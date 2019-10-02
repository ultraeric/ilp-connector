"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const crypto_1 = require("crypto");
const IlpPacket = require("ilp-packet");
const bignumber_js_1 = require("bignumber.js");
const STATIC_DATA_OFFSET = 25;
const DEFAULT_CLEANUP_INTERVAL = 30000;
const DEFAULT_PACKET_LIFETIME = 30000;
class DeduplicateMiddleware {
    constructor(opts, { getInfo }) {
        this.packetCache = new Map();
        this.getInfo = getInfo;
    }
    async applyToPipelines(pipelines, accountId) {
        const log = log_1.create(`deduplicate-middleware[${accountId}]`);
        const accountInfo = this.getInfo(accountId);
        if (!accountInfo) {
            throw new Error('account info unavailable. accountId=' + accountId);
        }
        const { cleanupInterval, packetLifetime } = accountInfo.deduplicate || {
            cleanupInterval: DEFAULT_CLEANUP_INTERVAL,
            packetLifetime: DEFAULT_PACKET_LIFETIME
        };
        let interval;
        pipelines.startup.insertLast({
            name: 'deduplicate',
            method: async (dummy, next) => {
                interval = setInterval(() => this.cleanupCache(packetLifetime), cleanupInterval);
                return next(dummy);
            }
        });
        pipelines.teardown.insertLast({
            name: 'deduplicate',
            method: async (dummy, next) => {
                clearInterval(interval);
                return next(dummy);
            }
        });
        pipelines.outgoingData.insertLast({
            name: 'deduplicate',
            method: async (data, next) => {
                if (data[0] === IlpPacket.Type.TYPE_ILP_PREPARE) {
                    const { contents } = IlpPacket.deserializeEnvelope(data);
                    const index = crypto_1.createHash('sha256')
                        .update(contents.slice(STATIC_DATA_OFFSET))
                        .digest()
                        .slice(0, 16)
                        .toString('base64');
                    const { amount, expiresAt } = IlpPacket.deserializeIlpPrepare(data);
                    const cachedPacket = this.packetCache.get(index);
                    if (cachedPacket) {
                        if (new bignumber_js_1.default(cachedPacket.amount).gte(amount) && cachedPacket.expiresAt >= expiresAt) {
                            log.warn('deduplicate packet cache hit. accountId=%s elapsed=%s amount=%s', accountId, cachedPacket.expiresAt.getTime() - Date.now(), amount);
                            return cachedPacket.promise;
                        }
                    }
                    const promise = next(data);
                    this.packetCache.set(index, {
                        amount,
                        expiresAt,
                        promise
                    });
                    return promise;
                }
                return next(data);
            }
        });
    }
    cleanupCache(packetLifetime) {
        const now = Date.now();
        for (const index of this.packetCache.keys()) {
            const cachedPacket = this.packetCache.get(index);
            if (!cachedPacket)
                continue;
            const packetExpiry = cachedPacket.expiresAt.getTime() + packetLifetime;
            if (packetExpiry < now) {
                this.packetCache.delete(index);
            }
        }
    }
}
exports.default = DeduplicateMiddleware;
//# sourceMappingURL=deduplicate.js.map