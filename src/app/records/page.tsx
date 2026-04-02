"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useFinance } from "@/hooks/FinanceDataContext";
import type { MonthlyRecord } from "@/hooks/useFinanceData";
import { formatCurrency, formatPercent, monthNames } from "@/data/mockData";

type YearFilter = "all" | "2026" | "2025";

function getLastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function savingsRateColor(pct: number): string {
  if (pct < 10) return "#DC2626";
  if (pct < 25) return "#C4A84D";
  return "#0D9B7A";
}

/* ── Column group definitions ── */
const COL_GROUPS = [
  { label: "PERIOD", cols: 1, color: "#F5F0E8", textColor: "#8A8A8A" },
  { label: "ASSETS & LIABILITIES", cols: 2, color: "#E6F7F3", textColor: "#0D9B7A" },
  { label: "INCOME", cols: 2, color: "#E6F7F3", textColor: "#0D9B7A" },
  { label: "EXPENSES", cols: 2, color: "#FEF2F2", textColor: "#DC2626" },
  { label: "PERFORMANCE", cols: 6, color: "#FDF8E8", textColor: "#B8941F" },
];

const COL_HEADERS = [
  "Period",
  "Assets", "Liabilities",
  "Income", "Adj.",
  "Expenses", "Adj. Expenses",
  "Net Worth", "NW MoM", "Burn Rate", "Savings", "Savings Rate", "Debt Repayment",
];

