"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const IlpPacket = require("ilp-packet");
class ErrorHandlerMiddleware {
    constructor(opts, api) {
        this.getOwnAddress = api.getOwnAddress;
    }
    async applyToPipelines(pipelines, accountId) {
        const log = log_1.create(`error-handler-middleware[${accountId}]`);
        pipelines.incomingData.insertLast({
            name: 'errorHandler',
            method: async (data, next) => {
                try {
                    const response = await next(data);
                    if (!Buffer.isBuffer(response)) {
                        throw new Error('handler did not return a value.');
                    }
                    return response;
                }
                catch (e) {
                    let err = e;
                    if (!err || typeof err !== 'object') {
                        err = new Error('Non-object thrown: ' + e);
                    }
                    log.debug('error in data handler, creating rejection. ilpErrorCode=%s error=%s', err.ilpErrorCode, err.stack ? err.stack : err);
                    return IlpPacket.errorToReject(this.getOwnAddress(), err);
                }
            }
        });
        pipelines.incomingMoney.insertLast({
            name: 'errorHandler',
            method: async (amount, next) => {
                try {
                    return await next(amount);
                }
                catch (e) {
                    let err = e;
                    if (!err || typeof err !== 'object') {
                        err = new Error('non-object thrown. value=' + e);
                    }
                    log.debug('error in money handler. error=%s', err.stack ? err.stack : err);
                    throw err;
                }
            }
        });
    }
}
exports.default = ErrorHandlerMiddleware;
//# sourceMappingURL=error-handler.js.map