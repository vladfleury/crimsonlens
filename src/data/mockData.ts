// ============================================================
// CrimsonLens — Mock Data
// All financial data lives here for easy swap to Supabase later
// ============================================================

export interface MonthlyRecord {
  year: number;
  month: number; // 1-12
  label: string; // "Mar 2025"
  assets: number;
  liabilities: number;
  income: number;
  expenses: number;
  debtRepayment?: number;
}

export interface Account {
  name: string;
  currency: "PLN" | "EUR" | "USD";
  balance: number;
  illiquid?: boolean;
}

export interface DebtItem {
  name: string;
  apr: number;
  currency: string;
  totalOwed: number;
  totalPaid: number;
}

export interface ExchangeRate {
  pair: string;
  rate: number;
  symbol: string;
}

// ── Monthly records (most recent first) ──────────────────────
export const monthlyRecords: MonthlyRecord[] = [
  { year: 2026, month: 3, label: "Mar 2026", assets: 2714, liabilities: -3966, income: 5654, expenses: 3054, debtRepayment: 0 },
  { year: 2026, month: 2, label: "Feb 2026", assets: 1365, liabilities: -3994, income: 6503, expenses: 4048, debtRepayment: 0 },
  { year: 2026, month: 1, label: "Jan 2026", assets: 30, liabilities: -5114, income: 5456, expenses: 3690, debtRepayment: 0 },
  { year: 2025, month: 12, label: "Dec 2025", assets: 337, liabilities: -7187, income: 6226, expenses: 3868, debtRepayment: 0 },
  { year: 2025, month: 11, label: "Nov 2025", assets: 75, liabilities: -9283, income: 5963, expenses: 5124, debtRepayment: 0 },
  { year: 2025, month: 10, label: "Oct 2025", assets: 51, liabilities: -10098, income: 5598, expenses: 5950, debtRepayment: 0 },
  { year: 2025, month: 9, label: "Sep 2025", assets: 188, liabilities: -9883, income: 5537, expenses: 5000, debtRepayment: 0 },
  { year: 2025, month: 8, label: "Aug 2025", assets: 778, liabilities: -11010, income: 6487, expenses: 4716, debtRepayment: 0 },
  { year: 2025, month: 7, label: "Jul 2025", assets: 62, liabilities: -12065, income: 5265, expenses: 5099, debtRepayment: 0 },
  { year: 2025, month: 6, label: "Jun 2025", assets: 4, liabilities: -12172, income: 4845, expenses: 3324, debtRepayment: 0 },
  { year: 2025, month: 5, label: "May 2025", assets: 67, liabilities: -13756, income: 3305, expenses: 5401, debtRepayment: 0 },
  { year: 2025, month: 4, label: "Apr 2025", assets: 17, liabilities: -11610, income: 3863, expenses: 5310, debtRepayment: 0 },
  { year: 2025, month: 3, label: "Mar 2025", assets: 83, liabilities: -10229, income: 3877, expenses: 0, debtRepayment: 0 },
];

// ── Accounts ─────────────────────────────────────────────────
export const accounts: Account[] = [
  { name: "MBank", currency: "PLN", balance: 4940.01 },
  { name: "Revolut", currency: "PLN", balance: 1.30 },
  { name: "CA24", currency: "PLN", balance: 7.24 },
  { name: "Apartment Deposit", currency: "PLN", balance: 8300.00, illiquid: true },
  { name: "Priorbank", currency: "EUR", balance: 1202.54 },
];

// ── Debts ────────────────────────────────────────────────────
export const debts: DebtItem[] = [
  { name: "Grandma", apr: 0, currency: "USD", totalOwed: 2140, totalPaid: 50 },
  { name: "Красная Карта", apr: 14.6, currency: "BYN", totalOwed: 8720, totalPaid: 3216.22 },
];

