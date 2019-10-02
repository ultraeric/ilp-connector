"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IlpPacket = require("ilp-packet");
const log_1 = require("../common/log");
const log = log_1.create('max-packet-amount-middleware');
const bignumber_js_1 = require("bignumber.js");
const { AmountTooLargeError } = IlpPacket.Errors;
class MaxPacketAmountMiddleware {
    constructor(opts, { getInfo }) {
        this.getInfo = getInfo;
    }
    async applyToPipelines(pipelines, accountId) {
        const accountInfo = this.getInfo(accountId);
        if (!accountInfo) {
            throw new Error('account info unavailable. accountId=' + accountId);
        }
        if (accountInfo.maxPacketAmount) {
            const maxPacketAmount = accountInfo.maxPacketAmount;
            pipelines.incomingData.insertLast({
                name: 'maxPacketAmount',
                method: async (data, next) => {
                    if (data[0] === IlpPacket.Type.TYPE_ILP_PREPARE) {
                        const parsedPacket = IlpPacket.deserializeIlpPrepare(data);
                        const amount = new bignumber_js_1.default(parsedPacket.amount);
                        if (amount.gt(maxPacketAmount)) {
                            log.debug('rejecting packet for exceeding max amount. accountId=%s maxAmount=%s actualAmount=%s', accountId, maxPacketAmount, parsedPacket.amount);
                            throw new AmountTooLargeError(`packet size too large. maxAmount=${maxPacketAmount} actualAmount=${parsedPacket.amount}`, {
                                receivedAmount: parsedPacket.amount,
                                maximumAmount: maxPacketAmount
                            });
                        }
                    }
                    return next(data);
                }
            });
        }
    }
}
exports.default = MaxPacketAmountMiddleware;
//# sourceMappingURL=max-packet-amount.js.map