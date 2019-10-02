"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const log = log_1.create('echo');
const ilp_packet_1 = require("ilp-packet");
const oer_utils_1 = require("oer-utils");
const config_1 = require("../services/config");
const route_builder_1 = require("../services/route-builder");
const { InvalidPacketError } = ilp_packet_1.Errors;
const MINIMUM_ECHO_PACKET_DATA_LENGTH = 16 + 1;
const ECHO_DATA_PREFIX = Buffer.from('ECHOECHOECHOECHO', 'ascii');
class EchoController {
    constructor(deps) {
        this.config = deps(config_1.default);
        this.routeBuilder = deps(route_builder_1.default);
    }
    async handle(data, sourceAccount, { parsedPacket, outbound }) {
        if (parsedPacket.data.length < MINIMUM_ECHO_PACKET_DATA_LENGTH) {
            throw new InvalidPacketError('packet data too short for echo request. length=' + parsedPacket.data.length);
        }
        if (!parsedPacket.data.slice(0, 16).equals(ECHO_DATA_PREFIX)) {
            throw new InvalidPacketError('packet data does not start with ECHO prefix.');
        }
        const reader = new oer_utils_1.Reader(parsedPacket.data);
        reader.skip(ECHO_DATA_PREFIX.length);
        const type = reader.readUInt8Number();
        if (type === 0) {
            const sourceAddress = reader.readVarOctetString().toString('ascii');
            log.trace('responding to ping. sourceAccount=%s sourceAddress=%s cond=%s', sourceAccount, sourceAddress, parsedPacket.executionCondition.slice(0, 9).toString('base64'));
            const nextHop = this.routeBuilder.getNextHop(sourceAccount, sourceAddress);
            const writer = new oer_utils_1.Writer();
            writer.write(ECHO_DATA_PREFIX);
            writer.writeUInt8(0x01);
            return outbound(ilp_packet_1.serializeIlpPrepare({
                amount: parsedPacket.amount,
                destination: sourceAddress,
                executionCondition: parsedPacket.executionCondition,
                expiresAt: new Date(Number(parsedPacket.expiresAt) - this.config.minMessageWindow),
                data: writer.getBuffer()
            }), nextHop);
        }
        else {
            log.error('received unexpected ping response. sourceAccount=%s', sourceAccount);
            throw new InvalidPacketError('unexpected ping response.');
        }
    }
}
exports.default = EchoController;
//# sourceMappingURL=echo.js.map