"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const utils_1 = require("../lib/utils");
class Store {
    constructor(deps) {
        this.config = deps(config_1.default);
        const Store = utils_1.loadModuleOfType('store', this.config.store);
        this.store = new Store(Object.assign({
            path: this.config.storePath
        }, this.config.storeConfig), {});
    }
    getPluginStore(name) {
        if (!name.match(/^[A-Za-z0-9_\-~.]+$/)) {
            throw new Error('"' + name + '" includes forbidden characters.');
        }
        return {
            get: (key) => {
                return this.store.get(name + key);
            },
            put: (key, value) => {
                return this.store.put(name + key, value);
            },
            del: (key) => {
                return this.store.del(name + key);
            }
        };
    }
    async get(key) {
        return this.store.get(key);
    }
    async put(key, value) {
        return this.store.put(key, value);
    }
    async del(key) {
        return this.store.del(key);
    }
}
exports.default = Store;
//# sourceMappingURL=store.js.map