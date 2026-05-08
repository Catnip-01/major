const extractTransaction = (message) => {
  if (!message) return null;
  const raw = message.trim();

  // 1. HARDENING: Mandatory Transaction Keywords
  // Most Indian bank/fintech SMS use these specific terms.
  const isTransaction = /(debited|credited|received|spent|payment|transfer|vpa|upi|a\/c|account|ref\s*no|txn|transaction)/i.test(raw);
  if (!isTransaction) return null;

  // 2. HARDENING: Negative Filters (Spam, Offers, OTPs)
  const isSpam = /(offer|congratulations|win|lucky|pre-approved|apply\s*now|otp|verification\s*code|secret\s*code|lottery|discount|gift)/i.test(raw);
  if (isSpam) return null;

  // 3. Amount Extraction
  let amountMatch = raw.match(/(?:INR|Rs\.?|₹)\s?([0-9,]+(?:\.[0-9]+)?)/i);
  if (!amountMatch) return null; 

  let amount = amountMatch[1].replace(/,/g, '');
  let currency = 'INR';

  // 4. Determine debit/credit
  let type = 'debit';
  if (raw.match(/(credited|received|added|deposited|reversed|refunded)/i)) {
    type = 'credit';
  }

  // 5. Account Extraction (PII REDACTION)
  const accountMatch = raw.match(/(?:[Aa]\/?c\s*(?:no\.?)?\s*|ending\s*in\s*)(X*\d+)/i);
  let account = accountMatch ? accountMatch[1] : '';
  if (account.length > 4) {
    account = '*'.repeat(account.length - 4) + account.slice(-4);
  }

  // 6. Merchant Extraction
  let merchant = '';
  // Try UPI P2M pattern first
  const upiMatch = raw.match(/UPI[/-].+?[/-].+?[/-]([^\s\n/]+)/i) || 
                   raw.match(/(?:to|at|vpa)\s+([A-Za-z0-9@\s\.]+?)(?:\s+on|\s+ref|\s+using|\.|$)/i);
  
  if (upiMatch && upiMatch[1]) {
    merchant = upiMatch[1].trim();
    // Clean up common noise in merchant names
    merchant = merchant.replace(/^[0-9]+|[0-9]+$/g, '').trim();
    if (merchant.length > 30) merchant = merchant.substring(0, 30);
  }

  // 7. General Network PII: Redact clear unmasked phone numbers
  const redactedRaw = raw.replace(/(?:\+?91[\-\s]?)?[6-9]\d{9}/g, '[REDACTED_PHONE]');

  // 8. Date Extraction
  let date = '';
  const dateMatch = raw.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i);
  if (dateMatch) date = dateMatch[0];

  // 9. Bank (approximate)
  const bankMatch = raw.match(/(SBI|HDFC|ICICI|Axis|Kotak|PNB|IDFC|IndusInd|Yes Bank|Bank of|Federal|Canara|AU Small|Paytm|PhonePe)/i);
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