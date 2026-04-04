const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// standard connection for bullmq
const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

// The chat processing queue
const chatQueue = new Queue('chatQueue', { connection });

module.exports = {
  chatQueue,
  connection
};
