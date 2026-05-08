const { Worker } = require('bullmq');
const { connection } = require('./queue');
const ChatHistory = require('./models/ChatHistory');
const Transaction = require('./models/Transaction');

// Initialize Groq
// Note: server-py is now used for AI tasks, keeping worker.js minimal
const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function queryGroq(messages) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages
        })
    });
    return await response.json();
}

function formatTransactions(transactions = []) {
  if (!Array.isArray(transactions) || !transactions.length) {
    return 'No transaction data available.';
  }

  const total = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const lines = transactions.slice(-15).map((t, i) => {
    const amt = Number(t.amount || 0).toFixed(2);
    const desc = t.merchant || 'Unknown';
    const date = t.date ? ` on ${t.date}` : '';
    return `${i + 1}. ${desc} — ₹${amt}${date} (${t.type || 'debit'})`;
  });

  return `Total spend across ${transactions.length} transactions: ₹${total.toFixed(2)}\n\nRecent (up to 15):\n${lines.join('\n')}`;
}

const chatWorker = new Worker('chatQueue', async job => {
  console.log(`Processing Chat Job: ${job.id}`);
  const { deviceId, messageText } = job.data;

  try {
    // 1. Fetch user context & recent transactions
    const historyDoc = await ChatHistory.findOneAndUpdate(
      { deviceId },
      { $setOnInsert: { deviceId, messages: [] } },
      { new: true, upsert: true }
    );
    
    // Add User Message to DB
    historyDoc.messages.push({ role: 'user', text: messageText });
    
    const recentTx = await Transaction.find({ deviceId })
                                      .sort({ createdAt: -1 })
                                      .limit(15);
    
    const txContext = formatTransactions(recentTx);

    // 2. Build Groq Payload
    const systemInstruction = `You are Finize, a personal finance coach for Indian users.
- Give short, practical, rupee-denominated advice based on the user's actual transactions.
- Never invent numbers that aren't in the data.
- Never say you are an AI.
- Be conversational, not preachy.

User Context:
${txContext}`;

    // 3. Send message to Groq
    const chatCompletion = await queryGroq([
        { role: 'system', content: systemInstruction },
        ...historyDoc.messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }))
    ]);
    const responseText = chatCompletion.choices[0].message.content;

    // 4. Save Bot Response to DB
    historyDoc.messages.push({ role: 'assistant', text: responseText });
    await historyDoc.save();

    return {
      status: 'success',
      text: responseText
    };

  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    throw error;
  }
}, { connection });

chatWorker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

chatWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = chatWorker;
