"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const accounts_1 = require("./accounts");
const utils_1 = require("../lib/utils");
const DEFAULT_BACKEND = 'one-to-one';
class RateBackend {
    constructor(deps) {
        const config = deps(config_1.default);
        this.accounts = deps(accounts_1.default);
        const Backend = utils_1.loadModuleOfType('backend', config.backend || DEFAULT_BACKEND);
        this.backend = new Backend(Object.assign({
            spread: config.spread
        }, config.backendConfig), {
            getInfo: (account) => this.accounts.getInfo(account),
            accounts: this.accounts
        });
    }
    connect() {
        return this.backend.connect();
    }
    getRate(sourceAccount, destinationAccount) {
        return this.backend.getRate(sourceAccount, destinationAccount);
    }
    submitPayment(params) {
        return this.backend.submitPayment(params);
    }
    submitPacket(params) {
        if (this.backend.submitPacket) {
            return this.backend.submitPacket(params);
        }
        return Promise.resolve();
    }
    async getStatus() {
        const rates = {};
        const accountIds = this.accounts.getAccountIds();
        for (const srcAccount of accountIds) {
            const accountRates = rates[srcAccount] = {};
            for (const dstAccount of accountIds) {
                if (srcAccount === dstAccount)
                    continue;
                accountRates[dstAccount] = await this.backend.getRate(srcAccount, dstAccount);
            }
        }
        return rates;
    }
}
exports.default = RateBackend;
//# sourceMappingURL=rate-backend.js.map