// ── Exchange Rates ───────────────────────────────────────────
export const exchangeRates: ExchangeRate[] = [
  { pair: "PLN/USD", rate: 3.7154, symbol: "zł" },
  { pair: "BYN/USD", rate: 2.9332, symbol: "BYN" },
  { pair: "USD/EUR", rate: 1.1496, symbol: "$" },
];

// ── Asset Allocation (for donut chart) ───────────────────────
export const assetAllocation = [
  { name: "PLN Holdings", value: 73, color: "#1A8F78" },
  { name: "EUR Holdings", value: 22, color: "#7DD8C4" },
  { name: "USD Holdings", value: 5, color: "#C4A84D" },
];

// ── Month Change breakdown ───────────────────────────────────
export const monthChange = {
  total: 2572,
  breakdown: [
    { currency: "PLN", amount: 4949, symbol: "zł", prefix: "+" },
    { currency: "EUR", amount: 1203, symbol: "€", prefix: "+" },
    { currency: "USD", amount: 0, symbol: "$", prefix: "" },
  ],
};

// ── Goal ─────────────────────────────────────────────────────
export const goal = {
  target: 10000,
  current: -1252,
};

// ── Income by Source ─────────────────────────────────────────
export interface IncomeSource {
  year: number;
  month: string;
  kufar: number;
  tokMedia: number;
  other: number;
}

export const incomeBySource: IncomeSource[] = [
  { year: 2025, month: "January", kufar: 0, tokMedia: 3134, other: 0 },
  { year: 2025, month: "February", kufar: 0, tokMedia: 3169, other: 0 },
  { year: 2025, month: "March", kufar: 0, tokMedia: 3877, other: 0 },
  { year: 2025, month: "April", kufar: 0, tokMedia: 3863, other: 0 },
  { year: 2025, month: "May", kufar: 0, tokMedia: 3305, other: 0 },
  { year: 2025, month: "June", kufar: 1201, tokMedia: 3644, other: 0 },
  { year: 2025, month: "July", kufar: 1567, tokMedia: 3698, other: 0 },
  { year: 2025, month: "August", kufar: 1550, tokMedia: 4937, other: 0 },
  { year: 2025, month: "September", kufar: 1639, tokMedia: 3898, other: 0 },
  { year: 2025, month: "October", kufar: 1544, tokMedia: 4055, other: 0 },
  { year: 2025, month: "November", kufar: 1592, tokMedia: 4370, other: 0 },
  { year: 2025, month: "December", kufar: 2436, tokMedia: 3790, other: 0 },
  { year: 2026, month: "January", kufar: 835, tokMedia: 4571, other: 50 },
  { year: 2026, month: "February", kufar: 1625, tokMedia: 4639, other: 239 },
  { year: 2026, month: "March", kufar: 1580, tokMedia: 4026, other: 47 },
];

// ── Helpers ──────────────────────────────────────────────────

export function getNetWorth(r: MonthlyRecord): number {
  return r.assets + r.liabilities;
}

export function getSavings(r: MonthlyRecord): number {
  return r.income - r.expenses - (r.debtRepayment ?? 0);
}

export function getBurnRate(r: MonthlyRecord): number {
  if (r.income === 0) return 0;
  return r.expenses / r.income;
}

export function getSavingsRate(r: MonthlyRecord): number {
  if (r.income === 0) return 0;
  return getSavings(r) / r.income;
}

export function getNetWorthMoM(records: MonthlyRecord[], index: number): number | null {
  if (index >= records.length - 1) return null;
  const current = getNetWorth(records[index]);
  const previous = getNetWorth(records[index + 1]);
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatCurrency(value: number, symbol = "$", showSign = false): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const sign = value < 0 ? "-" : (showSign && value > 0 ? "+" : "");
  return `${sign}${symbol}${formatted}`;
}

export function formatCurrencyDecimal(value: number, symbol = "$"): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}

export function formatPercent(value: number, showSign = false): string {
  const sign = value > 0 && showSign ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
