"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = require("bignumber.js");
const accounts_1 = require("./accounts");
const routing_table_1 = require("./routing-table");
const rate_backend_1 = require("./rate-backend");
const config_1 = require("./config");
const IlpPacket = require("ilp-packet");
const log_1 = require("../common/log");
const log = log_1.create('route-builder');
const { InsufficientTimeoutError, InvalidPacketError, PeerUnreachableError, UnreachableError } = IlpPacket.Errors;
class RouteBuilder {
    constructor(deps) {
        this.accounts = deps(accounts_1.default);
        this.routingTable = deps(routing_table_1.default);
        this.backend = deps(rate_backend_1.default);
        this.config = deps(config_1.default);
        this.isTrivialRate =
            this.config.backend === 'one-to-one' &&
                this.config.spread === 0;
    }
    getNextHop(sourceAccount, destinationAccount) {
        const route = this.routingTable.resolve(destinationAccount);
        if (!route) {
            log.debug('no route found. destinationAccount=' + destinationAccount);
            throw new UnreachableError('no route found. source=' + sourceAccount + ' destination=' + destinationAccount);
        }
        if (!this.config.reflectPayments && sourceAccount === route.nextHop) {
            log.debug('refusing to route payments back to sender. sourceAccount=%s destinationAccount=%s', sourceAccount, destinationAccount);
            throw new UnreachableError('refusing to route payments back to sender. sourceAccount=' + sourceAccount + ' destinationAccount=' + destinationAccount);
        }
        return route.nextHop;
    }
    async getNextHopPacket(sourceAccount, sourcePacket) {
        const { amount, executionCondition, expiresAt, destination, data } = sourcePacket;
        log.trace('constructing next hop packet. sourceAccount=%s sourceAmount=%s destination=%s', sourceAccount, amount, destination);
        if (destination.length < 1) {
            throw new InvalidPacketError('missing destination.');
        }
        const nextHop = this.getNextHop(sourceAccount, destination);
        log.trace('determined next hop. nextHop=%s', nextHop);
        const rate = await this.backend.getRate(sourceAccount, nextHop);
        log.trace('determined local rate. rate=%s', rate);
        this._verifyPluginIsConnected(nextHop);
        const nextAmount = new bignumber_js_1.default(amount).times(rate).integerValue(bignumber_js_1.default.ROUND_FLOOR);
        return {
            nextHop,
            nextHopPacket: {
                amount: nextAmount.toString(),
                expiresAt: this._getDestinationExpiry(expiresAt),
                executionCondition,
                destination,
                data
            }
        };
    }
    _getDestinationExpiry(sourceExpiry) {
        if (!sourceExpiry) {
            throw new TypeError('source expiry must be a Date');
        }
        const sourceExpiryTime = sourceExpiry.getTime();
        if (sourceExpiryTime < Date.now()) {
            throw new InsufficientTimeoutError('source transfer has already expired. sourceExpiry=' + sourceExpiry.toISOString() + ' currentTime=' + (new Date().toISOString()));
        }
        const destinationExpiryTime = Math.min(sourceExpiryTime - this.config.minMessageWindow, Date.now() + this.config.maxHoldTime);
        if ((destinationExpiryTime - Date.now()) < this.config.minMessageWindow) {
            throw new InsufficientTimeoutError('source transfer expires too soon to complete payment. actualSourceExpiry=' + sourceExpiry.toISOString() + ' requiredSourceExpiry=' + (new Date(Date.now() + 2 * this.config.minMessageWindow).toISOString()) + ' currentTime=' + (new Date().toISOString()));
        }
        return new Date(destinationExpiryTime);
    }
    _verifyPluginIsConnected(account) {
        if (!this.accounts.getPlugin(account).isConnected()) {
            throw new PeerUnreachableError('no connection to account. account=' + account);
        }
    }
}
exports.default = RouteBuilder;
//# sourceMappingURL=route-builder.js.map