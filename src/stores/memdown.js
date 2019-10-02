"use strict";
const memdown_1 = require("memdown");
const levelup_1 = require("levelup");
const LeveldownStore = require("./leveldown");
const log_1 = require("../common/log");
const log = log_1.create('memdown-store');
class MemdownStore extends LeveldownStore {
    constructor({ path }) {
        log.info('initialize in-memory database.');
        log.warn('(!!!) balances and other important state will NOT persist across sessions. DO NOT DO THIS IN PRODUCTION!');
        const db = levelup_1.default(memdown_1.default(path || 'connector-main'));
        super({ db });
    }
}
module.exports = MemdownStore;
//# sourceMappingURL=memdown.js.map