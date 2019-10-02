"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Prometheus = require("prom-client");
function mergeAccountLabels(account, labels) {
    labels['account'] = account.accountId;
    labels['asset'] = account.accountInfo.assetCode;
    labels['scale'] = account.accountInfo.assetScale;
    return labels;
}
class AccountCounter extends Prometheus.Counter {
    constructor(configuration) {
        configuration.labelNames = (configuration.labelNames || []);
        configuration.labelNames.push('account', 'asset', 'scale');
        super(configuration);
    }
    increment(account, labels, value) {
        return this.inc(mergeAccountLabels(account, labels), value);
    }
}
exports.AccountCounter = AccountCounter;
class AccountGauge extends Prometheus.Gauge {
    constructor(configuration) {
        configuration.labelNames = (configuration.labelNames || []);
        configuration.labelNames.push('account', 'asset', 'scale');
        super(configuration);
    }
    setValue(account, labels, value) {
        return this.set(mergeAccountLabels(account, labels), value);
    }
}
exports.AccountGauge = AccountGauge;
class Stats {
    constructor() {
        this.registry = new (Prometheus.Registry)();
        this.incomingDataPackets = new AccountCounter({
            name: 'ilp_connector_incoming_ilp_packets',
            help: 'Total number of incoming ILP packets',
            labelNames: ['result', 'code'],
            registers: [this.registry]
        });
        this.incomingDataPacketValue = new AccountCounter({
            name: 'ilp_connector_incoming_ilp_packet_value',
            help: 'Total value of incoming ILP packets',
            labelNames: ['result', 'code'],
            registers: [this.registry]
        });
        this.outgoingDataPackets = new AccountCounter({
            name: 'ilp_connector_outgoing_ilp_packets',
            help: 'Total number of outgoing ILP packets',
            labelNames: ['result', 'code'],
            registers: [this.registry]
        });
        this.outgoingDataPacketValue = new AccountCounter({
            name: 'ilp_connector_outgoing_ilp_packet_value',
            help: 'Total value of outgoing ILP packets',
            labelNames: ['result', 'code'],
            registers: [this.registry]
        });
        this.incomingMoney = new AccountGauge({
            name: 'ilp_connector_incoming_money',
            help: 'Total of incoming money',
            labelNames: ['result'],
            registers: [this.registry]
        });
        this.outgoingMoney = new AccountGauge({
            name: 'ilp_connector_outgoing_money',
            help: 'Total of outgoing money',
            labelNames: ['result'],
            registers: [this.registry]
        });
        this.rateLimitedPackets = new AccountCounter({
            name: 'ilp_connector_rate_limited_ilp_packets',
            help: 'Total of rate limited ILP packets',
            registers: [this.registry]
        });
        this.rateLimitedMoney = new AccountCounter({
            name: 'ilp_connector_rate_limited_money',
            help: 'Total of rate limited money requests',
            registers: [this.registry]
        });
        this.balance = new AccountGauge({
            name: 'ilp_connector_balance',
            help: 'Balances on peer account',
            registers: [this.registry]
        });
    }
    getStatus() {
        return this.registry.getMetricsAsJSON();
    }
    getRegistry() {
        return this.registry;
    }
}
exports.default = Stats;
//# sourceMappingURL=stats.js.map