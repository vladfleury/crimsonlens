"use client";

import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useFinance } from "@/hooks/FinanceDataContext";
import type { MonthlyRecord } from "@/hooks/useFinanceData";
import type { IncomeTransaction } from "@/lib/data";
import { formatCurrency, formatPercent, monthNames } from "@/data/mockData";

type YearFilter = "all" | "2026" | "2025";

function getLastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Days to divide monthly expenses by: full days in the month for a closed
// record, or days elapsed so far for the in-progress (live) month.
function expenseDaysForRecord(r: MonthlyRecord): number {
  const daysInMonth = new Date(r.year, r.month, 0).getDate();
  if (r.isLive) {
    const now = new Date();
    if (now.getFullYear() === r.year && now.getMonth() + 1 === r.month) {
      return Math.min(now.getDate(), daysInMonth);
    }
  }
  return daysInMonth;
}

function formatPerDay(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function savingsRateColor(pct: number): string {
  if (pct < 10) return "var(--accent-red-strong)";
  if (pct < 25) return "var(--accent-gold-deep)";
  return "var(--accent-green-strong)";
}

/* ── Column group definitions ── */
const COL_GROUPS = [
  { label: "PERIOD", cols: 1, color: "var(--surface-sunken)", textColor: "var(--text-muted)" },
  { label: "ASSETS & LIABILITIES", cols: 2, color: "var(--accent-green-soft-bg)", textColor: "var(--accent-green-strong)" },
  { label: "INCOME", cols: 2, color: "var(--accent-green-soft-bg)", textColor: "var(--accent-green-strong)" },
  { label: "EXPENSES", cols: 3, color: "var(--accent-red-soft-bg)", textColor: "var(--accent-red-strong)" },
  { label: "PERFORMANCE", cols: 6, color: "var(--accent-gold-soft-bg)", textColor: "var(--accent-gold-deep)" },
];

const COL_HEADERS = [
  "Period",
  "Assets", "Liabilities",
  "Income", "Adj.",
  "Expenses", "Adj. Expenses", "Exp/Day",
  "Net Worth", "NW MoM", "Burn Rate", "Savings", "Savings Rate", "Debt Repayment",
];

export default function RecordsPage() {
  const {
    monthlyRecords, incomeBySource, incomeTransactions, monthlyIncomeAgg,
    upsertRecord, upsertIncomeOnly,
    insertIncomeTx, updateIncomeTx, deleteIncomeTx,
    plnUsdRate, usdEurRate, bynUsdRate,
    isLoading, error, refetch,
  } = useFinance();
  const [yearFilter, setYearFilter] = useState<YearFilter>("all");
  const [editingRecord, setEditingRecord] = useState<MonthlyRecord | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [editingIncomeTx, setEditingIncomeTx] = useState<IncomeTransaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (yearFilter === "all") return monthlyRecords;
    return monthlyRecords.filter((r) => r.year === Number(yearFilter));
  }, [yearFilter, monthlyRecords]);

  const filteredTx = useMemo(() => {
    if (yearFilter === "all") return incomeTransactions;
    return incomeTransactions.filter((tx) => {
      const d = new Date(tx.date + "T00:00:00");
      return d.getFullYear() === Number(yearFilter);
    });
  }, [yearFilter, incomeTransactions]);

  // Group transactions by year-month
  const groupedTx = useMemo(() => {
    const groups: Record<string, IncomeTransaction[]> = {};
    for (const tx of filteredTx) {
      const d = new Date(tx.date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, txs]) => {
        const [y, m] = key.split("-").map(Number);
        const total = txs.reduce((s, t) => s + t.usd_amount, 0);
        return { key, year: y, month: m, label: `${monthNames[m - 1]} ${y}`, txs, total };
      });
  }, [filteredTx]);

  // Unique sources for autocomplete
  const existingSources = useMemo(() => {
    const set = new Set(incomeTransactions.map((tx) => tx.source));
    return Array.from(set).sort();
  }, [incomeTransactions]);

  const handleDeleteTx = useCallback(async (id: number) => {
    await deleteIncomeTx(id);
    setDeletingTxId(null);
  }, [deleteIncomeTx]);

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
            <div className="w-8 h-8 border-2 border-[var(--accent-green)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-muted)]">Loading records...</span>
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
            <p className="text-sm text-[var(--accent-red)] font-medium">Failed to load data</p>
            <p className="text-xs text-[var(--text-muted)]">{error}</p>
            <button onClick={refetch} className="mt-2 px-4 py-2 bg-[var(--text)] text-[var(--bg)] rounded-xl text-sm font-medium hover:opacity-90 transition-colors">
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
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Monthly Records</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Manage your financial data</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowAddIncome(true)}
              className="flex-1 md:flex-none px-3.5 md:px-5 py-2.5 bg-[var(--accent-green)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-[0_4px_14px_-4px_rgba(41,183,154,0.45)]"
            >
              + Add Income
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-1 md:flex-none px-3.5 md:px-5 py-2.5 bg-[var(--text)] text-[var(--bg)] rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-[0_4px_14px_-4px_rgba(0,0,0,0.45)]"
            >
              + Add Record
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-[var(--chip)] rounded-xl p-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  yearFilter === y ? "bg-[var(--text)] text-[var(--bg)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {yearLabels[y]}
              </button>
            ))}
          </div>
          <span className="text-sm text-[var(--text-muted)]">{filtered.length} records</span>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--border-strong)" }}>
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
                        borderBottom: "2px solid var(--border-strong)",
                        borderRight: gi < COL_GROUPS.length - 1 ? "2px solid var(--border-strong)" : "none",
                      }}
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
                {/* ── Column name headers ── */}
                <tr style={{ backgroundColor: "var(--surface)" }}>
                  {COL_HEADERS.map((h, i) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] whitespace-nowrap"
                      style={{
                        fontFamily: "var(--font-heading)",
                        borderBottom: "2px solid var(--border-strong)",
                        borderRight: i < COL_HEADERS.length - 1 ? "1px solid var(--border)" : "none",
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

        {/* ── Income Transactions Section ── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Income Transactions</h2>
            <span className="text-sm text-[var(--text-muted)]">{filteredTx.length} transactions</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--border-strong)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--surface)" }}>
                    {["Date", "Source", "Currency", "Amount", "USD Amount", "Notes", ""].map((h, i) => (
                      <th
                        key={h || "actions"}
                        className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] whitespace-nowrap"
                        style={{
                          fontFamily: "var(--font-heading)",
                          borderBottom: "2px solid var(--border-strong)",
                          borderRight: i < 6 ? "1px solid var(--border)" : "none",
                          minWidth: h === "Notes" ? 140 : h === "" ? 60 : 90,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedTx.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                        No income transactions yet. Click "+ Add Income" to get started.
                      </td>
                    </tr>
                  )}
                  {groupedTx.map((group) => (
                    <IncomeGroupRows
                      key={group.key}
                      label={group.label}
                      txs={group.txs}
                      total={group.total}
                      onEdit={(tx) => setEditingIncomeTx(tx)}
                      onDelete={(id) => setDeletingTxId(id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deletingTxId !== null && (
        <>
          <div className="fixed inset-0 bg-[var(--scrim)] z-40" onClick={() => setDeletingTxId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface)] rounded-2xl p-6 shadow-xl z-50 w-[340px]">
            <h3 className="text-sm font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Delete Transaction?</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDeleteTx(deletingTxId)} className="flex-1 py-2.5 bg-[var(--accent-red)] text-white rounded-xl font-medium text-sm hover:bg-[var(--accent-red-deep)] transition-colors">
                Delete
              </button>
              <button onClick={() => setDeletingTxId(null)} className="flex-1 py-2.5 bg-[var(--chip)] text-[var(--text-muted)] rounded-xl font-medium text-sm hover:bg-[var(--border)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Income transaction panels */}
      {showAddIncome && (
        <IncomeTransactionPanel
          mode="add"
          existingSources={existingSources}
          plnUsdRate={plnUsdRate}
          usdEurRate={usdEurRate}
          bynUsdRate={bynUsdRate}
          onClose={() => setShowAddIncome(false)}
          onSave={insertIncomeTx}
        />
      )}

      {editingIncomeTx && (
        <IncomeTransactionPanel
          mode="edit"
          tx={editingIncomeTx}
          existingSources={existingSources}
          plnUsdRate={plnUsdRate}
          usdEurRate={usdEurRate}
          bynUsdRate={bynUsdRate}
          onClose={() => setEditingIncomeTx(null)}
          onSave={async (data) => {
            await updateIncomeTx(editingIncomeTx.id, data);
          }}
        />
      )}

      {editingRecord && editingRecord.isLive && (
        <LiveRecordPanel
          record={editingRecord}
          currentMonthIncome={monthlyIncomeAgg.find((a) => a.year === editingRecord.year && a.month === editingRecord.month)?.total ?? 0}
          incomeBySource={monthlyIncomeAgg.find((a) => a.year === editingRecord.year && a.month === editingRecord.month)?.bySource ?? {}}
          onClose={() => setEditingRecord(null)}
          onSaveAdjustment={upsertIncomeOnly}
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
  const totalExpDays = yearRecordsWithData
    .filter((r) => r.adjustedExpenses > 0)
    .reduce((s, r) => s + expenseDaysForRecord(r), 0);
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
          colSpan={14}
          className="px-4 py-2.5"
          style={{ backgroundColor: "var(--surface-sunken)", borderBottom: "2px solid var(--border-strong)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-bold tracking-wide uppercase"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-muted)" }}
            >
              {year}
            </span>
            {totalSavings !== 0 && (
              <span
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: totalSavings >= 0 ? "var(--accent-green-soft-bg)" : "var(--accent-red-soft-bg)",
                  color: totalSavings >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)",
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
            backgroundColor: idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-sunken)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)"; }}
          onClick={() => onEdit(r)}
        >
          <Cell border>{r.label}{r.isLive && <LiveBadge />}</Cell>
          <Cell border>{formatCurrency(r.assets)}</Cell>
          <Cell border>{formatCurrency(r.liabilities)}</Cell>
          <Cell border>{r.income > 0 ? formatCurrency(r.income) : "—"}</Cell>
          <Cell border color="var(--accent-gold-deep)">
            {r.expenseAdjustment > 0 ? `-${formatCurrency(r.expenseAdjustment)}` : r.expenseAdjustment < 0 ? `+${formatCurrency(Math.abs(r.expenseAdjustment))}` : "—"}
          </Cell>
          <Cell border>{r.expenses > 0 ? formatCurrency(r.expenses) : "—"}</Cell>
          <Cell border>{r.adjustedExpenses > 0 ? formatCurrency(r.adjustedExpenses) : "—"}</Cell>
          <Cell border>{r.adjustedExpenses > 0 ? formatPerDay(r.adjustedExpenses / expenseDaysForRecord(r)) : "—"}</Cell>
          <Cell border color={r.netWorth >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)"} bold>{formatCurrency(r.netWorth)}</Cell>
          <Cell border>
            {r.netWorthMoM !== null ? (
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: r.netWorthMoM >= 0 ? "var(--accent-green-soft-bg)" : "var(--accent-red-soft-bg)",
                  color: r.netWorthMoM >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)",
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
        <tr style={{ backgroundColor: "var(--chip)", borderTop: "2px solid var(--border-strong)" }}>
          <TotalCell border>
            <span className="font-bold text-[var(--text-muted)]" style={{ fontFamily: "var(--font-heading)" }}>Totals</span>
          </TotalCell>
          <TotalCell border />
          <TotalCell border />
          <TotalCell border bold color="var(--text-secondary)">{formatCurrency(totalIncome)}</TotalCell>
          <TotalCell border />
          <TotalCell border />
          <TotalCell border bold color="var(--text-secondary)">{formatCurrency(totalExpenses)}</TotalCell>
          <TotalCell border color="var(--text-secondary)">{totalExpDays > 0 ? formatPerDay(totalExpenses / totalExpDays) : ""}</TotalCell>
          <TotalCell border />
          <TotalCell border />
          <TotalCell border color="var(--text-secondary)">{formatPercent(avgBurnRate * 100)}</TotalCell>
          <TotalCell border bold>{formatCurrency(totalSavings)}</TotalCell>
          <TotalCell border />
          <TotalCell color="var(--text-secondary)">{formatCurrency(yearRecordsWithData.reduce((s, r) => s + r.debtRepayment, 0))}</TotalCell>
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
        borderBottom: "1px solid var(--border)",
        borderRight: border ? "1px solid var(--border)" : "none",
        color: color || "var(--text-secondary)",
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
        borderTop: "2px solid var(--border-strong)",
        borderRight: border ? "1px solid var(--border)" : "none",
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
    <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-[var(--accent-green-soft-bg)] text-[var(--accent-green-strong)] rounded-full not-italic font-semibold inline-block align-middle">
      LIVE
    </span>
  );
}

/* ── LIVE Record Panel ── */
function LiveRecordPanel({ record, currentMonthIncome, incomeBySource, onClose, onSaveAdjustment, onFinalize }: {
  record: MonthlyRecord;
  currentMonthIncome: number;
  incomeBySource: Record<string, number>;
  onClose: () => void;
  onSaveAdjustment: (inc: { year: number; date: string; kufar: number; tokmedia: number; other: number; total: number; expense_adjustment?: number }) => Promise<void>;
  onFinalize: (al: { year: number; date: string; assets: number; liabilities: number }, inc: { year: number; date: string; kufar: number; tokmedia: number; other: number; total: number; expense_adjustment?: number }) => Promise<void>;
}) {
  const initAdj = record.expenseAdjustment ?? 0;
  const [form, setForm] = useState({
    adjDirection: initAdj >= 0 ? "reduce" as const : "add" as const,
    adjAmount: Math.abs(initAdj),
  });
  const computedAdjustment = form.adjDirection === "reduce" ? form.adjAmount : -form.adjAmount;
  const [saving, setSaving] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const date = getLastDayOfMonth(record.year, record.month);
  const sourceEntries = Object.entries(incomeBySource).sort(([, a], [, b]) => b - a);

  const handleSaveAdjustment = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Save adjustment to legacy income_data (keeps expense_adjustment working)
      await onSaveAdjustment({
        year: record.year, date,
        kufar: 0, tokmedia: 0, other: 0, total: 0,
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
        { year: record.year, date, kufar: 0, tokmedia: 0, other: 0, total: 0, expense_adjustment: computedAdjustment },
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
      <div className="fixed inset-0 bg-[var(--scrim)] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-[var(--surface)] shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{record.label}</h2>
              <span className="text-[9px] px-1.5 py-0.5 bg-[var(--accent-green-soft-bg)] text-[var(--accent-green-strong)] rounded-full font-semibold">LIVE</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--chip)] text-[var(--text-muted)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Assets & Liabilities — read-only */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Assets &amp; Liabilities</h3>
            <p className="text-[10px] text-[var(--text-faint)] mb-2">Auto-calculated from current accounts &amp; debts</p>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Total Assets (USD)</label>
              <input type="number" value={record.assets} readOnly className="w-full px-3 py-2 rounded-xl bg-[var(--surface-sunken)] text-sm outline-none border-none text-[var(--text-muted)] cursor-not-allowed" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Total Liabilities (USD)</label>
              <input type="number" value={record.liabilities} readOnly className="w-full px-3 py-2 rounded-xl bg-[var(--surface-sunken)] text-sm outline-none border-none text-[var(--text-muted)] cursor-not-allowed" />
            </div>
          </div>

          {/* Current Month Income — read-only from income_transactions */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Current Month Income</h3>
            <p className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--accent-green-strong)" }}>
              ${currentMonthIncome.toLocaleString()}
            </p>
            {sourceEntries.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                {sourceEntries.map(([source, amount], i) => (
                  <span key={source}>
                    {source}: <span className="font-medium">${amount.toLocaleString()}</span>
                    {i < sourceEntries.length - 1 && <span className="text-[var(--text-faint)] ml-1">|</span>}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-[var(--text-faint)] mt-2">To add or edit income, use the + Add Income button on the Records page</p>
          </div>

          {/* Expense Adjustment */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expense Adjustment</h3>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "reduce" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "reduce" ? "bg-[var(--accent-green-strong)] text-white" : "bg-[var(--chip)] text-[var(--text-muted)]"}`}
              >
                Reduce expenses
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "add" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "add" ? "bg-[var(--accent-red)] text-white" : "bg-[var(--chip)] text-[var(--text-muted)]"}`}
              >
                Add to expenses
              </button>
            </div>
            <input type="number" value={form.adjAmount || ""} onChange={(e) => setForm((f) => ({ ...f, adjAmount: e.target.value === "" ? 0 : Math.abs(Number(e.target.value)) }))} placeholder="0" className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            <p className="text-[10px] text-[var(--text-faint)] mt-1">Use this for non-expense outflows (deposits, investments) or missed expenses</p>
          </div>

          {saveError && (
            <div className="mb-3 p-2 bg-[var(--accent-red-soft-bg)] rounded-xl text-xs text-[var(--accent-red-strong)]">Error: {saveError}</div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={handleSaveAdjustment} disabled={saving} className="w-full py-3 border-2 border-[var(--accent-green)] text-[var(--accent-green)] rounded-xl font-medium text-sm hover:bg-[var(--accent-green-soft-bg)] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Adjustment"}
            </button>

            {!showFinalizeConfirm ? (
              <button onClick={() => setShowFinalizeConfirm(true)} disabled={saving} className="w-full py-3 bg-[var(--accent-green)] text-white rounded-xl font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50">
                Finalize Month
              </button>
            ) : (
              <div className="border-2 border-[var(--accent-gold)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  This will permanently save assets (${record.assets.toLocaleString()}) and liabilities (${Math.abs(record.liabilities).toLocaleString()}) for {record.label}. The LIVE badge will move to next month.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleFinalize} disabled={saving} className="flex-1 py-2.5 bg-[var(--accent-green)] text-white rounded-xl font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50">
                    {saving ? "Finalizing..." : "Confirm"}
                  </button>
                  <button onClick={() => setShowFinalizeConfirm(false)} className="flex-1 py-2.5 bg-[var(--chip)] text-[var(--text-muted)] rounded-xl font-medium text-sm hover:bg-[var(--border)] transition-colors">
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
      <div className="fixed inset-0 bg-[var(--scrim)] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-[var(--surface)] shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{isAdd ? "Add Record" : "Edit Record"}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--chip)] text-[var(--text-muted)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Year</label>
              <input type="number" value={form.year} onChange={(e) => update("year", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Month</label>
              <select value={form.month} onChange={(e) => update("month", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none">
                {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Assets &amp; Liabilities</h3>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Total Assets (USD)</label>
              <input type="number" value={form.assets} onChange={(e) => update("assets", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Total Liabilities (USD)</label>
              <input type="number" value={form.liabilities} onChange={(e) => update("liabilities", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2" style={{ fontFamily: "var(--font-heading)" }}>Income by Source</h3>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Kufar</label>
              <input type="number" value={form.kufar} onChange={(e) => update("kufar", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">TokMedia</label>
              <input type="number" value={form.tokmedia} onChange={(e) => update("tokmedia", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
            <div className="mb-2">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Other</label>
              <input type="number" value={form.other} onChange={(e) => update("other", e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
          </div>

          {/* Total Income — read-only */}
          <div className="mb-5">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Total Income (auto-calculated)</label>
            <input type="text" value={`$${totalIncome.toLocaleString()}`} readOnly className="w-full px-3 py-2 rounded-xl bg-[var(--surface-sunken)] text-sm outline-none border-none text-[var(--text-muted)] cursor-not-allowed" />
          </div>

          {/* Expense Adjustment */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expense Adjustment</h3>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "reduce" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "reduce" ? "bg-[var(--accent-green-strong)] text-white" : "bg-[var(--chip)] text-[var(--text-muted)]"}`}
              >
                Reduce expenses
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, adjDirection: "add" as const }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${form.adjDirection === "add" ? "bg-[var(--accent-red)] text-white" : "bg-[var(--chip)] text-[var(--text-muted)]"}`}
              >
                Add to expenses
              </button>
            </div>
            <input type="number" value={form.adjAmount || ""} onChange={(e) => setForm((f) => ({ ...f, adjAmount: e.target.value === "" ? 0 : Math.abs(Number(e.target.value)) }))} placeholder="0" className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            <p className="text-[10px] text-[var(--text-faint)] mt-1">Use this for non-expense outflows (deposits, investments) or missed expenses</p>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-[var(--text)] text-[var(--bg)] rounded-xl font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50">
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

/* ── Income Transaction Group Rows ── */
function IncomeGroupRows({ label, txs, total, onEdit, onDelete }: {
  label: string;
  txs: IncomeTransaction[];
  total: number;
  onEdit: (tx: IncomeTransaction) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={7}
          className="px-4 py-2"
          style={{ backgroundColor: "var(--surface-sunken)", borderBottom: "2px solid var(--border-strong)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide uppercase" style={{ fontFamily: "var(--font-heading)", color: "var(--text-muted)" }}>
              {label}
            </span>
            <span className="text-xs font-semibold" style={{ color: "var(--accent-green-strong)" }}>
              ${Math.round(total).toLocaleString()}
            </span>
          </div>
        </td>
      </tr>
      {txs.map((tx, idx) => (
        <tr
          key={tx.id}
          className="cursor-pointer transition-colors"
          style={{ backgroundColor: idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-sunken)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)"; }}
          onClick={() => onEdit(tx)}
        >
          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {new Date(tx.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </td>
          <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {tx.source}
          </td>
          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {tx.currency}
          </td>
          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {tx.currency === "USD" ? "$" : tx.currency === "EUR" ? "\u20AC" : tx.currency === "PLN" ? "z\u0142" : ""}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--accent-green-strong)" }}>
            ${tx.usd_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td className="px-4 py-2.5 whitespace-nowrap text-[var(--text-muted)] text-xs" style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
            {tx.notes || "\u2014"}
          </td>
          <td className="px-4 py-2.5 whitespace-nowrap text-center" style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
              className="text-[var(--text-faint)] hover:text-[var(--accent-red)] transition-colors"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

/* ── Income Transaction Side Panel (Add / Edit) ── */
function IncomeTransactionPanel({ mode, tx, existingSources, plnUsdRate, usdEurRate, bynUsdRate, onClose, onSave }: {
  mode: "add" | "edit";
  tx?: IncomeTransaction;
  existingSources: string[];
  plnUsdRate: number;
  usdEurRate: number;
  bynUsdRate: number;
  onClose: () => void;
  onSave: (data: { date: string; source: string; currency: string; amount: number; exchange_rate: number; usd_amount: number; notes?: string }) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: tx?.date ?? today,
    source: tx?.source ?? "",
    currency: tx?.currency ?? "USD",
    amount: tx?.amount ?? 0,
    exchange_rate: tx?.exchange_rate ?? 1,
    notes: tx?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getDefaultRate = (currency: string) => {
    switch (currency) {
      case "USD": return 1;
      case "PLN": return plnUsdRate;
      case "EUR": return 1 / usdEurRate;
      case "BYN": return 1 / bynUsdRate;
      default: return 1;
    }
  };

  const handleCurrencyChange = (currency: string) => {
    const rate = getDefaultRate(currency);
    setForm((f) => ({ ...f, currency, exchange_rate: rate }));
  };

  const usdAmount = form.currency === "USD"
    ? form.amount
    : form.amount / form.exchange_rate;

  const handleSave = async () => {
    if (!form.source.trim()) return;
    setSaving(true);
    try {
      await onSave({
        date: form.date,
        source: form.source.trim(),
        currency: form.currency,
        amount: form.amount,
        exchange_rate: Number(form.exchange_rate.toFixed(4)),
        usd_amount: Number(usdAmount.toFixed(2)),
        notes: form.notes.trim() || undefined,
      });
      onClose();
    } catch {
      // stay open
    } finally {
      setSaving(false);
    }
  };

  const filteredSuggestions = existingSources.filter(
    (s) => s.toLowerCase().includes(form.source.toLowerCase()) && s.toLowerCase() !== form.source.toLowerCase()
  );

  return (
    <>
      <div className="fixed inset-0 bg-[var(--scrim)] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-[var(--surface)] shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {mode === "add" ? "Add Income" : "Edit Income"}
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--chip)] text-[var(--text-muted)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
          </div>

          <div className="mb-4 relative">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Source</label>
            <input
              type="text" value={form.source}
              onChange={(e) => { setForm((f) => ({ ...f, source: e.target.value })); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. Kufar, TokMedia, Interest..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] z-10 max-h-32 overflow-y-auto">
                {filteredSuggestions.map((s) => (
                  <button key={s} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--chip)] transition-colors"
                    onMouseDown={() => { setForm((f) => ({ ...f, source: s })); setShowSuggestions(false); }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Currency</label>
            <select value={form.currency} onChange={(e) => handleCurrencyChange(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none">
              <option value="USD">USD</option>
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="BYN">BYN</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Amount ({form.currency})</label>
            <input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value === "" ? 0 : Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
          </div>

          {form.currency !== "USD" && (
            <div className="mb-4">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Exchange Rate (1 {form.currency} = ? USD)</label>
              <input type="number" step="0.0001" value={form.exchange_rate || ""} onChange={(e) => setForm((f) => ({ ...f, exchange_rate: e.target.value === "" ? 0 : Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none" />
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">USD Amount (auto-calculated)</label>
            <input type="text" value={`$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} readOnly className="w-full px-3 py-2 rounded-xl bg-[var(--surface-sunken)] text-sm outline-none border-none text-[var(--text-muted)] cursor-not-allowed" />
          </div>

          <div className="mb-6">
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !form.source.trim()} className="flex-1 py-3 bg-[var(--accent-green)] text-white rounded-xl font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose} className="flex-1 py-3 border-2 border-[var(--border)] text-[var(--text-muted)] rounded-xl font-medium text-sm hover:bg-[var(--chip)] transition-colors">
              Cancel
            </button>
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
