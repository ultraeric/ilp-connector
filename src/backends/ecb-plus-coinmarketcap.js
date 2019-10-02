"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = require("node-fetch");
const ecb_1 = require("./ecb");
const lodash_1 = require("lodash");
const COINMARKETCAP_API = 'https://api.coinmarketcap.com/v1/ticker/';
const ROUNDING_FACTOR = 100000000;
class ECBAndCoinMarketCapBackend extends ecb_1.default {
    async connect() {
        await super.connect();
        const ccRates = await this._getCCRates(this.rates.USD);
        Object.assign(this.rates, ccRates);
        this.currencies = this.currencies.concat(Object.keys(ccRates));
        this.currencies.sort();
    }
    async _getCCRates(usdRate) {
        const rateRes = await node_fetch_1.default(COINMARKETCAP_API);
        if (rateRes.status !== 200) {
            throw new Error('Unexpected status from coinmarketcap.com: ' + rateRes.status);
        }
        const body = await rateRes.json();
        return lodash_1.fromPairs(body.map((rateInfo) => {
            return [rateInfo.symbol, Math.floor(ROUNDING_FACTOR / (rateInfo.price_usd * usdRate)) / ROUNDING_FACTOR];
        }));
    }
}
exports.default = ECBAndCoinMarketCapBackend;
//# sourceMappingURL=ecb-plus-coinmarketcap.js.map