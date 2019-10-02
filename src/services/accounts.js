"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ilp_compat_plugin_1 = require("ilp-compat-plugin");
const store_1 = require("../services/store");
const config_1 = require("./config");
const events_1 = require("events");
const ILDCP = require("ilp-protocol-ildcp");
const log_1 = require("../common/log");
const log = log_1.create('accounts');
class Accounts extends events_1.EventEmitter {
    constructor(deps) {
        super();
        this.config = deps(config_1.default);
        this.store = deps(store_1.default);
        this.address = this.config.ilpAddress || 'unknown';
        this.accounts = new Map();
    }
    async loadIlpAddress() {
        const inheritFrom = this.config.ilpAddressInheritFrom ||
            [...this.accounts]
                .filter(([key, value]) => value.info.relation === 'parent')
                .map(([key]) => key)[0];
        if (this.config.ilpAddress === 'unknown' && !inheritFrom) {
            throw new Error('When there is no parent, ILP address must be specified in configuration.');
        }
        else if (this.config.ilpAddress === 'unknown' && inheritFrom) {
            const parent = this.getPlugin(inheritFrom);
            log.trace('connecting to parent. accountId=%s', inheritFrom);
            await parent.connect({});
            const ildcpInfo = await ILDCP.fetch(parent.sendData.bind(parent));
            this.setOwnAddress(ildcpInfo.clientAddress);
            if (this.address === 'unknown') {
                log.error('could not get ilp address from parent.');
                throw new Error('no ilp address configured.');
            }
        }
    }
    async connect(options) {
        const unconnectedAccounts = Array.from(this.accounts.values())
            .filter(account => !account.plugin.isConnected());
        return Promise.all(unconnectedAccounts.map(account => account.plugin.connect(options)));
    }
    async disconnect() {
        const connectedAccounts = Array.from(this.accounts.values())
            .filter(account => account.plugin.isConnected());
        return Promise.all(connectedAccounts.map(account => account.plugin.disconnect()));
    }
    getOwnAddress() {
        return this.address;
    }
    setOwnAddress(newAddress) {
        log.trace('setting ilp address. oldAddress=%s newAddress=%s', this.address, newAddress);
        this.address = newAddress;
    }
    getPlugin(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) {
            log.error('could not find plugin for account id. accountId=%s', accountId);
            throw new Error('unknown account id. accountId=' + accountId);
        }
        return account.plugin;
    }
    exists(accountId) {
        return this.accounts.has(accountId);
    }
    getAccountIds() {
        return Array.from(this.accounts.keys());
    }
    getAssetCode(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) {
            log.error('no currency found. account=%s', accountId);
            return undefined;
        }
        return account.info.assetCode;
    }
    add(accountId, creds) {
        log.info('add account. accountId=%s', accountId);
        try {
            this.config.validateAccount(accountId, creds);
        }
        catch (err) {
            if (err.name === 'InvalidJsonBodyError') {
                log.error('validation error in account config. id=%s', accountId);
                err.debugPrint(log.warn.bind(log));
                throw new Error('error while adding account, see error log for details.');
            }
            throw err;
        }
        const plugin = this.getPluginFromCreds(accountId, creds);
        this.accounts.set(accountId, {
            info: creds,
            plugin
        });
        this.emit('add', accountId, plugin);
    }
    remove(accountId) {
        const plugin = this.getPlugin(accountId);
        if (!plugin) {
            return undefined;
        }
        log.info('remove account. accountId=' + accountId);
        this.emit('remove', accountId, plugin);
        this.accounts.delete(accountId);
        return plugin;
    }
    getInfo(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) {
            throw new Error('unknown account id. accountId=' + accountId);
        }
        return account.info;
    }
    getChildAddress(accountId) {
        const info = this.getInfo(accountId);
        if (info.relation !== 'child') {
            throw new Error('Can\'t generate child address for account that is isn\'t a child');
        }
        const ilpAddressSegment = info.ilpAddressSegment || accountId;
        return this.address + '.' + ilpAddressSegment;
    }
    getStatus() {
        const accounts = {};
        this.accounts.forEach((account, accountId) => {
            accounts[accountId] = {
                info: Object.assign({}, account.info, { options: undefined }),
                connected: account.plugin.isConnected(),
                adminInfo: !!account.plugin.getAdminInfo
            };
        });
        return {
            address: this.address,
            accounts
        };
    }
    getPluginFromCreds(accountId, creds) {
        if (typeof creds.plugin === 'object')
            return creds.plugin;
        const Plugin = require(creds.plugin);
        const api = {
            store: this.store.getPluginStore(accountId),
            log: log_1.create(`${creds.plugin}[${accountId}]`)
        };
        const opts = Object.assign({
            _store: api.store,
            _log: api.log
        }, creds.options);
        return ilp_compat_plugin_1.default(new Plugin(opts, api));
    }
}
exports.default = Accounts;
//# sourceMappingURL=accounts.js.map