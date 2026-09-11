/**
 * VaultFlow — SMS/Text Transaction Parser
 *
 * Architecture: strategy pattern with confidence scoring.
 * Each strategy handles a specific SMS format class.
 * A parser failure never crashes the app.
 *
 * Privacy rules:
 * - Parsing is 100% on-device
 * - Raw SMS content is never logged in production
 * - SMS content is never sent to an external server
 */

import type { PaymentMethod } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTransaction {
  type?: 'income' | 'expense';
  amount?: number;
  merchant?: string;
  category?: string;
  date?: string;
  paymentMethod?: PaymentMethod;
  txRef?: string | null;
  note?: string;
  confidence: number; // 0.0 – 1.0
  strategy: string;  // which parser matched
}

export interface ParseResult {
  parsed: ParsedTransaction | null;
  isTransaction: boolean;
  confidence: number;
  strategy: string;
}

// ---------------------------------------------------------------------------
// Sender classification
// ---------------------------------------------------------------------------

const BANK_SENDER_PATTERNS = [
  /\b(HDFCBK|SBIINB|ICICIB|AXISBK|KOTAK|PNBSMS|BOIIND|CANBNK|UCOBNK|INDBNK|SCBNK|YESBNK|RBLBNK|IDBIBNK|FEDERALBNK|CSBBNK|KVBBNK|SOUTHBNK)\b/i,
  /\bBANK\b/i,
  /\bFINB\b/i,
];

const UPI_SENDER_PATTERNS = [
  /\b(PAYTM|GPAY|PHONEPE|BHIMUPI|AMAZONPAY|MOBIKWIK|FREECHARGE|JIOPAY|CRED|SLICE)\b/i,
];

const OTP_PATTERNS = [
  /\b(OTP|one.time.password|verification code|authenticate)\b/i,
  /\b\d{4,8}\b.*\b(OTP|code|verify)\b/i,
];

const MARKETING_PATTERNS = [
  /\b(offer|discount|cashback|sale|deal|promo|subscribe|upgrade|winner|congratulations|lottery|selected)\b/i,
  /\b(click here|visit us|download now|limited time|exclusive)\b/i,
];

export type SenderType = 'bank' | 'upi' | 'marketing' | 'otp' | 'unknown';

export function classifySender(sender: string, body: string): SenderType {
  const s = sender.toUpperCase();
  const b = body.toLowerCase();

  if (OTP_PATTERNS.some((p) => p.test(b))) return 'otp';
  if (MARKETING_PATTERNS.some((p) => p.test(b))) return 'marketing';
  if (BANK_SENDER_PATTERNS.some((p) => p.test(s))) return 'bank';
  if (UPI_SENDER_PATTERNS.some((p) => p.test(s))) return 'upi';
  return 'unknown';
}

export function isTransactionMessage(body: string, senderType: SenderType): boolean {
  if (senderType === 'otp' || senderType === 'marketing') return false;
  const lower = body.toLowerCase();
  const hasDebitCredit = /\b(debited|credited|debit|credit|dr\b|cr\b|charged|withdrawn|deposited|received|paid|purchase|transfer|refund)\b/.test(lower);
  const hasAmount = /(?:inr|rs\.?|₹)\s*\d/.test(lower) || /\d+(?:\.\d{1,2})?\s*(?:inr|rs\.?|₹)/.test(lower);
  return hasDebitCredit && hasAmount;
}

// ---------------------------------------------------------------------------
// Amount extraction
// ---------------------------------------------------------------------------

