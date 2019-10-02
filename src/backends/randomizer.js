"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = require("bignumber.js");
const log_1 = require("../common/log");
const log = log_1.create('randomizer-backend');
class RandomizerBackend {
    constructor(opts, api) {
        this.spread = opts.spread || 0;
        this.variation = opts.variation || 0.1;
        this.getInfo = api.getInfo;
        this.variation = Math.min(Math.abs(this.variation), 1);
        log.warn('(!!!) using the randomizer backend. variation=%s', this.variation);
    }
    async connect() {
    }
    async getRate(sourceAccount, destinationAccount) {
        const sourceInfo = this.getInfo(sourceAccount);
        const destinationInfo = this.getInfo(destinationAccount);
        if (!sourceInfo) {
            log.error('unable to fetch account info for source account. accountId=%s', sourceAccount);
            throw new Error('unable to fetch account info for source account. accountId=' + sourceAccount);
        }
        if (!destinationInfo) {
            log.error('unable to fetch account info for destination account. accountId=%s', destinationAccount);
            throw new Error('unable to fetch account info for destination account. accountId=' + destinationAccount);
        }
        const scaleDiff = destinationInfo.assetScale - sourceInfo.assetScale;
        const randomness = Math.max((0.5 - Math.random()) * this.variation * 2, -1).toFixed(5);
        const rate = new bignumber_js_1.default(1).plus(randomness).minus(this.spread).shiftedBy(scaleDiff).toPrecision(15);
        return Number(rate);
    }
    submitPayment() {
        return Promise.resolve();
    }
}
exports.default = RandomizerBackend;
//# sourceMappingURL=randomizer.js.map