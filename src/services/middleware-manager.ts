import reduct = require('reduct')

import { loadModuleOfType, composeMiddleware } from '../lib/utils'
import { create as createLogger } from '../common/log'
import { serializeIlpPrepare} from 'ilp-packet';

const log = createLogger('middleware-manager');

import Config from './config'
import Accounts from './accounts'
import Core from './core'
import Stats from './stats'
import {
  Middleware,
  MiddlewareDefinition,
  MiddlewareMethod,
  MiddlewareConstructor,
  Pipeline,
  Pipelines
} from '../types/middleware'
import { PluginInstance, DataHandler, MoneyHandler } from '../types/plugin'
import MiddlewarePipeline from '../lib/middleware-pipeline'
import { Errors } from 'ilp-packet'
const { codes, UnreachableError } = Errors;

const peerAccounts = require('../reputation/state/peer-accounts').peerAccounts;

interface VoidHandler {
  (dummy: void): Promise<void>
}

const BUILTIN_MIDDLEWARES: { [key: string]: MiddlewareDefinition } = {
  errorHandler: {
    type: 'error-handler'
  },
  rateLimit: {
    type: 'rate-limit'
  },
  maxPacketAmount: {
    type: 'max-packet-amount'
  },
  throughput: {
    type: 'throughput'
  },
  balance: {
    type: 'balance'
  },
  deduplicate: {
    type: 'deduplicate'
  },
  expire: {
    type: 'expire'
  },
  validateFulfillment: {
    type: 'validate-fulfillment'
  },
  stats: {
    type: 'stats'
  },
  alert: {
    type: 'alert'
  }
};

export default class MiddlewareManager {
  protected config: Config;
  protected accounts: Accounts;
  protected core: Core;
  protected middlewares: { [key: string]: Middleware };
  protected stats: Stats;
  private startupHandlers: Map<string, VoidHandler> = new Map();
  private teardownHandlers: Map<string, VoidHandler> = new Map();
  private outgoingDataHandlers: Map<string, DataHandler> = new Map();
  private outgoingMoneyHandlers: Map<string, MoneyHandler> = new Map();
  private started: boolean = false;

  constructor (deps: reduct.Injector) {
    this.config = deps(Config);
    this.accounts = deps(Accounts);
    this.core = deps(Core);
    this.stats = deps(Stats);

    const disabledMiddlewareConfig: string[] = this.config.disableMiddleware || [];
    const customMiddlewareConfig: { [key: string]: MiddlewareDefinition } = this.config.middlewares || {};

    this.middlewares = {};

    for (const name of Object.keys(BUILTIN_MIDDLEWARES)) {
      if (disabledMiddlewareConfig.includes(name)) {
        continue
      }

      this.middlewares[name] = this.construct(name, BUILTIN_MIDDLEWARES[name])
    }

    for (const name of Object.keys(customMiddlewareConfig)) {
      if (this.middlewares[name]) {
        throw new Error('custom middleware has same name as built-in middleware. name=' + name)
      }

      this.middlewares[name] = this.construct(name, customMiddlewareConfig[name])
    }
  }

  construct (name: string, definition: MiddlewareDefinition): Middleware {
    // Custom middleware
    const Middleware: MiddlewareConstructor =
      loadModuleOfType('middleware', definition.type);

    return new Middleware(definition.options || {}, {
      getInfo: accountId => this.accounts.getInfo(accountId),
      getOwnAddress: () => this.accounts.getOwnAddress(),
      sendData: this.sendData.bind(this),
      sendMoney: this.sendMoney.bind(this),
      stats: this.stats
    })
  }

  async setup () {
    for (const accountId of this.accounts.getAccountIds()) {
      const plugin = this.accounts.getPlugin(accountId);

      await this.addPlugin(accountId, plugin)
    }
  }

  /**
   * Executes middleware hooks for connector startup.
   *
   * This should be called after the plugins are connected
   */
  async startup () {
    this.started = true;
    for (const handler of this.startupHandlers.values()) {
      await handler(undefined)
    }
  }

