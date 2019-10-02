"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const ilp_packet_1 = require("ilp-packet");
const log_1 = require("../common/log");
const log = log_1.create('route-broadcaster');
const lodash_1 = require("lodash");
const routing_table_1 = require("./routing-table");
const forwarding_routing_table_1 = require("./forwarding-routing-table");
const accounts_1 = require("./accounts");
const config_1 = require("./config");
const peer_1 = require("../routing/peer");
const dragon_1 = require("../routing/dragon");
const relation_1 = require("../routing/relation");
const utils_1 = require("../routing/utils");
const utils_2 = require("../lib/utils");
const { BadRequestError } = ilp_packet_1.Errors;
class RouteBroadcaster {
    constructor(deps) {
        this.untrackCallbacks = new Map();
        this.getAccountRelation = (accountId) => {
            return accountId ? this.accounts.getInfo(accountId).relation : 'local';
        };
        this.deps = deps;
        this.localRoutingTable = deps(routing_table_1.default);
        this.forwardingRoutingTable = deps(forwarding_routing_table_1.default);
        this.accounts = deps(accounts_1.default);
        this.config = deps(config_1.default);
        if (this.config.routingSecret) {
            log.info('loaded routing secret from config.');
            this.routingSecret = Buffer.from(this.config.routingSecret, 'base64');
        }
        else {
            log.info('generated random routing secret.');
            this.routingSecret = crypto_1.randomBytes(32);
        }
        this.peers = new Map();
        this.localRoutes = new Map();
    }
    start() {
        this.reloadLocalRoutes();
        for (const accountId of this.accounts.getAccountIds()) {
            this.track(accountId);
        }
    }
    stop() {
        for (const accountId of this.peers.keys()) {
            this.remove(accountId);
        }
    }
    track(accountId) {
        if (this.untrackCallbacks.has(accountId)) {
            return;
        }
        const plugin = this.accounts.getPlugin(accountId);
        const connectHandler = () => {
            if (!plugin.isConnected()) {
                log.error('(!!!) plugin emitted connect, but then returned false for isConnected, broken plugin. account=%s', accountId);
                setImmediate(() => this.add(accountId));
            }
            else {
                this.add(accountId);
            }
        };
        const disconnectHandler = () => {
            this.remove(accountId);
        };
        plugin.on('connect', connectHandler);
        plugin.on('disconnect', disconnectHandler);
        this.untrackCallbacks.set(accountId, () => {
            plugin.removeListener('connect', connectHandler);
            plugin.removeListener('disconnect', disconnectHandler);
        });
        this.add(accountId);
    }
    untrack(accountId) {
        this.remove(accountId);
        const callback = this.untrackCallbacks.get(accountId);
        if (callback) {
            callback();
        }
    }
    add(accountId) {
        const accountInfo = this.accounts.getInfo(accountId);
        let sendRoutes;
        if (typeof accountInfo.sendRoutes === 'boolean') {
            sendRoutes = accountInfo.sendRoutes;
        }
        else if (accountInfo.relation !== 'child') {
            sendRoutes = true;
        }
        else {
            sendRoutes = false;
        }
        let receiveRoutes;
        if (typeof accountInfo.receiveRoutes === 'boolean') {
            receiveRoutes = accountInfo.receiveRoutes;
        }
        else if (accountInfo.relation !== 'child') {
            receiveRoutes = true;
        }
        else {
            receiveRoutes = false;
        }
        if (!sendRoutes && !receiveRoutes) {
            log.warn('not sending/receiving routes for peer, set sendRoutes/receiveRoutes to override. accountId=%s', accountId);
            return;
        }
        const existingPeer = this.peers.get(accountId);
        if (existingPeer) {
            const receiver = existingPeer.getReceiver();
            if (receiver) {
                receiver.sendRouteControl();
            }
            else {
                log.warn('unable to send route control message, receiver object undefined. peer=%s', existingPeer);
            }
            return;
        }
        const plugin = this.accounts.getPlugin(accountId);
        if (plugin.isConnected()) {
            log.trace('add peer. accountId=%s sendRoutes=%s receiveRoutes=%s', accountId, sendRoutes, receiveRoutes);
            const peer = new peer_1.default({ deps: this.deps, accountId, sendRoutes, receiveRoutes });
            this.peers.set(accountId, peer);
            const receiver = peer.getReceiver();
            if (receiver) {
                receiver.sendRouteControl();
            }
            this.reloadLocalRoutes();
        }
    }
    remove(accountId) {
        const peer = this.peers.get(accountId);
        if (!peer) {
            return;
        }
        const sender = peer.getSender();
        const receiver = peer.getReceiver();
        log.trace('remove peer. peerId=' + accountId);
        if (sender) {
            sender.stop();
        }
        this.peers.delete(accountId);
        if (receiver) {
            for (let prefix of receiver.getPrefixes()) {
                this.updatePrefix(prefix);
            }
        }
        if (this.getAccountRelation(accountId) === 'child') {
            this.updatePrefix(this.accounts.getChildAddress(accountId));
        }
    }
    handleRouteControl(sourceAccount, routeControl) {
        const peer = this.peers.get(sourceAccount);
        if (!peer) {
            log.debug('received route control message from non-peer. sourceAccount=%s', sourceAccount);
            throw new BadRequestError('cannot process route control messages from non-peers.');
        }
        const sender = peer.getSender();
        if (!sender) {
            log.debug('received route control message from peer not authorized to receive routes from us (sendRoutes=false). sourceAccount=%s', sourceAccount);
            throw new BadRequestError('rejecting route control message, we are configured not to send routes to you.');
        }
        sender.handleRouteControl(routeControl);
    }
    handleRouteUpdate(sourceAccount, routeUpdate) {
        const peer = this.peers.get(sourceAccount);
        if (!peer) {
            log.debug('received route update from non-peer. sourceAccount=%s', sourceAccount);
            throw new BadRequestError('cannot process route update messages from non-peers.');
        }
        const receiver = peer.getReceiver();
        if (!receiver) {
            log.debug('received route update from peer not authorized to advertise routes to us (receiveRoutes=false). sourceAccount=%s', sourceAccount);
            throw new BadRequestError('rejecting route update, we are configured not to receive routes from you.');
        }
        routeUpdate.newRoutes = routeUpdate.newRoutes
            .filter(route => route.prefix.startsWith(this.getGlobalPrefix()) &&
            route.prefix.length > this.getGlobalPrefix().length)
            .filter(route => !route.path.includes(this.accounts.getOwnAddress()));
        const changedPrefixes = receiver.handleRouteUpdate(routeUpdate);
        let haveRoutesChanged;
        for (const prefix of changedPrefixes) {
            haveRoutesChanged = this.updatePrefix(prefix) || haveRoutesChanged;
        }
        if (haveRoutesChanged && this.config.routeBroadcastEnabled) {
            for (const peer of this.peers.values()) {
                const sender = peer.getSender();
                if (sender) {
                    sender.scheduleRouteUpdate();
                }
            }
        }
    }
    reloadLocalRoutes() {
        log.trace('reload local and configured routes.');
        this.localRoutes = new Map();
        const localAccounts = this.accounts.getAccountIds();
        const ownAddress = this.accounts.getOwnAddress();
        this.localRoutes.set(ownAddress, {
            nextHop: '',
            path: [],
            auth: utils_2.hmac(this.routingSecret, ownAddress)
        });
        let defaultRoute = this.config.defaultRoute;
        if (defaultRoute === 'auto') {
            defaultRoute = localAccounts.filter(id => this.accounts.getInfo(id).relation === 'parent')[0];
        }
        if (defaultRoute) {
            const globalPrefix = this.getGlobalPrefix();
            this.localRoutes.set(globalPrefix, {
                nextHop: defaultRoute,
                path: [],
                auth: utils_2.hmac(this.routingSecret, globalPrefix)
            });
        }
        for (let accountId of localAccounts) {
            if (this.getAccountRelation(accountId) === 'child') {
                const childAddress = this.accounts.getChildAddress(accountId);
                this.localRoutes.set(childAddress, {
                    nextHop: accountId,
                    path: [],
                    auth: utils_2.hmac(this.routingSecret, childAddress)
                });
            }
        }
        const localPrefixes = Array.from(this.localRoutes.keys());
        const configuredPrefixes = this.config.routes
            ? this.config.routes.map(r => r.targetPrefix)
            : [];
        for (let prefix of localPrefixes.concat(configuredPrefixes)) {
            this.updatePrefix(prefix);
        }
    }
    updatePrefix(prefix) {
        const newBest = this.getBestPeerForPrefix(prefix);
        return this.updateLocalRoute(prefix, newBest);
    }
    getBestPeerForPrefix(prefix) {
        const configuredRoute = lodash_1.find(this.config.routes, { targetPrefix: prefix });
        if (configuredRoute) {
            if (this.accounts.exists(configuredRoute.peerId)) {
                return {
                    nextHop: configuredRoute.peerId,
                    path: [],
                    auth: utils_2.hmac(this.routingSecret, prefix)
                };
            }
            else {
                log.warn('ignoring configured route, account does not exist. prefix=%s accountId=%s', configuredRoute.targetPrefix, configuredRoute.peerId);
            }
        }
        const localRoute = this.localRoutes.get(prefix);
        if (localRoute) {
            return localRoute;
        }
        const weight = (route) => {
            const relation = this.getAccountRelation(route.peer);
            return relation_1.getRelationPriority(relation);
        };
        const bestRoute = Array.from(this.peers.values())
            .map(peer => peer.getReceiver())
            .map(receiver => receiver && receiver.getPrefix(prefix))
            .filter((a) => !!a)
            .sort((a, b) => {
            if (!a && !b) {
                return 0;
            }
            else if (!a) {
                return 1;
            }
            else if (!b) {
                return -1;
            }
            const weightA = weight(a);
            const weightB = weight(b);
            if (weightA !== weightB) {
                return weightB - weightA;
            }
            const pathA = a.path.length;
            const pathB = b.path.length;
            if (pathA !== pathB) {
                return pathA - pathB;
            }
            if (a.peer > b.peer) {
                return 1;
            }
            else if (b.peer > a.peer) {
                return -1;
            }
            else {
                return 0;
            }
        })[0];
        return bestRoute && {
            nextHop: bestRoute.peer,
            path: bestRoute.path,
            auth: bestRoute.auth
        };
    }
    getGlobalPrefix() {
        switch (this.config.env) {
            case 'production':
                return 'g';
            case 'test':
                return 'test';
            default:
                throw new Error('invalid value for `env` config. env=' + this.config.env);
        }
    }
    getStatus() {
        return {
            routingTableId: this.forwardingRoutingTable.routingTableId,
            currentEpoch: this.forwardingRoutingTable.currentEpoch,
            localRoutingTable: utils_1.formatRoutingTableAsJson(this.localRoutingTable),
            forwardingRoutingTable: utils_1.formatForwardingRoutingTableAsJson(this.forwardingRoutingTable),
            routingLog: this.forwardingRoutingTable.log
                .filter(Boolean)
                .map(entry => (Object.assign({}, entry, { route: entry && entry.route && utils_1.formatRouteAsJson(entry.route) }))),
            peers: Array.from(this.peers.values()).reduce((acc, peer) => {
                const sender = peer.getSender();
                const receiver = peer.getReceiver();
                acc[peer.getAccountId()] = {
                    send: sender && sender.getStatus(),
                    receive: receiver && receiver.getStatus()
                };
                return acc;
            }, {})
        };
    }
    updateLocalRoute(prefix, route) {
        const currentBest = this.localRoutingTable.get(prefix);
        const currentNextHop = currentBest && currentBest.nextHop;
        const newNextHop = route && route.nextHop;
        if (newNextHop !== currentNextHop) {
            if (route) {
                log.trace('new best route for prefix. prefix=%s oldBest=%s newBest=%s', prefix, currentNextHop, newNextHop);
                this.localRoutingTable.insert(prefix, route);
            }
            else {
                log.trace('no more route available for prefix. prefix=%s', prefix);
                this.localRoutingTable.delete(prefix);
            }
            this.updateForwardingRoute(prefix, route);
            return true;
        }
        return false;
    }
    updateForwardingRoute(prefix, route) {
        if (route) {
            route = Object.assign({}, route, { path: [this.accounts.getOwnAddress(), ...route.path], auth: utils_2.sha256(route.auth) });
            if (!prefix.startsWith(this.getGlobalPrefix()) ||
                prefix === this.getGlobalPrefix() ||
                (prefix.startsWith(this.accounts.getOwnAddress() + '.') &&
                    route.path.length === 1) ||
                dragon_1.canDragonFilter(this.forwardingRoutingTable, this.getAccountRelation, prefix, route)) {
                route = undefined;
            }
        }
        const currentBest = this.forwardingRoutingTable.get(prefix);
        const currentNextHop = currentBest && currentBest.route && currentBest.route.nextHop;
        const newNextHop = route && route.nextHop;
        if (currentNextHop !== newNextHop) {
            const epoch = this.forwardingRoutingTable.currentEpoch++;
            const routeUpdate = {
                prefix,
                route,
                epoch
            };
            this.forwardingRoutingTable.insert(prefix, routeUpdate);
            log.trace('logging route update. update=%j', routeUpdate);
            if (currentBest) {
                this.forwardingRoutingTable.log[currentBest.epoch] = null;
            }
            this.forwardingRoutingTable.log[epoch] = routeUpdate;
            if (route) {
                const subPrefixes = this.forwardingRoutingTable.getKeysStartingWith(prefix);
                for (const subPrefix of subPrefixes) {
                    if (subPrefix === prefix)
                        continue;
                    const routeUpdate = this.forwardingRoutingTable.get(subPrefix);
                    if (!routeUpdate || !routeUpdate.route)
                        continue;
                    this.updateForwardingRoute(subPrefix, routeUpdate.route);
                }
            }
        }
    }
}
exports.default = RouteBroadcaster;
//# sourceMappingURL=route-broadcaster.js.map