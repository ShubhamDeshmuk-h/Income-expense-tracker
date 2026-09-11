export type OcrParseResult = {
  amount?: number;
  date?: string;
  type?: 'income' | 'expense';
  note?: string;
  category?: string;
};

function normalizeAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isValidDateParts(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function normalizeDate(raw: string): string | undefined {
  const isoMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidDateParts(year, month, day)) return undefined;
    return `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  const slashMatch = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (!slashMatch) return undefined;

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = Number(
    slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
  );

  const candidates: Array<{ day: number; month: number }> = [
    { day: first, month: second },
    { day: second, month: first },
  ];
  for (const candidate of candidates) {
    if (isValidDateParts(year, candidate.month, candidate.day)) {
      return `${year.toString().padStart(4, '0')}-${candidate.month
        .toString()
        .padStart(2, '0')}-${candidate.day.toString().padStart(2, '0')}`;
    }
  }
  return undefined;
}

function scoreAmountCandidate(
  fullTextLower: string,
  amountToken: string,
  index: number
) {
  const start = Math.max(0, index - 32);
  const end = Math.min(fullTextLower.length, index + amountToken.length + 32);
  const context = fullTextLower.slice(start, end);
  let score = 0;

  if (
    /(debited|spent|paid|purchase|dr\b|upi|txn|transaction|credited|received|cr\b)/.test(
      context
    )
  ) {
    score += 2;
  }
  if (/(balance|avl bal|available|closing|ledger|total due)/.test(context)) {
    score -= 3;
  }
  if (/(amt|amount|rs|inr|₹)/.test(context)) {
    score += 1;
  }
  return score;
}

function extractBestAmount(text: string): number | undefined {
  const full = text;
  const lower = text.toLowerCase();
  const tokenRegex =
    /(?:inr|rs\.?|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  const picks: Array<{ amount: number; score: number; index: number }> = [];

  for (const match of full.matchAll(tokenRegex)) {
    if (!match[1]) continue;
    const parsed = normalizeAmount(match[1]);
    if (!parsed || parsed <= 0) continue;
    const index = match.index ?? 0;
    const raw = match[0];
    const score = scoreAmountCandidate(lower, raw.toLowerCase(), index);
    // Ignore year-like values
    if (parsed > 1900 && parsed < 2100 && !/(inr|rs|₹)/i.test(raw)) continue;
    picks.push({ amount: parsed, score, index });
  }

  if (!picks.length) return undefined;
  picks.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });
  return picks[0].amount;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ['restaurant', 'food', 'swiggy', 'zomato', 'cafe', 'pizza', 'burger', 'hotel', 'eating', 'dining', 'meal', 'lunch', 'dinner', 'breakfast'],
  Transport: ['uber', 'ola', 'cab', 'taxi', 'bus', 'metro', 'train', 'auto', 'petrol', 'fuel', 'rapido'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'mall', 'shop', 'store', 'purchase'],
  Bills: ['electricity', 'water', 'gas', 'internet', 'broadband', 'airtel', 'jio', 'vi', 'vodafone', 'recharge', 'bill'],
  Health: ['hospital', 'clinic', 'doctor', 'medicine', 'pharmacy', 'medical', 'health'],
  Entertainment: ['netflix', 'spotify', 'prime', 'hotstar', 'movie', 'cinema', 'game'],
  Salary: ['salary', 'wage', 'payroll', 'stipend', 'income'],
  Transfer: ['transfer', 'upi', 'neft', 'imps', 'rtgs', 'sent', 'received'],
};

function guessCategory(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }
  return undefined;
}

export function parseTransactionFromText(text: string): OcrParseResult {
  const lower = text.toLowerCase();
  const result: OcrParseResult = {};

  // Classify type using scoring
  const incomeScore = (
    lower.match(/credited|credit|received|deposit|refund|\bcr\b/g) || []
  ).length;
  const expenseScore = (
    lower.match(/debited|debit|paid|spent|purchase|withdrawn|\bdr\b/g) || []
  ).length;

  if (incomeScore > expenseScore && incomeScore > 0) {
    result.type = 'income';
  } else if (expenseScore > incomeScore && expenseScore > 0) {
    result.type = 'expense';
  }

  // Extract amount using scoring
  const amount = extractBestAmount(text);
  if (amount !== undefined) {
    result.amount = amount;
  }

  // Extract date
  const dateMatch = text.match(
    /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/
  );
  if (dateMatch) {
    const normalized = normalizeDate(dateMatch[0]);
    if (normalized) result.date = normalized;
  }

  // Extract note/merchant
  const noteMatch = text.match(
    /(?:to|at|merchant|payee|from|via upi to|upi to)[:\s]+([A-Za-z0-9 .&-]{3,})/i
  );
  if (noteMatch) {
    result.note = noteMatch[1].trim().slice(0, 80);
  }

  // Guess category
  result.category = guessCategory(text);

  return result;
}
