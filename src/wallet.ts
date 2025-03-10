import AsyncLock from 'async-lock';
import { randomBytes } from 'crypto';
import ReconnectingWebSocket from 'reconnecting-websocket';
import WS from 'ws';

import { wallet as walletLib, block } from 'multi-nano-web';

import { RPC } from './rpc';
import {
    NanoAccount,
    WalletConfig,
    PendingTransaction,
    ConfirmationMessage,
} from './types';
import {
  AccountError,
  AccountNotFoundError,
  InvalidAddressError,
  InvalidAmountError,
  InvalidSeedError,
  MissingConfigurationError,
  TransactionFailedError,
  WebSocketMessageError,
} from './errors';
import { Tools } from './tools';

const lock = new AsyncLock({ maxPending: 1000 });

class Wallet {
    private accountMap = new Map<string, NanoAccount>();
    private processedTransactionHashes = new Map<string, Date>(); // In memory cache for processed transaction hashes

    private lastIndex = 0;
    private readonly rpc: RPC;
    private websocket?: ReconnectingWebSocket;
    private activeSubscriptions = new Set<string>();
    private toolsInstance: Tools;

    constructor(
        private readonly config: WalletConfig
    ) {
        this.validateConfig();
        
        this.rpc = new RPC(
            config.rpcUrls,
            config.workUrls,
            config.customHeaders
        );

        this.toolsInstance = new Tools({
            decimalPlaces: this.config.decimalPlaces ?? 30
        });

        this.initializeWebSocket();
    }

    // Aliases
    public send = this.sendFunds;
    public receive = this.receiveFunds;

    //#region Getters
    /**
     * Get the list of accounts addresses in the wallet
     */
    get accounts(): string[] {
        return Array.from(this.accountMap.keys());
    }

    /**
     * Get the map of accounts with their public and private keys, indexed by address
     */
    get accountsWithKeys(): Map<string, NanoAccount> {
        return this.accountMap;
    }

    /**
     * Get the tools instance for this wallet, providing utility functions for working with Nano amounts
     */
    get tools(): Tools {
        return this.toolsInstance;
    }
    //#endregion
    //#region Initialization
    private validateConfig(): void {
        if (!this.config.rpcUrls || !this.config.workUrls) {
            throw new MissingConfigurationError('rpcUrls and workUrls');
        }

        if (this.config.seed && !/^[0-9A-F]{64}$/i.test(this.config.seed)) {
            throw new InvalidSeedError();
        }
    }

    private initializeWebSocket(): void {
        if (!this.config.wsUrl) return;

        if(this.config.autoReceive === undefined) this.config.autoReceive = true;

        this.websocket = new ReconnectingWebSocket(this.config.wsUrl, [], {
            WebSocket: WS,
            maxRetries: 10,
            maxReconnectionDelay: 10000,
            minReconnectionDelay: 1000
        });

        this.setupWebSocketHandlers();
    }

