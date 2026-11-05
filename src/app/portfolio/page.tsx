"use client";

import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useFinance } from "@/hooks/FinanceDataContext";
import { quoteSymbolFor } from "@/hooks/useFinanceData";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { InvestmentTransaction } from "@/lib/data";
import { CURRENCY_SYMBOLS, fmtMoney, fmtPct, fmtSigned, holdingColors } from "@/lib/portfolio";

// ── Portfolio tab ──
// KPIs, allocation ledger, where the portfolio shows up in net worth and the
// month's numbers, and the editable list of purchases. Prices are live from
// /api/quotes; nothing here is typed in by hand except the purchases.

const heading = { fontFamily: "var(--font-heading)" };
const nums = { fontVariantNumeric: "tabular-nums" as const };
const CURRENCIES = ["USD", "EUR", "PLN"] as const;

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortfolioPage() {
  const {
    portfolio, investmentTransactions, monthlyRecords, accounts,
    plnUsdRate, usdEurRate, bynUsdRate,
    insertInvestmentTx, updateInvestmentTx, deleteInvestmentTx,
    isLoading, error, refetch,
  } = useFinance();
  const c = useThemeColors();
  const colors = holdingColors(c.isDark);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<InvestmentTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Liquid cash, the same way the dashboard computes it.
  const liquidCash = useMemo(() => accounts
    .filter((a) => a.is_liquid)
    .reduce((s, a) => {
      if (a.currency === "PLN") return s + a.amount / plnUsdRate;
      if (a.currency === "EUR") return s + a.amount * usdEurRate;
      if (a.currency === "BYN") return s + a.amount / bynUsdRate;
      return s + a.amount;
    }, 0), [accounts, plnUsdRate, usdEurRate, bynUsdRate]);

  const live = monthlyRecords[0];
  const prev = monthlyRecords[1];
  const fees = investmentTransactions.reduce((s, tx) => s + Number(tx.fee ?? 0), 0);
  const up = portfolio.gainUsd >= 0;
  const colorOf = (ticker: string) => {
    const i = portfolio.holdings.findIndex((h) => h.ticker === ticker.toUpperCase());
    return colors[Math.min(i < 0 ? colors.length - 1 : i, colors.length - 1)];
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-[1100px] mx-auto flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent-green)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-muted)]">Loading portfolio...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-[1100px] mx-auto flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[var(--accent-red)] font-medium">Failed to load data</p>
            <p className="text-xs text-[var(--text-muted)]">{error}</p>
            <button onClick={refetch} className="mt-2 px-4 py-2 bg-[var(--text)] text-[var(--bg)] rounded-xl text-sm font-medium hover:opacity-90 transition-colors">Retry</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={heading}>Portfolio</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Manage your investments</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-[var(--text)] text-[var(--bg)] rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-[0_4px_14px_-4px_rgba(0,0,0,0.45)]"
          >
            + Add transaction
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <Kpi label="Total paid" value={fmtMoney(portfolio.totalCostUsd)} sub={`${investmentTransactions.length} ${investmentTransactions.length === 1 ? "purchase" : "purchases"} · fees ${fmtMoney(fees)}`} />
          <Kpi
            label="Portfolio value"
            value={fmtMoney(portfolio.totalValueUsd)}
            sub={portfolio.quotesUpdatedAt
              ? <><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-green)] align-middle mr-1.5" />live prices · {new Date(portfolio.quotesUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
              : "prices pending"}
          />
          <Kpi
            label="Total gain / loss"
            value={`${up ? "▲" : "▼"} ${fmtSigned(portfolio.gainUsd)}`}
            valueColor={up ? "var(--accent-green-strong)" : "var(--accent-red-strong)"}
            sub={<><span className="font-semibold" style={{ color: up ? "var(--accent-green-strong)" : "var(--accent-red-strong)" }}>{fmtPct(portfolio.gainPct)}</span> · unrealized</>}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5 items-start">
          {/* Allocation */}
          <div className="glass-card rounded-2xl p-5">
            <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)] mb-3" style={{ ...heading, letterSpacing: "0.09em" }}>Allocation</div>
            {portfolio.hasPositions ? (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full" style={{ gap: 2 }} role="img" aria-label={portfolio.holdings.map((h) => `${h.ticker} ${h.share.toFixed(1)}%`).join(", ")}>
                  {portfolio.holdings.map((h, i) => (
                    <div key={h.ticker} style={{ flexGrow: Math.max(h.valueUsd, 0), minWidth: 3, backgroundColor: colors[Math.min(i, colors.length - 1)] }} />
                  ))}
                </div>
                <div className="mt-2">
                  {portfolio.holdings.map((h, i) => (
                    <div key={h.ticker} className="flex items-center gap-2.5 py-2.5" style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}>
                      <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ backgroundColor: colors[Math.min(i, colors.length - 1)] }} />
                      <span className="w-14 text-[13px] font-bold text-[var(--text)]" style={heading}>{h.ticker}</span>
                      <span className="flex-1 min-w-0 truncate text-xs text-[var(--text-muted)]">
                        {portfolio.quotes[h.symbol]?.name ?? h.symbol} · {h.currency}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--text)]" style={{ ...heading, ...nums }}>{fmtMoney(h.valueUsd)}</span>
                      <span className="w-12 text-right text-xs text-[var(--text-faint)]" style={nums}>{h.share.toFixed(1)}%</span>
                      <span className="w-20 text-right text-xs font-semibold" style={{ color: h.gainUsd >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)", ...nums }}>
                        {h.priced ? fmtSigned(h.gainUsd) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Add your first purchase to see the allocation.</p>
            )}
          </div>

          {/* Where it shows up */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]" style={{ ...heading, letterSpacing: "0.09em" }}>Where it shows up</div>
            <div className="rounded-xl border border-[var(--border)] p-4 flex flex-col gap-2 text-sm">
              <Line label="Cash & accounts" value={fmtMoney(liquidCash, "USD", 0)} />
              <Line label="Portfolio (market value)" value={fmtMoney(portfolio.totalValueUsd, "USD", 0)} />
              <Line label="Net worth" value={fmtMoney(liquidCash + portfolio.totalValueUsd + (live?.liabilities ?? 0), "USD", 0)} total />
            </div>
            {live && (
              <div className="rounded-xl border border-[var(--border)] p-4 flex flex-col gap-2 text-sm">
                <Line label="Income" value={fmtSigned(live.income, "USD", 0)} color="var(--accent-green-strong)" />
                <Line label="Expenses" value={fmtMoney(-live.adjustedExpenses, "USD", 0)} />
                <Line label="Investment return" value={fmtSigned(live.investmentReturn, "USD", 0)} color={live.investmentReturn >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)"} />
                <Line label={`Net worth change, ${live.label.split(" ")[0]}`} value={fmtSigned(prev ? live.netWorth - prev.netWorth : live.netWorth, "USD", 0)} total />
              </div>
            )}
            <p className="text-xs text-[var(--text-faint)]">Buying shares moves cash into the portfolio and is not an expense. Market moves are their own line, so income, expenses and savings rate stay about real cash flow.</p>
          </div>
        </div>

        {/* Transactions */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={heading}>Transactions</h2>
          <span className="text-sm text-[var(--text-muted)]">{investmentTransactions.length} {investmentTransactions.length === 1 ? "purchase" : "purchases"}</span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--border-strong)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, ...nums }}>
              <thead>
                <tr style={{ backgroundColor: "var(--surface)" }}>
                  {["Date", "Ticker", "Ccy", "Bought at", "Shares", "Paid", "Fee", "Current", "Value", "Gain / loss", ""].map((h, i, arr) => (
                    <th
                      key={h || "actions"}
                      className={`px-4 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] whitespace-nowrap ${i < 3 ? "text-left" : "text-right"}`}
                      style={{ ...heading, borderBottom: "2px solid var(--border-strong)", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investmentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                      No purchases yet. Click &quot;+ Add transaction&quot; to record your first one.
                    </td>
                  </tr>
                )}
                {investmentTransactions.map((tx, idx) => {
                  const sym = quoteSymbolFor(tx);
                  const q = portfolio.quotes[sym];
                  const price = Number(tx.price);
                  const shares = Number(tx.shares);
                  const fee = Number(tx.fee ?? 0);
                  const paid = price * shares;
                  const current = q && q.price > 0 ? q.price : null;
                  const value = current !== null ? current * shares : null;
                  const gain = value !== null ? value - paid - fee : null;
                  const ccy = tx.currency;
                  const cell = (content: React.ReactNode, right = true, extra = "") => (
                    <td className={`px-4 py-3 whitespace-nowrap ${right ? "text-right" : "text-left"} ${extra}`} style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--text-secondary)" }}>{content}</td>
                  );
                  return (
                    <tr
                      key={tx.id}
                      className="cursor-pointer transition-colors"
                      style={{ backgroundColor: idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-sunken)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)"; }}
                      onClick={() => setEditing(tx)}
                    >
                      {cell(fmtDate(tx.date), false)}
                      {cell(<span className="inline-flex items-center gap-2 font-bold text-[var(--text)]" style={heading}><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: colorOf(tx.ticker) }} />{tx.ticker.toUpperCase()}</span>, false)}
                      {cell(<span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--text-secondary)]">{ccy}</span>, false)}
                      {cell(fmtMoney(price, ccy))}
                      {cell(shares.toLocaleString("en-US", { maximumFractionDigits: 8 }))}
                      {cell(fmtMoney(paid, ccy))}
                      {cell(fmtMoney(fee, ccy))}
                      {cell(current !== null ? fmtMoney(current, ccy) : "—")}
                      {cell(value !== null ? fmtMoney(value, ccy) : "—")}
                      <td
                        className="px-4 py-3 whitespace-nowrap text-right font-semibold"
                        style={{ borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: gain === null ? "var(--text-faint)" : gain >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)" }}
                      >
                        {gain === null ? "—" : `${gain >= 0 ? "▲" : "▼"} ${fmtSigned(gain, ccy)}`}
                      </td>
                      <td className="px-3 py-3 text-center" style={{ borderBottom: "1px solid var(--border)" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(tx.id); }}
                          className="text-[var(--text-faint)] hover:text-[var(--accent-red)] transition-colors"
                          title="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 mb-8 text-xs text-[var(--text-faint)]">Gain/loss per row is in the row&apos;s own currency and includes its fee; the totals above are in USD at the live rate. Prices: Yahoo Finance, refreshed every 60s.</p>
      </div>

      {deletingId !== null && (
        <>
          <div className="fixed inset-0 bg-[var(--scrim)] z-40" onClick={() => setDeletingId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface)] rounded-2xl p-6 shadow-xl z-50 w-[340px]">
            <h3 className="text-sm font-bold mb-2" style={heading}>Delete purchase?</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteInvestmentTx(deletingId); setDeletingId(null); }} className="flex-1 py-2.5 bg-[var(--accent-red)] text-white rounded-xl font-medium text-sm hover:bg-[var(--accent-red-deep)] transition-colors">Delete</button>
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 bg-[var(--chip)] text-[var(--text-muted)] rounded-xl font-medium text-sm hover:bg-[var(--border)] transition-colors">Cancel</button>
            </div>
          </div>
        </>
      )}

      {showAdd && (
        <TxPanel mode="add" onClose={() => setShowAdd(false)} onSave={insertInvestmentTx} />
      )}
      {editing && (
        <TxPanel
          mode="edit"
          tx={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => { await updateInvestmentTx(editing.id, data); }}
        />
      )}
    </DashboardLayout>
  );
}

