const express = require('express');
const { chatQueue } = require('./queue');
const Transaction = require('./models/Transaction');


const router = express.Router();

// --- API ROUTES ---


// 1. Sync SMS Transactions
router.post('/sync-sms', async (req, res) => {
    const { deviceId, transactions } = req.body;
    if (!deviceId || !transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid payload format' });
    }

    try {
        const bulkOps = transactions.map(tx => ({
            updateOne: {
                filter: { deviceId, smsId: tx.id },
                update: { $set: { ...tx, deviceId, smsId: tx.id } },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await Transaction.bulkWrite(bulkOps);
        }

        res.json({ status: 'success', synced: transactions.length });
    } catch (e) {
        console.error('Sync Error:', e);
        res.status(500).json({ error: 'Failed to sync transactions' });
    }
});

// 2. Chat Enqueue
router.post('/chat', async (req, res) => {
    const { deviceId, message } = req.body;
    if (!deviceId || !message) {
        return res.status(400).json({ error: 'deviceId and message required' });
    }

    try {
        // Add to bullmq
        const job = await chatQueue.add('processChat', {
            deviceId,
            messageText: message
        });

        res.json({ status: 'processing', jobId: job.id });
    } catch (e) {
        res.status(500).json({ error: 'Failed to queue chat' });
    }
});

// 3. Chat Status / Result Polling
router.get('/chat/status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const job = await chatQueue.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();
        if (state === 'completed') {
            res.json({ status: 'completed', result: job.returnvalue });
        } else if (state === 'failed') {
            res.json({ status: 'failed', error: job.failedReason });
        } else {
            res.json({ status: state }); // 'active', 'waiting', etc.
        }
    } catch (e) {
        res.status(500).json({ error: 'Failed to check status' });
    }
});

module.exports = router;
