"use client";

import Link from "next/link";
import { useFinance } from "@/hooks/FinanceDataContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { fmtMoney, fmtPct, fmtSigned, holdingColors } from "@/lib/portfolio";

// ── Portfolio — dashboard widget ──
// Market value of all investments, labeled all-time gain/loss, cost basis, a
// proportion bar of the holdings and the top three. Lives in the sidebar under
// the Month Clock. The Assets KPI and Net Worth already include this value.

const heading = { fontFamily: "var(--font-heading)" };
const nums = { fontVariantNumeric: "tabular-nums" as const };

export default function PortfolioCard() {
  const { portfolio } = useFinance();
  const c = useThemeColors();
  const colors = holdingColors(c.isDark);

  if (!portfolio.hasPositions) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]" style={{ ...heading, letterSpacing: "0.09em" }}>
            Portfolio
          </div>
          <div className="mt-1 text-xs text-[var(--text-faint)]">No investments yet</div>
        </div>
        <Link href="/portfolio" className="flex-shrink-0 rounded-full border border-dashed border-[var(--border)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors">
          + Add purchase
        </Link>
      </div>
    );
  }

  const { holdings, totalValueUsd, totalCostUsd, gainUsd, gainPct, quotesUpdatedAt } = portfolio;
  const up = gainUsd >= 0;
  const top = holdings.slice(0, 3);
  const rest = holdings.length - top.length;

  return (
    <div className="glass-card rounded-2xl px-5 pt-5 pb-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase text-[var(--text-muted)]" style={{ ...heading, letterSpacing: "0.09em" }}>
          Portfolio
        </span>
        <span className="text-[11px] text-[var(--text-faint)]">
          {quotesUpdatedAt ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-green)] align-middle mr-1.5" />
              live · {new Date(quotesUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </>
          ) : (
            "prices pending"
          )}
        </span>
      </div>

      <div className="mt-3 text-[32px] font-extrabold leading-none text-[var(--text)]" style={{ ...heading, ...nums, letterSpacing: "-0.02em" }}>
        {fmtMoney(totalValueUsd)}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{
            backgroundColor: up ? "var(--accent-green-soft-bg)" : "var(--accent-red-soft-bg)",
            color: up ? "var(--accent-green-strong)" : "var(--accent-red-strong)",
            ...nums,
          }}
        >
          {up ? "▲" : "▼"} {fmtSigned(gainUsd)} · {fmtPct(gainPct)}
        </span>
        <span className="text-xs text-[var(--text-muted)]">all time</span>
      </div>
      <div className="mt-1.5 text-xs text-[var(--text-muted)]" style={nums}>
        Paid <b className="text-[var(--text-secondary)]" style={heading}>{fmtMoney(totalCostUsd)}</b> · {holdings.length} {holdings.length === 1 ? "holding" : "holdings"}
      </div>

      <div
        className="mt-4 flex h-2.5 overflow-hidden rounded-full"
        style={{ gap: 2 }}
        role="img"
        aria-label={holdings.map((h) => `${h.ticker} ${Math.round(h.share)}%`).join(", ")}
      >
        {holdings.map((h, i) => (
          <div key={h.ticker} style={{ flexGrow: Math.max(h.valueUsd, 0), minWidth: 3, backgroundColor: colors[Math.min(i, colors.length - 1)] }} />
        ))}
      </div>

      <div className="mt-2">
        {top.map((h, i) => (
          <div key={h.ticker} className="flex items-center gap-2.5 py-2" style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}>
            <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ backgroundColor: colors[i] }} />
            <span className="w-14 text-[13px] font-bold text-[var(--text)]" style={heading}>{h.ticker}</span>
            <span className="flex-1" />
            <span className="text-[13px] font-semibold text-[var(--text)]" style={{ ...heading, ...nums }}>{fmtMoney(h.valueUsd)}</span>
            <span className="w-9 text-right text-xs text-[var(--text-faint)]" style={nums}>{Math.round(h.share)}%</span>
            <span
              className="w-16 text-right text-xs font-semibold"
              style={{ color: h.gainUsd >= 0 ? "var(--accent-green-strong)" : "var(--accent-red-strong)", ...nums }}
            >
              {h.priced ? fmtSigned(h.gainUsd) : "—"}
            </span>
          </div>
        ))}
      </div>

      <Link href="/portfolio" className="mt-2 block text-right text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        {rest > 0 ? `+${rest} more · ` : ""}View portfolio →
      </Link>
    </div>
  );
}
