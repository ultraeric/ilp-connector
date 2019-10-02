"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IlpPacket = require("ilp-packet");
const config_1 = require("../services/config");
const accounts_1 = require("../services/accounts");
const route_broadcaster_1 = require("../services/route-broadcaster");
const route_builder_1 = require("../services/route-builder");
const ilp_prepare_1 = require("../controllers/ilp-prepare");
const log_1 = require("../common/log");
const log = log_1.create('core-middleware');
const { InvalidPacketError } = IlpPacket.Errors;
class Core {
    constructor(deps) {
        this.config = deps(config_1.default);
        this.accounts = deps(accounts_1.default);
        this.routeBroadcaster = deps(route_broadcaster_1.default);
        this.routeBuilder = deps(route_builder_1.default);
        this.ilpPrepareController = deps(ilp_prepare_1.default);
    }
    async processData(data, accountId, outbound) {
        if (!this.accounts.getInfo(accountId)) {
            log.warn('got data from unknown account id. accountId=%s', accountId);
            throw new Error('got data from unknown account id. accountId=' + accountId);
        }
        if (!Buffer.isBuffer(data)) {
            log.error('data handler was passed a non-buffer. typeof=%s data=%s', typeof data, data);
            throw new Error('data handler was passed a non-buffer. typeof=' + typeof data);
        }
        switch (data[0]) {
            case IlpPacket.Type.TYPE_ILP_PREPARE:
                return this.ilpPrepareController.sendData(data, accountId, outbound);
            default:
                log.error('received invalid packet type. source=%s type=%s', accountId, data[0]);
                throw new InvalidPacketError('invalid packet type received. type=' + data[0]);
        }
    }
}
exports.default = Core;
//# sourceMappingURL=core.js.map