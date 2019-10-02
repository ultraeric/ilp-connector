"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const ilp_protocol_ccp_1 = require("ilp-protocol-ccp");
const MINIMUM_UPDATE_INTERVAL = 150;
const MAX_EPOCHS_PER_UPDATE = 50;
class CcpSender {
    constructor({ accountId, plugin, forwardingRoutingTable, getOwnAddress, getAccountRelation, routeExpiry, routeBroadcastInterval }) {
        this.mode = ilp_protocol_ccp_1.Mode.MODE_IDLE;
        this.lastKnownEpoch = 0;
        this.lastUpdate = 0;
        this.scheduleRouteUpdate = () => {
            if (this.sendRouteUpdateTimer) {
                clearTimeout(this.sendRouteUpdateTimer);
                this.sendRouteUpdateTimer = undefined;
            }
            if (this.mode !== ilp_protocol_ccp_1.Mode.MODE_SYNC) {
                return;
            }
            const lastUpdate = this.lastUpdate;
            const nextEpoch = this.lastKnownEpoch;
            let delay;
            if (nextEpoch < this.forwardingRoutingTable.currentEpoch) {
                delay = 0;
            }
            else {
                delay = this.routeBroadcastInterval - (Date.now() - lastUpdate);
            }
            delay = Math.max(MINIMUM_UPDATE_INTERVAL, delay);
            this.log.trace('scheduling next route update. accountId=%s delay=%s currentEpoch=%s peerHasEpoch=%s', this.accountId, delay, this.forwardingRoutingTable.currentEpoch, this.lastKnownEpoch);
            this.sendRouteUpdateTimer = setTimeout(() => {
                this.sendSingleRouteUpdate()
                    .then(() => this.scheduleRouteUpdate())
                    .catch((err) => {
                    const errInfo = (err instanceof Object && err.stack) ? err.stack : err;
                    this.log.debug('failed to broadcast route information to peer. peer=%s error=%s', this.accountId, errInfo);
                });
            }, delay);
            this.sendRouteUpdateTimer.unref();
        };
        this.plugin = plugin;
        this.forwardingRoutingTable = forwardingRoutingTable;
        this.log = log_1.create(`ccp-sender[${accountId}]`);
        this.accountId = accountId;
        this.getOwnAddress = getOwnAddress;
        this.getAccountRelation = getAccountRelation;
        this.routeExpiry = routeExpiry;
        this.routeBroadcastInterval = routeBroadcastInterval;
    }
    stop() {
        if (this.sendRouteUpdateTimer) {
            clearTimeout(this.sendRouteUpdateTimer);
        }
    }
    getAccountId() {
        return this.accountId;
    }
    getLastUpdate() {
        return this.lastUpdate;
    }
    getLastKnownEpoch() {
        return this.lastKnownEpoch;
    }
    getMode() {
        return this.mode;
    }
    getStatus() {
        return {
            epoch: this.lastKnownEpoch,
            mode: ilp_protocol_ccp_1.ModeReverseMap[this.mode]
        };
    }
    handleRouteControl({ mode, lastKnownRoutingTableId, lastKnownEpoch, features }) {
        if (this.mode !== mode) {
            this.log.trace('peer requested changing routing mode. oldMode=%s newMode=%s', ilp_protocol_ccp_1.ModeReverseMap[this.mode], ilp_protocol_ccp_1.ModeReverseMap[mode]);
        }
        this.mode = mode;
        if (lastKnownRoutingTableId !== this.forwardingRoutingTable.routingTableId) {
            this.log.trace('peer has old routing table id, resetting lastKnownEpoch to zero. theirTableId=%s correctTableId=%s', lastKnownRoutingTableId, this.forwardingRoutingTable.routingTableId);
            this.lastKnownEpoch = 0;
        }
        else {
            this.log.trace('peer epoch set. epoch=%s currentEpoch=%s', this.accountId, lastKnownEpoch, this.forwardingRoutingTable.currentEpoch);
            this.lastKnownEpoch = lastKnownEpoch;
        }
        if (this.mode === ilp_protocol_ccp_1.Mode.MODE_SYNC) {
            this.scheduleRouteUpdate();
        }
        else {
            if (this.sendRouteUpdateTimer) {
                clearTimeout(this.sendRouteUpdateTimer);
                this.sendRouteUpdateTimer = undefined;
            }
        }
    }
    async sendSingleRouteUpdate() {
        this.lastUpdate = Date.now();
        if (!this.plugin.isConnected()) {
            this.log.debug('cannot send routes, plugin not connected (yet).');
            return;
        }
        const nextRequestedEpoch = this.lastKnownEpoch;
        const allUpdates = this.forwardingRoutingTable.log
            .slice(nextRequestedEpoch, nextRequestedEpoch + MAX_EPOCHS_PER_UPDATE);
        const toEpoch = nextRequestedEpoch + allUpdates.length;
        const relation = this.getAccountRelation(this.accountId);
        function isRouteUpdate(update) {
            return !!update;
        }
        const updates = allUpdates
            .filter(isRouteUpdate)
            .map((update) => {
            if (!update.route)
                return update;
            if (update.route.nextHop === this.accountId ||
                (relation === 'parent' &&
                    ['peer', 'parent'].indexOf(this.getAccountRelation(update.route.nextHop)) !== -1)) {
                return Object.assign({}, update, { route: undefined });
            }
            else {
                return update;
            }
        });
        const newRoutes = [];
        const withdrawnRoutes = [];
        for (const update of updates) {
            if (update.route) {
                newRoutes.push({
                    prefix: update.prefix,
                    nextHop: update.route.nextHop,
                    path: update.route.path,
                    auth: update.route.auth
                });
            }
            else {
                withdrawnRoutes.push({
                    prefix: update.prefix,
                    epoch: update.epoch
                });
            }
        }
        this.log.trace('broadcasting routes to peer. speaker=%s peer=%s fromEpoch=%s toEpoch=%s routeCount=%s unreachableCount=%s', this.getOwnAddress(), this.accountId, this.lastKnownEpoch, toEpoch, newRoutes.length, withdrawnRoutes.length);
        const routeUpdate = {
            speaker: this.getOwnAddress(),
            routingTableId: this.forwardingRoutingTable.routingTableId,
            holdDownTime: this.routeExpiry,
            currentEpochIndex: this.forwardingRoutingTable.currentEpoch,
            fromEpochIndex: this.lastKnownEpoch,
            toEpochIndex: toEpoch,
            newRoutes: newRoutes.map(r => (Object.assign({}, r, { nextHop: undefined, auth: r.auth, props: [] }))),
            withdrawnRoutes: withdrawnRoutes.map(r => r.prefix)
        };
        const previousNextRequestedEpoch = this.lastKnownEpoch;
        this.lastKnownEpoch = toEpoch;
        const timeout = this.routeBroadcastInterval;
        const timerPromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('route update timed out.')), timeout);
            timer.unref();
        });
        try {
            await Promise.race([
                this.plugin.sendData(ilp_protocol_ccp_1.serializeCcpRouteUpdateRequest(routeUpdate)),
                timerPromise
            ]);
        }
        catch (err) {
            this.lastKnownEpoch = previousNextRequestedEpoch;
            throw err;
        }
    }
}
exports.default = CcpSender;
//# sourceMappingURL=ccp-sender.js.map