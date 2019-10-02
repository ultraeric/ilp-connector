"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../common/log");
const log = log_1.create('dragon');
const relation_1 = require("./relation");
function canDragonFilter(routingTable, getRelation, prefix, route) {
    for (const parentPrefix of routingTable.getKeysPrefixesOf(prefix)) {
        const parentRouteUpdate = routingTable.get(parentPrefix);
        if (!parentRouteUpdate || !parentRouteUpdate.route) {
            log.warn('found a parent prefix, but no parent route; this should never happen. prefix=%s parentPrefix=%s', prefix, parentPrefix);
            continue;
        }
        const parentRoute = parentRouteUpdate.route;
        if (parentRoute.nextHop === '') {
            continue;
        }
        const parentRelation = getRelation(parentRoute.nextHop);
        const childRelation = getRelation(route.nextHop);
        if (relation_1.getRelationPriority(parentRelation) < relation_1.getRelationPriority(childRelation)) {
            continue;
        }
        log.trace('applied DRAGON route filter. prefix=%s parentPrefix=%s', prefix, parentPrefix);
        return true;
    }
    return false;
}
exports.canDragonFilter = canDragonFilter;
//# sourceMappingURL=dragon.js.map