"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../lib/utils");
const log_1 = require("../common/log");
const log = log_1.create('middleware-manager');
const config_1 = require("./config");
const accounts_1 = require("./accounts");
const core_1 = require("./core");
const stats_1 = require("./stats");
const middleware_pipeline_1 = require("../lib/middleware-pipeline");
const ilp_packet_1 = require("ilp-packet");
const { codes, UnreachableError } = ilp_packet_1.Errors;
const peerAccounts = require('../reputation/state/peer-accounts').peerAccounts;
const messageHandler = require('../reputation/mh/mh').asyncMsgHandler;
const BUILTIN_MIDDLEWARES = {
    errorHandler: {
        type: 'error-handler'
    },
    rateLimit: {
        type: 'rate-limit'
    },
    maxPacketAmount: {
        type: 'max-packet-amount'
    },
    throughput: {
        type: 'throughput'
    },
    balance: {
        type: 'balance'
    },
    deduplicate: {
        type: 'deduplicate'
    },
    expire: {
        type: 'expire'
    },
    validateFulfillment: {
        type: 'validate-fulfillment'
    },
    stats: {
        type: 'stats'
    },
    alert: {
        type: 'alert'
    }
};
class MiddlewareManager {
    constructor(deps) {
        this.startupHandlers = new Map();
        this.teardownHandlers = new Map();
        this.outgoingDataHandlers = new Map();
        this.outgoingMoneyHandlers = new Map();
        this.started = false;
        this.config = deps(config_1.default);
        this.accounts = deps(accounts_1.default);
        this.core = deps(core_1.default);
        this.stats = deps(stats_1.default);
        const disabledMiddlewareConfig = this.config.disableMiddleware || [];
        const customMiddlewareConfig = this.config.middlewares || {};
        this.middlewares = {};
        for (const name of Object.keys(BUILTIN_MIDDLEWARES)) {
            if (disabledMiddlewareConfig.includes(name)) {
                continue;
            }
            this.middlewares[name] = this.construct(name, BUILTIN_MIDDLEWARES[name]);
        }
        for (const name of Object.keys(customMiddlewareConfig)) {
            if (this.middlewares[name]) {
                throw new Error('custom middleware has same name as built-in middleware. name=' + name);
            }
            this.middlewares[name] = this.construct(name, customMiddlewareConfig[name]);
        }
    }
    construct(name, definition) {
        const Middleware = utils_1.loadModuleOfType('middleware', definition.type);
        return new Middleware(definition.options || {}, {
            getInfo: accountId => this.accounts.getInfo(accountId),
            getOwnAddress: () => this.accounts.getOwnAddress(),
            sendData: this.sendData.bind(this),
            sendMoney: this.sendMoney.bind(this),
            stats: this.stats
        });
    }
    async setup() {
        for (const accountId of this.accounts.getAccountIds()) {
            const plugin = this.accounts.getPlugin(accountId);
            await this.addPlugin(accountId, plugin);
        }
    }
    async startup() {
        this.started = true;
        for (const handler of this.startupHandlers.values()) {
            await handler(undefined);
        }
    }
    async addPlugin(accountId, plugin) {
        const pipelines = {
            startup: new middleware_pipeline_1.default(),
            teardown: new middleware_pipeline_1.default(),
            incomingData: new middleware_pipeline_1.default(),
            incomingMoney: new middleware_pipeline_1.default(),
            outgoingData: new middleware_pipeline_1.default(),
            outgoingMoney: new middleware_pipeline_1.default()
        };
        for (const middlewareName of Object.keys(this.middlewares)) {
            const middleware = this.middlewares[middlewareName];
            try {
                await middleware.applyToPipelines(pipelines, accountId);
            }
            catch (err) {
                const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : String(err);
                log.error('failed to apply middleware to account. middlewareName=%s accountId=%s error=%s', middlewareName, accountId, errInfo);
                throw new Error('failed to apply middleware. middlewareName=' + middlewareName);
            }
        }
        const submitData = async (data) => {
            try {
                return await plugin.sendData(data);
            }
            catch (e) {
                let err = e;
                if (!err || typeof err !== 'object') {
                    err = new Error('non-object thrown. value=' + e);
                }
                if (!err.ilpErrorCode) {
                    err.ilpErrorCode = codes.F02_UNREACHABLE;
                }
                err.message = 'failed to send packet: ' + err.message;
                throw err;
            }
        };
        const submitMoney = plugin.sendMoney.bind(plugin);
        const startupHandler = this.createHandler(pipelines.startup, accountId, async () => { return; });
        const teardownHandler = this.createHandler(pipelines.teardown, accountId, async () => { return; });
        const outgoingDataHandler = this.createHandler(pipelines.outgoingData, accountId, submitData);
        const outgoingMoneyHandler = this.createHandler(pipelines.outgoingMoney, accountId, submitMoney);
        this.startupHandlers.set(accountId, startupHandler);
        this.teardownHandlers.set(accountId, teardownHandler);
        this.outgoingDataHandlers.set(accountId, outgoingDataHandler);
        this.outgoingMoneyHandlers.set(accountId, outgoingMoneyHandler);
        setTimeout(() => {
            messageHandler.sendRaw(accountId, '1', Buffer.from(''));
        }, 3000);
        const handleData = (data) => {
            return this.core.processData(data, accountId, this.sendData.bind(this));
        };
        const handleMoney = async () => {
            console.log('handleMoney called');
        };
        const incomingDataHandler = this.createHandler(pipelines.incomingData, accountId, handleData);
        const incomingMoneyHandler = this.createHandler(pipelines.incomingMoney, accountId, handleMoney);
        plugin.registerDataHandler(incomingDataHandler);
        plugin.registerMoneyHandler(incomingMoneyHandler);
        await peerAccounts.addAccount(accountId, plugin);
        messageHandler.blockPayments(accountId);
        if (this.started) {
            await startupHandler(undefined);
        }
    }
    async removePlugin(accountId, plugin) {
        plugin.deregisterDataHandler();
        plugin.deregisterMoneyHandler();
        peerAccounts.deleteAccount(accountId);
        this.startupHandlers.delete(accountId);
        const teardownHandler = this.teardownHandlers.get(accountId);
        if (teardownHandler)
            await teardownHandler(undefined);
        this.teardownHandlers.delete(accountId);
        this.outgoingDataHandlers.delete(accountId);
        this.outgoingMoneyHandlers.delete(accountId);
    }
    async sendData(data, accountId) {
        const handler = this.outgoingDataHandlers.get(accountId);
        if (!handler) {
            throw new UnreachableError('tried to send data to non-existent account. accountId=' + accountId);
        }
        return handler(data);
    }
    async sendMoney(amount, accountId) {
        const handler = this.outgoingMoneyHandlers.get(accountId);
        if (!handler) {
            throw new UnreachableError('tried to send money to non-existent account. accountId=' + accountId);
        }
        return handler(amount);
    }
    getMiddleware(name) {
        return this.middlewares[name];
    }
    createHandler(pipeline, accountId, next) {
        const middleware = utils_1.composeMiddleware(pipeline.getMethods());
        return (param) => middleware(param, next);
    }
}
exports.default = MiddlewareManager;
//# sourceMappingURL=middleware-manager.js.map