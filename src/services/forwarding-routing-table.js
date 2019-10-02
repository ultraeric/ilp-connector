"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prefix_map_1 = require("../routing/prefix-map");
const utils_1 = require("../lib/utils");
class ForwardingRoutingTable extends prefix_map_1.default {
    constructor() {
        super(...arguments);
        this.routingTableId = utils_1.uuid();
        this.log = [];
        this.currentEpoch = 0;
    }
}
exports.default = ForwardingRoutingTable;
//# sourceMappingURL=forwarding-routing-table.js.map