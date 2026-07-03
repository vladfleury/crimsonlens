"use client";

import { useFinance } from "@/hooks/FinanceDataContext";
import { formatCurrency, monthNames } from "@/data/mockData";

// ── Month Clock ──
// A compact "this month at a glance" gauge. The ring is split into the month's
// income (green) vs. burn/expense (red) share; the tick marks + hand + center
// number track how far we are through the calendar month. Income/burn are
// pulled from the live current-month record (same source the KPI cards use).
// Colors use the theme CSS variables so it works in both light and dark.

const CX = 120;
const CY = 120;
const RING_R = 90;
const RING_W = 11;
const GAP_DEG = 5; // small visual gap between the income and burn arcs

// 0° at 12 o'clock, increasing clockwise.
function polar(r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function arcPath(r: number, startAngle: number, endAngle: number) {
  const start = polar(r, startAngle);
  const end = polar(r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// Render one segment as either an arc (partial) or a full circle (~whole ring),
// skipping it entirely when the share is negligible.
function Segment({ share, offsetDeg, color }: { share: number; offsetDeg: number; color: string }) {
  if (share <= 0.0005) return null;
  if (share >= 0.9995) {
    return <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke={color} strokeWidth={RING_W} />;
  }
  const start = offsetDeg + GAP_DEG / 2;
  const end = offsetDeg + share * 360 - GAP_DEG / 2;
  return (
    <path
      d={arcPath(RING_R, start, end)}
      fill="none"
      stroke={color}
      strokeWidth={RING_W}
      strokeLinecap="round"
    />
  );
}

export default function MonthClock() {
  const { monthlyRecords } = useFinance();

  // Anchor to the current calendar month — that's what the clock represents.
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();

  const rec = monthlyRecords.find((r) => r.year === year && r.month === month);
  const income = rec?.income ?? 0;
  const burn = rec?.adjustedExpenses ?? 0;
  const net = income - burn;

  const total = income + burn;
  const incomeShare = total > 0 ? income / total : 0;
  const burnShare = total > 0 ? burn / total : 0;

  // Per-day figures use days elapsed so far this month.
  const incomePerDay = income / day;
  const burnPerDay = burn / day;

  // Clock hand angle: fraction of the month elapsed.
  const handAngle = (day / daysInMonth) * 360;
  const hand = polar(58, handAngle);

  // Day ticks around the face.
  const ticks = Array.from({ length: daysInMonth }, (_, i) => {
    const angle = (i / daysInMonth) * 360;
    const outer = polar(110, angle);
    const inner = polar(i % 5 === 0 ? 100 : 103, angle);
    const elapsed = i < day;
    return { i, outer, inner, elapsed };
  });

  return (
    <div className="glass-card rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-heading)" }}>
          Month Clock
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {monthNames[month - 1]} · Day {day}/{daysInMonth}
        </span>
      </div>

      {/* Clock */}
      <div className="flex justify-center py-1">
        <svg viewBox="0 0 240 240" className="w-full" style={{ maxWidth: 240 }}>
          {/* Ticks */}
          {ticks.map((t) => (
            <line
              key={t.i}
              x1={t.inner.x}
              y1={t.inner.y}
              x2={t.outer.x}
              y2={t.outer.y}
              stroke={t.elapsed ? "var(--text-faint)" : "var(--border-strong)"}
              strokeWidth={t.i % 5 === 0 ? 1.75 : 1}
              strokeLinecap="round"
            />
          ))}

          {/* Track */}
          <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="var(--border-strong)" strokeWidth={RING_W} />

          {/* Income + burn arcs */}
          <Segment share={incomeShare} offsetDeg={0} color="var(--accent-green)" />
          <Segment share={burnShare} offsetDeg={incomeShare * 360} color="var(--accent-red)" />

          {/* Hand */}
          <line
            x1={CX}
            y1={CY}
            x2={hand.x}
            y2={hand.y}
            stroke="var(--text-secondary)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={4} fill="var(--text-secondary)" />

          {/* Center readout */}
          <text
            x={CX}
            y={CY - 2}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "var(--font-heading)" }}
            fontSize={46}
            fontWeight={800}
            fill="var(--text)"
          >
            {day}
          </text>
          <text
            x={CX}
            y={CY + 30}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            letterSpacing={2}
            fill="var(--text-muted)"
          >
            OF {daysInMonth}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-col">
        <LegendRow
          dot="var(--accent-green)"
          labelColor="var(--accent-green-strong)"
          label="Income"
          value={formatCurrency(income)}
          perDay={`$${incomePerDay.toFixed(1)}/d`}
        />
        <LegendRow
          dot="var(--accent-red)"
          labelColor="var(--accent-red-strong)"
          label="Burn"
          value={formatCurrency(burn)}
          perDay={`$${burnPerDay.toFixed(1)}/d`}
        />
        <LegendRow
          dot="var(--accent-gold)"
          labelColor="var(--accent-gold-deep)"
          label="Net"
          value={formatCurrency(net, "$", true)}
          valueColor="var(--accent-gold-deep)"
          last
        />
      </div>
    </div>
  );
}

function LegendRow({
  dot,
  labelColor,
  label,
  value,
  perDay,
  valueColor,
  last,
}: {
  dot: string;
  labelColor: string;
  label: string;
  value: string;
  perDay?: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-[var(--hairline)]"}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />
        <span className="text-[11px] uppercase tracking-wider" style={{ color: labelColor }}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-sm font-bold"
          style={{ fontFamily: "var(--font-heading)", color: valueColor ?? "var(--text)" }}
        >
          {value}
        </span>
        {perDay && <span className="text-[11px] text-[var(--text-muted)]">· {perDay}</span>}
      </div>
    </div>
  );
}
