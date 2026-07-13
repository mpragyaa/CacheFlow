const express = require('express');
const cors = require('cors');
const Cache = require('./cache');
const http = require('http');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const cache = new Cache(process.env.CACHE_CAPACITY || 100);
const NODE_ID = 'node-2';

// publish invalidation event to message queue
function publishInvalidation(key, action) {
    const data = JSON.stringify({
        topic: 'cache:invalidate',
        message: { key, action, node: NODE_ID, timestamp: new Date().toISOString() }
    });
    const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/publish',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options);
    req.write(data);
    req.end();
}

// poll queue for invalidation events every second
function pollInvalidations() {
    setInterval(async () => {
        try {
            const data = JSON.stringify({});
            const options = {
                hostname: 'localhost',
                port: 3002,
                path: `/consume/cache:invalidate/${NODE_ID}`,
                method: 'GET',
            };
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        parsed.messages.forEach(msg => {
                            // only process events from OTHER nodes
                            if (msg.payload.node !== NODE_ID) {
                                if (msg.payload.action === 'delete') {
                                    cache.delete(msg.payload.key);
                                    console.log(`[${NODE_ID}] Invalidated key: ${msg.payload.key}`);
                                } else if (msg.payload.action === 'flush') {
                                    cache.flush();
                                    console.log(`[${NODE_ID}] Cache flushed by remote event`);
                                }
                            }
                        });
                    } catch (e) {}
                });
            });
            req.end();
        } catch (e) {}
    }, 1000);
}

// start polling
pollInvalidations();

// ── ROUTES ──
app.get('/cache/:key', (req, res) => {
    const { key } = req.params;
    const value = cache.get(key);
    if (value === null) {
        return res.status(404).json({ hit: false, key, value: null, message: 'Cache miss', node: NODE_ID });
    }
    res.json({ hit: true, key, value, message: 'Cache hit', node: NODE_ID });
});

app.post('/cache', (req, res) => {
    const { key, value, ttl } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
    cache.set(key, value, ttl || null);
    res.json({ success: true, key, value, ttl: ttl || 'no expiry', node: NODE_ID });
});

app.delete('/cache/:key', (req, res) => {
    const { key } = req.params;
    const deleted = cache.delete(key);
    if (!deleted) return res.status(404).json({ error: 'Key not found' });
    publishInvalidation(key, 'delete');
    res.json({ success: true, key, message: 'Key deleted', node: NODE_ID });
});

app.delete('/cache', (req, res) => {
    cache.flush();
    publishInvalidation('*', 'flush');
    res.json({ success: true, message: 'Cache flushed', node: NODE_ID });
});

app.get('/stats', (req, res) => {
    res.json({ ...cache.stats(), node: NODE_ID });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', node: NODE_ID, uptime: process.uptime() });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Cache node 2 running on port ${PORT}`);
});