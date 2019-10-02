"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IlpPacket = require("ilp-packet");
const log_1 = require("../common/log");
const log = log_1.create('ilp-prepare');
const accounts_1 = require("../services/accounts");
const route_builder_1 = require("../services/route-builder");
const rate_backend_1 = require("../services/rate-backend");
const peer_protocol_1 = require("../controllers/peer-protocol");
const echo_1 = require("../controllers/echo");
let asyncMsgHandler = require('../reputation/mh').asyncMsgHandler;
const PEER_PROTOCOL_PREFIX = 'peer.';
class IlpPrepareController {
    constructor(deps) {
        this.accounts = deps(accounts_1.default);
        this.routeBuilder = deps(route_builder_1.default);
        this.backend = deps(rate_backend_1.default);
        this.peerProtocolController = deps(peer_protocol_1.default);
        this.echoController = deps(echo_1.default);
    }
    async sendData(packet, sourceAccount, outbound) {
        const parsedPacket = IlpPacket.deserializeIlpPrepare(packet);
        const { amount, executionCondition, destination, expiresAt } = parsedPacket;
        let remaining = async () => {
            log.trace('handling ilp prepare. sourceAccount=%s destination=%s amount=%s condition=%s expiry=%s packet=%s', sourceAccount, destination, amount, executionCondition.toString('base64'), expiresAt.toISOString(), packet.toString('base64'));
            if (destination.startsWith(PEER_PROTOCOL_PREFIX)) {
                return this.peerProtocolController.handle(packet, sourceAccount, { parsedPacket });
            }
            else if (destination === this.accounts.getOwnAddress()) {
                return this.echoController.handle(packet, sourceAccount, { parsedPacket, outbound });
            }
            const { nextHop, nextHopPacket } = await this.routeBuilder.getNextHopPacket(sourceAccount, parsedPacket);
            log.trace('sending outbound ilp prepare. destination=%s amount=%s', destination, nextHopPacket.amount);
            const result = await outbound(IlpPacket.serializeIlpPrepare(nextHopPacket), nextHop);
            this.backend.submitPacket({
                sourceAccount: sourceAccount,
                sourceAmount: amount,
                destinationAccount: nextHop,
                destinationAmount: nextHopPacket.amount,
                parsedPacket,
                result
            }).catch(err => {
                const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : String(err);
                log.error('error while submitting packet to backend. error=%s', errInfo);
            });
            if (result[0] === IlpPacket.Type.TYPE_ILP_FULFILL) {
                log.trace('got fulfillment. cond=%s nextHop=%s amount=%s', executionCondition.slice(0, 6).toString('base64'), nextHop, nextHopPacket.amount);
                this.backend.submitPayment({
                    sourceAccount: sourceAccount,
                    sourceAmount: amount,
                    destinationAccount: nextHop,
                    destinationAmount: nextHopPacket.amount
                })
                    .catch(err => {
                    const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : String(err);
                    log.error('error while submitting payment to backend. error=%s', errInfo);
                });
            }
            else if (result[0] === IlpPacket.Type.TYPE_ILP_REJECT) {
                const parsed = IlpPacket.deserializeIlpReject(result);
                log.trace('got rejection. cond=%s nextHop=%s amount=%s code=%s triggeredBy=%s message=%s', executionCondition.slice(0, 6).toString('base64'), nextHop, nextHopPacket.amount, parsed.code, parsed.triggeredBy, parsed.message);
            }
            return result;
        };
        let handled = await asyncMsgHandler.handleMsg(sourceAccount, amount, parsedPacket.data, remaining);
        if (handled) {
            return new Promise((resolve, reject) => resolve(Buffer.from('')));
        }
        else {
            return remaining();
        }
    }
    async sendDataNoHandler(packet, sourceAccount, outbound) {
        const parsedPacket = IlpPacket.deserializeIlpPrepare(packet);
        const { amount, executionCondition, destination, expiresAt } = parsedPacket;
        log.trace('handling ilp prepare. sourceAccount=%s destination=%s amount=%s condition=%s expiry=%s packet=%s', sourceAccount, destination, amount, executionCondition.toString('base64'), expiresAt.toISOString(), packet.toString('base64'));
        if (destination.startsWith(PEER_PROTOCOL_PREFIX)) {
            return this.peerProtocolController.handle(packet, sourceAccount, { parsedPacket });
        }
        else if (destination === this.accounts.getOwnAddress()) {
            return this.echoController.handle(packet, sourceAccount, { parsedPacket, outbound });
        }
        const { nextHop, nextHopPacket } = await this.routeBuilder.getNextHopPacket(sourceAccount, parsedPacket);
        log.trace('sending outbound ilp prepare. destination=%s amount=%s', destination, nextHopPacket.amount);
        const result = await outbound(IlpPacket.serializeIlpPrepare(nextHopPacket), nextHop);
        this.backend.submitPacket({
            sourceAccount: sourceAccount,
            sourceAmount: amount,
            destinationAccount: nextHop,
            destinationAmount: nextHopPacket.amount,
            parsedPacket,
            result
        }).catch(err => {
            const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : String(err);
            log.error('error while submitting packet to backend. error=%s', errInfo);
        });
        if (result[0] === IlpPacket.Type.TYPE_ILP_FULFILL) {
            log.trace('got fulfillment. cond=%s nextHop=%s amount=%s', executionCondition.slice(0, 6).toString('base64'), nextHop, nextHopPacket.amount);
            this.backend.submitPayment({
                sourceAccount: sourceAccount,
                sourceAmount: amount,
                destinationAccount: nextHop,
                destinationAmount: nextHopPacket.amount
            })
                .catch(err => {
                const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : String(err);
                log.error('error while submitting payment to backend. error=%s', errInfo);
            });
        }
        else if (result[0] === IlpPacket.Type.TYPE_ILP_REJECT) {
            const parsed = IlpPacket.deserializeIlpReject(result);
            log.trace('got rejection. cond=%s nextHop=%s amount=%s code=%s triggeredBy=%s message=%s', executionCondition.slice(0, 6).toString('base64'), nextHop, nextHopPacket.amount, parsed.code, parsed.triggeredBy, parsed.message);
        }
        return result;
    }
}
exports.default = IlpPrepareController;
//# sourceMappingURL=ilp-prepare.js.map