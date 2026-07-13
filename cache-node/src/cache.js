const LRUCache = require('./lru');

class Cache {
    constructor(capacity = 100) {
        this.lru = new LRUCache(capacity);
        this.hits = 0;
        this.misses = 0;
        
        // run expired key cleanup every 30 seconds
        setInterval(() => {
            this.lru.evictExpired();
        }, 30000);
    }

    get(key) {
        const value = this.lru.get(key);
        if (value === null) {
            this.misses++;
            return null;
        }
        this.hits++;
        return value;
    }

    set(key, value, ttl = null) {
        this.lru.set(key, value, ttl);
        return true;
    }

    delete(key) {
        return this.lru.delete(key);
    }

    flush() {
        this.lru = new LRUCache(this.lru.capacity);
        this.hits = 0;
        this.misses = 0;
    }

    stats() {
        const lruStats = this.lru.getStats();
        return {
            ...lruStats,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits + this.misses === 0 ? 0 :
                ((this.hits / (this.hits + this.misses)) * 100).toFixed(2) + '%'
        };
    }
}

module.exports = Cache;