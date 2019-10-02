// Use ilp-btp to send packet across link layer to connector
const IlpPacket = require('ilp-packet')
const crypto = require('crypto')
// const mh = require('../mh/mh.js');
const UserApi = require('./api.js')
const GlobalState = require('../state/state.js')

// const client = new BtpPlugin({
//   server: 'btp+ws://:secret@localhost:9000'
// })

export default class UserClient {
  constructor (args) {
    this.privateKey = GlobalState.get('privateKey');
    this.supportedLedgers = GlobalState.get('supportedLedgers') // A key:value mapping ledgerId:userId
  }

  // Payment Agreement Phase
  // genPaymentAgreement (creditLimit, timeLimit, ledgerType, contractAddress = '0x') {
  //   const sign = crypto.createSign('SHA256')
  //   sign.write(`${creditLimit}:${timeLimit}`)
  //   sign.end()
  //   const signature = sign.sign(this.privateKey, 'hex')
  //   const rawData = {
  //     creditLimit,
  //     timeLimit,
  //     ledgerType,
  //     contractAddress,
  //     signature
  //   }
  //   const rawDataString = JSON.stringify(rawData)

  //   return rawDataString
  // }
  genSupportedLedgers () {
    return UserApi.sendLedgers(this.supportedLedgers);
  }

  // Actual payment phase
  // rawBuf: JSON.stringify({recipient ILP address (string), amount (string), condition (Buffer(32 bytes), encrypted preimage (Buffer(32 bytes), signature(amt || condition)})
  genPayment (recipientAddress, amount) {
    const data = {recipientAddress, amount}
    // Generate 32 Byte condition
    // Generate encrypted preimage
    // Generate signature
    return UserApi.sendPayment(data)
  }
}