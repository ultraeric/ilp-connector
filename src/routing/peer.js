"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const accounts_1 = require("../services/accounts");
const config_1 = require("../services/config");
const forwarding_routing_table_1 = require("../services/forwarding-routing-table");
const ccp_sender_1 = require("./ccp-sender");
const ccp_receiver_1 = require("./ccp-receiver");
class Peer {
    constructor({ deps, accountId, sendRoutes, receiveRoutes }) {
        this.getAccountRelation = (accountId) => {
            return accountId ? this.accounts.getInfo(accountId).relation : 'local';
        };
        this.config = deps(config_1.default);
        this.accounts = deps(accounts_1.default);
        this.accountId = accountId;
        const plugin = this.accounts.getPlugin(accountId);
        const forwardingRoutingTable = deps(forwarding_routing_table_1.default);
        if (sendRoutes) {
            this.ccpSender = new ccp_sender_1.default({
                accountId,
                plugin,
                forwardingRoutingTable,
                getOwnAddress: () => this.accounts.getOwnAddress(),
                getAccountRelation: this.getAccountRelation,
                routeExpiry: this.config.routeExpiry,
                routeBroadcastInterval: this.config.routeBroadcastInterval
            });
        }
        if (receiveRoutes) {
            this.ccpReceiver = new ccp_receiver_1.default({ accountId, plugin });
        }
    }
    getAccountId() {
        return this.accountId;
    }
    getReceiver() {
        return this.ccpReceiver;
    }
    getSender() {
        return this.ccpSender;
    }
}
exports.default = Peer;
//# sourceMappingURL=peer.js.map