class Node {
    constructor(key, value) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map();
        
        // dummy head and tail nodes
        this.head = new Node(null, null); // most recent
        this.tail = new Node(null, null); // least recent
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    // add node right after head (most recent position)
    addToFront(node) {
        node.next = this.head.next;
        node.prev = this.head;
        this.head.next.prev = node;
        this.head.next = node;
    }

    // remove a node from its current position
    removeNode(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    get(key) {
        if (!this.map.has(key)) return null;
        
        const node = this.map.get(key);
        // move to front (most recently used)
        this.removeNode(node);
        this.addToFront(node);
        
        return node.value;
    }

    set(key, value, ttl = null) {
        if (this.map.has(key)) {
            // update existing
            const node = this.map.get(key);
            node.value = value;
            node.ttl = ttl ? Date.now() + ttl * 1000 : null;
            this.removeNode(node);
            this.addToFront(node);
        } else {
            // add new
            if (this.map.size >= this.capacity) {
                // evict least recently used (node before tail)
                const lru = this.tail.prev;
                this.removeNode(lru);
                this.map.delete(lru.key);
            }
            const node = new Node(key, value);
            node.ttl = ttl ? Date.now() + ttl * 1000 : null;
            this.addToFront(node);
            this.map.set(key, node);
        }
    }

    delete(key) {
        if (!this.map.has(key)) return false;
        const node = this.map.get(key);
        this.removeNode(node);
        this.map.delete(key);
        return true;
    }

    // remove expired keys
    evictExpired() {
        const now = Date.now();
        for (const [key, node] of this.map) {
            if (node.ttl && node.ttl < now) {
                this.removeNode(node);
                this.map.delete(key);
            }
        }
    }

    getStats() {
        return {
            size: this.map.size,
            capacity: this.capacity,
            keys: Array.from(this.map.keys())
        };
    }
}

module.exports = LRUCache;