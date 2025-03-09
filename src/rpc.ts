interface RPCParams {
    action: string;
    [key: string]: any;
}

/**
 * RPC client for Nano node with fallback server support
 */
class RPC {
    private rpcURLs: string[];
    private workURLs: string[];
    private customHeaders: HeadersInit;

    constructor(
        rpcURL: string | string[],
        workURL: string | string[],
        customHeaders: HeadersInit = {}
    ) {
        this.rpcURLs = Array.isArray(rpcURL) ? rpcURL : [rpcURL];
        this.workURLs = Array.isArray(workURL) ? workURL : [workURL];
        this.customHeaders = customHeaders;
    }

    async account_info(account: string): Promise<any> {
        const params: RPCParams = {
            action: "account_info",
            account,
            representative: "true"
        };
        return await this.execute(params);
    }

    async work_generate(hash: string): Promise<string> {
        const params: RPCParams = {
            action: "work_generate",
            hash
        };

        const r = await this.execute(params);
        if (r.work === undefined) {
            throw new Error(`Work generation failed: ${JSON.stringify(r)}`);
        }
        return r.work;
    }

    async receivable(account: string): Promise<any> {
        const params: RPCParams = {
            action: "pending",
            account,
            threshold: "1"
        };
        const r = await this.execute(params);
        return r.blocks;
    }

    async process(block: any, subtype: string): Promise<any> {
        const params: RPCParams = {
            action: "process",
            json_block: "true",
            subtype,
            block
        };
        return await this.execute(params);
    }

    private async execute(params: RPCParams): Promise<any> {
        const isWorkRequest = params.action === "work_generate";
        const urls = isWorkRequest ? this.workURLs : this.rpcURLs;
        let lastError: Error | null = null;

        for (const url of urls) {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: this.customHeaders,
                    body: JSON.stringify(params)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                // Immediately return if we get a successful response
                return data;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`Request to ${url} failed: ${lastError.message}`);
                // Continue to next URL on error
            }
        }

        throw new Error(
            `All ${isWorkRequest ? "work" : "RPC"} servers failed. ` +
            `Last error: ${lastError?.message || "Unknown error"}`
        );
    }
}

export { RPC };