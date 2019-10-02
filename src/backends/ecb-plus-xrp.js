"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = require("node-fetch");
const ecb_1 = require("./ecb");
const log_1 = require("../common/log");
const log = log_1.create('ecb-plus-xrp');
const CHARTS_API = 'https://data.ripple.com/v2/exchange_rates/EUR+rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq/XRP';
class ECBAndXRPBackend extends ecb_1.default {
    async connect() {
        await super.connect();
        if (!this.rates.XRP) {
            this.rates.XRP = await this._getXRPRate();
        }
        this.currencies.push('XRP');
        this.currencies.sort();
    }
    async _getXRPRate() {
        const rateRes = await node_fetch_1.default(CHARTS_API);
        if (rateRes.status !== 200) {
            throw new Error('unexpected HTTP status code from Ripple Data API. status=' + rateRes.status);
        }
        const body = await rateRes.json();
        const rate = Number(body.rate).toFixed(5);
        log.trace('loaded EUR/XRP rate. rate=%s', rate);
        return Number(rate);
    }
}
exports.default = ECBAndXRPBackend;
//# sourceMappingURL=ecb-plus-xrp.js.map