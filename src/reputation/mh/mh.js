// A message queue.
const IlpPacket = require("ilp-packet/dist/index");
const globalState = require("../state/state").globalState;
const peerAccounts = require("../state/peer-accounts").peerAccounts;

/**
 * AsyncMsgHandler
 *
 * Primary goal is to provide read/write capabilities from and to particular peer addresses
 *
 * Cond API: (peerAddr: string, amt: string, rawData: Buffer) => bool, whether or not to capture this packet
 * Callback API: (peerAddr: string, amt: string, rawData: Buffer) => null, callback that is called when the corresponding
 *    Cond returns true
 *
 * blockPayments(peerAddr: string) => null, blocks payments from going through. Only works when part of ilp-connector
 * allowPayments(peerAddr: string) => null, allows payments. Only works when part of ilp-connector
 * registerPlugin(peerAddr: string, plugin: Plugin) => null, registers the plugin into this packet listener. Will intercept
 *    all data packets coming through
 * isPluginConnected(peerAddr: string) => bool, returns whether the plugin is connected on the other end or not
 * deletePlugin(peerAddr: string) => null, deletes a plugin
 * sendRaw(peerAddr: string, amount: string, rawData: Buffer) => Promise, sends the raw amount and raw data to the peer address.
 *    Note that this method should not be used for any ILP cross-network payments.
 * registerListener (cond: func<Cond>, cb: func<Callback>) => null, registers the condition that should trigger a callback.
 * hasCondition (cond: func<Cond>) => bool, returns whether this is currently listening to a condition
 * deleteListeners (cond: func<Cond>) => bool, deletes callbacks and returns whether anything was deleted
 * deleteListener (cond: func<Cond>, cb: func<Callback) => bool, deletes callback associated with a specific condition
 *    returns whether anything was deleted
 */

// amount: string
// data: Buffer
function formatDataPacket(amount, data) {
  let ilpPacket = {
    amount: amount,
    executionCondition: Buffer.alloc(32),
    expiresAt: new Date(4000, 12),
    destination: 'reputation-placeholder',
    data: data
  };
  return IlpPacket.serializeIlpPrepare(ilpPacket);
}



class AsyncMsgHandler {
  constructor () {
    // Stores string(func) => List[func(addr, amt, msg), Set<func(addr, amt, msg)>]
    this.callbacks = {};
    // Stores peerAddr => List[blocking condition, null cb]
    this.blockers = {};

    this.blockPayments.bind(this);
    this.allowPayments.bind(this);
    this.registerPlugin.bind(this);
    this.isPluginConnected.bind(this);
    this.deletePlugin.bind(this);
    this.sendRaw.bind(this);
    this.handleMsg.bind(this);
    this.registerListener.bind(this);
    this.deleteListener.bind(this);
    this.deleteListeners.bind(this);
  }

  // Block all payments from this peer address
  blockPayments(peerAddr) {
    if (!(peerAddr in this.blockers)) {
      this.blockers[peerAddr] = [
        // Condition function
        (pa, amt, _) => {
          return (peerAddr === pa && amt > '0');
        },
        // Null callback function
        (a, b, c) => null
      ];
      this.registerListener(this.blockers[peerAddr][0], this.blockers[peerAddr][1]);
    }
  }

  // Allow all payments from this peer address
  allowPayments(peerAddr) {
    this.deleteListener(this.blockers[peerAddr][0], this.blockers[peerAddr][1]);
  }

  // peerAddr: string
  // plugin: Plugin
  async registerPlugin(peerAddr, plugin) {
    if (plugin) {
      peerAccounts.addAccount(peerAddr, plugin);
      plugin.registerDataHandler((data) => {
        const parsedPacket = IlpPacket.deserializeIlpPrepare(data);
        return this.handleMsg(peerAddr, parsedPacket.amount, parsedPacket.data);
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
  async sendRaw (peerAddr, amount, rawBuf) {
    let plugin = peerAccounts.getAccount(peerAddr);
    return plugin.sendData(formatDataPacket(amount, rawBuf));
  }

  // Queues the message for the event loop to later handle
  // Returns a Promise<bool> that is resolved when the message is processed.
  // peerSourceAddr: string
  // msg: Buffer
  async handleMsg (peerSourceAddr, amount, msg) {
    return new Promise( // Return a promise
      (res, rej) => {
        setTimeout( // Make this async call
          () => {
            let caught = false;
            for (let pair of Object.values(this.callbacks)) {
              if (pair[0](peerSourceAddr, amount, msg)) {
                caught = true;
                for (let cb of pair[1]) { // Call every single listener
                  setTimeout(() => cb(peerSourceAddr, amount, msg), 0);
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
    return Object.keys(this.callbacks).includes(cond.toString());
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
    if (this.hasCondition(cond)) {
      this.callbacks[cond.toString()][1].add(cb);
    } else {
      this.callbacks[cond.toString()] = [cond, new Set([cb])];
    }
  }
}

const asyncMsgHandler = new AsyncMsgHandler();

module.exports = { AsyncMsgHandler, asyncMsgHandler };