function extractAmount(text: string): number | undefined {
  const lower = text.toLowerCase();
  const patterns = [
    // INR/Rs prefix
    /(?:inr|rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/gi,
    // Amount word prefix
    /(?:amount|amt)\s*(?:of|:)?\s*(?:inr|rs\.?|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/gi,
    // Debited/credited with amount
    /(?:debited|credited|debit|credit)\s+(?:with\s+)?(?:inr|rs\.?|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/gi,
  ];

  const candidates: Array<{ amount: number; score: number }> = [];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1].replace(/,/g, '');
      const parsed = parseFloat(raw);
      if (!isFinite(parsed) || parsed <= 0) continue;
      if (parsed > 1900 && parsed < 2100 && raw.indexOf('.') === -1) continue; // skip years
      candidates.push({ amount: parsed, score: 1 });
    }
  }

  // Reject "balance" amounts
  const balancePattern = /(?:available|avl|closing|ledger|total due|balance)\s*(?:bal)?[:\s]+(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  const balanceAmounts = new Set<number>();
  for (const match of text.matchAll(balancePattern)) {
    const raw = match[1].replace(/,/g, '');
    const parsed = parseFloat(raw);
    if (isFinite(parsed)) balanceAmounts.add(parsed);
  }
  const filtered = candidates.filter((c) => !balanceAmounts.has(c.amount));

  if (filtered.length === 0) return undefined;
  return filtered[0].amount;
}

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

function extractDate(text: string): string | undefined {
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidDate(Number(y), Number(m), Number(d))) return `${y}-${m}-${d}`;
  }

  const ddmmyyMatch = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (ddmmyyMatch) {
    let [, d, m, y] = ddmmyyMatch;
    if (y.length === 2) y = `20${y}`;
    if (isValidDate(Number(y), Number(m), Number(d))) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Month name: "12 Sep 2024" or "Sep 12, 2024"
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const monthNameMatch = text.match(
    /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(\d{4})\b/i
  ) ?? text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (monthNameMatch) {
    const [, a, b, c] = monthNameMatch;
    const isMonthFirst = isNaN(Number(a));
    const d = isMonthFirst ? b : a;
    const m = isMonthFirst ? monthMap[a.slice(0, 3).toLowerCase()] : monthMap[b.slice(0, 3).toLowerCase()];
    const y = c;
    if (m && isValidDate(Number(y), Number(m), Number(d))) {
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  return undefined;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2099) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

function detectType(text: string): 'income' | 'expense' | undefined {
  const lower = text.toLowerCase();
  const incomeScore = (lower.match(/\b(credited|credit|received|deposit|refund|cr\b|salary|cashback)\b/g) ?? []).length;
  const expenseScore = (lower.match(/\b(debited|debit|paid|spent|purchase|withdrawn|dr\b|charged|deducted)\b/g) ?? []).length;
  if (incomeScore > expenseScore && incomeScore > 0) return 'income';
  if (expenseScore > incomeScore && expenseScore > 0) return 'expense';
  return undefined;
}

// ---------------------------------------------------------------------------
// Merchant extraction
// ---------------------------------------------------------------------------

function extractMerchant(text: string): string | undefined {
  const patterns = [
    /(?:at|to merchant|merchant|payee|at pos|pos txn at)\s*[:\-]?\s*([A-Za-z0-9 .,&\-]{3,40})/i,
    /(?:upi to|paid to|sent to|transfer to)\s*([A-Za-z0-9 .,&\-@]{3,40})/i,
    /UPI-([A-Za-z0-9.\-@]+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^A-Za-z0-9 .,&\-@]/g, '')
        .slice(0, 50);
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Transaction reference extraction
// ---------------------------------------------------------------------------

function extractTxRef(text: string): string | null {
  const patterns = [
    /(?:ref|reference|txn|transaction|utr|rrn)\s*(?:no\.?|number|id|#)?\s*[:\-]?\s*([A-Za-z0-9]{6,24})/i,
    /UPI\s+ref[:\s]+([A-Za-z0-9]{6,24})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Category inference
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ['restaurant', 'food', 'swiggy', 'zomato', 'cafe', 'pizza', 'burger', 'hotel', 'dining', 'meal', 'lunch', 'dinner', 'breakfast', 'eatery', 'dominos'],
  Transport: ['uber', 'ola', 'rapido', 'cab', 'taxi', 'bus', 'metro', 'train', 'petrol', 'fuel', 'diesel', 'parking', 'toll', 'redbus'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'mall', 'shop', 'store', 'market', 'meesho'],
  Bills: ['electricity', 'water', 'gas', 'internet', 'broadband', 'airtel', 'jio', 'vodafone', 'recharge', 'bill', 'dth', 'bsnl'],
  Health: ['hospital', 'clinic', 'doctor', 'medicine', 'pharmacy', 'medical', 'health', 'apollo', 'medplus'],
  Entertainment: ['netflix', 'spotify', 'prime', 'hotstar', 'disney', 'movie', 'cinema', 'pvr', 'inox', 'game'],
  Salary: ['salary', 'wage', 'payroll', 'stipend'],
  Transfer: ['transfer', 'neft', 'imps', 'rtgs'],
};

function inferCategory(text: string, merchant?: string): string | undefined {
  const haystack = `${text} ${merchant ?? ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) return category;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Payment method detection
// ---------------------------------------------------------------------------

function detectPaymentMethod(text: string): PaymentMethod {
  const lower = text.toLowerCase();
  if (/\bupi\b/i.test(lower)) return 'upi';
  if (/\b(credit card|debit card|card|pos)\b/i.test(lower)) return 'card';
  if (/\batm\b/i.test(lower)) return 'atm';
  if (/\b(neft|imps|rtgs|transfer|bank)\b/i.test(lower)) return 'bank';
  return 'bank'; // default for SMS-parsed transactions
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse a bank/UPI SMS or pasted text into a structured transaction.
 * Returns null if the text is not a financial transaction.
 * Confidence < 0.7 means user should review before saving.
 */
export function parseTransactionFromText(
  text: string,
  sender: string = ''
): ParseResult {
  const senderType = classifySender(sender, text);

  // Early rejection for OTPs and marketing
  if (senderType === 'otp') {
    return { parsed: null, isTransaction: false, confidence: 0, strategy: 'rejected_otp' };
  }
  if (senderType === 'marketing') {
    return { parsed: null, isTransaction: false, confidence: 0, strategy: 'rejected_marketing' };
  }

  const isTransaction = isTransactionMessage(text, senderType);
  if (!isTransaction) {
    return { parsed: null, isTransaction: false, confidence: 0, strategy: 'no_transaction_pattern' };
  }

  const amount = extractAmount(text);
  const type = detectType(text);
  const date = extractDate(text) ?? new Date().toISOString().split('T')[0];
  const merchant = extractMerchant(text);
  const txRef = extractTxRef(text);
  const category = inferCategory(text, merchant) ?? (type === 'income' ? 'Salary' : 'Other');
  const paymentMethod = detectPaymentMethod(text);

  // Confidence scoring
  let confidence = 0;
  if (amount !== undefined) confidence += 0.4;
  if (type !== undefined) confidence += 0.25;
  if (merchant) confidence += 0.15;
  if (txRef) confidence += 0.1;
  if (extractDate(text)) confidence += 0.1; // explicit date found

  const parsed: ParsedTransaction = {
    type,
    amount,
    merchant,
    category,
    date,
    paymentMethod,
    txRef,
    note: merchant ? `Paid to ${merchant}` : '',
    confidence,
    strategy: `${senderType}_parser`,
  };

  return { parsed, isTransaction: true, confidence, strategy: parsed.strategy };
}

/**
 * Parses text and returns a simplified result compatible with the Add Transaction form.
 * This is the public API used by the UI layer.
 */
export type OcrParseResult = {
  amount?: number;
  date?: string;
  type?: 'income' | 'expense';
  note?: string;
  category?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  txRef?: string | null;
  confidence: number;
};

export function parseTransactionText(text: string): OcrParseResult {
  const result = parseTransactionFromText(text, '');
  if (!result.parsed) {
    return { confidence: 0 };
  }
  const p = result.parsed;
  return {
    amount: p.amount,
    date: p.date,
    type: p.type,
    note: p.note,
    category: p.category,
    merchant: p.merchant,
    paymentMethod: p.paymentMethod,
    txRef: p.txRef,
    confidence: p.confidence,
  };
}
