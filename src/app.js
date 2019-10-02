"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reduct_1 = require("reduct");
const lodash_1 = require("lodash");
const log_1 = require("./common/log");
const log = log_1.create('app');
const config_1 = require("./services/config");
const route_builder_1 = require("./services/route-builder");
const route_broadcaster_1 = require("./services/route-broadcaster");
const accounts_1 = require("./services/accounts");
const rate_backend_1 = require("./services/rate-backend");
const store_1 = require("./services/store");
const middleware_manager_1 = require("./services/middleware-manager");
const admin_api_1 = require("./services/admin-api");
const Prometheus = require("prom-client");
const version = require('../package.json').version;
function listen(config, accounts, backend, store, routeBuilder, routeBroadcaster, middlewareManager, adminApi) {
    return (async function () {
        adminApi.listen();
        try {
            await backend.connect();
        }
        catch (error) {
            log.error(error);
            process.exit(1);
        }
        await middlewareManager.setup();
        await accounts.loadIlpAddress();
        if (config.routeBroadcastEnabled) {
            routeBroadcaster.start();
        }
        await new Promise((resolve, reject) => {
            const connectTimeout = setTimeout(() => {
                log.warn('one or more accounts failed to connect within the time limit, continuing anyway.');
                resolve();
            }, config.initialConnectTimeout);
            accounts.connect({ timeout: config.initialConnectTimeout })
                .then(() => {
                clearTimeout(connectTimeout);
                resolve();
            }, reject);
        });
        await middlewareManager.startup();
        if (config.collectDefaultMetrics) {
            Prometheus.collectDefaultMetrics();
        }
        log.info('connector ready (republic attitude). address=%s version=%s', accounts.getOwnAddress(), version);
    })().catch((err) => log.error(err));
}
async function addPlugin(config, accounts, backend, routeBroadcaster, middlewareManager, id, options) {
    accounts.add(id, options);
    const plugin = accounts.getPlugin(id);
    await middlewareManager.addPlugin(id, plugin);
    await plugin.connect({ timeout: Infinity });
    routeBroadcaster.track(id);
    routeBroadcaster.reloadLocalRoutes();
}
async function removePlugin(config, accounts, backend, routeBroadcaster, middlewareManager, id) {
    const plugin = accounts.getPlugin(id);
    await middlewareManager.removePlugin(id, plugin);
    await plugin.disconnect();
    routeBroadcaster.untrack(id);
    accounts.remove(id);
    routeBroadcaster.reloadLocalRoutes();
}
function getPlugin(accounts, id) {
    return accounts.getPlugin(id);
}
function shutdown(accounts, routeBroadcaster) {
    routeBroadcaster.stop();
    return accounts.disconnect();
}
function createApp(opts, container) {
    const deps = container || reduct_1.default();
    const config = deps(config_1.default);
    try {
        if (opts) {
            config.loadFromOpts(opts);
        }
        else {
            config.loadFromEnv();
        }
    }
    catch (err) {
        if (err.name === 'InvalidJsonBodyError') {
            log.warn('config validation error.');
            err.debugPrint(log.warn.bind(log));
            log.error('invalid configuration, shutting down.');
            throw new Error('failed to initialize due to invalid configuration.');
        }
        throw err;
    }
    const accounts = deps(accounts_1.default);
    const routeBuilder = deps(route_builder_1.default);
    const routeBroadcaster = deps(route_broadcaster_1.default);
    const backend = deps(rate_backend_1.default);
    const store = deps(store_1.default);
    const middlewareManager = deps(middleware_manager_1.default);
    const adminApi = deps(admin_api_1.default);
    const credentials = config.accounts;
    for (let id of Object.keys(credentials)) {
        accounts.add(id, credentials[id]);
    }
    return {
        config,
        listen: lodash_1.partial(listen, config, accounts, backend, store, routeBuilder, routeBroadcaster, middlewareManager, adminApi),
        addPlugin: lodash_1.partial(addPlugin, config, accounts, backend, routeBroadcaster, middlewareManager),
        removePlugin: lodash_1.partial(removePlugin, config, accounts, backend, routeBroadcaster, middlewareManager),
        getPlugin: lodash_1.partial(getPlugin, accounts),
        shutdown: lodash_1.partial(shutdown, accounts, routeBroadcaster)
    };
}
exports.default = createApp;
//# sourceMappingURL=app.js.map