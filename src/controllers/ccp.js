"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const log = log_1.create('ccp');
const route_broadcaster_1 = require("../services/route-broadcaster");
const ilp_protocol_ccp_1 = require("ilp-protocol-ccp");
class CcpController {
    constructor(deps) {
        this.routeBroadcaster = deps(route_broadcaster_1.default);
    }
    async handle(data, sourceAccount, { parsedPacket }) {
        switch (parsedPacket.destination) {
            case ilp_protocol_ccp_1.CCP_CONTROL_DESTINATION:
                return this.handleRouteControl(data, sourceAccount);
            case ilp_protocol_ccp_1.CCP_UPDATE_DESTINATION:
                return this.handleRouteUpdate(data, sourceAccount);
            default:
                throw new Error('unrecognized ccp message. destination=' + parsedPacket.destination);
        }
    }
    async handleRouteControl(data, sourceAccount) {
        const routeControl = ilp_protocol_ccp_1.deserializeCcpRouteControlRequest(data);
        log.trace('received route control message. sender=%s, tableId=%s epoch=%s features=%s', sourceAccount, routeControl.lastKnownRoutingTableId, routeControl.lastKnownEpoch, routeControl.features.join(','));
        this.routeBroadcaster.handleRouteControl(sourceAccount, routeControl);
        return ilp_protocol_ccp_1.serializeCcpResponse();
    }
    async handleRouteUpdate(data, sourceAccount) {
        const routeUpdate = ilp_protocol_ccp_1.deserializeCcpRouteUpdateRequest(data);
        log.trace('received routes. sender=%s speaker=%s currentEpoch=%s fromEpoch=%s toEpoch=%s newRoutes=%s withdrawnRoutes=%s', sourceAccount, routeUpdate.speaker, routeUpdate.currentEpochIndex, routeUpdate.fromEpochIndex, routeUpdate.toEpochIndex, routeUpdate.newRoutes.length, routeUpdate.withdrawnRoutes.length);
        this.routeBroadcaster.handleRouteUpdate(sourceAccount, routeUpdate);
        return ilp_protocol_ccp_1.serializeCcpResponse();
    }
}
exports.default = CcpController;
//# sourceMappingURL=ccp.js.map