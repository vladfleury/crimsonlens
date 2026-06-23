"use client";

import { useState, useMemo, useId } from "react";
import {
  sankey as d3Sankey,
  sankeyJustify,
  SankeyNode,
  SankeyLink,
} from "d3-sankey";
import { useFinance } from "@/hooks/FinanceDataContext";
import { useThemeColors } from "@/hooks/useThemeColors";

type FlowYear = "2026" | "2025";

interface NodeDef {
  id: string;
  label: string;
  color: string;
}

type N = SankeyNode<NodeDef, Record<string, unknown>> & NodeDef;
type L = SankeyLink<NodeDef, Record<string, unknown>> & { color: string };

const W = 720;
const H = 380;
const MARGIN = { top: 30, right: 130, bottom: 20, left: 130 };
const NODE_W = 6;
const NODE_PAD = 28;

function bandPath(
  sx: number, sy0: number, sy1: number,
  tx: number, ty0: number, ty1: number,
): string {
  const mx = (sx + tx) / 2;
  return [
    `M${sx},${sy0}`,
    `C${mx},${sy0} ${mx},${ty0} ${tx},${ty0}`,
    `L${tx},${ty1}`,
    `C${mx},${ty1} ${mx},${sy1} ${sx},${sy1}`,
    "Z",
  ].join(" ");
}

function fmt(v: number): string {
  return "$" + Math.round(v).toLocaleString();
}

