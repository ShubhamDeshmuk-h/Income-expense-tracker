/**
 * VaultFlow — Analytics Engine
 *
 * All analytics are computed from actual transaction data.
 * No fabricated predictions — insufficient data is communicated clearly.
 * All amounts returned as cents (integer) for precision.
 */

import {
  getMonthlyTrend,
  getMonthlySummary,
  getCategoryBreakdown,
  getMerchantBreakdown,
  getBalanceSummary,
  getTransactionsByDateRange,
  centsToAmount,
  type MonthlyTrend,
  type CategoryBreakdown,
  type MerchantBreakdown,
} from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlySummary {
  year: number;
  month: number;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  savingsRate: number; // 0–100, -100 if no income
}

export interface SpendingInsight {
  id: string;
  type: 'info' | 'warning' | 'positive' | 'anomaly';
  title: string;
  body: string;
  icon: string; // lucide icon name
}

export interface SpendingForecast {
  estimatedEndOfMonthExpense_cents: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  daysRemaining: number;
  dailyBurnRate_cents: number;
  note?: string;
}

export interface AnalyticsSummary {
  trend: MonthlyTrend[];
  categoryBreakdown: CategoryBreakdown[];
  merchantBreakdown: MerchantBreakdown[];
  insights: SpendingInsight[];
  forecast: SpendingForecast | null;
  currentMonth: {
    income_cents: number;
    expense_cents: number;
    net_cents: number;
    savingsRate: number;
    burnRate_cents: number; // daily
  };
}

// ---------------------------------------------------------------------------
// Core analytics functions
// ---------------------------------------------------------------------------

/**
 * Computes savings rate as a percentage.
 * Returns -100 if no income (spending more than earned).
 */
export function computeSavingsRate(income_cents: number, expense_cents: number): number {
  if (income_cents <= 0) return expense_cents > 0 ? -100 : 0;
  const rate = ((income_cents - expense_cents) / income_cents) * 100;
  return Math.round(rate * 10) / 10; // 1 decimal place
}

/**
 * Computes daily burn rate from expense total and number of days elapsed.
 */
export function computeDailyBurnRate(expense_cents: number, daysElapsed: number): number {
  if (daysElapsed <= 0) return 0;
  return Math.round(expense_cents / daysElapsed);
}

/**
 * Returns the number of days elapsed in the current month (up to today).
 */
export function daysElapsedInMonth(year: number, month: number): number {
  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() + 1 === month) {
    return today.getDate();
  }
  return new Date(year, month, 0).getDate(); // full month
}

/**
 * Returns the number of days remaining in the current month.
 */
export function daysRemainingInMonth(): number {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return lastDay - today.getDate();
}

/**
 * Returns month start/end date strings (YYYY-MM-DD).
 */
export function getMonthDateRange(year: number, month: number): { start: string; end: string } {
  const m = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${m}-01`,
    end: `${year}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ---------------------------------------------------------------------------
// Insight generators (rule-based — no fake AI)
// ---------------------------------------------------------------------------

export async function generateInsights(
  year: number,
  month: number
): Promise<SpendingInsight[]> {
  const insights: SpendingInsight[] = [];
  const { start, end } = getMonthDateRange(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [current, previous, categories, prevCategories] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlySummary(prevYear, prevMonth),
    getCategoryBreakdown('expense', start, end),
    getCategoryBreakdown('expense', ...Object.values(getMonthDateRange(prevYear, prevMonth)) as [string, string]),
  ]);

  const income = current.total_income_cents;
  const expense = current.total_expense_cents;
  const prevExpense = previous.total_expense_cents;
  const savingsRate = computeSavingsRate(income, expense);

  // 1. Savings rate insight
  if (income > 0) {
    if (savingsRate >= 30) {
      insights.push({
        id: 'savings-positive',
        type: 'positive',
        title: 'Great Savings!',
        body: `You saved ${savingsRate.toFixed(0)}% of your income this month. Keep it up!`,
        icon: 'TrendingUp',
      });
    } else if (savingsRate < 0) {
      insights.push({
        id: 'savings-warning',
        type: 'warning',
        title: 'Spending Exceeds Income',
        body: `Your expenses are ${Math.abs(savingsRate).toFixed(0)}% more than your income this month.`,
        icon: 'AlertTriangle',
      });
    } else if (savingsRate < 10) {
      insights.push({
        id: 'savings-low',
        type: 'info',
        title: 'Low Savings Rate',
        body: `You saved ${savingsRate.toFixed(0)}% this month. Consider reviewing your largest expense categories.`,
        icon: 'Info',
      });
    }
  }

  // 2. Month-over-month expense comparison
  if (prevExpense > 0 && expense > 0) {
    const changePercent = ((expense - prevExpense) / prevExpense) * 100;
    if (changePercent > 20) {
      insights.push({
        id: 'expense-spike',
        type: 'warning',
        title: 'Spending Increased',
        body: `Your expenses are ${changePercent.toFixed(0)}% higher than last month.`,
        icon: 'TrendingUp',
      });
    } else if (changePercent < -15) {
      insights.push({
        id: 'expense-reduced',
        type: 'positive',
        title: 'Great Reduction!',
        body: `You spent ${Math.abs(changePercent).toFixed(0)}% less than last month. Excellent discipline!`,
        icon: 'TrendingDown',
      });
    }
  }

  // 3. Top spending category
  if (categories.length > 0) {
    const top = categories[0];
    const topPercent = expense > 0 ? ((top.total_cents / expense) * 100).toFixed(0) : '0';
    insights.push({
      id: 'top-category',
      type: 'info',
      title: `Top Spend: ${top.category}`,
      body: `${top.category} accounts for ${topPercent}% of your expenses this month (${top.count} transactions).`,
      icon: 'PieChart',
    });

    // Category vs previous month
    const prevTopCat = prevCategories.find((c) => c.category === top.category);
    if (prevTopCat && prevTopCat.total_cents > 0) {
      const catChange = ((top.total_cents - prevTopCat.total_cents) / prevTopCat.total_cents) * 100;
      if (catChange > 25) {
        insights.push({
          id: `category-spike-${top.category}`,
          type: 'warning',
          title: `${top.category} Spending Up`,
          body: `Your ${top.category} spending increased by ${catChange.toFixed(0)}% compared to last month.`,
          icon: 'AlertCircle',
        });
      }
    }
  }

  // 4. Daily burn rate
  const daysElapsed = daysElapsedInMonth(year, month);
  if (daysElapsed > 0 && expense > 0) {
    const burnRate = computeDailyBurnRate(expense, daysElapsed);
    if (burnRate > 0) {
      insights.push({
        id: 'burn-rate',
        type: 'info',
        title: 'Daily Spending',
        body: `Your average daily spend this month is ${centsToAmount(burnRate).toFixed(2)}.`,
        icon: 'Activity',
      });
    }
  }

  return insights.slice(0, 4); // Cap at 4 insights
}

