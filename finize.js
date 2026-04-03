// finize.js
// Calls Gemini API with full financial context.

// No hardcoded key here anymore. The key is passed dynamically from App.js.
const GEMINI_MODEL = 'gemini-2.5-flash';

const logs = [];

// ─── Format transactions for Gemini context ───────────────────────────────────
function formatTransactions(transactions = []) {
  if (!Array.isArray(transactions) || !transactions.length) {
    return 'No transaction data available.';
  }

  const total = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const lines = transactions.slice(-15).map((t, i) => {
    const amt = Number(t.amount || 0).toFixed(2);
    const desc = t.merchant || t.category || 'Unknown';
    const cat = t.category ? ` [${t.category}]` : '';
    const date = t.date ? ` on ${t.date}` : '';
    return `${i + 1}. ${desc} — ₹${amt}${cat}${date} (${t.type || 'debit'})`;
  });

  return `Total spend across ${transactions.length} transactions: ₹${total.toFixed(2)}\n\nRecent (up to 15):\n${lines.join('\n')}`;
}

// ─── Format snapshot for Gemini context ──────────────────────────────────────
function formatSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 'No snapshot available.';

  return [
    snapshot.monthlySpend != null && `Monthly spend: ₹${Number(snapshot.monthlySpend).toFixed(2)}`,
    snapshot.budget != null && `Monthly budget: ₹${Number(snapshot.budget).toFixed(2)}`,
    snapshot.budgetProgress != null && `Budget used: ${snapshot.budgetProgress}%`,
    snapshot.savings != null && `Savings: ₹${Number(snapshot.savings).toFixed(2)}`,
    snapshot.level && `Level: ${snapshot.level}`,
    snapshot.streak != null && `Streak: ${snapshot.streak} days`,
    snapshot.points != null && `Points: ${snapshot.points}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Build Gemini request payload ─────────────────────────────────────────────
function buildPayload(message, transactions, user, history = [], snapshot = null) {
  const userId = (user && (user.email || user.id)) || 'anonymous';
  const txContext = formatTransactions(transactions);
  const snapText = formatSnapshot(snapshot);

  const systemInstruction = {
    parts: [{
      text: `You are Finize, a personal finance coach for Indian users.
- Give short, practical, rupee-denominated advice based on the user's actual transactions.
- Never invent numbers that aren't in the data.
- Never say you are an AI.
- Be conversational, not preachy.

User: ${userId}

Transaction context:
${txContext}

Financial snapshot:
${snapText}`.trim()
    }]
  };

  const historyContents = Array.isArray(history)
    ? history
      .filter(m => m.text && m.text.trim())
      .map(m => ({
        role: m.from === 'finize' ? 'model' : 'user',
        parts: [{ text: String(m.text) }],
      }))
    : [];

  return {
    systemInstruction,
    contents: [
      ...historyContents,
      { role: 'user', parts: [{ text: String(message || '') }] },
    ],
  };
}

// ─── Call Gemini ──────────────────────────────────────────────────────────────
async function callGemini(message, transactions, user, history, snapshot, apiKey) {
  if (!apiKey) throw new Error("Missing Gemini API Key");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(message, transactions, user, history, snapshot)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '')
    .join(' ')
    .trim();

  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getResponse(message, transactions = [], user = null, history = [], snapshot = null, apiKey = null) {
  try {
    const text = await callGemini(message, transactions, user, history, snapshot, apiKey);
    logs.push({ ts: Date.now(), message, response: text });
    return { response: text };
  } catch (err) {
    console.warn('[finize] Gemini call failed:', err.message);
    return { response: `Sorry, couldn't reach Finize right now. (${err.message})` };
  }
}

export function getLogs() { return logs.slice(); }
export function clearLogs() { logs.length = 0; }