const globalState = require('../state/state').globalState;
const peerAccounts = require('../state/peer-accounts').peerAccounts;
const asyncMsgHandler = require('../mh/mh').asyncMsgHandler;

const proposalStorePrefix = '000-reputation-connectorproposals-';
const paychanPrefix = '000-reputation-paychan-';

class ClientApi {
  constructor(ledgers=[]) {
    this.ledgers = {};

    this.getAcceptedProposals.bind(this);
    this.getOpenProposals.bind(this);
    this.checkIfProposal.bind(this);
    this.checkIfProposalACK.bind(this);
    this.onReceiveProposal.bind(this);
    this.onReceiveProposalACK.bind(this);
    this.registerLedger.bind(this);
    this.createSendLedgers.bind(this);
    this.createSenderCommit.bind(this);

    // When new plugin/account is created, send the peer your ledger information
    peerAccounts.registerNewAccountListener(
      (peerAddr) => {
        return asyncMsgHandler.sendRaw(peerAddr, '0', this.createSendLedgers());
      }
    );

    for (let ledger of ledgers) { this.registerLedger(ledger); }
  }

  // returns open proposals
  getOpenProposals() {
    return globalState.get(proposalStorePrefix + 'openProposals');
  }

  // Implements cond api from `src/reputation/mh`
  checkIfProposal(peerAddr, amt, rawData) {
    try {
      rawData = JSON.parse(rawData);
      return ('type' in rawData) && (rawData.type === (paychanPrefix + 'ProposeUserAgreement')) ;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  // Implements callback api from `src/reputation/mh`
  // Adds this proposal to the global store if it satisfies cryptographic properties
  onReceiveProposal(peerAddr, amt, rawData) {
    rawData = JSON.parse(rawData);
    console.log('User: Received Proposal');
    console.log(rawData);

    let ledger = this.ledgers[rawData.ledgerType];
    let verifyCommit = ledger.verifyCommit(
      Buffer.from(`${rawData.creditLimit}:${rawData.timeLimit}`),
      rawData.connectorProof,
      rawData.connectorId
    );
    if (!verifyCommit) {
      throw new Error('received proposal that is not signed by the claimed connector');
    }

    // Store peer address as well
    rawData.peerAddr = peerAddr;

    const storeKey = proposalStorePrefix + 'openProposals';
    let storeVal = Object.assign({}, rawData);
    delete storeVal.type;
    globalState.set(storeKey, (new Set(globalState.get(storeKey)).add(rawData)));
  }



  // Implements cond api from `src/reputation/mh`
  checkIfProposalACK(peerAddr, amt, rawData) {
    try {
      rawData = JSON.parse(rawData);
      return ('type' in rawData) && (rawData.type === (paychanPrefix + 'AcceptAgreement')) ;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  // Implements callback api from `src/reputation/mh`
  onReceiveProposalACK(peerAddr, amt, rawData) {
    rawData = JSON.parse(rawData);
    console.log('User: Received Proposal ACK');
    console.log(rawData);
    const storeOpenKey = proposalStorePrefix + 'openProposals';
    const storeAcceptedKey = proposalStorePrefix + 'acceptedProposals';
    let openProposals = new Set(globalState.get(storeOpenKey));
    let matchProposal = null;
    for (let proposal of openProposals) {
      if (proposal.peerAddr === peerAddr) {
        matchProposal = proposal;
        break;
      }
    }
    openProposals.delete(matchProposal);
    globalState.set(storeOpenKey, openProposals);
  }

  // returns accepted proposals
  getAcceptedProposals() {
    return globalState.get(proposalStorePrefix + 'acceptedProposals');
  }

  // Registers a new ledger.
  // ledger: Ledger. Ledger must conform to ledger API in src/reputation/ledgers
  registerLedger(ledger) {
    this.ledgers[ledger.id] = ledger;
  }

  // Sends supported ledgers to connector peer
  createSendLedgers() {
    const rawData = {
      type: paychanPrefix + 'SendLedgers',
      ledgers: Object.keys(this.ledgers)
    };
    return Buffer.from(JSON.stringify(rawData));
  }

  // peerAddr: string
  // ledgerType: string, ledgerType to use (3-4 letter identifier)
  // creditLimit: string(number)
  // timeLimit: number(blocks)
  createSenderCommit(peerAddr, ledgerType, creditLimit, timeLimit) {
    // Retrieve proposal that we are keeping track of
    let ledger = this.ledgers[ledgerType];
    // Get data that proof should prove
    let proofData = Buffer.from(`${creditLimit}:${timeLimit}`);
    let rawData = {
      type: paychanPrefix + 'SenderCommit',
      userId: ledger.getPublicId(),
      userProof: ledger.commit(proofData)
    };
    return Buffer.from(JSON.stringify(rawData));
  }
}

module.exports = { ClientApi };
