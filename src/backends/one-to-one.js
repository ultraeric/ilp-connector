"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = require("bignumber.js");
const log_1 = require("../common/log");
const log = log_1.create('one-to-one-backend');
class OneToOneBackend {
    constructor(opts, api) {
        this.spread = opts.spread || 0;
        this.getInfo = api.getInfo;
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
        const rate = new bignumber_js_1.default(1).minus(this.spread).shiftedBy(scaleDiff).toPrecision(15);
        return Number(rate);
    }
    submitPayment() {
        return Promise.resolve();
    }
}
exports.default = OneToOneBackend;
//# sourceMappingURL=one-to-one.js.map