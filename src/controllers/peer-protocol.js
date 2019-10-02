"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IlpPacket = require("ilp-packet");
const ildcp_host_1 = require("./ildcp-host");
const ccp_1 = require("./ccp");
const { InvalidPacketError } = IlpPacket.Errors;
const PEER_PROTOCOL_CONDITION = Buffer.from('Zmh6rfhivXdsj8GLjp+OIAiXFIVu4jOzkCpZHQ1fKSU=', 'base64');
class PeerProtocolController {
    constructor(deps) {
        this.ildcpHostController = deps(ildcp_host_1.default);
        this.ccpController = deps(ccp_1.default);
    }
    async handle(data, sourceAccount, { parsedPacket }) {
        if (!PEER_PROTOCOL_CONDITION.equals(parsedPacket.executionCondition)) {
            throw new InvalidPacketError('condition must be peer protocol condition.');
        }
        if (parsedPacket.destination === 'peer.config') {
            return this.ildcpHostController.handle(data, sourceAccount);
        }
        else if (parsedPacket.destination.startsWith('peer.route')) {
            return this.ccpController.handle(data, sourceAccount, { parsedPacket });
        }
        else {
            throw new InvalidPacketError('unknown peer protocol.');
        }
    }
}
exports.default = PeerProtocolController;
//# sourceMappingURL=peer-protocol.js.map