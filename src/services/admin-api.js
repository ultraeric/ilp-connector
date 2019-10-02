"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Ajv = require("ajv");
const lodash_1 = require("lodash");
const accounts_1 = require("./accounts");
const config_1 = require("./config");
const middleware_manager_1 = require("./middleware-manager");
const routing_table_1 = require("./routing-table");
const route_broadcaster_1 = require("./route-broadcaster");
const stats_1 = require("./stats");
const rate_backend_1 = require("./rate-backend");
const utils_1 = require("../routing/utils");
const http_1 = require("http");
const invalid_json_body_error_1 = require("../errors/invalid-json-body-error");
const log_1 = require("../common/log");
const Prometheus = require("prom-client");
const log = log_1.create('admin-api');
const ajv = new Ajv();
const validateBalanceUpdate = ajv.compile(require('../schemas/BalanceUpdate.json'));
class AdminApi {
    constructor(deps) {
        this.accounts = deps(accounts_1.default);
        this.config = deps(config_1.default);
        this.middlewareManager = deps(middleware_manager_1.default);
        this.routingTable = deps(routing_table_1.default);
        this.routeBroadcaster = deps(route_broadcaster_1.default);
        this.rateBackend = deps(rate_backend_1.default);
        this.stats = deps(stats_1.default);
        this.routes = [
            { method: 'GET', match: '/status$', fn: this.getStatus },
            { method: 'GET', match: '/routing$', fn: this.getRoutingStatus },
            { method: 'GET', match: '/accounts$', fn: this.getAccountStatus },
            { method: 'GET', match: '/accounts/', fn: this.getAccountAdminInfo },
            { method: 'POST', match: '/accounts/', fn: this.sendAccountAdminInfo },
            { method: 'GET', match: '/balance$', fn: this.getBalanceStatus },
            { method: 'POST', match: '/balance$', fn: this.postBalance },
            { method: 'GET', match: '/rates$', fn: this.getBackendStatus },
            { method: 'GET', match: '/stats$', fn: this.getStats },
            { method: 'GET', match: '/alerts$', fn: this.getAlerts },
            { method: 'DELETE', match: '/alerts/', fn: this.deleteAlert },
            { method: 'GET', match: '/metrics$', fn: this.getMetrics, responseType: Prometheus.register.contentType },
            { method: 'POST', match: '/addAccount$', fn: this.addAccount }
        ];
    }
    listen() {
        const { adminApi = false, adminApiHost = '127.0.0.1', adminApiPort = 7780 } = this.config;
        log.info('listen called');
        if (adminApi) {
            log.info('admin api listening. host=%s port=%s', adminApiHost, adminApiPort);
            this.server = new http_1.Server();
            this.server.listen(adminApiPort, adminApiHost);
            this.server.on('request', (req, res) => {
                this.handleRequest(req, res).catch((e) => {
                    let err = e;
                    if (!e || typeof e !== 'object') {
                        err = new Error('non-object thrown. error=' + e);
                    }
                    log.warn('error in admin api request handler. error=%s', err.stack ? err.stack : err);
                    res.statusCode = e.httpErrorCode || 500;
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(String(err));
                });
            });
        }
    }
    async handleRequest(req, res) {
        req.setEncoding('utf8');
        let body = '';
        await new Promise((resolve, reject) => {
            req.on('data', data => body += data);
            req.once('end', resolve);
            req.once('error', reject);
        });
        const urlPrefix = (req.url || '').split('?')[0] + '$';
        const route = this.routes.find((route) => route.method === req.method && urlPrefix.startsWith(route.match));
        if (!route) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found');
            return;
        }
        const resBody = await route.fn.call(this, req.url, body && JSON.parse(body));
        if (resBody) {
            res.statusCode = 200;
            if (route.responseType) {
                res.setHeader('Content-Type', route.responseType);
                res.end(resBody);
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(resBody));
            }
        }
        else {
            res.statusCode = 204;
            res.end();
        }
    }
    async getStatus() {
        const balanceStatus = await this.getBalanceStatus();
        const accountStatus = await this.getAccountStatus();
        return {
            balances: lodash_1.mapValues(balanceStatus['accounts'], 'balance'),
            connected: lodash_1.mapValues(accountStatus['accounts'], 'connected'),
            localRoutingTable: utils_1.formatRoutingTableAsJson(this.routingTable)
        };
    }
    async getRoutingStatus() {
        return this.routeBroadcaster.getStatus();
    }
    async getAccountStatus() {
        return this.accounts.getStatus();
    }
    async getBalanceStatus() {
        const middleware = this.middlewareManager.getMiddleware('balance');
        if (!middleware)
            return {};
        const balanceMiddleware = middleware;
        return balanceMiddleware.getStatus();
    }
    async postBalance(url, _data) {
        try {
            validateBalanceUpdate(_data);
        }
        catch (err) {
            const firstError = (validateBalanceUpdate.errors &&
                validateBalanceUpdate.errors[0]) ||
                { message: 'unknown validation error', dataPath: '' };
            throw new invalid_json_body_error_1.default('invalid balance update: error=' + firstError.message + ' dataPath=' + firstError.dataPath, validateBalanceUpdate.errors || []);
        }
        const data = _data;
        const middleware = this.middlewareManager.getMiddleware('balance');
        if (!middleware)
            return;
        const balanceMiddleware = middleware;
        balanceMiddleware.modifyBalance(data.accountId, data.amountDiff);
    }
    getBackendStatus() {
        return this.rateBackend.getStatus();
    }
    async getStats() {
        return this.stats.getStatus();
    }
    async getAlerts() {
        const middleware = this.middlewareManager.getMiddleware('alert');
        if (!middleware)
            return {};
        const alertMiddleware = middleware;
        return {
            alerts: alertMiddleware.getAlerts()
        };
    }
    async deleteAlert(url) {
        const middleware = this.middlewareManager.getMiddleware('alert');
        if (!middleware)
            return {};
        const alertMiddleware = middleware;
        if (!url)
            throw new Error('no path on request');
        const match = /^\/alerts\/(\d+)$/.exec(url.split('?')[0]);
        if (!match)
            throw new Error('invalid alert id');
        alertMiddleware.dismissAlert(+match[1]);
    }
    async getMetrics() {
        const promRegistry = Prometheus.register;
        const ilpRegistry = this.stats.getRegistry();
        const mergedRegistry = Prometheus.Registry.merge([promRegistry, ilpRegistry]);
        return mergedRegistry.metrics();
    }
    _getPlugin(url) {
        if (!url)
            throw new Error('no path on request');
        const match = /^\/accounts\/([A-Za-z0-9_.\-~]+)$/.exec(url.split('?')[0]);
        if (!match)
            throw new Error('invalid account.');
        const account = match[1];
        const plugin = this.accounts.getPlugin(account);
        if (!plugin)
            throw new Error('account does not exist. account=' + account);
        const info = this.accounts.getInfo(account);
        return {
            account,
            info,
            plugin
        };
    }
    async getAccountAdminInfo(url) {
        if (!url)
            throw new Error('no path on request');
        const { account, info, plugin } = this._getPlugin(url);
        if (!plugin.getAdminInfo)
            throw new Error('plugin has no admin info. account=' + account);
        return {
            account,
            plugin: info.plugin,
            info: (await plugin.getAdminInfo())
        };
    }
    async sendAccountAdminInfo(url, body) {
        if (!url)
            throw new Error('no path on request');
        if (!body)
            throw new Error('no json body provided to set admin info.');
        const { account, info, plugin } = this._getPlugin(url);
        if (!plugin.sendAdminInfo)
            throw new Error('plugin does not support sending admin info. account=' + account);
        return {
            account,
            plugin: info.plugin,
            result: (await plugin.sendAdminInfo(body))
        };
    }
    async addAccount(url, body) {
        if (!url)
            throw new Error('no path on request');
        if (!body)
            throw new Error('no json body provided to make plugin.');
        const { id, options } = body;
        this.accounts.add(id, options);
        const plugin = this.accounts.getPlugin(id);
        await this.middlewareManager.addPlugin(id, plugin);
        await plugin.connect({ timeout: Infinity });
        this.routeBroadcaster.track(id);
        this.routeBroadcaster.reloadLocalRoutes();
        return {
            plugin: id,
            connected: plugin.isConnected()
        };
    }
}
exports.default = AdminApi;
//# sourceMappingURL=admin-api.js.map