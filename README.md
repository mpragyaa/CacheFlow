# CacheFlow
# CacheFlow

A distributed in-memory caching system built from scratch — featuring LRU eviction, a custom pub/sub message queue, cross-node cache invalidation, and a real-time React dashboard.

> Built to demonstrate core distributed systems concepts: cache consistency, event-driven architecture, and real-time observability.

---

## Architecture

```
┌─────────────────┐        ┌─────────────────┐
│  Cache Node 1   │        │  Cache Node 2   │
│   (port 3001)   │        │   (port 3003)   │
│                 │        │                 │
│  LRU Cache      │        │  LRU Cache      │
│  capacity: 100  │        │  capacity: 100  │
└────────┬────────┘        └────────┬────────┘
         │  publish invalidation    │  consume invalidation
         │                          │
         └──────────┬───────────────┘
                    │
          ┌─────────▼─────────┐
          │   Message Queue   │
          │   (port 3002)     │
          │                   │
          │  topic-based pub/ │
          │  sub, offset track│
          └───────────────────┘
                    │
          ┌─────────▼─────────┐
          │  React Dashboard  │
          │   (port 3000)     │
          │                   │
          │  hit/miss rates   │
          │  invalidation log │
          └───────────────────┘
```

**How it works:**
1. Each cache node runs an independent LRU cache with a REST API
2. When a key is deleted from any node, it publishes a `cache:invalidate` event to the message queue
3. Other nodes consume from the queue and evict the same key from their local cache
4. The React dashboard polls both nodes and the queue to visualize cache state in real time

---

## Features

- **LRU Eviction** — doubly linked list + hashmap implementation, O(1) get and set
- **Pub/Sub Message Queue** — topic-based messaging with consumer offset tracking
- **Cross-node Cache Invalidation** — delete on one node, auto-evicts on all others
- **REST API** — full CRUD on cache keys across both nodes
- **Real-time Dashboard** — hit/miss rates, cache size, and invalidation events via React + Recharts

---

## Tech Stack

| Layer | Tech |
|---|---|
| Cache Nodes | Node.js, Express |
| Message Queue | Node.js, Express (custom pub/sub) |
| Dashboard | React, Recharts |
| Data Structure | Custom LRU (doubly linked list + hashmap) |

---

## Getting Started

**Prerequisites:** Node.js v18+

**1. Clone the repo**
```bash
git clone https://github.com/mpragyaa/CacheFlow.git
cd CacheFlow
```

**2. Install dependencies for each service**
```bash
cd message-queue && npm install && cd ..
cd cache-node && npm install && cd ..
cd cache-node-2 && npm install && cd ..
cd dashboard && npm install && cd ..
```

**3. Start all services** (4 separate terminals)

```bash
# Terminal 1 — Message Queue
cd message-queue && node src/index.js

# Terminal 2 — Cache Node 1
cd cache-node && node src/index.js

# Terminal 3 — Cache Node 2
cd cache-node-2 && node src/index.js

# Terminal 4 — Dashboard
cd dashboard && npm start
```

---

## API Reference

### Cache Nodes (Node 1: 3001, Node 2: 3003)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/cache/:key` | Get a value (returns hit/miss) |
| `POST` | `/cache` | Set a key-value pair |
| `DELETE` | `/cache/:key` | Delete a key + publish invalidation event |
| `DELETE` | `/cache` | Flush entire cache |
| `GET` | `/stats` | Cache size, capacity, all keys |
| `GET` | `/health` | Health check |

**Set a key:**
```json
POST /cache
{
  "key": "user:1",
  "value": "John"
}
```

### Message Queue (port 3002)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/publish` | Publish a message to a topic |
| `GET` | `/consume/:topic/:consumerId` | Consume messages from a topic |
| `GET` | `/stats` | All topics and message counts |

---

## Demo: Cross-node Cache Invalidation

```bash
# 1. Set a key on Node 2
POST http://localhost:3003/cache
{ "key": "user:1", "value": "John" }

# 2. Verify it exists on Node 2
GET http://localhost:3003/cache/user:1
→ { "hit": true, "value": "John" }

# 3. Delete from Node 1
DELETE http://localhost:3001/cache/user:1

# 4. Check Node 2 — key is gone
GET http://localhost:3003/cache/user:1
→ { "hit": false, "value": null, "message": "Cache miss" }
```

Node 1 published a `cache:invalidate` event → Node 2 consumed it → key evicted automatically.

---

## Project Structure

```
CacheFlow/
├── cache-node/          # Cache Node 1 (port 3001)
│   └── src/
│       ├── index.js     # Express API + invalidation publisher
│       ├── cache.js     # Cache wrapper
│       └── lru.js       # LRU implementation (linked list + hashmap)
├── cache-node-2/        # Cache Node 2 (port 3003)
│   └── src/
│       ├── index.js     # Express API + queue consumer
│       ├── cache.js
│       └── lru.js
├── message-queue/       # Pub/Sub Queue (port 3002)
│   └── src/
│       ├── index.js     # Express API
│       └── queue.js     # Topic-based queue with offset tracking
└── dashboard/           # React Dashboard (port 3000)
    └── src/
        └── App.js       # Real-time hit/miss + invalidation UI
```

---

## Concepts Demonstrated

- **Cache consistency** in distributed systems
- **Event-driven architecture** via pub/sub
- **LRU cache** implementation from scratch
- **Consumer offset tracking** for reliable message delivery
- **REST API design** for stateful services

---

