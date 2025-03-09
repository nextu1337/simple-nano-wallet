// Type definitions
export interface NanoAccount {
    address: string;
    privateKey: string;
    publicKey: string;
}

export interface WalletConfig {
    rpcUrls: string | string[];
    workUrls: string | string[];
    wsUrl?: string;
    seed?: string;
    defaultRep?: string;
    autoReceive?: boolean;
    addressPrefix?: string;
    decimalPlaces?: number;
    customHeaders?: HeadersInit;
    subscribeAll?: boolean;
}

export interface PendingTransaction {
    hash: string;
    amount: string;
}

export interface ConfirmationMessage {
    topic: string;
    message: {
        block: {
            subtype: string;
            link_as_account: string;
        };
        hash: string;
        amount: string;
    };
}
