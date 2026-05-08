export const BANK_SENDER_REGISTRY = {
  HDFC: {
    bank: 'HDFC Bank',
    aliases: [
      'HDFCBK',
      'HDFCBN',
      'HDFCUP',
      'HDFCCC'
    ]
  },

  ICICI: {
    bank: 'ICICI Bank',
    aliases: [
      'ICICIB',
      'ICICBK',
      'ICIBNK',
      'ICICCC',
      'ICICUP'
    ]
  },

  SBI: {
    bank: 'State Bank of India',
    aliases: [
      'SBIINB',
      'SBIUPI',
      'SBIPSG',
      'SBIPRE',
      'SBIYONO',
      'ATMSBI'
    ]
  },

  AXIS: {
    bank: 'Axis Bank',
    aliases: [
      'AXISBK',
      'AXISB',
      'AXISUP',
      'UTIBNK',
      'UTIIBK'
    ]
  },

  KOTAK: {
    bank: 'Kotak Mahindra Bank',
    aliases: [
      'KOTAKB',
      'KOTAK',
      'KTKMHB'
    ]
  },

  IDFC: {
    bank: 'IDFC FIRST Bank',
    aliases: [
      'IDFCFB',
      'IDFCBK',
      'IDFCFT'
    ]
  },

  YES: {
    bank: 'Yes Bank',
    aliases: [
      'YESBNK',
      'YESB',
      'YBLUPI'
    ]
  },

  PNB: {
    bank: 'Punjab National Bank',
    aliases: [
      'PNBSMS',
      'PNBANK',
      'PNBUPI'
    ]
  },

  CANARA: {
    bank: 'Canara Bank',
    aliases: [
      'CANBNK',
      'CANARA',
      'CNRBNK'
    ]
  },

  BOB: {
    bank: 'Bank of Baroda',
    aliases: [
      'BOBTXN',
      'BANKBD'
    ]
  },

  UNION: {
    bank: 'Union Bank',
    aliases: [
      'UNIONB',
      'UBINBK'
    ]
  },

  INDUSIND: {
    bank: 'IndusInd Bank',
    aliases: [
      'INDUSB',
      'INDBNK'
    ]
  },

  FEDERAL: {
    bank: 'Federal Bank',
    aliases: [
      'FDRLBN',
      'FEDBNK'
    ]
  },

  PAYTM: {
    bank: 'Paytm Payments Bank',
    aliases: [
      'PAYTMB',
      'PAYTM',
      'PYTMUP'
    ]
  },

  PHONEPE: {
    bank: 'PhonePe',
    aliases: [
      'PHONEPE',
      'PHNPAY'
    ]
  },

  GPAY: {
    bank: 'Google Pay',
    aliases: [
      'GPAY',
      'GOOGLE',
      'GPayUP'
    ]
  },

  AMAZONPAY: {
    bank: 'Amazon Pay',
    aliases: [
      'AMAZON',
      'AMZPAY',
      'AMZUPI'
    ]
  }
};

const getCleanBankName = (sender, body) => {
  if (sender) {
    const cleanSender = sender.toUpperCase().replace(/[^A-Z]/g, '');
    for (const key in BANK_SENDER_REGISTRY) {
      const entry = BANK_SENDER_REGISTRY[key];
      if (entry.aliases.some(alias => cleanSender.includes(alias.toUpperCase()))) {
        return entry.bank;
      }
    }
  }

  // Fallback to body search
  const bankMatch = body.match(/(SBI|HDFC|ICICI|Axis|Kotak|PNB|IDFC|IndusInd|Yes Bank|Bank of|Federal|Canara|AU Small|Paytm|PhonePe)/i);
  return bankMatch ? bankMatch[1] : 'Unknown Bank';
};

const extractTransaction = (message, sender = '') => {
  if (!message) return null;
  const raw = message.trim();

  // 1. HARDENING: Negative Filters (Spam, Offers, OTPs, Loans)
  const isSpam = /(offer|congratulations|win|lucky|pre-approved|apply\s*now|otp|verification\s*code|secret\s*code|lottery|discount|gift|get\s*up\s*to|instantly|easy\s*&\s*secure|loan|eligible|limit|available|click|visit|emergency|bills\?|reward\s*points|cashback\s*of\s*up\s*to|claim\s*your|interest\s*rate|low\s*emi|no\s*cost\s*emi)/i.test(raw);
  if (isSpam) return null;

  // 2. HARDENING: Mandatory Transaction Keywords
  const isTransaction = /(debited|credited|received|spent|payment|transfer|vpa|upi|a\/c|account|ref\s*no|txn|transaction)/i.test(raw);
  if (!isTransaction) return null;

  // 3. Amount Extraction
  let amountMatch = raw.match(/(?:INR|Rs\.?|₹)\s?([0-9,]+(?:\.[0-9]+)?)/i);
  if (!amountMatch) return null; 

  let amountRaw = amountMatch[1].replace(/,/g, '');
  let amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount === 0) return null;

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
  const upiMatch = raw.match(/UPI[/-].+?[/-].+?[/-]([^\s\n/]+)/i) || 
                   raw.match(/(?:to|at|vpa)\s+([A-Za-z0-9@\s\.]+?)(?:\s+on|\s+ref|\s+using|\.|$)/i);
  
  if (upiMatch && upiMatch[1]) {
    merchant = upiMatch[1].trim();
    merchant = merchant.replace(/^[0-9]+|[0-9]+$/g, '').trim();
    if (merchant.length > 30) merchant = merchant.substring(0, 30);
  }

  // 7. General Network PII: Redact clear unmasked phone numbers
  const redactedRaw = raw.replace(/(?:\+?91[\-\s]?)?[6-9]\d{9}/g, '[REDACTED_PHONE]');

  // 8. Date Extraction
  let date = '';
  const dateMatch = raw.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i);
  if (dateMatch) date = dateMatch[0];

  // 9. Bank Cleanup
  const bank = getCleanBankName(sender, raw);

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