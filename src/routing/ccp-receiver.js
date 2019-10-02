"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prefix_map_1 = require("./prefix-map");
const log_1 = require("../common/log");
const ilp_packet_1 = require("ilp-packet");
const ilp_protocol_ccp_1 = require("ilp-protocol-ccp");
const ROUTE_CONTROL_RETRY_INTERVAL = 30000;
class CcpReceiver {
    constructor({ plugin, accountId }) {
        this.expiry = 0;
        this.routingTableId = '00000000-0000-0000-0000-000000000000';
        this.epoch = 0;
        this.sendRouteControl = () => {
            if (!this.plugin.isConnected()) {
                this.log.debug('cannot send route control message, plugin not connected (yet).');
                return;
            }
            const routeControl = {
                mode: ilp_protocol_ccp_1.Mode.MODE_SYNC,
                lastKnownRoutingTableId: this.routingTableId,
                lastKnownEpoch: this.epoch,
                features: []
            };
            this.plugin.sendData(ilp_protocol_ccp_1.serializeCcpRouteControlRequest(routeControl))
                .then(data => {
                if (data[0] === ilp_packet_1.Type.TYPE_ILP_FULFILL) {
                    this.log.trace('successfully sent route control message.');
                }
                else if (data[0] === ilp_packet_1.Type.TYPE_ILP_REJECT) {
                    this.log.debug('route control message was rejected. rejection=%j', ilp_packet_1.deserializeIlpReject(data));
                    throw new Error('route control message rejected.');
                }
                else {
                    this.log.debug('unknown response packet type. type=' + data[0]);
                    throw new Error('route control message returned unknown response.');
                }
            })
                .catch((err) => {
                const errInfo = (err instanceof Object && err.stack) ? err.stack : err;
                this.log.debug('failed to set route control information on peer. error=%s', errInfo);
                const retryTimeout = setTimeout(this.sendRouteControl, ROUTE_CONTROL_RETRY_INTERVAL);
                retryTimeout.unref();
            });
        };
        this.plugin = plugin;
        this.log = log_1.create(`ccp-receiver[${accountId}]`);
        this.accountId = accountId;
        this.routes = new prefix_map_1.default();
    }
    bump(holdDownTime) {
        this.expiry = Math.max(Date.now() + holdDownTime, this.expiry);
    }
    getAccountId() {
        return this.accountId;
    }
    getExpiry() {
        return this.expiry;
    }
    getPrefixes() {
        return this.routes.keys();
    }
    getRoutingTableId() {
        return this.routingTableId;
    }
    getEpoch() {
        return this.epoch;
    }
    getStatus() {
        return {
            routingTableId: this.routingTableId,
            epoch: this.epoch
        };
    }
    handleRouteUpdate({ speaker, routingTableId, fromEpochIndex, toEpochIndex, holdDownTime, newRoutes, withdrawnRoutes }) {
        this.bump(holdDownTime);
        if (this.routingTableId !== routingTableId) {
            this.log.trace('saw new routing table. oldId=%s newId=%s', this.routingTableId, routingTableId);
            this.routingTableId = routingTableId;
            this.epoch = 0;
        }
        if (fromEpochIndex > this.epoch) {
            this.log.trace('gap in routing updates. expectedEpoch=%s actualFromEpoch=%s', this.epoch, fromEpochIndex);
            return [];
        }
        if (this.epoch > toEpochIndex) {
            this.log.trace('old routing update, ignoring. expectedEpoch=%s actualToEpoch=%s', this.epoch, toEpochIndex);
            return [];
        }
        if (newRoutes.length === 0 && withdrawnRoutes.length === 0) {
            this.log.trace('pure heartbeat. fromEpoch=%s toEpoch=%s', fromEpochIndex, toEpochIndex);
            this.epoch = toEpochIndex;
            return [];
        }
        const changedPrefixes = [];
        if (withdrawnRoutes.length > 0) {
            this.log.trace('informed of no longer reachable routes. count=%s routes=%s', withdrawnRoutes.length, withdrawnRoutes);
            for (const prefix of withdrawnRoutes) {
                if (this.deleteRoute(prefix)) {
                    changedPrefixes.push(prefix);
                }
            }
        }
        for (const route of newRoutes) {
            if (this.addRoute({
                peer: this.accountId,
                prefix: route.prefix,
                path: route.path,
                auth: route.auth
            })) {
                changedPrefixes.push(route.prefix);
            }
        }
        this.epoch = toEpochIndex;
        this.log.trace('applied route update. changedPrefixesCount=%s fromEpoch=%s toEpoch=%s', changedPrefixes.length, fromEpochIndex, toEpochIndex);
        return changedPrefixes;
    }
    getPrefix(prefix) {
        return this.routes.get(prefix);
    }
    addRoute(route) {
        this.routes.insert(route.prefix, route);
        return true;
    }
    deleteRoute(prefix) {
        this.routes.delete(prefix);
        return true;
    }
}
exports.default = CcpReceiver;
//# sourceMappingURL=ccp-receiver.js.map