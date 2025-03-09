export const wallet = {
    generateLegacy: () => ({
      seed: 'TEST_SEED',
      accounts: [{ address: 'nano_123' }]
    }),
    legacyAccounts: (seed: string, start: number, end: number) => 
      Array(end - start).fill(null).map((_, i) => ({
        address: `nano_${i}`,
        privateKey: `priv_${i}`,
        publicKey: `pub_${i}`
      }))
  };
  
  export const block = {
    send: jest.fn().mockReturnValue({}),
    receive: jest.fn().mockReturnValue({})
  };