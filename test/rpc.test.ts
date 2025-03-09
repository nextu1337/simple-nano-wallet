import { RPC } from '../src/rpc';

describe('RPC Client', () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should try next URL on failure', async () => {
    const rpc = new RPC(
      ['http://fail1.com', 'https://rpc.nano.to/'],
      ['http://work1.com', 'https://rpc.nano.to/'],
      {}
    );

    mockFetch
      .mockRejectedValueOnce(new Error('Server down'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    const result = await rpc.account_info('nano_34aywqqfop7fcdy9a8xsxsysa68peb3dhmcnicegzbapwtnj63dq5t7groun');
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw after all URLs fail', async () => {
    const rpc = new RPC(['http://fail1.com'], ['http://work1.com'], {});
    mockFetch.mockRejectedValue(new Error('Server down'));

    await expect(rpc.account_info('nano_34aywqqfop7fcdy9a8xsxsysa68peb3dhmcnicegzbapwtnj63dq5t7groun'))
      .rejects
      .toThrow('All RPC servers failed');
  });

  it('should handle work generation', async () => {
    const rpc = new RPC([], ['https://rpc.nano.to'], {});
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ work: '123ABC' })
    });

    const work = await rpc.work_generate('ABCDEF');
    expect(work).toBe('123ABC');
  });
});