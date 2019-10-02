"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getRelationPriority(relation) {
    return {
        parent: 0,
        peer: 1,
        child: 2,
        local: 3
    }[relation];
}
exports.getRelationPriority = getRelationPriority;
//# sourceMappingURL=relation.js.map