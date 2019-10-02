"use strict";
const path_1 = require("path");
const levelup_1 = require("levelup");
const leveldown_1 = require("leveldown");
const log_1 = require("../common/log");
const log = log_1.create('leveldown-store');
class LeveldownStore {
    constructor({ db, path }) {
        if (db) {
            this.db = db;
            return;
        }
        if (!path) {
            log.warn('no CONNECTOR_STORE_PATH set, defaulting to ./data.');
            path = path_1.resolve(process.cwd(), 'data');
        }
        log.info('initialize database. path=%s', path);
        this.db = levelup_1.default(leveldown_1.default(path));
    }
    async get(key) {
        try {
            const value = await this.db.get(key);
            if (value instanceof Buffer) {
                return value.toString('utf8');
            }
            else {
                return value;
            }
        }
        catch (e) {
            if (e.name !== 'NotFoundError') {
                throw e;
            }
        }
    }
    async put(key, value) {
        return this.db.put(key, value);
    }
    async del(key) {
        return this.db.del(key);
    }
}
module.exports = LeveldownStore;
//# sourceMappingURL=leveldown.js.map