    private setupWebSocketHandlers(): void {
        this.websocket?.addEventListener('open', () => {
            this.resubscribeAccounts();
        });

        this.websocket?.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
        });

        this.websocket?.addEventListener('message', (event) => {
            this.removeOldProcessedTransactions();

            try {
                const message = this.parseWebSocketMessage(event.data);
                this.handleAutoReceive(message);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        });
    }
    //#endregion

    //#region Account Management
    /**
     * Initialize the wallet with a specific seed
     * @returns A new wallet with a random seed and a single account
     */
    generateWallet(): { seed: string; address: string } {
        const seed = randomBytes(32).toString('hex').toUpperCase();
        return this.initializeWallet(seed);
    }

    private initializeWallet(seed: string): { seed: string; address: string } {
        this.lastIndex = 0;
        this.accountMap.clear();
        
        this.config.seed = seed;

        const addresses = this.generateAccounts(1);
        return { seed, address: addresses[0] };
    }

    /**
     * Generate a number of new accounts from the wallet seed
     * @param count Amount of accounts to generate
     * @returns List of generated account addresses
     */
    generateAccounts(count: number): string[] {
        if (!this.config.seed) throw new MissingConfigurationError('Wallet not initialized');
        if (count <= 0 || count > 100) throw new AccountError('Invalid account count');

        const newAccounts = walletLib.legacyAccounts(this.config.seed, this.lastIndex, this.lastIndex + count)
            .map(acc => this.formatAccount(acc));

        this.lastIndex += count;
        newAccounts.forEach(acc => this.accountMap.set(acc.address, acc));
        
        this.subscribeToAccounts(newAccounts.map(acc => acc.address));
        return newAccounts.map(acc => acc.address);
    }

    private formatAccount(account: any): NanoAccount {
        return {
            ...account,
            address: account.address.replace('nano_', this.config.addressPrefix || 'nano_')
        };
    }
    //#endregion

    //#region Transaction Handling
    /**
     * Send funds from one account to another
     * @param params Source, destination and RAW amount of the transaction
     * @returns Transaction hash if successful
     * @throws AccountError if the source or destination address is invalid
     * @throws TransactionFailedError if the transaction fails
     */
    async sendFunds(params: { 
        source: string; 
        destination: string; 
        amount: string 
    }): Promise<string> {
        this.validateAddress(params.source);
        this.validateAddress(params.destination);
        this.validateRawAmount(params.amount);

        return lock.acquire(params.source, async () => {
            const accountInfo = await this.rpc.account_info(params.source);
            if (accountInfo.error) throw new AccountError(accountInfo.error);

            const blockData = {
                walletBalanceRaw: accountInfo.balance,
                fromAddress: params.source,
                toAddress: params.destination,
                representativeAddress: accountInfo.representative,
                frontier: accountInfo.frontier,
                amountRaw: params.amount,
                work: await this.rpc.work_generate(accountInfo.frontier),
            };

            const privateKey = this.getPrivateKey(params.source);
            const signedBlock = block.send(blockData, privateKey);
            const result = await this.rpc.process(signedBlock, 'send');
            
            if (result.hash) return result.hash;
            throw new TransactionFailedError(JSON.stringify(result));
        });
    }

    /**
     * Receive receivable funds for an account
     * @param account Account address to receive funds for
     * @param transaction Receivable transaction to receive (amount in RAW)
     * @returns Transaction hash if successful
     * @throws AccountError if the account address is invalid
     * @throws TransactionFailedError if the transaction fails
     */
    async receiveFunds(account: string, transaction: PendingTransaction): Promise<string> {
        this.validateAddress(account);

        return lock.acquire(account, async () => {
            const accountInfo = await this.rpc.account_info(account);
            const isNewAccount = !!accountInfo.error;

            const blockData = await this.prepareReceiveBlock(account, transaction, accountInfo, isNewAccount);

            // console.log('Receive block data:', blockData);
            const privateKey = this.getPrivateKey(account);
            const signedBlock = block.receive(blockData, privateKey);
            const result = await this.rpc.process(signedBlock, 'receive');

            // console.log('Receive result:', result);
            if (result.hash) return result.hash;
            throw new TransactionFailedError(JSON.stringify(result));
        });
    }
    //#endregion

    //#region Security Utilities
    private validateAddress(address: string): void {
        if (!address.startsWith(this.config.addressPrefix || 'nano_')) {
            throw new InvalidAddressError(address);
        }
    }

    private validateRawAmount(amount: string): void {
        if (!/^\d+$/.test(amount)) {
            throw new InvalidAmountError(amount);
        }
    }

    private getPrivateKey(address: string): string {
        const account = this.accountMap.get(address);
        if (!account) throw new AccountNotFoundError(address);
        return account.privateKey;
    }
    //#endregion

    //#region WebSocket Handling
    private removeOldProcessedTransactions(): void {
        const now = new Date();
        this.processedTransactionHashes.forEach((timestamp, hash) => {
            if (now.getTime() - timestamp.getTime() > 60000) {
                this.processedTransactionHashes.delete(hash);
            }
        });
    }

    private parseWebSocketMessage(data: string): ConfirmationMessage {
        try {
            return JSON.parse(data);
        } catch (error) {
            throw new WebSocketMessageError();
        }
    }

    private async handleAutoReceive(message: ConfirmationMessage): Promise<void> {
        // console.log('Handling auto-receive:', message);
        if (!this.config.autoReceive || message.topic !== 'confirmation') return;
        if (message.message.block.subtype !== 'send') return;

        if (this.processedTransactionHashes.has(message.message.hash)) return; // Skip if already processed
        this.processedTransactionHashes.set(message.message.hash, new Date()); // Add to cache ASAP to prevent duplicate processing

        const account = this.accountMap.get(message.message.block.link_as_account);
        if (!account) return;

        try {
            // console.log(`Auto-receiving funds for ${account.address}`);
            await this.receiveFunds(account.address, {
                hash: message.message.hash,
                amount: message.message.amount
            });
        } catch (error) {
            console.error(`Auto-receive failed for ${account.address}:`, error);
        }
    }

    private subscribeToAccounts(accounts: string[]): void {
        if (!this.config.wsUrl) return;

        accounts.forEach(account => this.activeSubscriptions.add(account));
        this.resubscribeAccounts();
    }

    private resubscribeAccounts(): void {
        if (!this.websocket || this.websocket.readyState !== WS.OPEN) return;
        // console.log('Resubscribing to accounts:', this.activeSubscriptions);

        const subscription = {
            action: 'subscribe',
            topic: 'confirmation',
            ack: true,
            options: {
                accounts: Array.from(this.activeSubscriptions)
            }
        };

        this.websocket.send(JSON.stringify(subscription));
    }
    //#endregion
    //#region Block Preparation
    private async prepareReceiveBlock(
        account: string,
        transaction: PendingTransaction,
        accountInfo: any,
        isNewAccount: boolean
    ): Promise<any> {
        const baseData = {
            toAddress: account,
            transactionHash: transaction.hash,
            amountRaw: transaction.amount,
            work: undefined as string | undefined
        };
    
        if (isNewAccount) {
            if (!this.config.defaultRep) {
                throw new MissingConfigurationError('defaultRep');
            }
    
            const nanoAccount = this.accountMap.get(account);
            if (!nanoAccount) {
                throw new AccountNotFoundError(account);
            }

            return {
                ...baseData,
                walletBalanceRaw: '0',
                representativeAddress: this.config.defaultRep,
                frontier: '0'.repeat(64),
                work: await this.rpc.work_generate(nanoAccount.publicKey)
            };
        }
    
        return {
            ...baseData,
            walletBalanceRaw: accountInfo.balance,
            representativeAddress: accountInfo.representative,
            frontier: accountInfo.frontier,
            work: await this.rpc.work_generate(accountInfo.frontier)
        };
    }
    //#endregion
    //#region Cleanup
    /**
     * Shutdown the wallet, closing the WebSocket connection and clearing all account data
     */
    shutdown(): void {
        this.websocket?.close();
        this.accountMap.clear();
        this.activeSubscriptions.clear();
    }
    //#endregion
}

export { Wallet };