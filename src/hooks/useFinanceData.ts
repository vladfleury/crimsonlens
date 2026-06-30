"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchAssetsLiabilities, fetchIncomeData, fetchAccounts, fetchDebts, fetchSettings,
  fetchIncomeTransactions,
  insertIncomeTransaction as apiInsertIncomeTx,
  updateIncomeTransaction as apiUpdateIncomeTx,
  deleteIncomeTransaction as apiDeleteIncomeTx,
  updateDebtPaid as apiUpdateDebtPaid,
  insertDebt as apiInsertDebt,
  updateDebt as apiUpdateDebt,
  deleteDebt as apiDeleteDebt,
  updateAccount as apiUpdateAccount,
  updateSetting as apiUpdateSetting,
  upsertAssetsLiabilities as apiUpsertAL,
  upsertIncomeData as apiUpsertIncome,
  insertAccount as apiInsertAccount,
  deleteAccount as apiDeleteAccount,
  updateAccountFull as apiUpdateAccountFull,
  type AssetsLiabilitiesRow, type IncomeDataRow, type AccountRow, type DebtRow, type SettingRow,
  type IncomeTransaction,
} from "@/lib/data";

// ── Derived record type (client-side computed) ──
export interface MonthlyRecord {
  year: number;
  month: number;
  label: string;
  assets: number;
  liabilities: number;
  income: number;
  expenses: number;
  expenseAdjustment: number;
  adjustedExpenses: number;
  debtRepayment: number;
  // Derived
  netWorth: number;
  savings: number;
  burnRate: number;
  savingsRate: number;
  netWorthMoM: number | null;
  // Live indicator
  isLive?: boolean;
}

export interface IncomeSourceRecord {
  year: number;
  month: string;
  kufar: number;
  tokMedia: number;
  other: number;
}

export interface MonthlyIncomeAgg {
  year: number;
  month: number; // 1-indexed
  date: string; // last day of month "YYYY-MM-DD"
  total: number; // USD total
  bySource: Record<string, number>; // e.g. { Kufar: 1580, TokMedia: 4026 }
  expenseAdjustment: number;
}

export interface UseFinanceDataReturn {
  // Raw data
  monthlyRecords: MonthlyRecord[];
  incomeBySource: IncomeSourceRecord[];
  incomeTransactions: IncomeTransaction[];
  monthlyIncomeAgg: MonthlyIncomeAgg[];
  accounts: AccountRow[];
  debts: DebtRow[];
  settings: SettingRow[];

  // Exchange rates
  plnUsdRate: number;
  bynUsdRate: number;
  usdEurRate: number;

  // Loading/error
  isLoading: boolean;
  error: string | null;

