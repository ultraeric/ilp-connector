"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const invalid_json_body_error_1 = require("../errors/invalid-json-body-error");
const change_case_1 = require("change-case");
const log_1 = require("../common/log");
const Config_1 = require("../schemas/Config");
const log = log_1.create('config');
const schema = require('../schemas/Config.json');
const { extractDefaultsFromSchema } = require('../lib/utils');
const Ajv = require("ajv");
const ajv = new Ajv();
const ENV_PREFIX = 'CONNECTOR_';
const BOOLEAN_VALUES = {
    '1': true,
    'true': true,
    '0': false,
    'false': false,
    '': false
};
class Config extends Config_1.Config {
    constructor() {
        super();
        this.loadDefaults();
        this._validate = ajv.compile(schema);
        this._validateAccount = ajv.compile(schema.properties.accounts.additionalProperties);
    }
    loadDefaults() {
        Object.assign(this, extractDefaultsFromSchema(schema));
    }
    loadFromEnv(env) {
        if (!env) {
            env = process.env;
        }
        const unrecognizedEnvKeys = new Set(Object.keys(env).filter(key => key.startsWith(ENV_PREFIX)));
        const config = {};
        for (let key of Object.keys(schema.properties)) {
            const envKey = ENV_PREFIX + change_case_1.constantCase(key);
            const envValue = env[envKey];
            unrecognizedEnvKeys.delete(envKey);
            if (typeof envValue === 'string') {
                switch (schema.properties[key].type) {
                    case 'string':
                        config[key] = envValue;
                        break;
                    case 'object':
                    case 'array':
                        try {
                            config[key] = JSON.parse(envValue);
                        }
                        catch (err) {
                            log.error('unable to parse config. key=%s', envKey);
                        }
                        break;
                    case 'boolean':
                        config[key] = BOOLEAN_VALUES[envValue] || false;
                        break;
                    case 'integer':
                    case 'number':
                        config[key] = Number(envValue);
                        break;
                    default:
                        throw new TypeError('Unknown JSON schema type: ' + schema.properties[key].type);
                }
            }
        }
        for (const key of unrecognizedEnvKeys) {
            log.warn('unrecognized environment variable. key=%s', key);
        }
        this.validate(config);
        Object.assign(this, config);
    }
    loadFromOpts(opts) {
        this.validate(opts);
        Object.assign(this, opts);
    }
    validate(config) {
        if (!this._validate(config)) {
            const firstError = this._validate.errors && this._validate.errors[0]
                ? this._validate.errors[0]
                : { message: 'unknown validation error', dataPath: '' };
            throw new invalid_json_body_error_1.default('config failed to validate. error=' + firstError.message + ' dataPath=' + firstError.dataPath, this._validate.errors || []);
        }
    }
    validateAccount(id, accountInfo) {
        if (!this._validateAccount(accountInfo)) {
            throw new invalid_json_body_error_1.default('account config failed to validate. id=' + id, this._validateAccount.errors || []);
        }
    }
    get(key) {
        return this[key];
    }
}
exports.default = Config;
//# sourceMappingURL=config.js.map