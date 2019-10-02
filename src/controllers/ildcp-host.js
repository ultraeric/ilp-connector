"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const accounts_1 = require("../services/accounts");
const log_1 = require("../common/log");
const ILDCP = require("ilp-protocol-ildcp");
const log = log_1.create('ildcp-host');
class IldcpHostController {
    constructor(deps) {
        this.accounts = deps(accounts_1.default);
    }
    async handle(data, sourceAccount) {
        const clientAddress = this.accounts.getChildAddress(sourceAccount);
        const info = this.accounts.getInfo(sourceAccount);
        log.trace('responding to ILDCP config request. clientAddress=%s', clientAddress);
        return ILDCP.serve({
            requestPacket: data,
            handler: () => Promise.resolve({
                clientAddress,
                assetScale: info.assetScale,
                assetCode: info.assetCode
            }),
            serverAddress: this.accounts.getOwnAddress()
        });
    }
}
exports.default = IldcpHostController;
//# sourceMappingURL=ildcp-host.js.map