import BigNumber from 'bignumber.js';

interface ToolsConfig {
    decimalPlaces: number;
}

class Tools {
    constructor(
        private readonly config: ToolsConfig
    ) {}

    get decimal(): number {
        return this.config.decimalPlaces;
    }

    /**
     * Convert NANO/XDG/BAN to RAW
     * @param amount Amount in NANO/XDG/BAN (mega) to convert to RAW
     * @returns RAW amount
     */
    megaToRaw(amount: number) {
        const value = new BigNumber(amount.toString());
        return value.shiftedBy(this.decimal).toFixed(0);
    };

    /**
     * Convert RAW to NANO/XDG/BAN
     * @param amount Amount in RAW to convert to NANO/XDG/BAN (mega)
     * @returns NANO/XDG/BAN amount
     */
    rawToMega(amount: number) {
        const value = new BigNumber(amount.toString());
        return value.shiftedBy(-(this.decimal)).toFixed(this.decimal, 1);
    };
}

export { Tools }