"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
function formatRouteAsJson(route) {
    return Object.assign({}, route, { auth: undefined, path: route.path.join(' ') });
}
exports.formatRouteAsJson = formatRouteAsJson;
function formatRoutingTableAsJson(routingTable) {
    return lodash_1.mapValues(routingTable.toJSON(), formatRouteAsJson);
}
exports.formatRoutingTableAsJson = formatRoutingTableAsJson;
function formatForwardingRoutingTableAsJson(routingTable) {
    return lodash_1.mapValues(routingTable.toJSON(), (routeUpdate) => (routeUpdate.route
        ? formatRouteAsJson(routeUpdate.route)
        : null));
}
exports.formatForwardingRoutingTableAsJson = formatForwardingRoutingTableAsJson;
//# sourceMappingURL=utils.js.map