export default function MoneyFlowChart() {
  const uid = useId();
  const c = useThemeColors();
  const [yearFilter, setYearFilter] = useState<FlowYear>("2026");
  const { monthlyRecords, monthlyIncomeAgg } = useFinance();

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const flowData = useMemo(() => {
    const year = Number(yearFilter);

    // Build source totals from monthly income aggregation (income_transactions)
    const yearAgg = monthlyIncomeAgg.filter((a) => a.year === year);
    const sourceTotals: Record<string, number> = {};
    for (const agg of yearAgg) {
      for (const [source, amount] of Object.entries(agg.bySource)) {
        sourceTotals[source] = (sourceTotals[source] ?? 0) + amount;
      }
    }

    const totalIncome = Object.values(sourceTotals).reduce((s, v) => s + v, 0);

    // Group small sources (<5% of total) into "Other"
    const threshold = totalIncome * 0.05;
    const sources: Record<string, number> = {};
    let otherTotal = 0;
    for (const [source, amount] of Object.entries(sourceTotals)) {
      if (amount < threshold && source !== "Other") {
        otherTotal += amount;
      } else {
        sources[source] = amount;
      }
    }
    if (otherTotal > 0) {
      sources["Other"] = (sources["Other"] ?? 0) + otherTotal;
    }

    // Sort sources by amount descending; if empty, add a placeholder
    let sortedSources = Object.entries(sources).sort(([, a], [, b]) => b - a);
    if (sortedSources.length === 0) {
      sortedSources = [["Income", 0]];
    }

    const yearRecords = monthlyRecords.filter((r) => r.year === year);
    const expenses = yearRecords.reduce((s, r) => s + r.adjustedExpenses, 0);
    const debtRepayment = yearRecords.reduce((s, r) => s + r.debtRepayment, 0);
    const savings = Math.max(0, totalIncome - expenses - debtRepayment);

    return { sources: sortedSources, totalIncome, expenses, debtRepayment, savings };
  }, [yearFilter, monthlyRecords, monthlyIncomeAgg]);

  const result = useMemo(() => {
    const { sources, totalIncome, expenses, debtRepayment, savings } = flowData;

    // Color palette for dynamic sources
    const sourceColors = c.sankeySources;

    // On mobile use narrower side gutters so the scaled-down labels don't clip.
    const margin = isMobile
      ? { ...MARGIN, left: 70, right: 70 }
      : MARGIN;

    const nodes: NodeDef[] = sources.map(([name], i) => ({
      id: `src_${name}`,
      label: name,
      color: sourceColors[i % sourceColors.length],
    }));
    nodes.push(
      { id: "totalIncome", label: "Total Income", color: c.sankeyIncome },
      { id: "expenses", label: "Expenses", color: c.sankeyExpense },
      { id: "savings", label: "Savings", color: c.sankeySavings },
    );
    if (debtRepayment > 0) {
      nodes.push({ id: "debtRepayment", label: "Debt Repayment", color: c.sankeyDebt });
    }

    const links: { source: string; target: string; value: number; color: string }[] = sources.map(([name, amount], i) => ({
      source: `src_${name}`,
      target: "totalIncome",
      value: amount || 1,
      color: sourceColors[i % sourceColors.length],
    }));
    links.push(
      { source: "totalIncome", target: "expenses", value: expenses || 1, color: c.sankeyExpense },
      { source: "totalIncome", target: "savings", value: savings || 1, color: c.sankeySavings },
    );
    if (debtRepayment > 0) {
      links.push({ source: "totalIncome", target: "debtRepayment", value: debtRepayment, color: c.sankeyDebt });
    }

    const generator = d3Sankey<NodeDef, Record<string, unknown>>()
      .nodeId((d) => (d as unknown as NodeDef).id)
      .nodeWidth(NODE_W)
      .nodePadding(NODE_PAD)
      .nodeAlign(sankeyJustify)
      .extent([
        [margin.left, margin.top],
        [W - margin.right, H - margin.bottom],
      ]);

    return generator({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    });
  }, [flowData, c, isMobile]);

  const years: FlowYear[] = ["2026", "2025"];

  // If no real data, show empty state
  if (flowData.totalIncome === 0 && flowData.expenses === 0) {
    return (
      <div className="glass-card rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Money Flow</h2>
          <div className="flex gap-1 bg-[var(--chip)] rounded-xl p-1">
            {years.map((y) => (
              <button key={y} onClick={() => setYearFilter(y)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${yearFilter === y ? "bg-[var(--text)] text-[var(--bg)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center h-[200px] text-sm text-[var(--text-muted)]">
          No income data for {yearFilter}
        </div>
      </div>
    );
  }

  // Build bands
  const nodeMap = new Map(result.nodes.map((n) => [(n as N).id, n as N]));
  const srcOffset = new Map<string, number>();
  const tgtOffset = new Map<string, number>();

  const bands = result.links.map((link, i) => {
    const src = link.source as N;
    const tgt = link.target as N;
    const lnk = link as L;

    const sx = src.x1 ?? 0;
    const tx = tgt.x0 ?? 0;

    const srcH = (src.y1 ?? 0) - (src.y0 ?? 0);
    const srcTotalOut = (src.sourceLinks ?? []).reduce((s: number, l: unknown) => s + ((l as { width?: number }).width ?? 0), 0);
    const bandSrcH = srcTotalOut > 0 ? ((link as unknown as { width: number }).width / srcTotalOut) * srcH : 0;
    const sOff = srcOffset.get(src.id) ?? 0;
    srcOffset.set(src.id, sOff + bandSrcH);

    const tgtH = (tgt.y1 ?? 0) - (tgt.y0 ?? 0);
    const tgtTotalIn = (tgt.targetLinks ?? []).reduce((s: number, l: unknown) => s + ((l as { width?: number }).width ?? 0), 0);
    const bandTgtH = tgtTotalIn > 0 ? ((link as unknown as { width: number }).width / tgtTotalIn) * tgtH : 0;
    const tOff = tgtOffset.get(tgt.id) ?? 0;
    tgtOffset.set(tgt.id, tOff + bandTgtH);

    const sy0 = (src.y0 ?? 0) + sOff;
    const sy1 = sy0 + bandSrcH;
    const ty0 = (tgt.y0 ?? 0) + tOff;
    const ty1 = ty0 + bandTgtH;

    const d = bandPath(sx, sy0, sy1, tx, ty0, ty1);

    return { d, color: lnk.color, key: `band-${i}`, srcId: src.id, tgtId: tgt.id };
  });

  const { totalIncome } = flowData;

  return (
    <div className="glass-card rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Money Flow</h2>
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
              {y}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" overflow="visible" style={{ maxHeight: H, overflow: "visible" }}>
        <defs>
          {bands.map((b, i) => {
            const src = nodeMap.get(b.srcId);
            const tgt = nodeMap.get(b.tgtId);
            if (!src || !tgt) return null;
            return (
              <linearGradient
                key={b.key}
                id={`${uid}-g${i}`}
                x1={src.x1} y1="0" x2={tgt.x0} y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={b.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={b.color} stopOpacity={0.25} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Filled bands */}
        {bands.map((b, i) => (
          <path key={b.key} d={b.d} fill={`url(#${uid}-g${i})`} />
        ))}

        {/* Nodes + labels */}
        {result.nodes.map((node) => {
          const n = node as N;
          const x0 = n.x0 ?? 0;
          const x1 = n.x1 ?? 0;
          const y0 = n.y0 ?? 0;
          const y1 = n.y1 ?? 0;
          const h = y1 - y0;
          if (h <= 0) return null;

          const value = n.value ?? 0;
          const midY = (y0 + y1) / 2;

          const depth = (node as unknown as { depth: number }).depth ?? 0;
          const maxDepth = Math.max(...result.nodes.map((nn) => (nn as unknown as { depth: number }).depth ?? 0));
          const isLeft = depth === 0;
          const isRight = depth === maxDepth;
          const isMid = !isLeft && !isRight;

          let labelX: number;
          let anchor: "start" | "end";
          if (isLeft) {
            // Clamp so left-anchored labels never run past the left edge.
            labelX = Math.max(8, x0 - 14);
            anchor = "end";
          } else {
            labelX = x1 + 14;
            anchor = "start";
          }

          const pct = totalIncome > 0 ? Math.round((value / totalIncome) * 100) : 0;

          // Mid-column (Total Income) gets a white pill
          if (isMid) {
            const pillW = 100;
            const pillH = 40;
            const pillX = (x0 + x1) / 2 - pillW / 2;
            const pillY = midY - pillH / 2;
            return (
              <g key={n.id}>
                <rect x={x0} y={y0} width={x1 - x0} height={h} rx={2} fill={n.color} />
                <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={6} fill={c.surface} fillOpacity={0.9} />
                <text x={(x0 + x1) / 2} y={midY - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill={c.text}>
                  {n.label}
                </text>
                <text x={(x0 + x1) / 2} y={midY + 13} textAnchor="middle" fontSize={12} fontWeight={400} fill={c.textSub}>
                  {fmt(value)}
                </text>
              </g>
            );
          }

          if (isMobile) {
            // Tighter two-line label (name + value) so it fits the scaled-down SVG.
            return (
              <g key={n.id}>
                <rect x={x0} y={y0} width={x1 - x0} height={h} rx={2} fill={n.color} />
                {/* Name */}
                <text x={labelX} y={midY - 4} textAnchor={anchor} fontSize={11} fontWeight={600} fill={c.text}>
                  {n.label}
                </text>
                {/* Value */}
                <text x={labelX} y={midY + 10} textAnchor={anchor} fontSize={10} fontWeight={400} fill={c.textSub}>
                  {fmt(value)}
                </text>
              </g>
            );
          }

          return (
            <g key={n.id}>
              <rect x={x0} y={y0} width={x1 - x0} height={h} rx={2} fill={n.color} />
              {/* Percentage */}
              <text x={labelX} y={midY - 14} textAnchor={anchor} fontSize={10} fontWeight={500} fill={c.axis}>
                ({pct}%)
              </text>
              {/* Name */}
              <text x={labelX} y={midY + 1} textAnchor={anchor} fontSize={13} fontWeight={600} fill={c.text}>
                {n.label}
              </text>
              {/* Value */}
              <text x={labelX} y={midY + 17} textAnchor={anchor} fontSize={12} fontWeight={400} fill={c.textSub}>
                {fmt(value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
