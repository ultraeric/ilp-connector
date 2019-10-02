#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('source-map-support').install();
const app_1 = require("./app");
exports.createApp = app_1.default;
const log_1 = require("./common/log");
const log = log_1.create('app');
if (!module.parent) {
    const connector = app_1.default();
    connector.listen()
        .catch((err) => {
        const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : err;
        log.error(errInfo);
    });
    let shuttingDown = false;
    process.on('SIGINT', async () => {
        try {
            if (shuttingDown) {
                log.warn('received second SIGINT during graceful shutdown, exiting forcefully.');
                process.exit(1);
                return;
            }
            shuttingDown = true;
            log.debug('shutting down.');
            await connector.shutdown();
            log.debug('completed graceful shutdown.');
            process.exit(0);
        }
        catch (err) {
            const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : err;
            log.error('error while shutting down. error=%s', errInfo);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=index.js.map