function Kpi({ label, value, sub, valueColor }: { label: string; value: string; sub: React.ReactNode; valueColor?: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ ...heading, ...nums, color: valueColor ?? "var(--text)" }}>{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1.5">{sub}</p>
    </div>
  );
}

function Line({ label, value, total, color }: { label: string; value: string; total?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between" style={total ? { borderTop: "1px solid var(--hairline)", paddingTop: 8, marginTop: 2 } : undefined}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <b style={{ ...heading, ...nums, color: color ?? "var(--text)" }}>{value}</b>
    </div>
  );
}

function TxPanel({ mode, tx, onClose, onSave }: {
  mode: "add" | "edit";
  tx?: InvestmentTransaction;
  onClose: () => void;
  onSave: (data: { date: string; ticker: string; currency: string; price: number; shares: number; fee: number; quote_symbol?: string | null; notes?: string | null }) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: tx?.date ?? today,
    ticker: tx?.ticker ?? "",
    currency: tx?.currency ?? "USD",
    price: tx ? String(tx.price) : "",
    shares: tx ? String(tx.shares) : "",
    fee: tx ? String(tx.fee ?? 0) : "0",
    quote_symbol: tx?.quote_symbol ?? "",
    notes: tx?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const price = parseFloat(form.price) || 0;
  const shares = parseFloat(form.shares) || 0;
  const fee = parseFloat(form.fee) || 0;
  const paid = price * shares;
  const sym = CURRENCY_SYMBOLS[form.currency] ?? "";
  const valid = form.ticker.trim().length > 0 && price > 0 && shares > 0 && !!form.date;
  const defaultSymbol = quoteSymbolFor({ ticker: form.ticker || "TICKER", currency: form.currency });

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        date: form.date,
        ticker: form.ticker.trim().toUpperCase(),
        currency: form.currency,
        price,
        shares,
        fee,
        quote_symbol: form.quote_symbol.trim() ? form.quote_symbol.trim().toUpperCase() : null,
        notes: form.notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] text-sm outline-none border-none";
  const label = "text-xs text-[var(--text-muted)] mb-1 block";

  return (
    <>
      <div className="fixed inset-0 bg-[var(--scrim)] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-full bg-[var(--surface)] shadow-xl z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={heading}>{mode === "add" ? "Add purchase" : "Edit purchase"}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--chip)] text-[var(--text-muted)] transition-colors" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={label} htmlFor="inv-date">Date</label>
              <input id="inv-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="inv-ccy">Currency</label>
              <select id="inv-ccy" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={input}>
                {CURRENCIES.map((ccy) => <option key={ccy} value={ccy}>{ccy}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className={label} htmlFor="inv-ticker">Ticker</label>
            <input id="inv-ticker" type="text" value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="e.g. VUAA, AAPL" className={input} autoFocus={mode === "add"} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={label} htmlFor="inv-price">Bought at ({sym})</label>
              <input id="inv-price" type="number" step="0.0001" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="inv-shares">Shares</label>
              <input id="inv-shares" type="number" step="0.00000001" value={form.shares} onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))} className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={label} htmlFor="inv-fee">Fee ({sym})</label>
              <input id="inv-fee" type="number" step="0.01" value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} className={input} />
            </div>
            <div>
              <label className={label}>Paid (auto)</label>
              <input type="text" value={fmtMoney(paid, form.currency)} readOnly className="w-full px-3 py-2 rounded-xl bg-[var(--surface-sunken)] text-sm outline-none border-none text-[var(--text-muted)] cursor-not-allowed" />
            </div>
          </div>

          <div className="mb-4">
            <label className={label} htmlFor="inv-symbol">Price symbol (optional)</label>
            <input id="inv-symbol" type="text" value={form.quote_symbol} onChange={(e) => setForm((f) => ({ ...f, quote_symbol: e.target.value }))} placeholder={`default: ${defaultSymbol}`} className={input} />
            <p className="text-[10px] text-[var(--text-faint)] mt-1">Yahoo Finance symbol. USD tickers price as-is; EUR tickers default to the Xetra listing (.DE).</p>
          </div>

          <div className="mb-6">
            <label className={label} htmlFor="inv-notes">Notes (optional)</label>
            <textarea id="inv-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${input} resize-none`} />
          </div>

          {saveError && <div className="mb-3 p-2 bg-[var(--accent-red-soft-bg)] rounded-xl text-xs text-[var(--accent-red)]">Error: {saveError}</div>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !valid} className="flex-1 py-3 bg-[var(--accent-green)] text-white rounded-xl font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose} className="flex-1 py-3 border-2 border-[var(--border)] text-[var(--text-muted)] rounded-xl font-medium text-sm hover:bg-[var(--chip)] transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}
