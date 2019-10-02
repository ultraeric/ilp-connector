"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const log_1 = require("../common/log");
const log = log_1.create('validate-fulfillment-middleware');
const IlpPacket = require("ilp-packet");
const { WrongConditionError } = IlpPacket.Errors;
class ValidateFulfillmentMiddleware {
    async applyToPipelines(pipelines, accountId) {
        pipelines.outgoingData.insertLast({
            name: 'validateFulfillment',
            method: async (data, next) => {
                if (data[0] === IlpPacket.Type.TYPE_ILP_PREPARE) {
                    const { executionCondition } = IlpPacket.deserializeIlpPrepare(data);
                    const result = await next(data);
                    if (result[0] === IlpPacket.Type.TYPE_ILP_FULFILL) {
                        const { fulfillment } = IlpPacket.deserializeIlpFulfill(result);
                        const calculatedCondition = crypto_1.createHash('sha256').update(fulfillment).digest();
                        if (!calculatedCondition.equals(executionCondition)) {
                            log.error('received incorrect fulfillment from account. accountId=%s fulfillment=%s calculatedCondition=%s executionCondition=%s', accountId, fulfillment.toString('base64'), calculatedCondition.toString('base64'), executionCondition.toString('base64'));
                            throw new WrongConditionError('fulfillment did not match expected value.');
                        }
                    }
                    return result;
                }
                return next(data);
            }
        });
    }
}
exports.default = ValidateFulfillmentMiddleware;
//# sourceMappingURL=validate-fulfillment.js.map