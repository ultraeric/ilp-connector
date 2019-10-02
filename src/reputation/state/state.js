//

// State implements the Map interface and the Listener interface
class State {
  constructor () {
    this.kvStore = {};
    this.listeners = {}; // map<string => Set[function]> Listeners are of the form function(oldVal, newVal)

    this.has.bind(this);
    this.set.bind(this);
    this.get.bind(this);
    this.delete.bind(this);
    this.hasListeners.bind(this);
    this.hasListener.bind(this);
    this.addListener.bind(this);
    this.getListeners.bind(this);
    this.deleteListener.bind(this);
  }

  // Returns whether key s
  // k: string, key to check
  has(k) {
    return k in Object.keys(this.kvStore);
  }

  // Contract: DO NOT ALTER prevV. Make a copy if changes are made.
  // Sets a new value for k and notifies all listeners of the state change
  // k: string, key to store
  // v: any, value to store
  set(k, v) {
    let prevV = this.kvStore[k];
    this.kvStore[k] = v;
    if (k in Object.keys(this.listeners)) {
      for (let f of this.listeners[k]) {
        f(prevV, v);
      }
    }
  }

  // k: string, key to retrieve from
  get(k) {
    return this.kvStore[k];
  }

  // Returns whether key existed
  // k: string, key to delete
  delete(k) {
    return delete this.kvStore[k]
  }

  // Returns if the specified key has any listeners at all
  // k: string
  hasListeners(k) {
    return (k in Object.keys(this.listeners)) && this.listeners[k].size !== 0;
  }

  // Returns if the specified key has a listener with the specific function signature
  // k: string
  // f: function
  hasListener(k, f) {
    if (this.hasListeners(k)) {
      return f in this.listeners[k];
    }
    return false
  }

  // k: string, key to listen to
  // v: any, function to listen to
  addListener(k, f) {
    if (this.hasListeners(k)) {
      this.listeners[k].add(f);
    } else {
      this.listeners[k] = new Set([f]);
    }
  }

  // Returns the listener that is listening to changes in this key
  // k: string, key to find listeners
  getListeners(k) {
    return this.listeners[k];
  }

  // Removes the listener specified by the specific key and function signature and returns if it existed
  // k: string, key to find listener
  // f: function, used to compare
  deleteListener(k, f) {
    if (this.hasListeners(k)) {
      return this.listeners[k].delete(f);
    }
    return false;
  }
}

const globalState = new State();

module.exports = { globalState };
