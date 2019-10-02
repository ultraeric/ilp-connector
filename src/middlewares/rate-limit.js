"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IlpPacket = require("ilp-packet");
const log_1 = require("../common/log");
const log = log_1.create('rate-limit-middleware');
const token_bucket_1 = require("../lib/token-bucket");
const { RateLimitedError } = IlpPacket.Errors;
const DEFAULT_REFILL_PERIOD = 60 * 1000;
const DEFAULT_REFILL_COUNT = 10000;
class RateLimitMiddleware {
    constructor(opts, { getInfo, stats }) {
        this.getInfo = getInfo;
        this.stats = stats;
    }
    async applyToPipelines(pipelines, accountId) {
        const accountInfo = this.getInfo(accountId);
        if (!accountInfo) {
            throw new Error('could not load info for account. accountId=' + accountId);
        }
        const rateLimit = accountInfo.rateLimit || {};
        const { refillPeriod = DEFAULT_REFILL_PERIOD, refillCount = DEFAULT_REFILL_COUNT } = rateLimit;
        const capacity = rateLimit.capacity || refillCount;
        log.trace('created token bucket for account. accountId=%s refillPeriod=%s refillCount=%s capacity=%s', accountId, refillPeriod, refillCount, capacity);
        const bucket = new token_bucket_1.default({ refillPeriod, refillCount, capacity });
        pipelines.incomingData.insertLast({
            name: 'rateLimit',
            method: async (data, next) => {
                if (!bucket.take()) {
                    this.stats.rateLimitedPackets.increment({ accountId, accountInfo }, {});
                    throw new RateLimitedError('too many requests, throttling.');
                }
                return next(data);
            }
        });
        pipelines.incomingMoney.insertLast({
            name: 'rateLimit',
            method: async (amount, next) => {
                if (!bucket.take()) {
                    this.stats.rateLimitedMoney.increment({ accountId, accountInfo }, {});
                    throw new RateLimitedError('too many requests, throttling.');
                }
                return next(amount);
            }
        });
    }
}
exports.default = RateLimitMiddleware;
//# sourceMappingURL=rate-limit.js.map