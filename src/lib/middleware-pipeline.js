"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MiddlewarePipeline {
    constructor() {
        this.entries = [];
    }
    insertFirst(entry) {
        this.entries = [entry, ...this.entries];
    }
    insertLast(entry) {
        this.entries = [...this.entries, entry];
    }
    insertBefore(middlewareName, entry) {
        const pipelineNames = this.entries.map((m) => m.name);
        const index = pipelineNames.indexOf(middlewareName);
        if (index === -1) {
            throw new Error(`could not insert before middleware; not found. name=${middlewareName}`);
        }
        this.entries = [
            ...this.entries.slice(0, index),
            entry,
            ...this.entries.slice(index)
        ];
    }
    insertAfter(middlewareName, entry) {
        const pipelineNames = this.entries.map((m) => m.name);
        const index = pipelineNames.indexOf(middlewareName);
        if (index === -1) {
            throw new Error(`could not insert after middleware; not found. name=${middlewareName}`);
        }
        this.entries = [
            ...this.entries.slice(0, index + 1),
            entry,
            ...this.entries.slice(index + 1)
        ];
    }
    getMethods() {
        return this.entries.map(e => e.method);
    }
}
exports.default = MiddlewarePipeline;
//# sourceMappingURL=middleware-pipeline.js.map