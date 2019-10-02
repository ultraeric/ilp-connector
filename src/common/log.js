"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const riverpig = require("riverpig");
const debug = require("debug");
const through2 = require("through2");
const logStream = through2();
logStream.pipe(process.stdout);
class ConnectorLogger {
    constructor(namespace, config0) {
        this.river = riverpig(namespace, config0);
        this.tracer = this.river.trace || debug(namespace + ':trace');
    }
    info(msg, ...elements) {
        this.river.info(msg, ...elements);
    }
    warn(msg, ...elements) {
        this.river.warn(msg, ...elements);
    }
    error(msg, ...elements) {
        this.river.error(msg, ...elements);
    }
    debug(msg, ...elements) {
        this.river.debug(msg, ...elements);
    }
    trace(msg, ...elements) {
        this.tracer(msg, ...elements);
    }
}
exports.ConnectorLogger = ConnectorLogger;
exports.createRaw = (namespace) => {
    return new ConnectorLogger(namespace, {
        stream: logStream
    });
};
exports.create = (namespace) => exports.createRaw('connector:' + namespace);
let outputStream = process.stdout;
exports.setOutputStream = (newOutputStream) => {
    logStream.unpipe(outputStream);
    logStream.pipe(newOutputStream);
    outputStream = newOutputStream;
};
//# sourceMappingURL=log.js.map