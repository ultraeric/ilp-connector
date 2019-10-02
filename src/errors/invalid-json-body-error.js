"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseError = require("extensible-error");
const ilp_packet_1 = require("ilp-packet");
class InvalidJsonBodyError extends BaseError {
    constructor(message, validationErrors) {
        super(message);
        this.httpErrorCode = 400;
        this.ilpErrorCode = ilp_packet_1.Errors.codes.F01_INVALID_PACKET;
        this.validationErrors = validationErrors;
    }
    debugPrint(log, validationError) {
        if (!validationError) {
            if (this.validationErrors) {
                for (let ve of this.validationErrors) {
                    this.debugPrint(log, ve);
                }
            }
            return;
        }
        const additionalInfo = Object.keys(validationError.params).map(key => `${key}=${validationError.params[key]}`).join(' ');
        log(`-- ${validationError.dataPath}: ${validationError.message}. ${additionalInfo}`);
    }
}
exports.default = InvalidJsonBodyError;
//# sourceMappingURL=invalid-json-body-error.js.map