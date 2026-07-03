"use client";

import { useFinance } from "@/hooks/FinanceDataContext";
import { formatCurrency } from "@/data/mockData";

// ── Month Clock — "Aurora Arc" ──
// A luminous half-arc gauge sweeps the month's time progress (today of N days),
// its gradient warming from income-green to a gold tip that previews the Net.
// A 65/35-style split bar shows the income-vs-burn proportion, and two tinted
// glass tiles carry the figures. Data comes from the live current-month record.
// Colors use the theme CSS variables so it works in both light and dark.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Upper half-arc gauge geometry (viewBox 224 x 150).
const CX = 112;
const CY = 120;
const R = 90;
const A0 = Math.PI; // left end
const A1 = 2 * Math.PI; // right end
function pt(a: number): [number, number] {
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
}

export default function MonthClock() {
  const { monthlyRecords } = useFinance();

  // Anchor to the current calendar month.
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
  const incShare = total > 0 ? income / total : 0;
  const incPct = total > 0 ? Math.round(incShare * 100) : 0;
  const burnPct = total > 0 ? 100 - incPct : 0;
  const elapsedPct = Math.round((day / daysInMonth) * 100);

  const incomePerDay = income / day;
  const burnPerDay = burn / day;

  // Gauge points: start (left), full-arc end (right), progress end (today).
  const s = pt(A0);
  const e = pt(A1);
  const pe = pt(A0 + (A1 - A0) * (day / daysInMonth));

  return (
    <div className="glass-card rounded-2xl p-5" style={{ position: "relative", overflow: "hidden" }}>
      {/* Ambient green glow bleeding from the top */}
      <div
        style={{
          position: "absolute",
          top: -64,
          left: "50%",
          transform: "translateX(-50%)",
          width: 240,
          height: 240,
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--accent-green) 20%, transparent), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ position: "relative" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: "var(--text)", letterSpacing: "-0.2px" }}>
            {MONTHS[month - 1]}
          </div>
          <div style={{ fontWeight: 500, fontSize: 10.5, color: "var(--text-faint)", letterSpacing: "0.4px", marginTop: 2 }}>
            MONTH TO DATE
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "color-mix(in srgb, var(--accent-gold) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-gold) 34%, transparent)",
            borderRadius: 999,
            padding: "5px 11px",
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 10, color: "var(--accent-gold-deep)", letterSpacing: "0.5px" }}>NET</span>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13, color: "var(--accent-gold)" }}>
            {formatCurrency(net, "$", true)}
          </span>
        </div>
      </div>

      {/* Gauge */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", margin: "10px 0 4px" }}>
        <svg viewBox="0 0 224 150" width={224} height={150}>
          <defs>
            <linearGradient id="mcArc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: "var(--accent-green-deep)" }} />
              <stop offset="0.5" style={{ stopColor: "var(--accent-green-strong)" }} />
              <stop offset="1" style={{ stopColor: "var(--accent-gold)" }} />
            </linearGradient>
            <filter id="mcGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={`M${s[0]} ${s[1]} A${R} ${R} 0 0 1 ${e[0]} ${e[1]}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={13}
            strokeLinecap="round"
          />
          <path
            d={`M${s[0]} ${s[1]} A${R} ${R} 0 0 1 ${pe[0]} ${pe[1]}`}
            fill="none"
            stroke="url(#mcArc)"
            strokeWidth={13}
            strokeLinecap="round"
            filter="url(#mcGlow)"
          />
          <circle cx={pe[0]} cy={pe[1]} r={7} fill="var(--text)" />
          <circle cx={pe[0]} cy={pe[1]} r={7} fill="none" stroke="var(--accent-gold)" strokeWidth={2} />
        </svg>
        <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 54, lineHeight: 1, color: "var(--text)", letterSpacing: "-1.8px" }}>
            {day}
          </div>
          <div style={{ fontWeight: 500, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.6px", marginTop: 4 }}>
            DAY {day} OF {daysInMonth} · {elapsedPct}%
          </div>
        </div>
      </div>

      {/* Income / burn split bar */}
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--border)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ width: `${incShare * 100}%`, background: "linear-gradient(90deg, var(--accent-green-deep), var(--accent-green-strong))" }} />
        <div style={{ width: `${(total > 0 ? 1 - incShare : 0) * 100}%`, background: "linear-gradient(90deg, var(--accent-red-strong), var(--accent-red-deep))" }} />
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 7 }}>
        <span style={{ fontWeight: 500, fontSize: 10, color: "var(--accent-green-strong)", letterSpacing: "0.4px" }}>INCOME {incPct}%</span>
        <span style={{ fontWeight: 500, fontSize: 10, color: "var(--accent-red-strong)", letterSpacing: "0.4px" }}>BURN {burnPct}%</span>
      </div>

      {/* Figure tiles */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <StatTile accent="var(--accent-green)" label="INCOME" value={formatCurrency(income)} perDay={`$${Math.round(incomePerDay).toLocaleString()}/day`} />
        <StatTile accent="var(--accent-red)" label="BURN" value={formatCurrency(burn)} perDay={`$${Math.round(burnPerDay).toLocaleString()}/day`} />
      </div>
    </div>
  );
}

function StatTile({ accent, label, value, perDay }: { accent: string; label: string; value: string; perDay: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: `color-mix(in srgb, ${accent} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
        borderRadius: 14,
        padding: "12px 12px 11px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: accent, boxShadow: `0 0 7px color-mix(in srgb, ${accent} 80%, transparent)` }} />
        <span style={{ fontWeight: 500, fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.5px" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: "var(--text)", letterSpacing: "-0.4px" }}>{value}</div>
      <div style={{ fontWeight: 400, fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{perDay}</div>
    </div>
  );
}
