"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, LineChart, AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, LabelList,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import NetWorthChart from "@/components/NetWorthChart";
import MoneyFlowChart from "@/components/MoneyFlowChart";
import MonthClock from "@/components/MonthClock";
import { useFinance } from "@/hooks/FinanceDataContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { formatCurrency, formatPercent, monthNames } from "@/data/mockData";

type YearFilter = "all" | "2026" | "2025";

const debtSymbols: Record<string, string> = { USD: "$", EUR: "€", PLN: "zł", BYN: "Br" };

// Compact integer dollar formatter — e.g. $2,714 → "$2.7k", -6850 → "-$6.9k"
function fmtCompact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  if (abs >= 1000) {
    const k = abs / 1000;
    const s = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}$${s}k`;
  }
  return `${sign}$${abs.toLocaleString()}`;
}

export default function NetWorthPage() {
  const c = useThemeColors();
  const {
    monthlyRecords, accounts, debts, settings,
    plnUsdRate, bynUsdRate, usdEurRate,
    setPlnUsdRate, setBynUsdRate, setUsdEurRate,
    updateSetting, insertDebt, updateDebt, deleteDebt,
    isLoading, error, refetch,
    refreshExchangeRates, exchangeRatesUpdatedAt,
  } = useFinance();

  const [yearFilter, setYearFilter] = useState<YearFilter>("2026");
  const [areaYearFilter, setAreaYearFilter] = useState<YearFilter>("2026");

  // Exchange rates auto-refresh every 60s and on tab focus inside useFinanceData;
  // the manual refresh buttons just trigger that same refresher.

  // ── Debt data from Supabase ──
  const grandmaDebt = debts.find((d) => d.currency === "USD");

  const grandmaPaid = grandmaDebt?.amount_paid ?? 0;
  const grandmaTotal = grandmaDebt?.total_amount ?? 0;

  const grandmaRemaining = grandmaTotal - grandmaPaid;
  const totalDebtUSD = Math.round(grandmaRemaining);

  // ── Live account totals (for current-month virtual record) — liquid only ──
  const plnAccounts = accounts.filter((a) => a.currency === "PLN" && a.is_liquid);
  const eurAccounts = accounts.filter((a) => a.currency === "EUR" && a.is_liquid);
  const usdAccounts = accounts.filter((a) => a.currency === "USD" && a.is_liquid);
  const plnTotal = plnAccounts.reduce((s, a) => s + a.amount, 0);
  const eurTotal = eurAccounts.reduce((s, a) => s + a.amount, 0);
  const usdTotal = usdAccounts.reduce((s, a) => s + a.amount, 0);
  const totalAccountsUSD = plnTotal / plnUsdRate + eurTotal * usdEurRate + usdTotal;
  const liveLiabilitiesUSD = -grandmaRemaining;

  const filteredRecords = useMemo(() => {
    const sorted = [...monthlyRecords];
    if (yearFilter === "all") return sorted;
    return sorted.filter((r) => r.year === Number(yearFilter));
  }, [yearFilter, monthlyRecords]);

  const allTimeSorted = useMemo(() => [...monthlyRecords], [monthlyRecords]);

  const barData = useMemo(() => {
    const shortMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dataMap = new Map<string, { income: number; expenses: number }>();
    for (const r of filteredRecords) {
      const key = shortMonth[r.month - 1] + " " + String(r.year).slice(2);
      dataMap.set(key, { income: r.income, expenses: r.adjustedExpenses });
    }

    let months: string[] = [];
    if (yearFilter === "2026") {
      months = shortMonth.map((m) => m + " 26");
    } else if (yearFilter === "2025") {
      months = shortMonth.map((m) => m + " 25");
    } else {
      for (let m = 2; m < 12; m++) months.push(shortMonth[m] + " 25");
      for (let m = 0; m < 12; m++) months.push(shortMonth[m] + " 26");
    }

    let rows = months.map((name) => {
      const d = dataMap.get(name);
      return {
        name,
        income: d ? d.income : undefined as number | undefined,
        expenses: d && d.expenses > 0 ? d.expenses : undefined as number | undefined,
      };
    });

    // For single-year filters, trim trailing months where both series are empty.
    if (yearFilter !== "all") {
      let lastIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].income != null || rows[i].expenses != null) lastIdx = i;
      }
      rows = rows.slice(0, lastIdx + 1);
    }

    return rows;
  }, [filteredRecords, yearFilter]);

  // Min/max income & expense indices for inline labelling (only extremes labelled).
  const barExtremes = useMemo(() => {
    let incMinI = -1, incMaxI = -1, expMinI = -1, expMaxI = -1;
    let incMin = Infinity, incMax = -Infinity, expMin = Infinity, expMax = -Infinity;
    barData.forEach((d, i) => {
      if (d.income != null) {
        if (d.income < incMin) { incMin = d.income; incMinI = i; }
        if (d.income > incMax) { incMax = d.income; incMaxI = i; }
      }
      if (d.expenses != null) {
        if (d.expenses < expMin) { expMin = d.expenses; expMinI = i; }
        if (d.expenses > expMax) { expMax = d.expenses; expMaxI = i; }
      }
    });
    return {
      income: new Set([incMinI, incMaxI].filter((i) => i >= 0)),
      expenses: new Set([expMinI, expMaxI].filter((i) => i >= 0)),
    };
  }, [barData]);

  // Period totals for the Income vs Expenses header (Apple-Card style).
  const incomeTotalPeriod = useMemo(() => barData.reduce((s, d) => s + (d.income ?? 0), 0), [barData]);
  const expenseTotalPeriod = useMemo(() => barData.reduce((s, d) => s + (d.expenses ?? 0), 0), [barData]);

  // Label density: every bar/point on wide screens, only min/max on narrow ones.
  const [isNarrowChart, setIsNarrowChart] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsNarrowChart(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Income bar gradient (Apple-Card style): saturated/opaque at the BOTTOM
  // (offset 100%), luminous + translucent glassy crest at the TOP (offset 0%).
  const incomeStops = c.isDark
    ? [
        { offset: "0%", color: "#7DF0DA", opacity: 0.18 },
        { offset: "30%", color: "#54E6C6", opacity: 0.5 },
        { offset: "65%", color: "#3DD5B4", opacity: 0.9 },
        { offset: "100%", color: "#2BB89D", opacity: 1 },
      ]
    : [
        { offset: "0%", color: "#86DCC9", opacity: 0.3 },
        { offset: "30%", color: "#46C9AB", opacity: 0.6 },
        { offset: "65%", color: "#1EB594", opacity: 0.94 },
        { offset: "100%", color: "#0E9C7C", opacity: 1 },
      ];

  const filteredAreaRecords = useMemo(() => {
    if (areaYearFilter === "all") return allTimeSorted;
    return allTimeSorted.filter((r) => r.year === Number(areaYearFilter));
  }, [areaYearFilter, allTimeSorted]);

  const areaData = useMemo(() => {
    const shortMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dataMap = new Map<string, { assets: number; liabilities: number }>();
    for (const r of filteredAreaRecords) {
      const key = shortMonth[r.month - 1] + " " + String(r.year).slice(2);
      dataMap.set(key, { assets: r.assets, liabilities: r.liabilities });
    }

    let months: string[] = [];
    if (areaYearFilter === "2026") {
      const dec25 = allTimeSorted.find((r) => r.year === 2025 && r.month === 12);
      if (dec25) {
        dataMap.set("Dec 25", { assets: dec25.assets, liabilities: dec25.liabilities });
      }
      months = ["Dec 25", ...shortMonth.map((m) => m + " 26")];
    } else if (areaYearFilter === "2025") {
      months = shortMonth.map((m) => m + " 25");
    } else {
      for (let m = 2; m < 12; m++) months.push(shortMonth[m] + " 25");
      for (let m = 0; m < 12; m++) months.push(shortMonth[m] + " 26");
    }

    let rows = months.map((name) => {
      const d = dataMap.get(name);
      return {
        name,
        assets: d ? d.assets : undefined as number | undefined,
        liabilities: d ? d.liabilities : undefined as number | undefined,
      };
    });

    // Trim trailing empty future months (keep "all" intact).
    if (areaYearFilter !== "all") {
      let lastIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].assets != null || rows[i].liabilities != null) lastIdx = i;
      }
      rows = rows.slice(0, lastIdx + 1);
    }

    return rows;
  }, [filteredAreaRecords, areaYearFilter, allTimeSorted]);

  // Last non-null index per series — only that point gets a label.
  const areaLastIdx = useMemo(() => {
    let assets = -1, liabilities = -1;
    areaData.forEach((d, i) => {
      if (d.assets != null) assets = i;
      if (d.liabilities != null) liabilities = i;
    });
    return { assets, liabilities };
  }, [areaData]);

  const current = monthlyRecords[0];
  const currentAssets = current?.isLive ? Math.round(totalAccountsUSD) : (current?.assets ?? 0);
  const currentIncome = current?.income ?? 0;
  const currentNW = current?.isLive ? Math.round(totalAccountsUSD + liveLiabilitiesUSD) : (current ? current.netWorth : 0);
  const currentMonth = current ? monthNames[current.month - 1] : "—";

  // ── KPI sparklines + deltas vs. previous month ──
  // monthlyRecords is most-recent-first; reverse for ascending order, then take last 7.
  const sparkRecords = useMemo(() => {
    const asc = [...monthlyRecords].reverse();
    return asc.slice(-7);
  }, [monthlyRecords]);

  const debtSeries = sparkRecords.map((r) => Math.abs(r.liabilities));
  const assetsSeries = sparkRecords.map((r) => r.assets);
  const nwSeries = sparkRecords.map((r) => r.netWorth);
  const incomeSeries = sparkRecords.map((r) => r.income);

  // Previous month: skip the live (in-progress) record so we compare against a closed month.
  const prevForKpi = monthlyRecords.find((r) => !r.isLive) ?? monthlyRecords[1];
  const prevAssetsKpi = prevForKpi?.assets ?? 0;
  const prevLiabilities = prevForKpi?.liabilities ?? 0;
  const prevNW = prevForKpi?.netWorth ?? 0;
  const prevIncome = prevForKpi?.income ?? 0;

  // Debt is shown as a signed-negative number; the chip should reflect change in *amount* of debt
  // (|curr| − |prev|), so a decrease in debt produces a negative chip with green styling.
  const currentDebtSigned = -totalDebtUSD;
  const debtAbsDelta = Math.abs(currentDebtSigned) - Math.abs(prevLiabilities);
  const debtImproving = debtAbsDelta <= 0; // debt went down (or unchanged)

  const assetsDelta = currentAssets - prevAssetsKpi;
  const assetsImproving = assetsDelta >= 0;

  const nwDelta = currentNW - prevNW;
  const nwImproving = nwDelta >= 0;

  const incomeDelta = currentIncome - prevIncome;
  const incomeImproving = incomeDelta >= 0;

  // Income tone: warn (gold) if below 90% of last month, otherwise income (green).
  const incomeTone: "income" | "warn" =
    prevIncome > 0 && currentIncome < 0.9 * prevIncome ? "warn" : "income";

  const fmtDelta = (n: number) => {
    const r = Math.round(n);
    if (r === 0) return "$0";
    return (r > 0 ? "+" : "−") + "$" + Math.abs(r).toLocaleString();
  };

  const hasPrev = !!prevForKpi;

  // Goal — compute from net worth
  const goalTarget = 10000;
  const goalCurrent = current ? current.netWorth : 0;
  const goalRemaining = goalTarget - goalCurrent;
  const goalPercent = (goalCurrent / goalTarget) * 100;
  const recentRecords = monthlyRecords.slice(0, 3);
  const avgMonthlyGain = recentRecords.length > 1
    ? (recentRecords[0].netWorth - recentRecords[recentRecords.length - 1].netWorth) / (recentRecords.length - 1)
    : 0;
  const estimatedMonths = avgMonthlyGain > 0 ? Math.ceil(goalRemaining / avgMonthlyGain) : null;

  // Asset allocation from current_accounts (already computed above).
  // Colors baked from theme tokens so the pie + swatches recolor on theme toggle.
  const allocColors = useMemo(() => [c.greenDeep, c.greenSoft, c.gold], [c]);
  const assetAllocation = useMemo(() => (totalAccountsUSD > 0 ? [
    { name: "PLN Holdings", value: Math.round((plnTotal / plnUsdRate / totalAccountsUSD) * 100), color: allocColors[0] },
    { name: "EUR Holdings", value: Math.round((eurTotal * usdEurRate / totalAccountsUSD) * 100), color: allocColors[1] },
    { name: "USD Holdings", value: Math.round((usdTotal / totalAccountsUSD) * 100), color: allocColors[2] },
  ] : [
    { name: "PLN Holdings", value: 73, color: allocColors[0] },
    { name: "EUR Holdings", value: 22, color: allocColors[1] },
    { name: "USD Holdings", value: 5, color: allocColors[2] },
  ]), [totalAccountsUSD, plnTotal, plnUsdRate, eurTotal, usdEurRate, usdTotal, allocColors]);

  // Month change — current live accounts vs previous month's assets from DB
  const prevMonth = monthlyRecords.find((r) => !r.isLive) ?? monthlyRecords[1];
  const prevAssetsUSD = prevMonth?.assets ?? 0;
  const monthChangeTotal = Math.round(totalAccountsUSD - prevAssetsUSD);
  const plnUSD = plnTotal / plnUsdRate;
  const eurUSD = eurTotal * usdEurRate;
  const monthChangeBreakdown = [
    { currency: "PLN", amount: Math.round(plnTotal), symbol: "zł", prefix: "", usdValue: plnUSD },
    { currency: "EUR", amount: Math.round(eurTotal), symbol: "€", prefix: "", usdValue: eurUSD },
    { currency: "USD", amount: Math.round(usdTotal), symbol: "$", prefix: "", usdValue: usdTotal },
  ];

  // Yearly performance
  const income2025 = monthlyRecords.filter((r) => r.year === 2025).reduce((s, r) => s + r.income, 0);
  const income2026 = monthlyRecords.filter((r) => r.year === 2026).reduce((s, r) => s + r.income, 0);

  const years: YearFilter[] = ["all", "2026", "2025"];
  const yearLabels: Record<YearFilter, string> = { all: "All Time", "2026": "2026", "2025": "2025" };

  const maxChange = Math.max(...monthChangeBreakdown.map((b) => b.usdValue), 1);
  const changeBarColors = allocColors;

  // ── Debt CRUD (writes ONLY to the debts table) ──
  const handleDebtField = useCallback(
    async (id: number, patch: Partial<{ name: string; currency: string; total_amount: number; amount_paid: number; apr: number }>) => {
      try { await updateDebt(id, patch); } catch { /* optimistic */ }
    },
    [updateDebt]
  );

  const handleDeleteDebt = useCallback(async (id: number) => {
    try { await deleteDebt(id); } catch { /* handled */ }
  }, [deleteDebt]);

  const handleAddDebt = useCallback(async () => {
    try {
      await insertDebt({ name: "New debt", currency: "USD", total_amount: 0, amount_paid: 0, apr: 0 });
    } catch { /* handled */ }
  }, [insertDebt]);

  const handleBynRateChange = useCallback(async (newRate: number) => {
    setBynUsdRate(newRate);
    try {
      await updateSetting("usd_byn", String(newRate));
    } catch { /* keep local state */ }
  }, [setBynUsdRate, updateSetting]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[var(--accent-green)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--text-muted)]">Loading financial data...</span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-red-soft-bg)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm text-[var(--accent-red)] font-medium">Failed to load data</p>
              <p className="text-xs text-[var(--text-muted)] max-w-[300px]">{error}</p>
              <button onClick={refetch} className="mt-2 px-4 py-2 bg-[var(--text)] text-[var(--bg)] rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                Retry
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (monthlyRecords.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-sm text-[var(--text-muted)]">No data found. Add records to get started.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto">
        {/* ── KPI Cards + Exchange Rates ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <KPICard
            label="Debt"
            value={formatCurrency(-totalDebtUSD)}
            tone="negative"
            series={debtSeries}
            deltaLabel={hasPrev ? fmtDelta(debtAbsDelta) : undefined}
            deltaImproving={debtImproving}
          />
          <KPICard
            label="Assets"
            value={formatCurrency(currentAssets)}
            tone="positive"
            series={assetsSeries}
            deltaLabel={hasPrev ? fmtDelta(assetsDelta) : undefined}
            deltaImproving={assetsImproving}
          />
          <KPICard
            label="Net Worth"
            value={formatCurrency(currentNW)}
            tone={currentNW >= 0 ? "positive" : "negative"}
            series={nwSeries}
            deltaLabel={hasPrev ? fmtDelta(nwDelta) : undefined}
            deltaImproving={nwImproving}
          />
          <KPICard
            label={`Income (${currentMonth})`}
            value={formatCurrency(currentIncome)}
            tone={incomeTone}
            series={incomeSeries}
            deltaLabel={hasPrev ? fmtDelta(incomeDelta) : undefined}
            deltaImproving={incomeImproving}
          />
        </div>

        {/* ── Two-column layout: Left charts + Right sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Debt Analysis */}
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Debt Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {debts.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    symbol={debtSymbols[debt.currency] ?? "$"}
                    onField={handleDebtField}
                    onDelete={handleDeleteDebt}
                  />
                ))}
                <button
                  onClick={handleAddDebt}
                  className="rounded-2xl p-5 flex flex-col items-center justify-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors border-2 border-dashed border-[var(--border)] min-h-[150px]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New debt
                </button>
              </div>
            </div>

            {/* Assets vs Liabilities */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Assets vs Liabilities</h2>
                <div className="flex gap-1 bg-[var(--chip)] rounded-xl p-1">
                  {years.map((y) => (
                    <button
                      key={`area-${y}`}
                      onClick={() => setAreaYearFilter(y)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        areaYearFilter === y
                          ? "bg-[var(--text)] text-[var(--bg)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {yearLabels[y]}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={areaData} margin={{ top: 16, right: 12, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.greenPale} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={c.greenPale} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradLiabilities" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.redPale} stopOpacity={0.05} />
                      <stop offset="100%" stopColor={c.redPale} stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={c.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis width={40} tickCount={4} tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} domain={[(dataMin: number) => Math.floor((dataMin * 1.1) / 1000) * 1000, (dataMax: number) => Math.ceil((dataMax * 1.15) / 1000) * 1000]} />
                  <ReferenceLine y={0} stroke={c.baseline} strokeWidth={1.5} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", backgroundColor: c.tooltipBg, color: c.tooltipText }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`$${Number(value).toLocaleString()}`, name === "assets" ? "Assets" : "Liabilities"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="assets"
                    stroke={c.green}
                    fill="url(#gradAssets)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: c.green, stroke: c.dotStroke, strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ x, y, index, value }: any) => index === areaLastIdx.assets && value != null ? (
                      <text x={x} y={y - 12} textAnchor="middle" fill={c.green} fontSize={11} fontWeight={600}>
                        {fmtCompact(Number(value))}
                      </text>
                    ) : null}
                  />
                  <Area
                    type="monotone"
                    dataKey="liabilities"
                    stroke={c.red}
                    fill="url(#gradLiabilities)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: c.red, stroke: c.dotStroke, strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ x, y, index, value }: any) => index === areaLastIdx.liabilities && value != null ? (
                      <text x={x} y={y + 18} textAnchor="middle" fill={c.red} fontSize={11} fontWeight={600}>
                        {fmtCompact(Number(value))}
                      </text>
                    ) : null}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Income vs Expenses */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Income vs Expenses</h2>
                <div className="flex gap-1 bg-[var(--chip)] rounded-xl p-1">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYearFilter(y)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        yearFilter === y
                          ? "bg-[var(--text)] text-[var(--bg)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {yearLabels[y]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Period totals (Apple-Card style headline) */}
              <div className="flex items-stretch gap-3 mb-5">
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Total Earned</p>
                  <p className="text-xl md:text-2xl font-bold tabular-nums text-[var(--accent-green-strong)]" style={{ fontFamily: "var(--font-heading)" }}>
                    ${Math.round(incomeTotalPeriod).toLocaleString()}
                  </p>
                </div>
                <div className="w-px self-stretch bg-[var(--hairline)]" />
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Total Spent</p>
                  <p className="text-xl md:text-2xl font-bold tabular-nums text-[var(--accent-red-strong)]" style={{ fontFamily: "var(--font-heading)" }}>
                    ${Math.round(expenseTotalPeriod).toLocaleString()}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={barData} barGap={0} barCategoryGap="18%" margin={{ top: 16, right: 12, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                      {incomeStops.map((s) => (
                        <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
                      ))}
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={c.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontFamily: "var(--font-body)", backgroundColor: c.tooltipBg, color: c.tooltipText }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`$${Math.round(Number(value)).toLocaleString()}`, name === "income" ? "Income" : "Expenses"]}
                  />
                  <Bar dataKey="income" fill="url(#incomeBar)" radius={[6, 6, 0, 0]} name="income" isAnimationActive={false}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={entry.income != null ? "url(#incomeBar)" : "transparent"} />
                    ))}
                    <LabelList
                      dataKey="income"
                      position="top"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      content={(props: any) => {
                        const { x, y, width, value, index } = props;
                        if (value == null || (isNarrowChart && !barExtremes.income.has(index))) return null;
                        return (
                          <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={c.incomeLabel} fontSize={11} fontWeight={600}>
                            {fmtCompact(Number(value))}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke={c.expense}
                    strokeWidth={2.5}
                    dot={{ r: 4.5, fill: c.expense, stroke: c.dotStroke, strokeWidth: 2 }}
                    connectNulls={false}
                    name="expenses"
                    isAnimationActive={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ x, y, index, value }: any) => value != null && (!isNarrowChart || barExtremes.expenses.has(index)) ? (
                      <text x={x} y={y - 13} textAnchor="middle" fill={c.expenseLabel} fontSize={11} fontWeight={600}>
                        {fmtCompact(Number(value))}
                      </text>
                    ) : null}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.income }} />
                  Income
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.expense }} />
                  Expenses
                </div>
              </div>
            </div>

            {/* Money Flow */}
            <MoneyFlowChart />

            {/* Net Worth + Gains */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
              <NetWorthChart />
            </div>

            {/* Yearly Performance (3D Isometric) */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
              <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Yearly Performance</h2>
              <YearlyPerformance3D records={monthlyRecords} />
            </div>
          </div>

          {/* ── RIGHT COLUMN (sticky sidebar) ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            {/* Month Clock */}
            <MonthClock />

            {/* Goal Card */}
            <div className="glass-tinted glass-tinted--gold rounded-2xl p-5 relative">
              <div className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "var(--accent-red)" }}>
                {Math.abs(goalPercent).toFixed(0)}%
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[var(--accent-gold-deep)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                </span>
                <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--accent-gold-deep)" }}>
                  Goal: $10,000
                </h3>
              </div>
              <p className="text-3xl font-bold mt-1 text-[var(--text)]" style={{ fontFamily: "var(--font-heading)" }}>
                {formatCurrency(goalCurrent)}
              </p>
              <div className="w-full h-3 bg-[var(--gold-track)] rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-[var(--text)]"
                  style={{ width: `${Math.max(0, goalPercent)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--accent-gold-deep)" }}>
                <span>${goalRemaining.toLocaleString()} remaining</span>
                {estimatedMonths && <span>~{estimatedMonths} months at current pace</span>}
              </div>
            </div>

            {/* Asset Allocation + Month Change */}
            <div className="glass-tinted rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-heading)" }}>Asset Allocation</h3>
                <span className="px-3 py-1 rounded-full text-sm font-bold text-white" style={{ backgroundColor: "var(--accent-green-deep)" }}>
                  ${Math.round(monthChangeTotal).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0" style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {assetAllocation.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-[8px] text-[var(--text-muted)]">Total</span>
                    <span className="text-sm font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-heading)" }}>${Math.round(totalAccountsUSD).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  {assetAllocation.map((a) => (
                    <div key={a.name}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                        <span className="text-[11px] text-[var(--text-muted)]">{a.name.replace(" Holdings", "")}</span>
                      </div>
                      <span className="text-lg font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-heading)" }}>{a.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Month Change breakdown */}
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--hairline)" }}>
                <div className="flex items-end gap-2 h-[60px] relative mt-1">
                  <div className="absolute bottom-[30px] left-0 right-0 border-t border-dashed" style={{ borderColor: "var(--border)" }} />
                  {monthChangeBreakdown.map((b, i) => {
                    const h = maxChange > 0 ? (b.usdValue / maxChange) * 50 : 0;
                    return (
                      <div key={b.currency} className="flex-1 flex flex-col items-center">
                        <div className="rounded-md w-full" style={{ height: `${Math.max(h, 3)}px`, backgroundColor: changeBarColors[i], opacity: 0.85 }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  {monthChangeBreakdown.map((b, i) => (
                    <div key={b.currency} className="flex flex-col items-center text-center flex-1">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: changeBarColors[i] }} />
                        <span className="text-[10px] text-[var(--accent-green-deep)]">{b.currency}</span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--accent-green-strong)]">
                        {b.prefix}{b.symbol}{b.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Exchange Rates */}
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Live FX</span>
                </div>
                <button
                  onClick={() => { refreshExchangeRates(); }}
                  className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
                  title={exchangeRatesUpdatedAt
                    ? `Last synced ${new Date(exchangeRatesUpdatedAt).toLocaleTimeString()}`
                    : "Refresh rates"}
                >
                  {exchangeRatesUpdatedAt
                    ? new Date(exchangeRatesUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <ExchangeRateRow label="PLN/USD" value={plnUsdRate} onChange={setPlnUsdRate} suffix=" zł" onRefresh={refreshExchangeRates} />
                <ExchangeRateRow label="BYN/USD" value={bynUsdRate} onChange={handleBynRateChange} prefix="BYN " onRefresh={refreshExchangeRates} />
                <ExchangeRateRow label="USD/EUR" value={usdEurRate} onChange={setUsdEurRate} prefix="$" onRefresh={refreshExchangeRates} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8" />
      </div>
    </DashboardLayout>
  );
}

/* ── Editable debt card (writes only to the debts table) ── */
function DebtCard({
  debt,
  symbol,
  onField,
  onDelete,
}: {
  debt: { id: number; name: string; currency: string; total_amount: number; amount_paid: number; apr: number };
  symbol: string;
  onField: (id: number, patch: Partial<{ name: string; currency: string; total_amount: number; amount_paid: number; apr: number }>) => void;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState(debt.name);
  useEffect(() => { setName(debt.name); }, [debt.name]);

  const remaining = debt.total_amount - debt.amount_paid;
  const progress = debt.total_amount > 0 ? (debt.amount_paid / debt.total_amount) * 100 : 0;
  const numCls =
    "text-right font-medium bg-[var(--input-num-bg)] rounded px-1.5 py-0.5 border-none outline-none text-sm focus:bg-[var(--input-num-focus)] transition-colors";

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { const v = name.trim() || "Untitled"; if (v !== debt.name) onField(debt.id, { name: v }); }}
          placeholder="Debt name"
          className="font-semibold text-sm bg-transparent outline-none flex-1 min-w-0 text-[var(--text)] rounded px-1 -mx-1 focus:bg-[var(--input-bg)] transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        />
        <button
          onClick={() => onDelete(debt.id)}
          aria-label="Delete debt"
          title="Delete debt"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-faint)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-red-soft-bg)] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-muted)]">Total</span>
          <div className="flex items-center gap-1">
            <select
              value={debt.currency}
              onChange={(e) => onField(debt.id, { currency: e.target.value })}
              className="text-xs text-[var(--text-muted)] bg-transparent outline-none cursor-pointer hover:text-[var(--text-secondary)]"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="PLN">PLN</option>
              <option value="BYN">BYN</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={debt.total_amount}
              onChange={(e) => onField(debt.id, { total_amount: e.target.value === "" ? 0 : Number(e.target.value) })}
              className={`${numCls} w-24 text-[var(--text)]`}
            />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-muted)]">Paid</span>
          <div className="flex items-center">
            <span className="text-[var(--accent-green-strong)] font-medium mr-0.5">{symbol}</span>
            <input
              type="number"
              step="0.01"
              value={debt.amount_paid}
              onChange={(e) => onField(debt.id, { amount_paid: e.target.value === "" ? 0 : Number(e.target.value) })}
              className={`${numCls} w-24 text-[var(--accent-green-strong)]`}
            />
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Remaining</span>
          <span className="font-medium text-[var(--accent-red-strong)] tabular-nums">{symbol}{remaining.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-muted)]">APR</span>
          <div className="flex items-center">
            <input
              type="number"
              step="0.1"
              value={debt.apr}
              onChange={(e) => onField(debt.id, { apr: e.target.value === "" ? 0 : Number(e.target.value) })}
              className={`${numCls} w-14 text-[var(--text)]`}
            />
            <span className="text-[var(--text-muted)] ml-0.5">%</span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="w-full h-2 bg-[var(--chip)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: progress < 30 ? "var(--accent-red)" : progress < 80 ? "var(--accent-gold)" : "var(--accent-green)" }}
          />
        </div>
        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">{formatPercent(progress)}</span>
      </div>
    </div>
  );
}

