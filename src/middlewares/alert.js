"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const log = log_1.create('alert-middleware');
const IlpPacket = require("ilp-packet");
const { T04_INSUFFICIENT_LIQUIDITY } = IlpPacket.Errors.codes;
class AlertMiddleware {
    constructor() {
        this.alerts = {};
        this.nextAlertId = Date.now();
    }
    async applyToPipelines(pipelines, accountId) {
        pipelines.outgoingData.insertLast({
            name: 'alert',
            method: async (data, next) => {
                const result = await next(data);
                if (result[0] !== IlpPacket.Type.TYPE_ILP_REJECT)
                    return result;
                const rejectPacket = IlpPacket.deserializeIlpReject(result);
                if (rejectPacket.code !== T04_INSUFFICIENT_LIQUIDITY)
                    return result;
                if (rejectPacket.message !== 'exceeded maximum balance.')
                    return result;
                const { triggeredBy } = rejectPacket;
                log.warn('generating alert for account=%s triggeredBy=%s message="%s"', accountId, triggeredBy, rejectPacket.message);
                this.addAlert(accountId, triggeredBy, rejectPacket.message);
                return result;
            }
        });
    }
    getAlerts() {
        return Object.keys(this.alerts)
            .map((id) => this.alerts[id])
            .sort((a, b) => a.id - b.id);
    }
    dismissAlert(id) {
        delete this.alerts[id];
    }
    addAlert(accountId, triggeredBy, message) {
        const alert = Object.keys(this.alerts)
            .map((alertId) => this.alerts[alertId])
            .find((alert) => alert.accountId === accountId &&
            alert.triggeredBy === triggeredBy &&
            alert.message === message);
        if (alert) {
            alert.count++;
            alert.updatedAt = new Date();
            return;
        }
        const id = this.nextAlertId++;
        const now = new Date();
        this.alerts[id] = {
            id,
            accountId,
            triggeredBy,
            message,
            count: 1,
            createdAt: now,
            updatedAt: now
        };
    }
}
exports.default = AlertMiddleware;
//# sourceMappingURL=alert.js.map