const globalState = require("./state").globalState;


class PeerAccounts {
  constructor() {
    this.getAccounts.bind(this);
    this.getAccount.bind(this);
    this.addAccount.bind(this);
    this.deleteAccount.bind(this);
    this.registerNewAccountListener.bind(this);
    this.accountListener = null;
  }

  // Returns all tracked peer accounts as a map (peerId => plugin)
  getAccounts() {
    return Object.assign({}, globalState.get('000-reputation-accounts'));
  }

  // Return plugin associated with an address or null if doesn't exist
  // peerAddr: string
  getAccount(peerAddr) {
    let accts = globalState.get('000-reputation-accounts');
    for (let pa of Object.keys(accts)) {
      if (pa === peerAddr) {
        return accts[peerAddr];
      }
    }
    return null;
  }

  // Adds a tracked peer account
  addAccount(peerAddr, plugin) {
    let accts = this.getAccounts();
    accts[peerAddr] = plugin;
    globalState.set('000-reputation-accounts', accts);
    this._tryRegisterAcct(peerAddr, plugin);
  }

  // Deletes a tracked peer account
  deleteAccount(peerAddr) {
    let accts = this.getAccounts();
    delete accts[peerAddr];
    globalState.set('000-reputation-accounts', peerAddr);
  }

  // Register new account listener, only called when account is actually ready.
  // cb: func(string)
  registerNewAccountListener(cb) {
    if (!this.accountListener) {
      this.accountListener = cb;
    }
  }

  // Attempts to register plugin if it has connected to peer. If not, tries again in 250ms.
  _tryRegisterAcct(peerAddr, plugin) {
    if (plugin.isConnected()) {
      if (typeof(this.accountListener) === 'function') {
        this.accountListener(peerAddr, plugin);
      }
    } else {
      setTimeout(() => this._tryRegisterAcct(peerAddr, plugin), 250);
    }
  }
}

const peerAccounts = new PeerAccounts();

module.exports = { peerAccounts };
