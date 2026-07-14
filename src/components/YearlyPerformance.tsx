"use client";

// ── Yearly Performance — stat-led editorial ──
// A hero net-worth-swing figure leads; below it, "Net position by year" renders
// one horizontal diverging row per year around a shared $0 rule: liabilities
// extend left (red), assets right (green), and a gold tick marks net worth.
// A $0 liability draws NO mark — it appears as "✓ $0 · debt cleared" instead.
// All colors come from the theme CSS variables, so light and dark both work.

interface YearRecord {
  year: number;
  assets: number;
  liabilities: number;
  netWorth: number;
}

interface RowDatum {
  year: number;
  isYTD: boolean;
  assets: number;
  liab: number; // absolute value, >= 0
  nw: number;
}

// Plot geometry (viewBox coordinates).
const VB_W = 636;
const PLOT_L = 86;
const PLOT_R = 500;
const NET_X = 628;
const BAR_H = 14;
const ROW_YS: Record<number, number[]> = { 1: [83], 2: [54, 112] };

const money = (n: number) => "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
// True minus sign for negatives, matching the approved design.
const signedMoney = (n: number) => (n < 0 ? "−" : "+") + money(n);

function tickLabel(v: number): string {
  const sign = v < 0 ? "−" : "+";
  const abs = Math.abs(v);
  return sign + (abs >= 1000 ? `$${abs / 1000}K` : `$${abs}`);
}

// Nice 1-2-5 step (nearest, not ceiling) so tick spacing adapts to any range —
// e.g. a $9.9k span yields $2k/$3k-style steps, not one lonely $5k line.
function niceStep(span: number): number {
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const unit = raw / mag;
  const m = unit < 1.5 ? 1 : unit < 3 ? 2 : unit < 7 ? 5 : 10;
  return m * mag;
}

// Horizontal bar rounded only at the data end, flat at the $0 rule.
function barPath(x: number, y: number, w: number, roundLeft: boolean): string {
  const r = Math.min(4, w / 2);
  if (roundLeft) {
    return `M${x + w} ${y} H${x + r} Q${x} ${y} ${x} ${y + r} V${y + BAR_H - r} Q${x} ${y + BAR_H} ${x + r} ${y + BAR_H} H${x + w} Z`;
  }
  return `M${x} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + BAR_H - r} Q${x + w} ${y + BAR_H} ${x + w - r} ${y + BAR_H} H${x} Z`;
}

