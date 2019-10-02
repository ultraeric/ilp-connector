const globalState = require('../state/state').globalState;
const asyncMsgHandler = require('../mh/mh').asyncMsgHandler;

const proposalStorePrefix = '000-reputation-userproposals-';
const paychanPrefix = '000-reputation-paychan-';
const defaultCreditLimit = '100';
const defaultTimeLimit = '100';

class ConnectorApi {
  constructor(ledgers=[]) {
    this.ledgers = {};

    this.registerLedger.bind(this);
    this.onReceiveLedgers.bind(this);
    this.onReceiveSenderCommit.bind(this);
    this.createProposeAgreement.bind(this);
    this.createAcceptAgreement.bind(this);

    asyncMsgHandler.registerListener(this.checkIfReceiveLedgers, this.onReceiveLedgers);
    asyncMsgHandler.registerListener(this.checkIfSenderCommit, this.onReceiveSenderCommit);

    for (let ledger of ledgers) { this.registerLedger(ledger); }
  }

  // Registers a new ledger.
  // ledger: Ledger. Ledger must conform to ledger API in src/reputation/ledgers
  registerLedger(ledger) {
    this.ledgers[ledger.id] = ledger;
  }

  // Implements cond api from `src/reputation/mh`
  checkIfReceiveLedgers(peerAddr, amt, rawData) {
    try {
      rawData = JSON.parse(rawData);
      return ('type' in rawData) && (rawData.type === (paychanPrefix + 'SendLedgers')) ;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  // Implements callback api from `src/reputation/mh`
  onReceiveLedgers(peerAddr, amt, rawData) {
    rawData = JSON.parse(rawData);
    console.log('Connector: Received Ledgers');
    console.log(rawData);
    for (let ledgerType of rawData.ledgers) {
      if (ledgerType in this.ledgers) {
        // Type Buffer
        let proposeAgreement = this.createProposeAgreement(
          peerAddr,
          defaultCreditLimit,
          defaultTimeLimit,
          ledgerType,
          this.ledgers[ledgerType].getLedgerData());
        asyncMsgHandler.sendRaw(peerAddr, '0', proposeAgreement);
        return;
      }
    }
  }

  // Implements cond api from `src/reputation/mh`
  checkIfSenderCommit(peerAddr, amt, rawData) {
    try {
      rawData = JSON.parse(rawData);
      return ('type' in rawData) && (rawData.type === (paychanPrefix + 'SenderCommit')) ;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  // Implements callback api from `src/reputation/mh`
  onReceiveSenderCommit(peerAddr, amt, rawData) {
    rawData = JSON.parse(rawData);
    console.log('Connector: Received Sender Commit');
    console.log(rawData);
    for (let ledgerType of rawData.ledgers) {
      if (ledgerType in this.ledgers) {
        // Type Buffer
        let acceptAgreement = this.createAcceptAgreement(peerAddr, rawData.userId, rawData.userProof);
        asyncMsgHandler.sendRaw(peerAddr, '0', acceptAgreement);
        return;
      }
    }
  }

  // Proposes an agreement to a user
  // peerAddr: string
  // creditLimit: string(number)
  // timeLimit: number (blocks)
  // ledgerType: string
  // ledgerData: {subId, url?, hash?}
  // connectorId: string (connector's identifier on the ledger)
  createProposeAgreement(peerAddr, creditLimit, timeLimit, ledgerType, ledgerData) {
    if (ledgerType in this.ledgers) {
      let ledger = this.ledgers.get(ledgerType);
      let connectorProof = ledger.commit(Buffer.from(`${creditLimit}:${timeLimit}`));
      const rawData = {
        type: paychanPrefix + 'ProposeUserAgreement',
        creditLimit,
        timeLimit,
        ledgerType,
        ledgerData,
        connectorId: ledger.getPublicId(),
        connectorProof
      };
      // Register so we can retrieve later
      globalState.set(proposalStorePrefix + peerAddr, rawData);
      return Buffer.from(JSON.stringify(rawData));
    } else {
      throw new Error('ledger not supported for collateralized payment channel w/ user');
    }
  }

  // peerAddr: string
  // userId: Buffer, user's identifier on the ledger
  // userProof: Buffer, proof that the userId accepted the amt + time from above
  //
  // return: bool, true/false ACK
  createAcceptAgreement(peerAddr, userId, userProof) {
    // Retrieve proposal that we are keeping track of
    let proposal = globalState.get(proposalStorePrefix + peerAddr);
    // Retrieve ledger that is being used for this peer
    let ledger = this.ledgers[proposal.ledgerType];
    // Get data that proof should prove
    let proofData = Buffer.from(`${proposal.creditLimit}:${proposal.timeLimit}`);
    if (!ledger.verifyCommit(proofData, userProof, userId)) {
      throw new Error('proof of agreement for ledger: ' + proposal.ledgerType + ' and userId: ' + userId + ' was not valid');
    }
    let res = ledger.setupEscrow(
      proposal.creditLimit,
      proposal.timeLimit,
      userId,
      proposal.connectorId,
      proposal.connectorProof,
      userProof
    );
    return Buffer.from(JSON.stringify({type: paychanPrefix + 'AcceptAgreement', result: res}))
  }
}

module.exports = { ConnectorApi };
