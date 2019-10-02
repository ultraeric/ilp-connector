"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TokenBucket {
    constructor({ refillPeriod, refillCount, capacity }) {
        this.lastTime = Date.now();
        this.capacity = (typeof capacity !== 'undefined') ? capacity : refillCount;
        this.left = this.capacity;
        this.refillRate = refillCount / refillPeriod;
    }
    take(count = 1) {
        const now = Date.now();
        const delta = Math.max(now - this.lastTime, 0);
        const amount = delta * this.refillRate;
        this.lastTime = now;
        this.left = Math.min(this.left + amount, this.capacity);
        if (this.left < count) {
            return false;
        }
        this.left -= count;
        return true;
    }
}
exports.default = TokenBucket;
//# sourceMappingURL=token-bucket.js.map