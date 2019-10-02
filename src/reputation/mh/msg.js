class Msg {
  constructor(from, to, data) {
    this.from = from;
    this.to = to;
    this.data = data;
  }
}

module.exports = { Msg };
