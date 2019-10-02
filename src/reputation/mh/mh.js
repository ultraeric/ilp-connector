// A message queue.
const IlpPacket = require("ilp-packet/dist/index");
const globalState = require("../state/state").globalState;
const peerAccounts = require("../state/peer-accounts").peerAccounts;

// data: Buffer
function formatPacket(data) {
  let ilpPacket = {
    amount: '0',
    executionCondition: Buffer.alloc(32),
    expiresAt: new Date(4000, 12),
    destination: 'reputation-placeholder',
    data: data
  };
  return serializeIlpPrepare(ilpPacket);
}

class AsyncMsgHandler {
  constructor () {
    // Stores string(func) => List[func(addr, msg), Set<func>]
    this.callbacks = {};

    this.registerPlugin.bind(this);
    this.isPluginConnected.bind(this);
    this.deletePlugin.bind(this);
    this.sendRaw.bind(this);
    this.handleMsg.bind(this);
    this.registerListener.bind(this);
    this.deleteListener.bind(this);
    this.deleteListeners.bind(this);
  }

  // peerAddr: string
  // plugin: Plugin
  async registerPlugin(peerAddr, plugin) {
    if (plugin) {
      peerAccounts.addAccount(peerAddr, plugin);
      plugin.registerDataHandler((data) => {
        const parsedPacket = IlpPacket.deserializeIlpPrepare(data);
        this.handleMsg(parsedPacket);
      });
    }
  }

  // peerAddr: string
  async isPluginConnected(peerAddr) {
    return peerAccounts.getAccount(peerAddr).isConnected();
  }

  // peerAddr: string
  async deletePlugin(peerAddr) {
    return peerAccounts.deleteAccount(peerAddr)
  }

  // GOTCHA: plugin is not necessarily connected
  // Send a raw buffer to a peer given a peer address
  // rawBuf: Buffer
  async sendRaw (peerAddr, rawBuf) {
    let plugin = peerAccounts.getAccount(peerAddr);
    return plugin.sendData(formatPacket(rawBuf));
  }

  // Queues the message for the event loop to later handle
  // Returns a Promise<bool> that is resolved when the message is processed.
  // peerSourceAddr: string
  // msg: Buffer
  async handleMsg (peerSourceAddr, msg) {
    return new Promise( // Return a promise
      (res, rej) => {
        setTimeout( // Make this async call
          () => {
            let caught = false;
            for (let pair of Object.values(this.callbacks)) {
              if (pair[0](peerSourceAddr, msg)) {
                caught = true;
                for (let cb of pair[0]) { // Call every single listener
                  setTimeout(() => cb(peerSourceAddr, msg), 0);
                }
              }
            }
            res(caught);
          }, 0);
      }
    );
  }

  // cond: function
  hasCondition(cond) {
    return cond.toString() in Object.keys(this.callbacks);
  }

  // Delete all listeners associated with the condition and returns if successful
  // cond: function
  deleteListeners(cond) {
    return delete this.callbacks[cond.toString()];
  }

  // Deletes a condition's specific callback and returns if successful
  // cond: function
  // cb: function
  deleteListener (cond, cb) {
    if (this.hasCondition(cond)) {
      return this.callbacks[cond.toString()][1].delete(cb);
    }
    return false
  }

  // cond: function(ilpPreparePacket) => bool, a function that returns true or false depending on the msg that is passed in.
  // cb: function(ilpPreparePacket) => null, a function that is called if the condition is true
  registerListener (cond, cb) {
    if (this.hasCondition()) {
      this.callbacks[cond.toString()][1].add(cb);
    } else {
      this.callbacks[cond.toString()] = [cond, new Set([cb])];
    }
  }
}

const asyncMsgHandler = new AsyncMsgHandler();

module.exports = { AsyncMsgHandler, asyncMsgHandler };
