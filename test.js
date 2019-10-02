const BtpPlugin = require('ilp-plugin-btp');
const IlpPacket = require('ilp-packet');

function serData (accountId, data) {
  let ilpPacket = {
    amount: '0',
    executionCondition: Buffer.alloc(32),
    expiresAt: new Date(3000, 12),
    destination: accountId,
    data: data
  };
  return IlpPacket.serializeIlpPrepare(ilpPacket);
}

const client = new BtpPlugin({
    server: 'btp+ws://:secret123@192.168.1.114:9000'
})

client.connect().then(() => console.log('connected'))
