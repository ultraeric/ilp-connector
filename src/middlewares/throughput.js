"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const log = log_1.create('throughput-middleware');
const token_bucket_1 = require("../lib/token-bucket");
const IlpPacket = require("ilp-packet");
const { InsufficientLiquidityError } = IlpPacket.Errors;
const DEFAULT_REFILL_PERIOD = 1000;
class ThroughputMiddleware {
    constructor(opts, { getInfo }) {
        this.getInfo = getInfo;
    }
    async applyToPipelines(pipelines, accountId) {
        const accountInfo = this.getInfo(accountId);
        if (!accountInfo) {
            throw new Error('could not load info for account. accountId=' + accountId);
        }
        if (accountInfo.throughput) {
            const { refillPeriod = DEFAULT_REFILL_PERIOD, incomingAmount = false, outgoingAmount = false } = accountInfo.throughput || {};
            if (incomingAmount) {
                const incomingBucket = new token_bucket_1.default({ refillPeriod, refillCount: Number(incomingAmount) });
                log.trace('created incoming amount limit token bucket for account. accountId=%s refillPeriod=%s incomingAmount=%s', accountId, refillPeriod, incomingAmount);
                pipelines.incomingData.insertLast({
                    name: 'throughput',
                    method: async (data, next) => {
                        if (data[0] === IlpPacket.Type.TYPE_ILP_PREPARE) {
                            const parsedPacket = IlpPacket.deserializeIlpPrepare(data);
                            if (!incomingBucket.take(Number(parsedPacket.amount))) {
                                throw new InsufficientLiquidityError('exceeded money bandwidth, throttling.');
                            }
                            return next(data);
                        }
                        else {
                            return next(data);
                        }
                    }
                });
            }
            if (outgoingAmount) {
                const incomingBucket = new token_bucket_1.default({ refillPeriod, refillCount: Number(outgoingAmount) });
                log.trace('created outgoing amount limit token bucket for account. accountId=%s refillPeriod=%s outgoingAmount=%s', accountId, refillPeriod, outgoingAmount);
                pipelines.outgoingData.insertLast({
                    name: 'throughput',
                    method: async (data, next) => {
                        if (data[0] === IlpPacket.Type.TYPE_ILP_PREPARE) {
                            const parsedPacket = IlpPacket.deserializeIlpPrepare(data);
                            if (!incomingBucket.take(Number(parsedPacket.amount))) {
                                throw new InsufficientLiquidityError('exceeded money bandwidth, throttling.');
                            }
                            return next(data);
                        }
                        else {
                            return next(data);
                        }
                    }
                });
            }
        }
    }
}
exports.default = ThroughputMiddleware;
//# sourceMappingURL=throughput.js.map