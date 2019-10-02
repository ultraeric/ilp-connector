// const mh = require('../mh/mh.js')

class UserApi {
  sendLedgers (supportedLedgers) {
    const packetData = {
      type: 'OnConnection',
      supportedLedgers: JSON.stringify(supportedLedgers)
    }
    // const supportedLedgersString = JSON.stringify(supportedLedgers)
    return Buffer.from(JSON.stringify(packetData))
  }

  sendPayment (data) {
    const packetData = {
      type: 'PaymentPacket',
      data
    }
    // const supportedLedgersString = JSON.stringify(supportedLedgers)
    return Buffer.from(JSON.stringify(packetData))
  }
}

module.exports = { UserApi }