export default function YearlyPerformance({ records }: { records: YearRecord[] }) {
  // Latest record per year (records arrive most-recent-first), newest two years.
  const latestByYear = new Map<number, YearRecord>();
  for (const r of records) {
    if (!latestByYear.has(r.year)) latestByYear.set(r.year, r);
  }
  const currentYear = new Date().getFullYear();
  const rows: RowDatum[] = Array.from(latestByYear.values())
    .sort((a, b) => a.year - b.year)
    .slice(-2)
    .map((r) => ({
      year: r.year,
      isYTD: r.year === currentYear,
      assets: Math.max(0, r.assets),
      liab: Math.abs(r.liabilities),
      nw: r.netWorth,
    }));

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No yearly data yet.</p>;
  }

  const prev = rows.length === 2 ? rows[0] : null;
  const latest = rows[rows.length - 1];
  const swing = prev ? latest.nw - prev.nw : latest.nw;
  const debtFree = latest.liab === 0;

  // Shared scale: liabilities (and negative net worth) left, assets right.
  const negSpan = Math.max(...rows.map((r) => Math.max(r.liab, -Math.min(0, r.nw))), 0);
  const posSpan = Math.max(...rows.map((r) => Math.max(r.assets, r.nw)), 0);
  const span = Math.max(negSpan + posSpan, 1);
  const S = (PLOT_R - PLOT_L) / span;
  const Z = PLOT_L + negSpan * S;

  const step = niceStep(span);
  const ticks: number[] = [];
  for (let v = -Math.floor(negSpan / step) * step; v <= posSpan; v += step) {
    if (v !== 0) ticks.push(v);
  }

  const ys = ROW_YS[rows.length] ?? ROW_YS[2];
  const heading = { fontFamily: "var(--font-heading)" };

  return (
    <div className="w-full" style={{ fontFamily: "var(--font-body)" }}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-semibold uppercase text-[var(--text-muted)]"
          style={{ ...heading, letterSpacing: "0.14em" }}
        >
          Yearly performance
        </span>
        {debtFree && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
            Debt-free
          </span>
        )}
      </div>

      {/* Hero */}
      <div className="mb-3 mt-5 h-[3px] w-[26px] rounded-sm bg-[var(--accent-gold)]" />
      <div
        className="font-extrabold leading-none text-[var(--text)]"
        style={{ ...heading, fontSize: "clamp(34px, 9vw, 52px)", letterSpacing: "-1.2px" }}
      >
        {signedMoney(swing)}
      </div>
      <div className="mt-2.5 text-[13.5px] text-[var(--text-secondary)]">
        {prev
          ? `Net-worth swing, ${prev.year} → ${latest.year}${latest.isYTD ? " YTD" : ""}`
          : `Net worth, ${latest.year}${latest.isYTD ? " YTD" : ""}`}
      </div>
      {prev && (
        <div className="mt-1 text-xs text-[var(--text-faint)]">
          Assets {money(prev.assets)} → {money(latest.assets)}
          {"  ·  "}
          Liabilities {money(prev.liab)} → {money(latest.liab)}
        </div>
      )}

      <div className="mb-3.5 mt-5 h-px bg-[var(--hairline)]" />

      {/* Section label + legend */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase text-[var(--text-faint)]"
          style={{ ...heading, letterSpacing: "0.12em" }}
        >
          Net position by year
        </span>
        <span className="flex items-center gap-4 text-[11px] font-medium text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--accent-green)]" />
            Assets
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--accent-red)]" />
            Liabilities
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-sm bg-[var(--accent-gold)]" />
            Net worth
          </span>
        </span>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${VB_W} 176`}
        className="block w-full"
        role="img"
        aria-label={`Assets, liabilities and net worth by year: ${rows
          .map((r) => `${r.year} net ${signedMoney(r.nw)}`)
          .join(", ")}`}
      >
        {/* Grid + axis */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={Z + v * S} y1={18} x2={Z + v * S} y2={148} stroke="var(--grid)" />
            <text x={Z + v * S} y={161} textAnchor="middle" fontSize={10} fill="var(--axis)">
              {tickLabel(v)}
            </text>
          </g>
        ))}
        <line x1={Z} y1={14} x2={Z} y2={148} stroke="var(--chart-zero)" strokeOpacity={0.45} />
        <text x={Z} y={161} textAnchor="middle" fontSize={10} fill="var(--axis)">
          $0
        </text>

        {rows.map((r, i) => {
          const y = ys[i];
          const isLatest = i === rows.length - 1;
          // Nonzero values keep a 2px visibility floor; exact zero draws nothing.
          const liabW = r.liab > 0 ? Math.max(r.liab * S, 2) : 0;
          const assetW = r.assets > 0 ? Math.max(r.assets * S, 2) : 0;
          const tickX = Z + r.nw * S;
          // Inside-bar label sits right of the gold tick when the tick falls
          // inside the bar (with 2025's data they'd collide at the same x).
          const liabLabelX = Math.max(Z - liabW + 14, tickX + 10);
          const showLiabLabel = liabW >= 56 && Z - liabLabelX >= 48;
          return (
            <g key={r.year}>
              {/* Year label */}
              <text
                x={8}
                y={y}
                fontSize={12}
                fontWeight={600}
                fill={isLatest ? "var(--text-secondary)" : "var(--text-muted)"}
                dominantBaseline="middle"
                style={heading}
              >
                {r.year}
                {r.isYTD && (
                  <tspan fontSize={9.5} fill="var(--text-faint)">
                    {" YTD"}
                  </tspan>
                )}
              </text>

              {/* Liabilities: bar when nonzero; "debt cleared" note only when
                  exactly $0 AND there's room left of the zero rule */}
              {liabW > 0 && (
                <path d={barPath(Z - liabW, y - BAR_H / 2, liabW - 1, true)} fill="var(--accent-red)">
                  <title>{`Liabilities ${r.year} · ${money(r.liab)}`}</title>
                </path>
              )}
              {r.liab === 0 && Z >= 200 && (
                <text x={Z - 12} y={y} fontSize={10.5} fill="var(--text-faint)" textAnchor="end" dominantBaseline="middle">
                  <tspan fill="var(--accent-green)">{"✓"}</tspan>
                  {" $0 · debt cleared"}
                </text>
              )}

              {/* Assets */}
              {assetW > 0 && (
                <path d={barPath(Z + 1, y - BAR_H / 2, assetW - 1, false)} fill="var(--accent-green)">
                  <title>{`Assets ${r.year} · ${money(r.assets)}`}</title>
                </path>
              )}

              {/* Net-worth tick — 2px surface ring keeps it legible over a bar
                  without an opaque backing tab against the glass card */}
              <rect
                x={tickX - 1.5}
                y={y - 11}
                width={3}
                height={22}
                rx={1.5}
                fill="var(--accent-gold)"
                stroke="var(--surface)"
                strokeWidth={2}
                paintOrder="stroke"
              >
                <title>{`Net worth ${r.year} · ${signedMoney(r.nw)}`}</title>
              </rect>

              {/* Inside-bar liability label, clear of the gold tick */}
              {showLiabLabel && (
                <text
                  x={liabLabelX}
                  y={y}
                  fontSize={10.5}
                  fontWeight={600}
                  fill="var(--surface-2)"
                  dominantBaseline="middle"
                >
                  {money(r.liab)}
                </text>
              )}

              {/* Net value, right-aligned */}
              <text
                x={NET_X}
                y={y}
                fontSize={12.5}
                fontWeight={isLatest ? 700 : 600}
                fill={isLatest ? "var(--text)" : "var(--text-muted)"}
                textAnchor="end"
                dominantBaseline="middle"
                style={heading}
              >
                {signedMoney(r.nw)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
