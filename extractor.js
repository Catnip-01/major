const extractTransaction = (message) => {
  if (!message) return null;
  const raw = message.trim();
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  // Amount - ALWAYS first line: "INR 1098.04 debited"
  let amount = '';
  let currency = 'INR';
  let type = 'debit';
  const firstLine = lines[0] || '';
  const firstLineMatch = firstLine.match(/^(INR|Rs\.?|₹)\s?([0-9,]+(?:\.[0-9]+)?)\s+(debited|credited)/i);
  if (firstLineMatch) {
    currency = firstLineMatch[1];
    amount = firstLineMatch[2].replace(/,/g, '');
    type = firstLineMatch[3].toLowerCase() === 'credited' ? 'credit' : 'debit';
  }

  // Account - second line: "A/c no. XX3659"
  const accountMatch = raw.match(/[Aa]\/c\s*(?:no\.?)?\s*(XX\d+|\d+)/i);
  const account = accountMatch ? accountMatch[1] : '';

  // Date - third line: "01-04-26, 20:47:55"
  const dateMatch = raw.match(/(\d{2}[-/]\d{2}[-/]\d{2,4})/);
  const date = dateMatch ? dateMatch[0] : '';

  // Merchant - from UPI string, last part after final slash
  let merchant = '';
  const upiMatch = raw.match(/UPI\/[A-Z0-9]+\/[0-9]+\/([^\n/]+?)(?:\/[^\n]*)?(?:\n|$)/i);
  if (upiMatch && upiMatch[1]) {
    merchant = upiMatch[1].trim();
  }

  // Bank - last line
  const bank = lines[lines.length - 1] || '';

  if (!amount) return null;

  return {
    raw,
    amount,
    currency,
    merchant,
    date,
    type,
    account,
    bank,
    id: Math.random().toString()
  };
};

export { extractTransaction };