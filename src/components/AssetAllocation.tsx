"use client";

// ── Asset Allocation — "Ledger Bar" ──
// One slim proportion bar carries the whole part-to-whole split; a ledger row
// per currency pairs the native amount with its USD equivalent and share.
// Currencies with nothing in them are demoted to a faint "no holdings" row
// rather than getting a phantom slice or a 0% that looks like data.

export interface AllocHolding {
  code: string; // "PLN"
  symbol: string; // "zł"
  native: number; // 7825
  usd: number; // 2079 (may be negative if an account is overdrawn)
  color: string; // resolved theme color
}

// Sign goes before the symbol: −$1,346, never $-1,346.
function usd(n: number): string {
  const r = Math.round(n);
  return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US");
}

// Largest-remainder apportionment so displayed shares always total 100%
// (plain per-row rounding gives 33/33/33 = 99 on a three-way split).
function apportion(values: number[]): number[] {
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / sum) * 100);
  const out = raw.map(Math.floor);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k].i] += 1;
  return out;
}

const heading = { fontFamily: "var(--font-heading)" };
const nums = { fontVariantNumeric: "tabular-nums" as const };

export default function AssetAllocation({
  holdings,
  total,
  monthChange,
}: {
  holdings: AllocHolding[];
  total: number;
  monthChange: number;
}) {
  const positive = holdings.filter((h) => h.usd > 0);
  const negative = holdings.filter((h) => h.usd < 0);
  const zero = holdings.filter((h) => h.usd === 0);

  // Shares are of the positive holdings — that's what the bar depicts.
  const shares = apportion(positive.map((h) => h.usd));

  const up = monthChange >= 0;
  const deltaColor = up ? "var(--accent-green-strong)" : "var(--accent-red-strong)";
  const deltaBg = up ? "var(--accent-green-soft-bg)" : "var(--accent-red-soft-bg)";

  // A single ordered list keeps the hairline logic honest (no border on row 0).
  const rows = [
    ...positive.map((h, i) => ({ h, kind: "positive" as const, pct: shares[i] })),
    ...negative.map((h) => ({ h, kind: "negative" as const, pct: 0 })),
    ...zero.map((h) => ({ h, kind: "zero" as const, pct: 0 })),
  ];

  return (
    <div className="glass-card rounded-2xl px-5 pt-5 pb-3">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span
          className="text-[11px] font-semibold uppercase text-[var(--text-muted)]"
          style={{ ...heading, letterSpacing: "0.09em" }}
        >
          Asset Allocation
        </span>
        <span className="text-[11px] text-[var(--text-faint)]">USD equiv.</span>
      </div>

      {/* Total + labeled delta */}
      <div
        className="mt-3 text-[32px] font-extrabold leading-none text-[var(--text)]"
        style={{ ...heading, ...nums, letterSpacing: "-0.02em" }}
      >
        {usd(total)}
      </div>
      {monthChange !== 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: deltaBg, color: deltaColor, ...nums }}
          >
            {up ? "↑" : "↓"} {up ? "+" : "−"}${Math.abs(Math.round(monthChange)).toLocaleString("en-US")}
          </span>
          <span className="text-xs text-[var(--text-muted)]">this month</span>
        </div>
      )}

      {/* The one and only encoding of the split */}
      {positive.length > 0 && (
        <div
          className="mt-4 flex h-2.5 overflow-hidden rounded-full"
          style={{ gap: 2 }}
          role="img"
          aria-label={positive
            .map((h, i) => `${h.code} ${shares[i] === 0 ? "under 1" : shares[i]}%`)
            .join(", ")}
        >
          {positive.map((h) => (
            <div
              key={h.code}
              // minWidth keeps a dust holding visible instead of clipping to nothing.
              style={{ flexGrow: h.usd, minWidth: 3, backgroundColor: h.color }}
            />
          ))}
        </div>
      )}

      {/* Ledger rows */}
      <div className="mt-3">
        {rows.map(({ h, kind, pct }, i) => {
          const faint = kind !== "positive";
          return (
            <div
              key={h.code}
              className="flex items-center py-2.5"
              style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}
            >
              <span
                className={`h-2.5 w-2.5 flex-none rounded-[3px] ${kind === "zero" ? "opacity-35" : ""}`}
                style={{ backgroundColor: h.color }}
              />
              <span
                className={`ml-2.5 text-[13px] font-bold ${faint ? "text-[var(--text-faint)]" : "text-[var(--text)]"}`}
                style={heading}
              >
                {h.code}
              </span>

              {kind === "zero" ? (
                <span className="ml-2 text-xs text-[var(--text-faint)] opacity-75">no holdings</span>
              ) : (
                <span
                  className="ml-2 truncate text-[12.5px] font-medium text-[var(--text-muted)]"
                  style={nums}
                >
                  {h.native < 0 ? "−" : ""}
                  {h.symbol}
                  {Math.abs(Math.round(h.native)).toLocaleString("en-US")}
                </span>
              )}

              <span className="flex-1" />

              <span
                className={`text-[13.5px] font-semibold ${
                  kind === "negative"
                    ? "text-[var(--accent-red-strong)]"
                    : faint
                      ? "text-[var(--text-faint)]"
                      : "text-[var(--text)]"
                }`}
                style={{ ...heading, ...nums }}
              >
                {usd(h.usd)}
              </span>

              <span
                className={`ml-2.5 w-9 text-right text-xs text-[var(--text-faint)] ${faint ? "opacity-60" : ""}`}
                style={nums}
              >
                {kind === "positive" ? (pct === 0 ? "<1%" : `${pct}%`) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