export default function RecordsPage() {
  const { monthlyRecords, incomeBySource, upsertRecord, upsertIncomeOnly, isLoading, error, refetch } = useFinance();
  const [yearFilter, setYearFilter] = useState<YearFilter>("all");
  const [editingRecord, setEditingRecord] = useState<MonthlyRecord | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered = useMemo(() => {
    if (yearFilter === "all") return monthlyRecords;
    return monthlyRecords.filter((r) => r.year === Number(yearFilter));
  }, [yearFilter, monthlyRecords]);

  const grouped = useMemo(() => {
    const groups: Record<number, MonthlyRecord[]> = {};
    filtered.forEach((r) => {
      if (!groups[r.year]) groups[r.year] = [];
      groups[r.year].push(r);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, records]) => ({ year: Number(year), records }));
  }, [filtered]);

  const getIncomeSource = (r: MonthlyRecord) => {
    const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return incomeBySource.find((s) => s.year === r.year && s.month === fullMonthNames[r.month - 1]);
  };

  const years: YearFilter[] = ["all", "2026", "2025"];
  const yearLabels: Record<YearFilter, string> = { all: "All", "2026": "2026", "2025": "2025" };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-[1400px] mx-auto flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#2DB89A] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#999]">Loading records...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-[1400px] mx-auto flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[#DC2626] font-medium">Failed to load data</p>
            <p className="text-xs text-[#999]">{error}</p>
            <button onClick={refetch} className="mt-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Monthly Records</h1>
            <p className="text-sm text-[#999] mt-1">Manage your financial data</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-5 py-2.5 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
          >
            + Add Record
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-[#F5F3EF] rounded-xl p-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  yearFilter === y ? "bg-[#1a1a1a] text-white shadow-sm" : "text-[#888] hover:text-[#555]"
                }`}
              >
                {yearLabels[y]}
              </button>
            ))}
          </div>
          <span className="text-sm text-[#999]">{filtered.length} records</span>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #D4D0C8" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              {/* ── Colored column group headers ── */}
              <thead>
                <tr>
                  {COL_GROUPS.map((g, gi) => (
                    <th
                      key={g.label}
                      colSpan={g.cols}
                      className="text-[10px] font-bold tracking-wider uppercase py-2 px-4 text-center whitespace-nowrap"
                      style={{
                        fontFamily: "var(--font-heading)",
                        backgroundColor: g.color,
                        color: g.textColor,
                        borderBottom: "2px solid #D4D0C8",
                        borderRight: gi < COL_GROUPS.length - 1 ? "2px solid #D4D0C8" : "none",
                      }}
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
                {/* ── Column name headers ── */}
                <tr style={{ backgroundColor: "#FAF8F4" }}>
                  {COL_HEADERS.map((h, i) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#999] whitespace-nowrap"
                      style={{
                        fontFamily: "var(--font-heading)",
                        borderBottom: "2px solid #D4D0C8",
                        borderRight: i < COL_HEADERS.length - 1 ? "1px solid #E8E5E0" : "none",
                        minWidth: i === 0 ? 120 : 95,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <GroupRows
                    key={group.year}
                    year={group.year}
                    records={group.records}
                    onEdit={(r) => setEditingRecord(r)}
                    allRecords={monthlyRecords}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingRecord && editingRecord.isLive && (
        <LiveRecordPanel
          record={editingRecord}
          incomeSource={getIncomeSource(editingRecord)}
          onClose={() => setEditingRecord(null)}
          onSaveIncome={upsertIncomeOnly}
          onFinalize={upsertRecord}
        />
      )}

      {editingRecord && !editingRecord.isLive && (
        <RecordPanel
          mode="edit"
          record={editingRecord}
          incomeSource={getIncomeSource(editingRecord)}
          onClose={() => setEditingRecord(null)}
          onSave={upsertRecord}
        />
      )}

      {showAddForm && (
        <RecordPanel
          mode="add"
          onClose={() => setShowAddForm(false)}
          onSave={upsertRecord}
        />
      )}
    </DashboardLayout>
  );
}

/* ── Year Group with header, data rows, and totals ── */
function GroupRows({
  year, records, onEdit, allRecords,
}: {
  year: number;
  records: MonthlyRecord[];
  onEdit: (r: MonthlyRecord) => void;
  allRecords: MonthlyRecord[];
}) {
  // Compute totals for this year group
  const yearRecordsWithData = records.filter((r) => r.income > 0 || r.adjustedExpenses > 0);
  const totalIncome = yearRecordsWithData.reduce((s, r) => s + r.income, 0);
  const totalExpenses = yearRecordsWithData.reduce((s, r) => s + r.adjustedExpenses, 0);
  const totalSavings = yearRecordsWithData.reduce((s, r) => s + r.savings, 0);
  const avgBurnRate = yearRecordsWithData.length > 0
    ? yearRecordsWithData.reduce((s, r) => s + r.burnRate, 0) / yearRecordsWithData.length
    : 0;

  // Check if this is a partial year (not all 12 months)
  const isPartialYear = records.length < 12;
  const savingsLabel = isPartialYear ? "YTD" : "Total";

  return (
    <>
      {/* Year section header */}
      <tr>
        <td
          colSpan={13}
          className="px-4 py-2.5"
          style={{ backgroundColor: "#F0EDE8", borderBottom: "2px solid #D4D0C8" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-bold tracking-wide uppercase"
              style={{ fontFamily: "var(--font-heading)", color: "#666" }}
            >
              {year}
            </span>
            {totalSavings !== 0 && (
              <span
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: totalSavings >= 0 ? "#E6F7F3" : "#FEF2F2",
                  color: totalSavings >= 0 ? "#0D9B7A" : "#DC2626",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {savingsLabel}: {totalSavings >= 0 ? "+" : ""}{formatCurrency(totalSavings, "$", true)}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Data rows */}
      {records.map((r, idx) => (
        <tr
          key={r.label}
          className="cursor-pointer transition-colors group"
          style={{
            backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#FAF8F2",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F5F0E8"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#FFFFFF" : "#FAF8F2"; }}
          onClick={() => onEdit(r)}
        >
          <Cell border>{r.label}{r.isLive && <LiveBadge />}</Cell>
          <Cell border>{formatCurrency(r.assets)}</Cell>
          <Cell border>{formatCurrency(r.liabilities)}</Cell>
          <Cell border>{r.income > 0 ? formatCurrency(r.income) : "—"}</Cell>
          <Cell border color="#C4A84D">
            {r.expenseAdjustment > 0 ? `-${formatCurrency(r.expenseAdjustment)}` : r.expenseAdjustment < 0 ? `+${formatCurrency(Math.abs(r.expenseAdjustment))}` : "—"}
          </Cell>
          <Cell border>{r.expenses > 0 ? formatCurrency(r.expenses) : "—"}</Cell>
          <Cell border>{r.adjustedExpenses > 0 ? formatCurrency(r.adjustedExpenses) : "—"}</Cell>
          <Cell border color={r.netWorth >= 0 ? "#0D9B7A" : "#DC2626"} bold>{formatCurrency(r.netWorth)}</Cell>
          <Cell border>
            {r.netWorthMoM !== null ? (
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: r.netWorthMoM >= 0 ? "#E6F7F3" : "#FEF2F2",
                  color: r.netWorthMoM >= 0 ? "#0D9B7A" : "#DC2626",
                }}
              >
                {formatPercent(r.netWorthMoM, true)}
              </span>
            ) : "—"}
          </Cell>
          <Cell border>{r.adjustedExpenses > 0 ? formatPercent(r.burnRate * 100) : "—"}</Cell>
          <Cell border>
            {r.adjustedExpenses > 0 || r.income > 0 ? formatCurrency(r.savings) : "—"}
          </Cell>
          <Cell border color={savingsRateColor(r.savingsRate * 100)}>
            {r.adjustedExpenses > 0 || r.income > 0 ? formatPercent(r.savingsRate * 100) : "—"}
          </Cell>
          <Cell>{r.debtRepayment > 0 ? formatCurrency(r.debtRepayment) : "—"}</Cell>
        </tr>
      ))}

      {/* Totals row */}
      {yearRecordsWithData.length > 0 && (
        <tr style={{ backgroundColor: "#F5F3EF", borderTop: "2px solid #D4D0C8" }}>
          <TotalCell border>
            <span className="font-bold text-[#666]" style={{ fontFamily: "var(--font-heading)" }}>Totals</span>
          </TotalCell>
          <TotalCell border />
          <TotalCell border />
          <TotalCell border bold color="#4A4A4A">{formatCurrency(totalIncome)}</TotalCell>
          <TotalCell border />
          <TotalCell border />
          <TotalCell border bold color="#4A4A4A">{formatCurrency(totalExpenses)}</TotalCell>
          <TotalCell border />
          <TotalCell border />
          <TotalCell border color="#4A4A4A">{formatPercent(avgBurnRate * 100)}</TotalCell>
          <TotalCell border bold>{formatCurrency(totalSavings)}</TotalCell>
          <TotalCell border />
          <TotalCell color="#4A4A4A">{formatCurrency(yearRecordsWithData.reduce((s, r) => s + r.debtRepayment, 0))}</TotalCell>
        </tr>
      )}
    </>
  );
}

/* ── Reusable cell components ── */
function Cell({ children, border, color, bold }: {
  children?: React.ReactNode;
  border?: boolean;
  color?: string;
  bold?: boolean;
}) {
  return (
    <td
      className="px-4 py-3 whitespace-nowrap"
      style={{
        borderBottom: "1px solid #E8E5E0",
        borderRight: border ? "1px solid #E8E5E0" : "none",
        color: color || "#4A4A4A",
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}

function TotalCell({ children, border, color, bold }: {
  children?: React.ReactNode;
  border?: boolean;
  color?: string;
  bold?: boolean;
}) {
  return (
    <td
      className="px-4 py-2.5 text-xs whitespace-nowrap"
      style={{
        borderTop: "2px solid #D4D0C8",
        borderRight: border ? "1px solid #E8E5E0" : "none",
        color: color || "transparent",
        fontWeight: bold ? 700 : 400,
        fontFamily: "var(--font-heading)",
      }}
    >
      {children}
    </td>
  );
}

function LiveBadge() {
  return (
    <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-[#E6F7F3] text-[#0D9B7A] rounded-full not-italic font-semibold inline-block align-middle">
      LIVE
    </span>
  );
}

/* ── LIVE Record Panel ── */
function LiveRecordPanel({ record, incomeSource, onClose, onSaveIncome, onFinalize }: {
  record: MonthlyRecord;
  incomeSource?: { kufar: number; tokMedia: number; other: number };
  onClose: () => void;
  onSaveIncome: (inc: { year: number; date: string; kufar: number; tokmedia: number; other: number; total: number; expense_adjustment?: number }) => Promise<void>;
  onFinalize: (al: { year: number; date: string; assets: number; liabilities: number }, inc: { year: number; date: string; kufar: number; tokmedia: number; other: number; total: number; expense_adjustment?: number }) => Promise<void>;
}) {
  const initAdj = record.expenseAdjustment ?? 0;
  const [form, setForm] = useState({
    kufar: incomeSource?.kufar ?? 0,
    tokmedia: incomeSource?.tokMedia ?? 0,
    other: incomeSource?.other ?? 0,
    adjDirection: initAdj >= 0 ? "reduce" as const : "add" as const,
    adjAmount: Math.abs(initAdj),
  });
  const computedAdjustment = form.adjDirection === "reduce" ? form.adjAmount : -form.adjAmount;
  const [saving, setSaving] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value === "" ? 0 : Number(value) }));
  };

  const totalIncome = form.kufar + form.tokmedia + form.other;
  const date = getLastDayOfMonth(record.year, record.month);

  const handleSaveIncome = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveIncome({
        year: record.year, date,
        kufar: form.kufar, tokmedia: form.tokmedia, other: form.other, total: totalIncome,
        expense_adjustment: computedAdjustment,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onFinalize(
        { year: record.year, date, assets: record.assets, liabilities: record.liabilities },
        { year: record.year, date, kufar: form.kufar, tokmedia: form.tokmedia, other: form.other, total: totalIncome, expense_adjustment: computedAdjustment },
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{record.label}</h2>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#E6F7F3] text-[#0D9B7A] rounded-full font-semibold">LIVE</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F3EF] text-[#999] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Assets & Liabilities — read-only */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Assets &amp; Liabilities</h3>
            <p className="text-[10px] text-[#bbb] mb-2">Auto-calculated from current accounts &amp; debts</p>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Total Assets (USD)</label>
              <input type="number" value={record.assets} readOnly className="w-full px-3 py-2 rounded-xl bg-[#F0EDE8] text-sm outline-none border-none text-[#999] cursor-not-allowed" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Total Liabilities (USD)</label>
              <input type="number" value={record.liabilities} readOnly className="w-full px-3 py-2 rounded-xl bg-[#F0EDE8] text-sm outline-none border-none text-[#999] cursor-not-allowed" />
            </div>
          </div>

          {/* Income by Source */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Income by Source</h3>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Kufar</label>
              <input type="number" value={form.kufar} onChange={(e) => update("kufar", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">TokMedia</label>
              <input type="number" value={form.tokmedia} onChange={(e) => update("tokmedia", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Other</label>
              <input type="number" value={form.other} onChange={(e) => update("other", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
          </div>

          {/* Total Income — read-only */}
          <div className="mb-5">
            <label className="text-xs text-[#888] mb-1 block">Total Income (auto-calculated)</label>
            <input type="text" value={`$${totalIncome.toLocaleString()}`} readOnly className="w-full px-3 py-2 rounded-xl bg-[#F0EDE8] text-sm outline-none border-none text-[#999] cursor-not-allowed" />
          </div>

          {/* Expense Adjustment */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expense Adjustment</h3>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "reduce" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "reduce" ? "bg-[#0D9B7A] text-white" : "bg-[#F5F3EF] text-[#888]"}`}
              >
                Reduce expenses
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "add" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "add" ? "bg-[#DC2626] text-white" : "bg-[#F5F3EF] text-[#888]"}`}
              >
                Add to expenses
              </button>
            </div>
            <input type="number" value={form.adjAmount || ""} onChange={(e) => setForm((f) => ({ ...f, adjAmount: e.target.value === "" ? 0 : Math.abs(Number(e.target.value)) }))} placeholder="0" className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            <p className="text-[10px] text-[#bbb] mt-1">Use this for non-expense outflows (deposits, investments) or missed expenses</p>
          </div>

          {saveError && (
            <div className="mb-3 p-2 bg-[#FEF2F2] rounded-xl text-xs text-[#DC2626]">Error: {saveError}</div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={handleSaveIncome} disabled={saving} className="w-full py-3 border-2 border-[#2DB89A] text-[#2DB89A] rounded-xl font-medium text-sm hover:bg-[#E6F7F3] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Income"}
            </button>

            {!showFinalizeConfirm ? (
              <button onClick={() => setShowFinalizeConfirm(true)} disabled={saving} className="w-full py-3 bg-[#2DB89A] text-white rounded-xl font-medium text-sm hover:bg-[#1A8F78] transition-colors disabled:opacity-50">
                Finalize Month
              </button>
            ) : (
              <div className="border-2 border-[#C4A84D] rounded-xl p-3">
                <p className="text-xs text-[#888] mb-3">
                  This will permanently save assets (${record.assets.toLocaleString()}) and liabilities (${Math.abs(record.liabilities).toLocaleString()}) for {record.label}. The LIVE badge will move to next month.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleFinalize} disabled={saving} className="flex-1 py-2.5 bg-[#2DB89A] text-white rounded-xl font-medium text-sm hover:bg-[#1A8F78] transition-colors disabled:opacity-50">
                    {saving ? "Finalizing..." : "Confirm"}
                  </button>
                  <button onClick={() => setShowFinalizeConfirm(false)} className="flex-1 py-2.5 bg-[#F5F3EF] text-[#888] rounded-xl font-medium text-sm hover:bg-[#E8E5DF] transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </>
  );
}

/* ── Standard Record Panel (Add / Edit non-live) ── */
function RecordPanel({ mode, record, incomeSource, onClose, onSave }: {
  mode: "add" | "edit";
  record?: MonthlyRecord;
  incomeSource?: { kufar: number; tokMedia: number; other: number };
  onClose: () => void;
  onSave: (al: { year: number; date: string; assets: number; liabilities: number }, inc: { year: number; date: string; kufar: number; tokmedia: number; other: number; total: number; expense_adjustment?: number }) => Promise<void>;
}) {
  const now = new Date();
  const defaultYear = mode === "edit" && record ? record.year : now.getFullYear();
  const defaultMonth = mode === "edit" && record ? record.month : now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;

  const initAdj = record?.expenseAdjustment ?? 0;
  const [form, setForm] = useState({
    year: defaultYear,
    month: defaultMonth,
    assets: record?.assets ?? 0,
    liabilities: record?.liabilities ?? 0,
    kufar: incomeSource?.kufar ?? 0,
    tokmedia: incomeSource?.tokMedia ?? 0,
    other: incomeSource?.other ?? 0,
    adjDirection: initAdj >= 0 ? "reduce" as const : "add" as const,
    adjAmount: Math.abs(initAdj),
  });
  const computedAdjustment = form.adjDirection === "reduce" ? form.adjAmount : -form.adjAmount;
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value === "" ? 0 : Number(value) }));
  };

  const totalIncome = form.kufar + form.tokmedia + form.other;

  const handleSave = async () => {
    setSaving(true);
    try {
      const date = getLastDayOfMonth(form.year, form.month);
      await onSave(
        { year: form.year, date, assets: form.assets, liabilities: form.liabilities },
        { year: form.year, date, kufar: form.kufar, tokmedia: form.tokmedia, other: form.other, total: totalIncome, expense_adjustment: computedAdjustment },
      );
      onClose();
    } catch { /* stay open */ }
    finally { setSaving(false); }
  };

  const isAdd = mode === "add";

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{isAdd ? "Add Record" : "Edit Record"}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F3EF] text-[#999] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-[#999] mb-1 block">Year</label>
              <input type="number" value={form.year} onChange={(e) => update("year", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
            <div>
              <label className="text-xs text-[#999] mb-1 block">Month</label>
              <select value={form.month} onChange={(e) => update("month", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none">
                {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Assets &amp; Liabilities</h3>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Total Assets (USD)</label>
              <input type="number" value={form.assets} onChange={(e) => update("assets", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Total Liabilities (USD)</label>
              <input type="number" value={form.liabilities} onChange={(e) => update("liabilities", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Income by Source</h3>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Kufar</label>
              <input type="number" value={form.kufar} onChange={(e) => update("kufar", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">TokMedia</label>
              <input type="number" value={form.tokmedia} onChange={(e) => update("tokmedia", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[#888] mb-1 block">Other</label>
              <input type="number" value={form.other} onChange={(e) => update("other", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            </div>
          </div>

          {/* Total Income — read-only */}
          <div className="mb-5">
            <label className="text-xs text-[#888] mb-1 block">Total Income (auto-calculated)</label>
            <input type="text" value={`$${totalIncome.toLocaleString()}`} readOnly className="w-full px-3 py-2 rounded-xl bg-[#F0EDE8] text-sm outline-none border-none text-[#999] cursor-not-allowed" />
          </div>

          {/* Expense Adjustment */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expense Adjustment</h3>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "reduce" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "reduce" ? "bg-[#0D9B7A] text-white" : "bg-[#F5F3EF] text-[#888]"}`}
              >
                Reduce expenses
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "add" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "add" ? "bg-[#DC2626] text-white" : "bg-[#F5F3EF] text-[#888]"}`}
              >
                Add to expenses
              </button>
            </div>
            <input type="number" value={form.adjAmount || ""} onChange={(e) => setForm((f) => ({ ...f, adjAmount: e.target.value === "" ? 0 : Math.abs(Number(e.target.value)) }))} placeholder="0" className="w-full px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none" />
            <p className="text-[10px] text-[#bbb] mt-1">Use this for non-expense outflows (deposits, investments) or missed expenses</p>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-medium text-sm hover:bg-[#333] transition-colors disabled:opacity-50">
            {saving ? "Saving..." : isAdd ? "Add Record" : "Save"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </>
  );
}
