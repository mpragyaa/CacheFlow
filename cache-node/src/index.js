
const express = require('express');
const cors = require('cors');
const Cache = require('./cache');
require('dotenv').config();
const http = require('http');

// publish invalidation event to message queue
function publishInvalidation(key, action) {
    const data = JSON.stringify({
        topic: 'cache:invalidate',
        message: { key, action, timestamp: new Date().toISOString() }
    });

    const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/publish',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = http.request(options);
    req.write(data);
    req.end();
}

const app = express();
app.use(cors());
app.use(express.json());

const cache = new Cache(process.env.CACHE_CAPACITY || 100);

// GET a value from cache
app.get('/cache/:key', (req, res) => {
    const { key } = req.params;
    const value = cache.get(key);
    
    if (value === null) {
        return res.status(404).json({
            hit: false,
            key,
            value: null,
            message: 'Cache miss'
        });
    }
    
    res.json({
        hit: true,
        key,
        value,
        message: 'Cache hit'
    });
});

// SET a value in cache
app.post('/cache', (req, res) => {
    const { key, value, ttl } = req.body;
    
    if (!key || value === undefined) {
        return res.status(400).json({ error: 'key and value are required' });
    }
    
    cache.set(key, value, ttl || null);
    
    res.json({
        success: true,
        key,
        value,
        ttl: ttl || 'no expiry'
    });
});

// DELETE a key from cache
app.delete('/cache/:key', (req, res) => {
    const { key } = req.params;
    const deleted = cache.delete(key);
    
    if (!deleted) {
        return res.status(404).json({ error: 'Key not found' });
    }

    // publish invalidation event to message queue
    publishInvalidation(key, 'delete');
    
    res.json({ success: true, key, message: 'Key deleted' });
});

// FLUSH entire cache
app.delete('/cache', (req, res) => {
    cache.flush();
    res.json({ success: true, message: 'Cache flushed' });
});

// GET cache stats
app.get('/stats', (req, res) => {
    res.json(cache.stats());
});

// health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Cache node running on port ${PORT}`);
});