// ---------------------------------------------------------------------------
// Forecast (only when sufficient data exists)
// ---------------------------------------------------------------------------

export async function computeForecast(
  year: number,
  month: number
): Promise<SpendingForecast | null> {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  if (!isCurrentMonth) return null; // Only forecast for current month

  const daysElapsed = today.getDate();
  const daysRemaining = daysRemainingInMonth();

  if (daysElapsed < 7) {
    return {
      estimatedEndOfMonthExpense_cents: 0,
      confidence: 'insufficient_data',
      daysRemaining,
      dailyBurnRate_cents: 0,
      note: 'Need at least 7 days of data to forecast end-of-month spending.',
    };
  }

  const { start } = getMonthDateRange(year, month);
  const today_str = today.toISOString().split('T')[0];
  const transactions = await getTransactionsByDateRange(start, today_str);
  const expenseTxns = transactions.filter((t) => t.type === 'expense');
  const totalExpense_cents = expenseTxns.reduce((s, t) => s + t.amount_cents, 0);

  const burnRate = computeDailyBurnRate(totalExpense_cents, daysElapsed);
  const estimatedRemaining = burnRate * daysRemaining;
  const estimatedTotal = totalExpense_cents + estimatedRemaining;

  const confidence: SpendingForecast['confidence'] =
    daysElapsed >= 20 ? 'high' : daysElapsed >= 14 ? 'medium' : 'low';

  return {
    estimatedEndOfMonthExpense_cents: estimatedTotal,
    confidence,
    daysRemaining,
    dailyBurnRate_cents: burnRate,
  };
}

// ---------------------------------------------------------------------------
// Full analytics summary
// ---------------------------------------------------------------------------

export async function getAnalyticsSummary(
  year: number,
  month: number
): Promise<AnalyticsSummary> {
  const { start, end } = getMonthDateRange(year, month);

  const [trend, categoryBreakdown, merchantBreakdown, currentMonth, insights, forecast] =
    await Promise.all([
      getMonthlyTrend(6),
      getCategoryBreakdown('expense', start, end),
      getMerchantBreakdown('expense', start, end, 5),
      getMonthlySummary(year, month),
      generateInsights(year, month),
      computeForecast(year, month),
    ]);

  const daysElapsed = daysElapsedInMonth(year, month);
  const income_cents = currentMonth.total_income_cents;
  const expense_cents = currentMonth.total_expense_cents;

  return {
    trend,
    categoryBreakdown,
    merchantBreakdown,
    insights,
    forecast,
    currentMonth: {
      income_cents,
      expense_cents,
      net_cents: income_cents - expense_cents,
      savingsRate: computeSavingsRate(income_cents, expense_cents),
      burnRate_cents: computeDailyBurnRate(expense_cents, daysElapsed),
    },
  };
}

/**
 * Detects potential anomalies in the current month's transactions.
 * Uses simple z-score deviation within each category.
 */
export async function detectAnomalies(year: number, month: number): Promise<SpendingInsight[]> {
  const { start, end } = getMonthDateRange(year, month);
  const transactions = await getTransactionsByDateRange(start, end);
  const expenses = transactions.filter((t) => t.type === 'expense');

  if (expenses.length < 5) return []; // Not enough data

  // Group by category and find outliers (> 2 standard deviations)
  const byCategory: Record<string, number[]> = {};
  for (const tx of expenses) {
    if (!byCategory[tx.category]) byCategory[tx.category] = [];
    byCategory[tx.category].push(tx.amount_cents);
  }

  const anomalies: SpendingInsight[] = [];
  for (const [category, amounts] of Object.entries(byCategory)) {
    if (amounts.length < 3) continue;
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const max = Math.max(...amounts);
    if (stdDev > 0 && (max - mean) / stdDev > 2.0) {
      anomalies.push({
        id: `anomaly-${category}`,
        type: 'anomaly',
        title: `Unusual ${category} Transaction`,
        body: `One of your ${category} transactions is significantly higher than your usual ${category} spending.`,
        icon: 'AlertOctagon',
      });
    }
  }

  return anomalies;
}
