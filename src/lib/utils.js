"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const path_1 = require("path");
exports.sha256 = (preimage) => {
    return crypto_1.createHash('sha256').update(preimage).digest();
};
function moduleExists(path) {
    try {
        require.resolve(path);
        return true;
    }
    catch (err) {
        return false;
    }
}
exports.moduleExists = moduleExists;
exports.loadModuleFromPathOrDirectly = (searchPath, module) => {
    const localPath = path_1.resolve(searchPath, module);
    if (moduleExists(localPath)) {
        return localPath;
    }
    else if (moduleExists(module)) {
        return module;
    }
    else {
        return null;
    }
};
exports.loadModuleOfType = (type, name) => {
    const module = exports.loadModuleFromPathOrDirectly(path_1.resolve(__dirname, `../${type}s/`), name);
    if (!module) {
        throw new Error(`${type} not found as a module name or under /${type}s/. moduleName=${name}`);
    }
    const loadedModule = require(module);
    if (loadedModule && typeof loadedModule === 'object' && typeof loadedModule.default === 'function') {
        return loadedModule.default;
    }
    else if (typeof loadedModule === 'function') {
        return loadedModule;
    }
    else {
        throw new TypeError(`${type} does not export a constructor. module=${module}`);
    }
};
exports.extractDefaultsFromSchema = (schema, path = '') => {
    if (typeof schema.default !== 'undefined') {
        return schema.default;
    }
    switch (schema.type) {
        case 'object':
            const result = {};
            for (let key of Object.keys(schema.properties)) {
                result[key] = exports.extractDefaultsFromSchema(schema.properties[key], path + '.' + key);
            }
            return result;
        default:
            throw new Error('No default found for schema path: ' + path);
    }
};
function composeMiddleware(middleware) {
    return function (val, next) {
        let index = -1;
        return dispatch(0, val);
        async function dispatch(i, val) {
            if (i <= index) {
                throw new Error('next() called multiple times.');
            }
            index = i;
            const fn = (i === middleware.length) ? next : middleware[i];
            return fn(val, function next(val) {
                return dispatch(i + 1, val);
            });
        }
    };
}
exports.composeMiddleware = composeMiddleware;
function uuid() {
    const random = crypto_1.randomBytes(16);
    random[6] = (random[6] & 0x0f) | 0x40;
    random[8] = (random[8] & 0x3f) | 0x80;
    return random.toString('hex')
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}
exports.uuid = uuid;
function hmac(secret, message) {
    const hmac = crypto_1.createHmac('sha256', secret);
    if (message instanceof Buffer) {
        hmac.update(message);
    }
    else {
        hmac.update(message, 'utf8');
    }
    return hmac.digest();
}
exports.hmac = hmac;
//# sourceMappingURL=utils.js.map