  async addPlugin (accountId: string, plugin: PluginInstance) {
    const pipelines: Pipelines = {
      startup: new MiddlewarePipeline<void, void>(),
      teardown: new MiddlewarePipeline<void, void>(),
      incomingData: new MiddlewarePipeline<Buffer, Buffer>(),
      incomingMoney: new MiddlewarePipeline<string, void>(),
      outgoingData: new MiddlewarePipeline<Buffer, Buffer>(),
      outgoingMoney: new MiddlewarePipeline<string, void>()
    };
    for (const middlewareName of Object.keys(this.middlewares)) {
      const middleware = this.middlewares[middlewareName];
      try {
        await middleware.applyToPipelines(pipelines, accountId)
      } catch (err) {
        const errInfo = (err && typeof err === 'object' && err.stack) ? err.stack : String(err);

        log.error('failed to apply middleware to account. middlewareName=%s accountId=%s error=%s', middlewareName, accountId, errInfo);
        throw new Error('failed to apply middleware. middlewareName=' + middlewareName)
      }
    }

    // Generate outgoing middleware
    const submitData = async (data: Buffer) => {
      try {
        return await plugin.sendData(data)
      } catch (e) {
        let err = e;
        if (!err || typeof err !== 'object') {
          err = new Error('non-object thrown. value=' + e)
        }

        if (!err.ilpErrorCode) {
          err.ilpErrorCode = codes.F02_UNREACHABLE
        }

        err.message = 'failed to send packet: ' + err.message;

        throw err
      }
    };
    const submitMoney = plugin.sendMoney.bind(plugin);
    const startupHandler = this.createHandler(pipelines.startup, accountId, async () => { return });
    const teardownHandler = this.createHandler(pipelines.teardown, accountId, async () => { return });
    const outgoingDataHandler: DataHandler =
      this.createHandler(pipelines.outgoingData, accountId, submitData);
    const outgoingMoneyHandler: MoneyHandler =
      this.createHandler(pipelines.outgoingMoney, accountId, submitMoney);

    this.startupHandlers.set(accountId, startupHandler);
    this.teardownHandlers.set(accountId, teardownHandler);
    this.outgoingDataHandlers.set(accountId, outgoingDataHandler);
    this.outgoingMoneyHandlers.set(accountId, outgoingMoneyHandler);

    // Generate incoming middleware
    const handleData: DataHandler = (data: Buffer) => {
      console.log('handleData called');
      return this.core.processData(data, accountId, this.sendData.bind(this))
    };
    const handleMoney: MoneyHandler = async () => {
      console.log('handleMoney called')
    };
    const incomingDataHandler: DataHandler =
      this.createHandler(pipelines.incomingData, accountId, handleData);
    const incomingMoneyHandler: MoneyHandler =
      this.createHandler(pipelines.incomingMoney, accountId, handleMoney);

    plugin.registerDataHandler(incomingDataHandler);
    plugin.registerMoneyHandler(incomingMoneyHandler);

    peerAccounts.addAccount(accountId, plugin);

    if (this.started) {
      // If the plugin is being added dynamically (after connector init),
      // make sure it's startup pipeline is run.
      await startupHandler(undefined)
    }
  }

  async removePlugin (accountId: string, plugin: PluginInstance) {
    plugin.deregisterDataHandler();
    plugin.deregisterMoneyHandler();

    peerAccounts.deleteAccount(accountId);

    this.startupHandlers.delete(accountId);
    const teardownHandler = this.teardownHandlers.get(accountId);
    if (teardownHandler) await teardownHandler(undefined);
    this.teardownHandlers.delete(accountId);
    this.outgoingDataHandlers.delete(accountId);
    this.outgoingMoneyHandlers.delete(accountId)
  }

  async sendData (data: Buffer, accountId: string) {
    const handler = this.outgoingDataHandlers.get(accountId);

    if (!handler) {
      throw new UnreachableError('tried to send data to non-existent account. accountId=' + accountId)
    }

    return handler(data)
  }

  async sendMoney (amount: string, accountId: string) {
    const handler = this.outgoingMoneyHandlers.get(accountId);

    if (!handler) {
      throw new UnreachableError('tried to send money to non-existent account. accountId=' + accountId)
    }

    return handler(amount)
  }

  getMiddleware (name: string): Middleware | undefined {
    return this.middlewares[name]
  }

  private createHandler<T,U> (pipeline: Pipeline<T,U>, accountId: string, next: (param: T) => Promise<U>): (param: T) => Promise<U> {
    const middleware: MiddlewareMethod<T,U> = composeMiddleware(pipeline.getMethods());

    return (param: T) => middleware(param, next)
  }
}
