const express = require('express');
const cors = require('cors');
const Queue = require('./queue');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const queue = new Queue();

// create a topic
app.post('/topics', (req, res) => {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    queue.createTopic(topic);
    res.json({ success: true, topic });
});

// publish a message to a topic
app.post('/publish', (req, res) => {
    const { topic, message } = req.body;
    if (!topic || !message) return res.status(400).json({ error: 'topic and message are required' });
    const msg = queue.publish(topic, message);
    res.json({ success: true, message: msg });
});

// consume messages from a topic
app.get('/consume/:topic/:consumerId', (req, res) => {
    const { topic, consumerId } = req.params;
    const messages = queue.consume(topic, consumerId);
    res.json({ success: true, messages, count: messages.length });
});

// subscribe to a topic (long polling)
app.post('/subscribe', (req, res) => {
    const { topic, consumerId } = req.body;
    if (!topic || !consumerId) return res.status(400).json({ error: 'topic and consumerId required' });
    queue.subscribe(topic, consumerId, (msg) => {
        console.log(`Message delivered to ${consumerId}:`, msg);
    });
    res.json({ success: true, topic, consumerId });
});

// get all topics and stats
app.get('/stats', (req, res) => {
    res.json(queue.stats());
});

// health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Message queue running on port ${PORT}`);
});