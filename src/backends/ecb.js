"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = require("node-fetch");
const sax = require("sax");
const bignumber_js_1 = require("bignumber.js");
const log_1 = require("../common/log");
const log = log_1.create('ecb');
const RATES_API = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
class ECBBackend {
    constructor(opts, api) {
        this.spread = opts.spread || 0;
        this.ratesApiUrl = opts.ratesApiUrl || RATES_API;
        this.mockData = opts.mockData;
        this.getInfo = api.getInfo;
        this.rates = {};
        this.currencies = [];
    }
    async connect() {
        let apiData;
        if (this.mockData) {
            log.info('connect using mock data.');
            apiData = this.mockData;
        }
        else {
            log.info('connect. uri=' + this.ratesApiUrl);
            let result = await node_fetch_1.default(this.ratesApiUrl);
            apiData = await parseXMLResponse(await result.text());
        }
        this.rates = apiData.rates;
        this.rates[apiData.base] = 1;
        this.currencies = Object.keys(this.rates);
        this.currencies.sort();
        log.info('data loaded. numCurrencies=' + this.currencies.length);
    }
    _formatAmount(amount) {
        return new bignumber_js_1.default(amount).toFixed(2);
    }
    _formatAmountCeil(amount) {
        return new bignumber_js_1.default(amount).decimalPlaces(2, bignumber_js_1.default.ROUND_CEIL).toFixed(2);
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
        const sourceCurrency = sourceInfo.assetCode;
        const destinationCurrency = destinationInfo.assetCode;
        const sourceRate = this.rates[sourceCurrency];
        const destinationRate = this.rates[destinationCurrency];
        if (!sourceRate) {
            log.error('no rate available for source currency. currency=%s', sourceCurrency);
            throw new Error('no rate available. currency=' + sourceCurrency);
        }
        if (!destinationRate) {
            log.error('no rate available for destination currency. currency=%s', destinationCurrency);
            throw new Error('no rate available. currency=' + destinationCurrency);
        }
        const rate = new bignumber_js_1.default(destinationRate).shiftedBy(destinationInfo.assetScale)
            .div(new bignumber_js_1.default(sourceRate).shiftedBy(sourceInfo.assetScale))
            .times(new bignumber_js_1.default(1).minus(this.spread))
            .toPrecision(15);
        log.trace('quoted rate. from=%s to=%s fromCur=%s toCur=%s rate=%s spread=%s', sourceAccount, destinationAccount, sourceCurrency, destinationCurrency, rate, this.spread);
        return Number(rate);
    }
    async submitPayment() {
        return Promise.resolve(undefined);
    }
}
exports.default = ECBBackend;
function parseXMLResponse(data) {
    const parser = sax.parser(true, {});
    const apiData = { base: 'EUR', rates: {} };
    parser.onopentag = (node) => {
        if (node.name === 'Cube' && node.attributes.time) {
            apiData.date = node.attributes.time;
        }
        if (node.name === 'Cube' && node.attributes.currency && node.attributes.rate) {
            apiData.rates[node.attributes.currency] = node.attributes.rate;
        }
    };
    return new Promise((resolve, reject) => {
        parser.onerror = reject;
        parser.onend = () => resolve(apiData);
        parser.write(data).close();
    });
}
//# sourceMappingURL=ecb.js.map