  // Mutations
  updateDebtPaid: (id: number, amount: number) => Promise<void>;
  insertDebt: (row: Omit<DebtRow, "id">) => Promise<DebtRow>;
  updateDebt: (id: number, patch: Partial<Omit<DebtRow, "id">>) => Promise<void>;
  deleteDebt: (id: number) => Promise<void>;
  updateAccount: (id: number, amount: number) => Promise<void>;
  updateAccountFull: (id: number, updates: Partial<Omit<AccountRow, "id">>) => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  upsertRecord: (al: Omit<AssetsLiabilitiesRow, "id">, inc: Omit<IncomeDataRow, "id">) => Promise<void>;
  upsertIncomeOnly: (inc: Omit<IncomeDataRow, "id">) => Promise<void>;
  upsertExpenseAdjustment: (date: string, year: number, amount: number) => Promise<void>;
  insertIncomeTx: (tx: Parameters<typeof apiInsertIncomeTx>[0]) => Promise<void>;
  updateIncomeTx: (id: number, tx: Parameters<typeof apiUpdateIncomeTx>[1]) => Promise<void>;
  deleteIncomeTx: (id: number) => Promise<void>;
  insertAccount: (row: Omit<AccountRow, "id">) => Promise<AccountRow>;
  deleteAccount: (id: number) => Promise<void>;
  setPlnUsdRate: (v: number) => void;
  setBynUsdRate: (v: number) => void;
  setUsdEurRate: (v: number) => void;
  refetch: () => Promise<void>;
  refreshExchangeRates: () => Promise<void>;
  exchangeRatesUpdatedAt: number | null;
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getLastDayOfMonth(year: number, month: number): string {
  // month is 1-indexed; Date uses 0-indexed months, so month+1 day 0 = last day of month
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useFinanceData(): UseFinanceDataReturn {
  // Raw Supabase data
  const [alRows, setAlRows] = useState<AssetsLiabilitiesRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<IncomeDataRow[]>([]);
  const [incomeTxRows, setIncomeTxRows] = useState<IncomeTransaction[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [settingRows, setSettingRows] = useState<SettingRow[]>([]);

  // Exchange rates (live fetched or from settings)
  const [plnUsdRate, setPlnUsdRate] = useState(3.7154);
  const [bynUsdRate, setBynUsdRate] = useState(2.9332);
  const [usdEurRate, setUsdEurRate] = useState(1.1496);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchangeRatesUpdatedAt, setExchangeRatesUpdatedAt] = useState<number | null>(null);

  // ── Fetch live exchange rates ──
  // Primary source: Google Finance, proxied through our /api/fx route (server-side
  //   scrape, avoids CORS, returns "TARGET per 1 USD" for PLN, EUR, BYN).
  // Fallback: Frankfurter (ECB daily ref rates) for PLN+EUR, NBRB for BYN.
  // Polling more frequently than the source updates is harmless.
  const refreshExchangeRates = useCallback(async () => {
    let pln: number | null = null;
    let eurPerUsd: number | null = null; // EUR per 1 USD (we invert for usdEurRate)
    let byn: number | null = null;

    // Try Google first
    try {
      const res = await fetch("/api/fx", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.rates?.PLN === "number" && data.rates.PLN > 0) pln = data.rates.PLN;
        if (typeof data?.rates?.EUR === "number" && data.rates.EUR > 0) eurPerUsd = data.rates.EUR;
        if (typeof data?.rates?.BYN === "number" && data.rates.BYN > 0) byn = data.rates.BYN;
      }
    } catch {
      // ignore, fall through to fallbacks
    }

    // Fallback: Frankfurter for PLN/EUR (only fill in what Google missed)
    if (pln === null || eurPerUsd === null) {
      try {
        const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=PLN,EUR", {
          cache: "no-store",
        });
        if (res.ok) {
          const fxData = await res.json();
          if (pln === null && typeof fxData?.rates?.PLN === "number") pln = fxData.rates.PLN;
          if (eurPerUsd === null && typeof fxData?.rates?.EUR === "number") eurPerUsd = fxData.rates.EUR;
        }
      } catch {
        // keep current
      }
    }

    // Fallback: NBRB for BYN
    if (byn === null) {
      try {
        const res = await fetch("https://api.nbrb.by/exrates/rates/USD?parammode=2", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const rate = typeof data?.Cur_OfficialRate === "number" ? data.Cur_OfficialRate : null;
          const scale = typeof data?.Cur_Scale === "number" && data.Cur_Scale > 0 ? data.Cur_Scale : 1;
          if (rate !== null) byn = rate / scale;
        }
      } catch {
        // keep current
      }
    }

    let touched = false;
    if (pln !== null) {
      setPlnUsdRate(parseFloat(pln.toFixed(4)));
      touched = true;
    }
    if (eurPerUsd !== null) {
      // usdEurRate = USD per 1 EUR (display convention) = 1 / (EUR per 1 USD)
      setUsdEurRate(parseFloat((1 / eurPerUsd).toFixed(4)));
      touched = true;
    }
    if (byn !== null) {
      setBynUsdRate(parseFloat(byn.toFixed(4)));
      touched = true;
    }
    if (touched) setExchangeRatesUpdatedAt(Date.now());
  }, []);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [al, inc, acc, dbt, sett, inctx] = await Promise.all([
        fetchAssetsLiabilities(),
        fetchIncomeData(),
        fetchAccounts(),
        fetchDebts(),
        fetchSettings(),
        fetchIncomeTransactions(),
      ]);

      setAlRows(al);
      setIncomeRows(inc);
      setIncomeTxRows(inctx);
      setAccountRows(acc);
      setDebtRows(dbt);
      setSettingRows(sett);

      // Seed BYN from settings as a fallback before the live fetch resolves
      const bynSetting = sett.find((s) => s.key === "usd_byn");
      if (bynSetting) {
        setBynUsdRate(parseFloat(bynSetting.value) || 2.9332);
      }

      await refreshExchangeRates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [refreshExchangeRates]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Auto-refresh exchange rates every 60s, plus when the tab regains focus ──
  useEffect(() => {
    const POLL_MS = 60_000;
    const id = setInterval(refreshExchangeRates, POLL_MS);
    const onFocus = () => { refreshExchangeRates(); };
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refreshExchangeRates();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      clearInterval(id);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [refreshExchangeRates]);

  // ── Compute virtual current-month assets from LIQUID accounts only ──
  const liveAssets = useMemo(() => {
    return accountRows
      .filter((a) => a.is_liquid)
      .reduce((sum, a) => {
        if (a.currency === "PLN") return sum + a.amount / plnUsdRate;
        if (a.currency === "EUR") return sum + a.amount * usdEurRate;
        return sum + a.amount; // USD
      }, 0);
  }, [accountRows, plnUsdRate, usdEurRate]);

  // ── Compute virtual current-month liabilities from debts ──
  const liveLiabilities = useMemo(() => {
    let total = 0;
    for (const d of debtRows) {
      const remaining = d.total_amount - d.amount_paid;
      if (d.currency === "BYN") {
        total += remaining / bynUsdRate;
      } else {
        total += remaining; // USD
      }
    }
    return -total; // Liabilities are negative
  }, [debtRows, bynUsdRate]);

  // ── Aggregate income_transactions by month ──
  const monthlyIncomeAgg = useMemo((): MonthlyIncomeAgg[] => {
    const map = new Map<string, { year: number; month: number; total: number; bySource: Record<string, number> }>();
    for (const tx of incomeTxRows) {
      const d = new Date(tx.date + "T00:00:00");
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      if (!map.has(key)) {
        map.set(key, { year, month, total: 0, bySource: {} });
      }
      const agg = map.get(key)!;
      agg.total += tx.usd_amount;
      agg.bySource[tx.source] = (agg.bySource[tx.source] ?? 0) + tx.usd_amount;
    }

    // Also pull expense_adjustment from income_data (legacy) for each month
    const adjMap = new Map<string, number>();
    for (const r of incomeRows) {
      const d = new Date(r.date + "T00:00:00");
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (r.expense_adjustment) adjMap.set(key, r.expense_adjustment);
    }

    return Array.from(map.entries())
      .map(([, agg]) => ({
        year: agg.year,
        month: agg.month,
        date: getLastDayOfMonth(agg.year, agg.month),
        total: Math.round(agg.total),
        bySource: Object.fromEntries(
          Object.entries(agg.bySource).map(([k, v]) => [k, Math.round(v)])
        ),
        expenseAdjustment: adjMap.get(`${agg.year}-${agg.month}`) ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [incomeTxRows, incomeRows]);

  // ── Compute monthly records by joining assets_liabilities + income (from transactions) ──
  const monthlyRecords = useMemo(() => {
    // Build a map from date -> aggregated monthly income from income_transactions
    const incomeAggMap = new Map<string, MonthlyIncomeAgg>();
    for (const agg of monthlyIncomeAgg) {
      incomeAggMap.set(agg.date, agg);
    }

    // Also keep legacy incomeMap for expense_adjustment fallback
    const incomeMap = new Map<string, IncomeDataRow>();
    for (const r of incomeRows) {
      incomeMap.set(r.date, r);
    }

    // Sort by date ascending for MoM calculation
    const sortedAL = [...alRows].sort((a, b) => a.date.localeCompare(b.date));

    // Determine current month/year
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentMonthDate = getLastDayOfMonth(currentYear, currentMonth);

    // Check if an assets_liabilities record exists for the current month
    const hasCurrentMonthAL = sortedAL.some((al) => {
      const d = new Date(al.date + "T00:00:00");
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });

    // Check if income_data exists for the current month (even without an AL record)
    const currentMonthIncomeRow = incomeRows.find((r) => {
      const d = new Date(r.date + "T00:00:00");
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });
    // Make it available via the incomeMap for the live date
    if (currentMonthIncomeRow && !incomeMap.has(currentMonthDate)) {
      incomeMap.set(currentMonthDate, currentMonthIncomeRow);
    }

    // If no AL record exists for current month, inject a virtual live one
    let alWithLive = sortedAL;
    let liveDate: string | null = null;
    if (!hasCurrentMonthAL && accountRows.length > 0) {
      liveDate = currentMonthDate;
      alWithLive = [
        ...sortedAL,
        {
          year: currentYear,
          date: currentMonthDate,
          assets: Math.round(liveAssets),
          liabilities: Math.round(liveLiabilities),
        },
      ];
    }

    // Build a set of dates covered by AL rows
    const alDateSet = new Set(alWithLive.map((al) => al.date));

    const records: MonthlyRecord[] = alWithLive.map((al, i) => {
      const d = new Date(al.date + "T00:00:00");
      const year = al.year || d.getFullYear();
      const month = d.getMonth() + 1;
      const label = `${MONTH_NAMES_SHORT[month - 1]} ${year}`;

      // Prefer income from income_transactions aggregation, fallback to legacy income_data
      const incAgg = incomeAggMap.get(al.date);
      const incLegacy = incomeMap.get(al.date);
      const totalIncome = incAgg ? incAgg.total : (incLegacy ? incLegacy.total : 0);

      // Net worth
      const netWorth = al.assets + al.liabilities;

      // Previous month net worth
      const prevNW = i > 0 ? alWithLive[i - 1].assets + alWithLive[i - 1].liabilities : null;

      // Expenses = prev_net_worth + income - net_worth
      const rawExpenses = prevNW !== null ? prevNW + totalIncome - netWorth : 0;
      const expenseAdjustment = incAgg?.expenseAdjustment ?? incLegacy?.expense_adjustment ?? 0;
      const adjustedExpenses = Math.max(0, rawExpenses - expenseAdjustment);

      // NW MoM
      const netWorthMoM = prevNW !== null && prevNW !== 0
        ? ((netWorth - prevNW) / Math.abs(prevNW)) * 100
        : null;

      // Debt repayment: how much liabilities decreased (liabilities are negative, so less negative = debt repaid)
      const debtRepayment = i > 0
        ? Math.max(0, Math.abs(alWithLive[i - 1].liabilities) - Math.abs(al.liabilities))
        : 0;

      // Burn rate, savings, savings rate — all use adjusted expenses
      const burnRate = totalIncome > 0 ? adjustedExpenses / totalIncome : 0;
      const savings = totalIncome - adjustedExpenses - debtRepayment;
      const savingsRate = totalIncome > 0 ? savings / totalIncome : 0;

      return {
        year,
        month,
        label,
        assets: al.assets,
        liabilities: al.liabilities,
        income: totalIncome,
        expenses: Math.max(0, rawExpenses),
        expenseAdjustment,
        adjustedExpenses,
        debtRepayment,
        netWorth,
        savings,
        burnRate,
        savingsRate,
        netWorthMoM,
        isLive: al.date === liveDate,
      };
    });

    // Add income-only months (no AL row) so they still appear in the table
    for (const inc of incomeRows) {
      if (!alDateSet.has(inc.date) && inc.date !== liveDate) {
        const d = new Date(inc.date + "T00:00:00");
        const year = inc.year || d.getFullYear();
        const month = d.getMonth() + 1;
        records.push({
          year,
          month,
          label: `${MONTH_NAMES_SHORT[month - 1]} ${year}`,
          assets: 0,
          liabilities: 0,
          income: inc.total,
          expenses: 0,
          expenseAdjustment: inc.expense_adjustment ?? 0,
          adjustedExpenses: 0,
          debtRepayment: 0,
          netWorth: 0,
          savings: inc.total,
          burnRate: 0,
          savingsRate: 1,
          netWorthMoM: null,
        });
      }
    }

    // Re-sort by date ascending
    records.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Return in most-recent-first order (matching old mockData convention)
    return records.reverse();
  }, [alRows, incomeRows, monthlyIncomeAgg, accountRows, liveAssets, liveLiabilities]);

  // ── Compute income by source (legacy from income_data, kept for backward compat) ──
  const incomeBySource = useMemo(() => {
    return incomeRows.map((r) => {
      const d = new Date(r.date + "T00:00:00");
      const month = d.getMonth();
      return {
        year: r.year || d.getFullYear(),
        month: MONTH_NAMES_FULL[month],
        kufar: r.kufar,
        tokMedia: r.tokmedia,
        other: r.other,
      };
    });
  }, [incomeRows]);


  // ── Mutations ──

  const updateDebtPaid = useCallback(async (id: number, amount: number) => {
    await apiUpdateDebtPaid(id, amount);
    setDebtRows((prev) => prev.map((d) => d.id === id ? { ...d, amount_paid: amount } : d));
  }, []);

  const insertDebt = useCallback(async (row: Omit<DebtRow, "id">) => {
    const newDebt = await apiInsertDebt(row);
    setDebtRows((prev) => [...prev, newDebt]);
    return newDebt;
  }, []);

  const updateDebt = useCallback(async (id: number, patch: Partial<Omit<DebtRow, "id">>) => {
    // Optimistic update for snappy inline editing; DB write is best-effort.
    setDebtRows((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
    try {
      await apiUpdateDebt(id, patch);
    } catch {
      /* keep optimistic value; refetch will reconcile */
    }
  }, []);

  const deleteDebt = useCallback(async (id: number) => {
    await apiDeleteDebt(id);
    setDebtRows((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateAccount = useCallback(async (id: number, amount: number) => {
    await apiUpdateAccount(id, amount);
    setAccountRows((prev) => prev.map((a) => a.id === id ? { ...a, amount } : a));
  }, []);

  const updateAccountFull = useCallback(async (id: number, updates: Partial<Omit<AccountRow, "id">>) => {
    await apiUpdateAccountFull(id, updates);
    setAccountRows((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    await apiUpdateSetting(key, value);
    setSettingRows((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
    if (key === "usd_byn") setBynUsdRate(parseFloat(value) || bynUsdRate);
  }, [bynUsdRate]);

  const upsertRecord = useCallback(async (
    al: Omit<AssetsLiabilitiesRow, "id">,
    inc: Omit<IncomeDataRow, "id">
  ) => {
    console.log("upsertRecord called with AL:", al, "INC:", inc);
    try {
      await Promise.all([
        apiUpsertAL(al),
        apiUpsertIncome(inc),
      ]);
      console.log("upsertRecord: Supabase calls succeeded");
    } catch (err: unknown) {
      console.error("upsertRecord: Supabase error:", err);
      const msg = (err && typeof err === "object" && "message" in err) ? (err as { message: string }).message : JSON.stringify(err);
      throw new Error(msg);
    }
    await fetchAll();
  }, [fetchAll]);

  const upsertIncomeOnly = useCallback(async (inc: Omit<IncomeDataRow, "id">) => {
    console.log("upsertIncomeOnly called with:", inc);
    try {
      await apiUpsertIncome(inc);
      console.log("upsertIncomeOnly: Supabase call succeeded");
    } catch (err: unknown) {
      console.error("upsertIncomeOnly: Supabase error:", err);
      // Re-throw with a proper Error so the caller gets a message
      const msg = (err && typeof err === "object" && "message" in err) ? (err as { message: string }).message : JSON.stringify(err);
      throw new Error(msg);
    }
    await fetchAll();
  }, [fetchAll]);

  const upsertExpenseAdjustment = useCallback(async (date: string, year: number, amount: number) => {
    // Save expense_adjustment to income_data table
    try {
      console.log("Saving expense adjustment to income_data:", { date, year, amount });
      // Check if income row exists for this date
      const existingIncome = incomeRows.find((r) => r.date === date);
      if (existingIncome) {
        // Update existing income row with adjustment
        await apiUpsertIncome({
          year, date,
          kufar: existingIncome.kufar, tokmedia: existingIncome.tokmedia,
          other: existingIncome.other, total: existingIncome.total,
          expense_adjustment: amount,
        });
      } else {
        // Create income row with just the adjustment (zeroed income)
        await apiUpsertIncome({
          year, date, kufar: 0, tokmedia: 0, other: 0, total: 0,
          expense_adjustment: amount,
        });
      }
      console.log("Expense adjustment saved successfully");
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "message" in err) ? (err as { message: string }).message : JSON.stringify(err);
      console.error("Failed to save expense adjustment:", msg);
      throw new Error(msg);
    }
    await fetchAll();
  }, [fetchAll, incomeRows]);

  const insertAccount = useCallback(async (row: Omit<AccountRow, "id">) => {
    const newAcc = await apiInsertAccount(row);
    setAccountRows((prev) => [...prev, newAcc]);
    return newAcc;
  }, []);

  const deleteAccount = useCallback(async (id: number) => {
    await apiDeleteAccount(id);
    setAccountRows((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const insertIncomeTx = useCallback(async (tx: Parameters<typeof apiInsertIncomeTx>[0]) => {
    await apiInsertIncomeTx(tx);
    await fetchAll();
  }, [fetchAll]);

  const updateIncomeTx = useCallback(async (id: number, tx: Parameters<typeof apiUpdateIncomeTx>[1]) => {
    await apiUpdateIncomeTx(id, tx);
    await fetchAll();
  }, [fetchAll]);

  const deleteIncomeTx = useCallback(async (id: number) => {
    await apiDeleteIncomeTx(id);
    await fetchAll();
  }, [fetchAll]);

  return {
    monthlyRecords,
    incomeBySource,
    incomeTransactions: incomeTxRows,
    monthlyIncomeAgg,
    accounts: accountRows,
    debts: debtRows,
    settings: settingRows,
    plnUsdRate,
    bynUsdRate,
    usdEurRate,
    isLoading,
    error,
    updateDebtPaid,
    insertDebt,
    updateDebt,
    deleteDebt,
    updateAccount,
    updateAccountFull,
    updateSetting,
    upsertRecord,
    upsertIncomeOnly,
    upsertExpenseAdjustment,
    insertIncomeTx,
    updateIncomeTx,
    deleteIncomeTx,
    insertAccount,
    deleteAccount,
    setPlnUsdRate,
    setBynUsdRate,
    setUsdEurRate,
    refetch: fetchAll,
    refreshExchangeRates,
    exchangeRatesUpdatedAt,
  };
}
