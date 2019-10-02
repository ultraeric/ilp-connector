const globalState = require("./state").globalState;

class PeerAccounts {
  constructor () {
    this.getAccounts.bind(this);
    this.getAccount.bind(this);
    this.addAccount.bind(this);
    this.deleteAccount.bind(this);
  }

  // Returns all tracked peer accounts as a map (peerId => plugin)
  getAccounts() {
    return Object.assign({}, globalState.get('000-reputation-accounts'));
  }

  // Return plugin associated with an address or null if doesn't exist
  // peerAddr: string
  getAccount(peerAddr) {
    let accts = globalState.get('000-reputation-accounts');
    return peerAddr in Object.keys(accts) ? accts[peerAddr] : null;
  }

  // Adds a tracked peer account
  addAccount(peerAddr, plugin) {
    let accts = this.getAccounts();
    accts[peerAddr] = plugin;
    globalState.set('000-reputation-accounts', accts);
  }

  // Deletes a tracked peer account
  deleteAccount(peerAddr) {
    let accts = this.getAccounts();
    delete accts[peerAddr];
    globalState.set('000-reputation-accounts', peerAddr);
  }
}

const peerAccounts = new PeerAccounts();

module.exports = { peerAccounts };
