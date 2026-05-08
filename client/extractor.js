export const BANK_SENDER_REGISTRY = {
  HDFC: {
    bank: 'HDFC Bank',
    aliases: ['HDFCBK', 'HDFCBN', 'HDFCUP', 'HDFCCC']
  },
  ICICI: {
    bank: 'ICICI Bank',
    aliases: ['ICICIB', 'ICICBK', 'ICIBNK', 'ICICCC', 'ICICUP']
  },
  SBI: {
    bank: 'State Bank of India',
    aliases: ['SBIINB', 'SBIUPI', 'SBIPSG', 'SBIPRE', 'SBIYONO', 'ATMSBI']
  },
  AXIS: {
    bank: 'Axis Bank',
    aliases: ['AXISBK', 'AXISB', 'AXISUP', 'UTIBNK', 'UTIIBK']
  },
  KOTAK: {
    bank: 'Kotak Mahindra Bank',
    aliases: ['KOTAKB', 'KOTAK', 'KTKMHB']
  },
  IDFC: {
    bank: 'IDFC FIRST Bank',
    aliases: ['IDFCFB', 'IDFCBK', 'IDFCFT']
  },
  YES: {
    bank: 'Yes Bank',
    aliases: ['YESBNK', 'YESB', 'YBLUPI']
  },
  PNB: {
    bank: 'Punjab National Bank',
    aliases: ['PNBSMS', 'PNBANK', 'PNBUPI']
  },
  CANARA: {
    bank: 'Canara Bank',
    aliases: ['CANBNK', 'CANARA', 'CNRBNK']
  },
  BOB: {
    bank: 'Bank of Baroda',
    aliases: ['BOBTXN', 'BANKBD']
  },
  UNION: {
    bank: 'Union Bank',
    aliases: ['UNIONB', 'UBINBK']
  },
  INDUSIND: {
    bank: 'IndusInd Bank',
    aliases: ['INDUSB', 'INDBNK']
  },
  FEDERAL: {
    bank: 'Federal Bank',
    aliases: ['FDRLBN', 'FEDBNK']
  },
  PAYTM: {
    bank: 'Paytm Payments Bank',
    aliases: ['PAYTMB', 'PAYTM', 'PYTMUP']
  },
  PHONEPE: {
    bank: 'PhonePe',
    aliases: ['PHONEPE', 'PHNPAY']
  },
  GPAY: {
    bank: 'Google Pay',
    aliases: ['GPAY', 'GOOGLE', 'GPayUP']
  },
  AMAZONPAY: {
    bank: 'Amazon Pay',
    aliases: ['AMAZON', 'AMZPAY', 'AMZUPI']
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
  const bankMatch = body.match(/(SBI|HDFC|ICICI|Axis|Kotak|PNB|IDFC|IndusInd|Yes Bank|Bank of|Federal|Canara|AU Small|Paytm|PhonePe)/i);
  return bankMatch ? bankMatch[1] : 'Unknown Bank';
};

export const extractTransaction = (message, sender = '') => {
  if (!message) return null;
  const raw = message.trim();

  // 1. Negative Filters (Spam, Loans, Offers)
  const isSpam = /(offer|congratulations|win|lucky|pre-approved|apply\s*now|otp|verification\s*code|secret\s*code|lottery|discount|gift|get\s*up\s*to|instantly|easy\s*&\s*secure|loan|eligible|limit|available|click|visit|emergency|bills\?|reward\s*points|cashback\s*of\s*up\s*to|claim\s*your|interest\s*rate|low\s*emi|no\s*cost\s*emi)/i.test(raw);
  if (isSpam) return null;

  // 2. Transaction Keywords
  const isTransaction = /(debited|credited|received|spent|payment|transfer|vpa|upi|a\/c|account|ref\s*no|txn|transaction)/i.test(raw);
  if (!isTransaction) return null;

  // 3. Amount Extraction
  let amountMatch = raw.match(/(?:INR|Rs\.?|₹)\s?([0-9,]+(?:\.[0-9]+)?)/i);
  if (!amountMatch) return null;

  let amountRaw = amountMatch[1].replace(/,/g, '');
  let amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount === 0) return null;

  // 4. Type & Merchant & Account
  let type = raw.match(/(credited|received|added|deposited|reversed|refunded)/i) ? 'credit' : 'debit';
  
  const upiMatch = raw.match(/UPI[/-].+?[/-].+?[/-]([^\s\n/]+)/i) || 
                   raw.match(/(?:to|at|vpa)\s+([A-Za-z0-9@\s\.]+?)(?:\s+on|\s+ref|\s+using|\.|$)/i);
  let merchant = upiMatch ? upiMatch[1].trim().replace(/^[0-9]+|[0-9]+$/g, '').trim() : 'Unknown Merchant';
  if (merchant.length > 30) merchant = merchant.substring(0, 30);

  const accountMatch = raw.match(/(?:[Aa]\/?c\s*(?:no\.?)?\s*|ending\s*in\s*)(X*\d+)/i);
  let account = accountMatch ? accountMatch[1] : '';
  if (account.length > 4) account = '*'.repeat(account.length - 4) + account.slice(-4);

  const dateMatch = raw.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i);
  
  return {
    raw: raw.replace(/(?:\+?91[\-\s]?)?[6-9]\d{9}/g, '[REDACTED_PHONE]'),
    amount,
    currency: 'INR',
    merchant: merchant || 'Unknown Merchant',
    date: dateMatch ? dateMatch[0] : '',
    type,
    account,
    bank: getCleanBankName(sender, raw),
    id: Math.random().toString()
  };
};
