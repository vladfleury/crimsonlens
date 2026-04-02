"use client";

import { useState, useMemo, useId } from "react";
import {
  sankey as d3Sankey,
  sankeyJustify,
  SankeyNode,
  SankeyLink,
} from "d3-sankey";
import { useFinance } from "@/hooks/FinanceDataContext";

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
  const [yearFilter, setYearFilter] = useState<FlowYear>("2026");
  const { monthlyRecords, incomeBySource } = useFinance();

  const flowData = useMemo(() => {
    const year = Number(yearFilter);
    const yearIncome = incomeBySource.filter((r) => r.year === year);
    const kufar = yearIncome.reduce((s, r) => s + r.kufar, 0);
    const tokMedia = yearIncome.reduce((s, r) => s + r.tokMedia, 0);
    const other = yearIncome.reduce((s, r) => s + r.other, 0);
    const totalIncome = kufar + tokMedia + other;

    const yearRecords = monthlyRecords.filter((r) => r.year === year);
    const expenses = yearRecords.reduce((s, r) => s + r.adjustedExpenses, 0);
    const debtRepayment = yearRecords.reduce((s, r) => s + r.debtRepayment, 0);
    const savings = Math.max(0, totalIncome - expenses - debtRepayment);

    return { kufar, tokMedia, other, totalIncome, expenses, debtRepayment, savings };
  }, [yearFilter, monthlyRecords, incomeBySource]);

  const result = useMemo(() => {
    const { kufar, tokMedia, other, totalIncome, expenses, debtRepayment, savings } = flowData;

    const nodes: NodeDef[] = [
      { id: "tokMedia", label: "TokMedia", color: "#C9A9B8" },
      { id: "kufar", label: "Kufar", color: "#D4C5A9" },
    ];
    if (other > 0) {
      nodes.push({ id: "other", label: "Other", color: "#B8C9D4" });
    }
    nodes.push(
      { id: "totalIncome", label: "Total Income", color: "#E8D98E" },
      { id: "expenses", label: "Expenses", color: "#D4C55A" },
      { id: "savings", label: "Savings", color: "#7DD8C4" },
    );
    if (debtRepayment > 0) {
      nodes.push({ id: "debtRepayment", label: "Debt Repayment", color: "#D4A07A" });
    }

    const links: { source: string; target: string; value: number; color: string }[] = [
      { source: "tokMedia", target: "totalIncome", value: tokMedia, color: "#C9A9B8" },
      { source: "kufar", target: "totalIncome", value: kufar || 1, color: "#D4C5A9" },
    ];
    if (other > 0) {
      links.push({ source: "other", target: "totalIncome", value: other, color: "#B8C9D4" });
    }
    links.push(
      { source: "totalIncome", target: "expenses", value: expenses, color: "#D4C55A" },
      { source: "totalIncome", target: "savings", value: savings || 1, color: "#7DD8C4" },
    );
    if (debtRepayment > 0) {
      links.push({ source: "totalIncome", target: "debtRepayment", value: debtRepayment, color: "#D4A07A" });
    }

    const generator = d3Sankey<NodeDef, Record<string, unknown>>()
      .nodeId((d) => (d as unknown as NodeDef).id)
      .nodeWidth(NODE_W)
      .nodePadding(NODE_PAD)
      .nodeAlign(sankeyJustify)
      .extent([
        [MARGIN.left, MARGIN.top],
        [W - MARGIN.right, H - MARGIN.bottom],
      ]);

    return generator({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    });
  }, [flowData]);

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
  const years: FlowYear[] = ["2026", "2025"];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Money Flow</h2>
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
              {y}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
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
            labelX = x0 - 14;
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
                <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={6} fill="white" fillOpacity={0.9} />
                <text x={(x0 + x1) / 2} y={midY - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2c2c2c">
                  {n.label}
                </text>
                <text x={(x0 + x1) / 2} y={midY + 13} textAnchor="middle" fontSize={12} fontWeight={400} fill="#6b6560">
                  {fmt(value)}
                </text>
              </g>
            );
          }

          return (
            <g key={n.id}>
              <rect x={x0} y={y0} width={x1 - x0} height={h} rx={2} fill={n.color} />
              {/* Percentage */}
              <text x={labelX} y={midY - 14} textAnchor={anchor} fontSize={10} fontWeight={500} fill="#9c9890">
                ({pct}%)
              </text>
              {/* Name */}
              <text x={labelX} y={midY + 1} textAnchor={anchor} fontSize={13} fontWeight={600} fill="#2c2c2c">
                {n.label}
              </text>
              {/* Value */}
              <text x={labelX} y={midY + 17} textAnchor={anchor} fontSize={12} fontWeight={400} fill="#6b6560">
                {fmt(value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
