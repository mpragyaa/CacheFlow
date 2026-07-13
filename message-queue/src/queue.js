class Queue {
    constructor() {
        this.topics = new Map(); // topic → array of messages
        this.consumers = new Map(); // topic → array of consumer callbacks
        this.offsets = new Map(); // consumerId → offset per topic
    }

    // create a topic if it doesn't exist
    createTopic(topic) {
        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.consumers.set(topic, []);
        }
        return true;
    }

    // publish a message to a topic
    publish(topic, message) {
        if (!this.topics.has(topic)) {
            this.createTopic(topic);
        }
        const msg = {
            id: Date.now() + Math.random().toString(36).slice(2),
            topic,
            payload: message,
            timestamp: new Date().toISOString(),
            delivered: false
        };
        this.topics.get(topic).push(msg);

        // notify all consumers of this topic
        const consumers = this.consumers.get(topic) || [];
        consumers.forEach(consumer => consumer(msg));

        return msg;
    }

    // subscribe to a topic
    subscribe(topic, consumerId, callback) {
        if (!this.topics.has(topic)) {
            this.createTopic(topic);
        }
        const consumers = this.consumers.get(topic);
        consumers.push(callback);

        // initialize offset for this consumer
        const offsetKey = `${consumerId}:${topic}`;
        if (!this.offsets.has(offsetKey)) {
            this.offsets.set(offsetKey, 0);
        }
        return true;
    }

    // consumer pulls messages since their last offset
    consume(topic, consumerId) {
        if (!this.topics.has(topic)) return [];

        const offsetKey = `${consumerId}:${topic}`;
        const offset = this.offsets.get(offsetKey) || 0;
        const messages = this.topics.get(topic).slice(offset);

        // update offset
        this.offsets.set(offsetKey, this.topics.get(topic).length);

        return messages;
    }

    // get stats
    stats() {
        const topicStats = {};
        for (const [topic, messages] of this.topics) {
            topicStats[topic] = {
                messageCount: messages.length,
                consumers: (this.consumers.get(topic) || []).length
            };
        }
        return {
            topics: topicStats,
            totalTopics: this.topics.size,
        };
    }
}

module.exports = Queue;