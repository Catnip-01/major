const extractTransaction = (message) => {
  if (!message) return null;
  const raw = message.trim();

  // Find amount anywhere in the string
  let amountMatch = raw.match(/(?:INR|Rs\.?|₹)\s?([0-9,]+(?:\.[0-9]+)?)/i);
  if (!amountMatch) return null; // If no amount found, it's likely not a transaction

  let amount = amountMatch[1].replace(/,/g, '');
  let currency = 'INR';

  // Determine debit/credit
  let type = 'debit';
  if (raw.match(/(credited|received|added|deposited|reversed)/i)) {
    type = 'credit';
  }

  // Account (PII REDACTION)
  const accountMatch = raw.match(/[Aa]\/?c\s*(?:no\.?)?\s*(X*\d+)/i);
  let account = accountMatch ? accountMatch[1] : '';
  // Mask account numbers, keep only last 4 digits
  if (account.length > 4) {
    account = '*'.repeat(account.length - 4) + account.slice(-4);
  }

  // General Network PII: Redact clear unmasked phone numbers
  const redactedRaw = raw.replace(/(?:\+?91[\-\s]?)?[6-9]\d{9}/g, '[REDACTED_PHONE]');

  // Date
  let date = '';
  const dateMatch = raw.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i);
  if (dateMatch) date = dateMatch[0];

  // Merchant
  let merchant = '';
  const upiMatch = raw.match(/UPI[/-].+?[/-].+?[/-]([^\s\n/]+)/i) || raw.match(/to\s+([A-Za-z0-9@\s]+?)(?:\s+on|\s+ref|\.|$)/i);
  if (upiMatch && upiMatch[1] && upiMatch[1].length < 30) {
    merchant = upiMatch[1].trim();
  }

  // Bank (approximate)
  const bankMatch = raw.match(/(SBI|HDFC|ICICI|Axis|Kotak|PNB|IDFC|IndusInd|Yes Bank|Bank of|Federal|Canara)/i);
  const bank = bankMatch ? bankMatch[1] : '';

  return {
    raw: redactedRaw,
    amount,
    currency,
    merchant: merchant || 'Unknown Merchant',
    date,
    type,
    account,
    bank,
    id: Math.random().toString()
  };
};

export { extractTransaction };