function ExchangeRateRow({
  label, value, onChange, prefix, suffix, onRefresh,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  onRefresh?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    if (!editing) setLocalValue(String(value));
  }, [value, editing]);

  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[var(--text-faint)]">{label}</span>
      <div className="flex items-center gap-1">
        {editing ? (
          <input
            type="number"
            step="0.0001"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
              setEditing(false);
              const n = parseFloat(localValue);
              if (!isNaN(n) && n > 0) onChange(n);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-16 text-right text-[12px] text-[var(--text-muted)] font-medium bg-[var(--input-num-bg)] rounded px-1 border-none outline-none focus:bg-[var(--input-num-focus)] transition-colors"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] text-[var(--text-muted)] font-medium hover:text-[var(--text-secondary)] transition-colors cursor-text"
          >
            {prefix}{value}{suffix}
          </button>
        )}
        {onRefresh && (
          <button onClick={onRefresh} className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors ml-0.5" title="Refresh rate">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  tone,
  series,
  deltaLabel,
  deltaImproving,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "income" | "warn" | "neutral";
  series?: number[];
  deltaLabel?: string;
  deltaImproving?: boolean;
}) {
  const c = useThemeColors();
  const sparkData = (series ?? []).map((v, i) => ({ i, v }));
  const toneColor =
    tone === "positive" ? c.greenStrong
    : tone === "negative" ? c.redStrong
    : tone === "income" ? c.greenStrong
    : tone === "warn" ? c.goldDeep
    : c.textSub;
  const lineColor = toneColor;

  return (
    <div className="glass-card rounded-2xl p-3.5 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] md:text-[11px] text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">{label}</p>
        {sparkData.length > 1 && (
          <div className="w-[56px] md:w-[70px] h-[20px] md:h-[24px] -mt-0.5 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={1.75}
                  isAnimationActive={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    if (props.index !== sparkData.length - 1) {
                      return <g key={`d-${props.index}`} />;
                    }
                    return (
                      <circle
                        key={`d-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={2.5}
                        fill={lineColor}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <p
        className="text-base md:text-xl font-bold mt-1 tabular-nums"
        style={{ fontFamily: "var(--font-heading)", color: toneColor }}
      >
        {value}
      </p>
      {deltaLabel && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              deltaImproving
                ? "bg-[var(--accent-green-soft-bg)] text-[var(--accent-green-strong)]"
                : "bg-[var(--accent-red-soft-bg)] text-[var(--accent-red-strong)]"
            }`}
          >
            {deltaLabel}
          </span>
          <span className="text-[10px] md:text-[11px] text-[var(--text-muted)]">vs last mo.</span>
        </div>
      )}
    </div>
  );
}

/* ── 3D Isometric Chart — Assets up / Liabilities down (reference-based) ── */
function YearlyPerformance3D({ records }: { records: { year: number; assets: number; liabilities: number; netWorth: number }[] }) {
  const c = useThemeColors();

  // Compute per-year data from records
  const years2025 = records.filter((r) => r.year === 2025);
  const years2026 = records.filter((r) => r.year === 2026);
  const last2025 = years2025.length > 0 ? years2025[0] : null; // most recent first
  const last2026 = years2026.length > 0 ? years2026[0] : null;

  const data = [
    { year: "2025", assets: last2025?.assets ?? 337, liabilities: Math.abs(last2025?.liabilities ?? -7187), nw: last2025?.netWorth ?? -6850 },
    { year: "2026 (YTD)", assets: last2026?.assets ?? 2714, liabilities: Math.abs(last2026?.liabilities ?? -3966), nw: last2026?.netWorth ?? -1252 },
  ];

  const DX = 20;
  const DY = 12;
  const colWidth = 160;
  const colGap = 56;
  const padLeft = 48;
  const zeroGap = 15;
  const maxVal = Math.max(...data.map((d) => Math.max(d.assets, d.liabilities)), 1);

  const scale = 150 / maxVal;
  function sc(v: number) { return Math.max(10, v * scale); }

  const maxAssetH = Math.max(...data.map((d) => sc(d.assets)));
  const zeroY = 60 + maxAssetH + DY;

  const columns = data.map((d, i) => {
    const x = padLeft + i * (colWidth + colGap);
    const aH = sc(d.assets);
    const lH = sc(d.liabilities);
    const assetY = zeroY - zeroGap - aH;
    const liabY = zeroY + zeroGap;
    const cx = x + colWidth / 2;
    return { d, x, aH, lH, assetY, liabY, cx };
  });

  const maxLiabBottom = Math.max(...columns.map((c) => c.liabY + c.lH));
  const svgW = padLeft + data.length * colWidth + (data.length - 1) * colGap + DX + 60;
  const svgH = maxLiabBottom + DY + 50;

  const assetColors = { front: c.green, top: c.greenSoft, right: c.greenDeep };
  const liabColors = { front: c.liabFront, top: c.liabTop, right: c.liabRight };

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: c.green }} />
          <span className="text-xs font-medium text-[var(--text-muted)]">Assets</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: c.liabFront }} />
          <span className="text-xs font-medium text-[var(--text-muted)]">Liabilities</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet" className="mx-auto block w-full" style={{ maxHeight: 420 }}>
        {columns.map((col, ci) => {
          if (ci === columns.length - 1) return null;
          const next = columns[ci + 1];
          return (
            <g key={`conn-${ci}`}>
              <path
                d={`M${col.x + colWidth},${col.assetY} L${next.x},${next.assetY} L${next.x},${zeroY - zeroGap} L${col.x + colWidth},${zeroY - zeroGap} Z`}
                fill={assetColors.front}
                opacity={0.12}
              />
              <path
                d={`M${col.x + colWidth},${col.liabY} L${next.x},${next.liabY} L${next.x},${next.liabY + next.lH} L${col.x + colWidth},${col.liabY + col.lH} Z`}
                fill={liabColors.front}
                opacity={0.12}
              />
            </g>
          );
        })}

        <line x1={padLeft - 30} y1={zeroY} x2={svgW - 30} y2={zeroY} stroke={c.baseline} strokeWidth="1.5" />
        <text x={padLeft - 35} y={zeroY + 4} textAnchor="end" fill={c.axis} fontSize="13">$0</text>

        {columns.map((col) => {
          const { d, x, aH, lH, assetY, liabY, cx } = col;

          return (
            <g key={d.year}>
              <path
                d={`M${x + colWidth},${assetY} L${x + colWidth + DX},${assetY - DY} L${x + colWidth + DX},${assetY + aH - DY} L${x + colWidth},${assetY + aH} Z`}
                fill={assetColors.right}
              />
              <path
                d={`M${x},${assetY} L${x + DX},${assetY - DY} L${x + colWidth + DX},${assetY - DY} L${x + colWidth},${assetY} Z`}
                fill={assetColors.top}
              />
              <rect x={x} y={assetY} width={colWidth} height={aH} fill={assetColors.front} rx={3} />

              <path
                d={`M${x + colWidth},${liabY} L${x + colWidth + DX},${liabY - DY} L${x + colWidth + DX},${liabY + lH - DY} L${x + colWidth},${liabY + lH} Z`}
                fill={liabColors.right}
              />
              <path
                d={`M${x},${liabY + lH} L${x + DX},${liabY + lH - DY} L${x + colWidth + DX},${liabY + lH - DY} L${x + colWidth},${liabY + lH} Z`}
                fill={liabColors.top}
              />
              <rect x={x} y={liabY} width={colWidth} height={lH} fill={liabColors.front} rx={3} />

              <text
                x={cx + DX / 2}
                y={assetY - DY - 14}
                textAnchor="middle"
                fontSize={16}
                fontWeight={700}
                fill={c.text}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <title>{d.nw < 0 ? `-$${Math.abs(d.nw).toLocaleString()}` : `$${d.nw.toLocaleString()}`}</title>
                {fmtCompact(d.nw)}
              </text>

              <text
                x={cx}
                y={liabY + lH + DY + 24}
                textAnchor="middle"
                fontSize={15}
                fontWeight={500}
                fill={c.axis}
                style={{ fontFamily: "var(--font-body)" }}
              >
                {d.year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
