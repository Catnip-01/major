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

  // Account
  const accountMatch = raw.match(/[Aa]\/?c\s*(?:no\.?)?\s*(X*\d+)/i);
  const account = accountMatch ? accountMatch[1] : '';

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
    raw,
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