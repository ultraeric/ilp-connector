/**
 * Ledger API:
 *
 * Represents a ledger-level connection for a single pair.
 *
 * Fields
 * - id: string, 3-4 letter identifier for ledger being used
 * - globalId: string, connector's identifier on the ledger
 *
 * Methods
 * - getPublicId() => Buffer, returns public identifier for an account on this ledger
 * - commit(data: Buffer) => Buffer, returns Buffer encompassing proof of commitment to the data. For centralized ledgers, this
 *      can be stored in a trusted fashion. For decentralized ledgers, this should be something like a signature.
 * - verifyCommit(data: Buffer, id: Buffer, proof: Buffer, publicId: Buffer) => bool, returns whether the proof satisfies the claim of data.
 * - setupEscrow(amt: string(int),
 *              time: int,
 *              idUser: Buffer,
 *              idConnector: Buffer,
 *              proofUser: Buffer,
 *              proofConnector: Buffer) => bool, returns whether escrow was successfully set up or not
 * - deposit(amt) => bool, returns whether deposit worked or not
 * - settle() => bool, returns whether settlement worked or not
 * - submitFulfillment(amt: string(int),
 *                     condition: Buffer,
 *                     satisfying: Buffer, // satisfying needs to satisfy the condition
 *                     proofUser: Buffer) => bool, returns whether submitted successfully or not
 * - getLedgerData() => {subId: Buffer, url?: string, hash?: Buffer}, additional information that lets the user know what
 *      agreement they are entering into. subId can consist of information such as: the subId of the escrow service, a
 *      smart contract address, etc. The url and hash allow the user to verify that the code they are agreeing to are
 *      as expected
 */

class Eth {
  constructor() {
    this.id = 'ETH';
    this.globalId = ''; //TODO
  }

  getPublicId() {
  }

  getLedgerData() {

  }

  commit(data) {

  }

  verifyCommit(data, proof, publicId) {

  }

  setupEscrow(amt, time, idUser, idConnector, proofUser, proofConnector) {

  }

  deposit(amt) {

  }
  settle() {

  }
  submitFulfillment(amt, condition, satisfying, proofUser) {

  }
}

module.exports = { Eth };
