"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const log = log_1.create('expire-middleware');
const IlpPacket = require("ilp-packet");
const { TransferTimedOutError } = IlpPacket.Errors;
class ExpireMiddleware {
    async applyToPipelines(pipelines, accountId) {
        pipelines.outgoingData.insertLast({
            name: 'expire',
            method: async (data, next) => {
                if (data[0] === IlpPacket.Type.TYPE_ILP_PREPARE) {
                    const { executionCondition, expiresAt } = IlpPacket.deserializeIlpPrepare(data);
                    const duration = expiresAt.getTime() - Date.now();
                    const promise = next(data);
                    let timeout;
                    const timeoutPromise = new Promise((resolve, reject) => {
                        timeout = setTimeout(() => {
                            log.debug('packet expired. cond=%s expiresAt=%s', executionCondition.slice(0, 6).toString('base64'), expiresAt.toISOString());
                            reject(new TransferTimedOutError('packet expired.'));
                        }, duration);
                    });
                    return Promise.race([
                        promise.then((data) => { clearTimeout(timeout); return data; }),
                        timeoutPromise
                    ]);
                }
                return next(data);
            }
        });
    }
}
exports.default = ExpireMiddleware;
//# sourceMappingURL=expire.js.map