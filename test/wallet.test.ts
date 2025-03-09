import { Wallet } from '../src/wallet';
import { RPC } from '../src/rpc';
// import ReconnectingWebSocket from 'reconnecting-websocket';
import { block } from 'multi-nano-web';

jest.mock('./../src/rpc');
// jest.mock('reconnecting-websocket');
// jest.mock('multi-nano-web');

const mockRPC = RPC as jest.MockedClass<typeof RPC>;

describe('Wallet', () => {
  const config = {
    rpcUrls: 'https://rpc.nano.to/',
    workUrls: 'https://rpc.nano.to/',
    wsUrl: 'wss://www.blocklattice.io/ws'
  };

  beforeEach(() => {
    mockRPC.mockClear();
    (block.send as jest.Mock).mockClear();
  });

  it('should generate new wallet', () => {
    const wallet = new Wallet(config);
    const { seed, address } = wallet.generateWallet();
    
    expect(seed).toMatch(/^[0-9A-F]{64}$/);
    expect(address).toContain('nano_');
  });

  it('should generate accounts from seed', () => {
    const wallet = new Wallet({
      ...config,
      seed: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    });
    
    const accounts = wallet.generateAccounts(3);
    expect(accounts).toHaveLength(3);
    accounts.forEach(addr => expect(addr).toContain('nano_'));
  });

  it('should handle send transactions', async () => {
    const wallet = new Wallet(config);
    const mockInstance = mockRPC.mock.instances[0];
    
    (mockInstance.account_info as jest.Mock).mockResolvedValue({
      balance: '1000',
      representative: 'nano_1rm7exnpws53gjii1t57fjp8ya5nf3kq6sb31118cum6ejiqara1rwwzykki',
      frontier: 'FRONTIER_HASH'
    });
    (mockInstance.work_generate as jest.Mock).mockResolvedValue('WORK_HASH');
    (mockInstance.process as jest.Mock).mockResolvedValue({ hash: 'TX_HASH' });

    const account = wallet.generateAccounts(1);
    const txHash = await wallet.sendFunds({
      source: account[0],
      destination: 'nano_1rm7exnpws53gjii1t57fjp8ya5nf3kq6sb31118cum6ejiqara1rwwzykki',
      amount: '100'
    });

    expect(txHash).toBe('TX_HASH');
    expect(block.send).toHaveBeenCalled();
  });
});