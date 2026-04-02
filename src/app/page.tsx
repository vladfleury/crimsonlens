"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, LabelList,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import NetWorthChart from "@/components/NetWorthChart";
import MoneyFlowChart from "@/components/MoneyFlowChart";
import { useFinance } from "@/hooks/FinanceDataContext";
import { formatCurrency, formatPercent, monthNames } from "@/data/mockData";

type YearFilter = "all" | "2026" | "2025";

export default function NetWorthPage() {
  const {
    monthlyRecords, accounts, debts, settings,
    plnUsdRate, bynUsdRate, usdEurRate,
    setPlnUsdRate, setBynUsdRate, setUsdEurRate,
    updateDebtPaid, updateSetting,
    isLoading, error, refetch,
  } = useFinance();

  const [yearFilter, setYearFilter] = useState<YearFilter>("2026");
  const [areaYearFilter, setAreaYearFilter] = useState<YearFilter>("2026");

  // ── Fetch exchange rates ──
  const fetchPlnUsd = useCallback(async () => {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=PLN");
      const data = await res.json();
      if (data.rates?.PLN) setPlnUsdRate(parseFloat(data.rates.PLN.toFixed(4)));
    } catch { /* keep current value */ }
  }, [setPlnUsdRate]);

  const fetchUsdEur = useCallback(async () => {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR");
      const data = await res.json();
      if (data.rates?.EUR) setUsdEurRate(parseFloat((1 / data.rates.EUR).toFixed(4)));
    } catch { /* keep current value */ }
  }, [setUsdEurRate]);

  // ── Debt data from Supabase ──
  const grandmaDebt = debts.find((d) => d.currency === "USD");

  const grandmaPaid = grandmaDebt?.amount_paid ?? 0;
  const grandmaTotal = grandmaDebt?.total_amount ?? 0;
  const grandmaApr = grandmaDebt?.apr ?? 0;

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

    return months.map((name) => {
      const d = dataMap.get(name);
      return {
        name,
        income: d ? d.income : undefined as number | undefined,
        expenses: d && d.expenses > 0 ? d.expenses : undefined as number | undefined,
      };
    });
  }, [filteredRecords, yearFilter]);

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

    return months.map((name) => {
      const d = dataMap.get(name);
      return {
        name,
        assets: d ? d.assets : undefined as number | undefined,
        liabilities: d ? d.liabilities : undefined as number | undefined,
      };
    });
  }, [filteredAreaRecords, areaYearFilter, allTimeSorted]);

  const current = monthlyRecords[0];
  const currentAssets = current?.isLive ? Math.round(totalAccountsUSD) : (current?.assets ?? 0);
  const currentIncome = current?.income ?? 0;
  const currentNW = current?.isLive ? Math.round(totalAccountsUSD + liveLiabilitiesUSD) : (current ? current.netWorth : 0);
  const currentMonth = current ? monthNames[current.month - 1] : "—";

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

  // Asset allocation from current_accounts (already computed above)
  const assetAllocation = totalAccountsUSD > 0 ? [
    { name: "PLN Holdings", value: Math.round((plnTotal / plnUsdRate / totalAccountsUSD) * 100), color: "#1A8F78" },
    { name: "EUR Holdings", value: Math.round((eurTotal * usdEurRate / totalAccountsUSD) * 100), color: "#7DD8C4" },
    { name: "USD Holdings", value: Math.round((usdTotal / totalAccountsUSD) * 100), color: "#C4A84D" },
  ] : [
    { name: "PLN Holdings", value: 73, color: "#1A8F78" },
    { name: "EUR Holdings", value: 22, color: "#7DD8C4" },
    { name: "USD Holdings", value: 5, color: "#C4A84D" },
  ];

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
  const changeBarColors = ["#1A8F78", "#7DD8C4", "#C4A84D"];

  // Build debt cards data
  const debtCards = [
    ...(grandmaDebt ? [{
      id: grandmaDebt.id,
      name: grandmaDebt.name,
      apr: grandmaApr,
      currency: grandmaDebt.currency,
      totalOwed: grandmaTotal,
      paid: grandmaPaid,
      symbol: "$",
      remaining: grandmaRemaining,
    }] : []),
  ];

  const handleDebtPaidChange = useCallback(async (debtId: number, newPaid: number) => {
    try {
      await updateDebtPaid(debtId, newPaid);
    } catch {
      // Error handled silently — optimistic update will fix on refetch
    }
  }, [updateDebtPaid]);

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
              <div className="w-8 h-8 border-2 border-[#2DB89A] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#999]">Loading financial data...</span>
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
              <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm text-[#DC2626] font-medium">Failed to load data</p>
              <p className="text-xs text-[#999] max-w-[300px]">{error}</p>
              <button onClick={refetch} className="mt-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
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
            <p className="text-sm text-[#999]">No data found. Add records to get started.</p>
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
          <KPICard label="Debt" value={formatCurrency(-totalDebtUSD)} color="#DC2626" />
          <KPICard label="Assets" value={formatCurrency(currentAssets)} color="#0D9B7A" />
          <KPICard label="Net Worth" value={formatCurrency(currentNW)} color={currentNW >= 0 ? "#0D9B7A" : "#DC2626"} />
          <KPICard label={`Income (${currentMonth})`} value={formatCurrency(currentIncome)} color="#0D9B7A" />
        </div>

        {/* ── Two-column layout: Left charts + Right sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Debt Analysis */}
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Debt Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {debtCards.map((debt) => {
                  const progress = (debt.paid / debt.totalOwed) * 100;
                  return (
                    <div key={debt.name} className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)" }}>{debt.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${debt.apr === 0 ? "bg-[#E6F7F3] text-[#0D9B7A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>{debt.apr}% APR</span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#999]">Total</span>
                          <div className="text-right">
                            <span className="font-medium">{debt.symbol}{debt.totalOwed.toLocaleString()}</span>
                            {"isForeign" in debt && debt.isForeign && <span className="text-[11px] text-[#aaa] ml-1">(${Math.round(debt.totalOwed / debt.fxRate).toLocaleString()})</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#999]">Paid</span>
                          <div className="flex items-center">
                            <span className="text-[#0D9B7A] font-medium mr-0.5">{debt.symbol.trim()}</span>
                            <input
                              type="number"
                              value={debt.paid}
                              onChange={(e) => {
                                const val = e.target.value === "" ? 0 : Number(e.target.value);
                                handleDebtPaidChange(debt.id, val);
                              }}
                              className="w-20 text-right font-medium text-[#0D9B7A] bg-[#EFF6FF] rounded px-1 border-none outline-none text-sm focus:bg-[#DBEAFE] transition-colors"
                              step="0.01"
                            />
                            {"isForeign" in debt && debt.isForeign && <span className="text-[11px] text-[#aaa] ml-1">(${Math.round(debt.paid / debt.fxRate).toLocaleString()})</span>}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#999]">Remaining</span>
                          <div className="text-right">
                            <span className="font-medium text-[#DC2626]">{debt.symbol}{debt.remaining.toLocaleString()}</span>
                            {"isForeign" in debt && debt.isForeign && <span className="text-[11px] text-[#aaa] ml-1">(${Math.round(debt.remaining / debt.fxRate).toLocaleString()})</span>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full h-2 bg-[#F5F3EF] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: progress < 30 ? "#DC2626" : progress < 80 ? "#C4A84D" : "#2DB89A" }} />
                        </div>
                        <span className="text-[10px] text-[#999] mt-1 block">{formatPercent(progress)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>Total Debt (USD)</h3>
                  <p className="text-2xl font-bold text-[#DC2626]" style={{ fontFamily: "var(--font-heading)" }}>
                    ${totalDebtUSD.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Assets vs Liabilities */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Assets vs Liabilities</h2>
                <div className="flex gap-1 bg-[#F5F3EF] rounded-xl p-1">
                  {years.map((y) => (
                    <button
                      key={`area-${y}`}
                      onClick={() => setAreaYearFilter(y)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        areaYearFilter === y
                          ? "bg-[#1a1a1a] text-white shadow-sm"
                          : "text-[#888] hover:text-[#555]"
                      }`}
                    >
                      {yearLabels[y]}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#B3ECE0" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#B3ECE0" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradLiabilities" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FECACA" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#FECACA" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E5E5E0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#999", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#999", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ReferenceLine y={0} stroke="#2D2D2D" strokeWidth={1.5} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", backgroundColor: "#FAF8F4" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`$${Number(value).toLocaleString()}`, name === "assets" ? "Assets" : "Liabilities"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="assets"
                    stroke="#2DB89A"
                    fill="url(#gradAssets)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#2DB89A", stroke: "white", strokeWidth: 2 }}
                    connectNulls={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ x, y, value }: any) => value != null ? (
                      <text x={x} y={y - 12} textAnchor="middle" fill="#2DB89A" fontSize={10} fontWeight={600}>
                        ${Number(value).toLocaleString()}
                      </text>
                    ) : null}
                  />
                  <Area
                    type="monotone"
                    dataKey="liabilities"
                    stroke="#DC2626"
                    fill="url(#gradLiabilities)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#DC2626", stroke: "white", strokeWidth: 2 }}
                    connectNulls={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ x, y, value }: any) => value != null ? (
                      <text x={x} y={y + 18} textAnchor="middle" fill="#DC2626" fontSize={10} fontWeight={600}>
                        ${Number(value).toLocaleString()}
                      </text>
                    ) : null}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Income vs Expenses */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Income vs Expenses</h2>
                <div className="flex gap-1 bg-[#F5F3EF] rounded-xl p-1">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYearFilter(y)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        yearFilter === y
                          ? "bg-[#1a1a1a] text-white shadow-sm"
                          : "text-[#888] hover:text-[#555]"
                      }`}
                    >
                      {yearLabels[y]}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={barData} barGap={0} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="4 4" stroke="#E5E5E0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#999", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#999", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontFamily: "var(--font-body)", backgroundColor: "#FAF8F4" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`$${Number(value).toLocaleString()}`, name === "income" ? "Income" : "Expenses"]}
                  />
                  <Bar dataKey="income" fill="#2DB89A" radius={[6, 6, 0, 0]} name="income">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={entry.income != null ? "#2DB89A" : "transparent"} />
                    ))}
                    <LabelList
                      dataKey="income"
                      position="top"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => v != null ? `$${Number(v).toLocaleString()}` : ""}
                      fill="#1A8F78"
                      fontSize={10}
                      fontWeight={600}
                      offset={6}
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#DC2626"
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#DC2626", stroke: "white", strokeWidth: 2 }}
                    connectNulls={false}
                    name="expenses"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ x, y, value }: any) => value != null ? (
                      <text x={x} y={y - 10} textAnchor="middle" fill="#DC2626" fontSize={10} fontWeight={600}>
                        ${Number(value).toLocaleString()}
                      </text>
                    ) : null}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm text-[#888]">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#2DB89A" }} />
                  Income
                </div>
                <div className="flex items-center gap-2 text-sm text-[#888]">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#DC2626" }} />
                  Expenses
                </div>
              </div>
            </div>

            {/* Money Flow */}
            <MoneyFlowChart />

            {/* Net Worth + Gains */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <NetWorthChart />
            </div>

            {/* Yearly Performance (3D Isometric) */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Yearly Performance</h2>
              <YearlyPerformance3D records={monthlyRecords} />
            </div>
          </div>

          {/* ── RIGHT COLUMN (sticky sidebar) ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            {/* Goal Card */}
            <div className="rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative" style={{ backgroundColor: "#EFE0A0" }}>
              <div className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>
                {Math.abs(goalPercent).toFixed(0)}%
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#B8962A]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                </span>
                <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "#8B7332" }}>
                  Goal: $10,000
                </h3>
              </div>
              <p className="text-3xl font-bold mt-1" style={{ fontFamily: "var(--font-heading)", color: "#2D2D2D" }}>
                {formatCurrency(goalCurrent)}
              </p>
              <div className="w-full h-3 bg-[#E0D5B0] rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(0, goalPercent)}%`, backgroundColor: "#1a1a1a" }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs" style={{ color: "#8B7332" }}>
                <span>${goalRemaining.toLocaleString()} remaining</span>
                {estimatedMonths && <span>~{estimatedMonths} months at current pace</span>}
              </div>
            </div>

            {/* Asset Allocation + Month Change */}
            <div className="rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ backgroundColor: "#E6F7F3" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>Asset Allocation</h3>
                <span className="px-3 py-1 rounded-full text-sm font-bold text-white" style={{ backgroundColor: "#1A8F78" }}>
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
                    <span className="text-[8px] text-[#999]">Total</span>
                    <span className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>${Math.round(totalAccountsUSD).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  {assetAllocation.map((a) => (
                    <div key={a.name}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                        <span className="text-[11px] text-[#999]">{a.name.replace(" Holdings", "")}</span>
                      </div>
                      <span className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{a.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Month Change breakdown */}
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(45,184,154,0.2)" }}>
                <div className="flex items-end gap-2 h-[60px] relative mt-1">
                  <div className="absolute bottom-[30px] left-0 right-0 border-t border-dashed" style={{ borderColor: "rgba(45,184,154,0.3)" }} />
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
                        <span className="text-[10px] text-[#1A8F78]">{b.currency}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#0D9B7A]">
                        {b.prefix}{b.symbol}{b.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Exchange Rates */}
            <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-1">
                <ExchangeRateRow label="PLN/USD" value={plnUsdRate} onChange={setPlnUsdRate} suffix=" zł" onRefresh={fetchPlnUsd} />
                <ExchangeRateRow label="BYN/USD" value={bynUsdRate} onChange={handleBynRateChange} prefix="BYN " />
                <ExchangeRateRow label="USD/EUR" value={usdEurRate} onChange={setUsdEurRate} prefix="$" onRefresh={fetchUsdEur} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8" />
      </div>
    </DashboardLayout>
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
      <span className="text-[11px] text-[#aaa]">{label}</span>
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
            className="w-16 text-right text-[12px] text-[#888] font-medium bg-[#EFF6FF] rounded px-1 border-none outline-none focus:bg-[#DBEAFE] transition-colors"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] text-[#888] font-medium hover:text-[#555] transition-colors cursor-text"
          >
            {prefix}{value}{suffix}
          </button>
        )}
        {onRefresh && (
          <button onClick={onRefresh} className="text-[#bbb] hover:text-[#888] transition-colors ml-0.5" title="Refresh rate">
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

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-xs text-[#999] mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)", color }}>{value}</p>
    </div>
  );
}

/* ── 3D Isometric Chart — Assets up / Liabilities down (reference-based) ── */
function YearlyPerformance3D({ records }: { records: { year: number; assets: number; liabilities: number; netWorth: number }[] }) {
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
  const colGap = 80;
  const padLeft = 80;
  const zeroGap = 15;
  const maxVal = Math.max(...data.map((d) => Math.max(d.assets, d.liabilities)), 1);

  const scale = 160 / maxVal;
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

  const assetColors = { front: "#2DB89A", top: "#7DD8C4", right: "#1A8F78" };
  const liabColors = { front: "rgba(248,113,113,0.55)", top: "rgba(252,165,165,0.55)", right: "rgba(220,38,38,0.55)" };

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: "#2DB89A" }} />
          <span className="text-xs font-medium text-[#999]">Assets</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: "rgba(248,113,113,0.7)" }} />
          <span className="text-xs font-medium text-[#999]">Liabilities</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto block w-full" style={{ maxHeight: 420 }}>
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

        <line x1={padLeft - 30} y1={zeroY} x2={svgW - 30} y2={zeroY} stroke="#D4D4D4" strokeWidth="1.5" />
        <text x={padLeft - 35} y={zeroY + 4} textAnchor="end" fill="#bbb" fontSize="12">$0</text>

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
                fontSize={15}
                fontWeight={700}
                fill="#1a1a1a"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {d.nw < 0 ? `-$${Math.abs(d.nw).toLocaleString()}` : `$${d.nw.toLocaleString()}`}
              </text>

              <text
                x={cx}
                y={liabY + lH + DY + 24}
                textAnchor="middle"
                fontSize={14}
                fontWeight={500}
                fill="#6b6560"
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
