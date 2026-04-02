"use client";

import { useRef, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { useFinance } from "@/hooks/FinanceDataContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface DataPoint {
  label: string;
  value: number;
  change: number | null;
  isGain: boolean;
  isYearStart?: boolean;
}

function getDotSize(absChange: number): { dot: number; halo: number } {
  if (absChange < 500) return { dot: 4, halo: 10 };
  if (absChange <= 2000) return { dot: 5, halo: 13 };
  return { dot: 6, halo: 16 };
}

export default function NetWorthChart() {
  const chartRef = useRef<ChartJS<"line">>(null);
  const { monthlyRecords } = useFinance();

  const dataPoints: DataPoint[] = useMemo(() => {
    const sorted = [...monthlyRecords].reverse(); // oldest first
    return sorted.map((r, i) => {
      const nw = r.netWorth;
      const prevNw = i > 0 ? sorted[i - 1].netWorth : null;
      const change = prevNw !== null ? nw - prevNw : null;
      return {
        label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][r.month - 1] + " " + String(r.year).slice(2),
        value: nw,
        change,
        isGain: change !== null ? change >= 0 : true,
        isYearStart: r.month === 1 && i > 0,
      };
    });
  }, [monthlyRecords]);

  // Net worth change: current NW minus end-of-previous-year NW
  const nwChange = useMemo(() => {
    if (monthlyRecords.length === 0) return 0;
    const sorted = [...monthlyRecords].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    const currentNW = sorted[0].netWorth;
    const currentYear = sorted[0].year;
    const prevYearEnd = sorted.find((r) => r.year === currentYear - 1);
    const baseNW = prevYearEnd ? prevYearEnd.netWorth : 0;
    return currentNW - baseNW;
  }, [monthlyRecords]);

  const labels = dataPoints.map((d) => d.label);
  const values = dataPoints.map((d) => d.value);

  // Refs for tooltip callbacks (avoids stale closures)
  const dpRef = dataPoints;
  const valRef = values;

  // Custom plugin for halos, year separator, and data labels
  const customPlugin = useMemo(() => ({
    id: "netWorthCustom",
    afterDatasetsDraw(chart: ChartJS) {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);

      meta.data.forEach((point, i) => {
        const dp = dataPoints[i];
        const absChange = dp.change !== null ? Math.abs(dp.change) : 0;
        const { dot, halo } = getDotSize(absChange);
        const x = point.x;
        const y = point.y;

        // Halo
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, halo, 0, Math.PI * 2);
        ctx.fillStyle = dp.isGain ? "rgba(45, 184, 154, 0.15)" : "rgba(220, 38, 38, 0.15)";
        ctx.fill();
        ctx.restore();

        // Main dot
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, dot, 0, Math.PI * 2);
        ctx.fillStyle = dp.isGain ? "#2DB89A" : "#DC2626";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Center dot
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = dp.isGain ? "#1A8F78" : "#991B1B";
        ctx.fill();
        ctx.restore();

        // Year separator label — positioned above Dec 25 (last month of previous year)
        if (dp.isYearStart && i > 0) {
          const prevPoint = meta.data[i - 1];
          const prevDp = dataPoints[i - 1];
          const prevHalo = getDotSize(prevDp.change !== null ? Math.abs(prevDp.change) : 0).halo;
          ctx.save();
          ctx.font = "600 10px 'Plus Jakarta Sans', sans-serif";
          ctx.fillStyle = "#999";
          ctx.textAlign = "center";
          ctx.fillText("2026", prevPoint.x, prevPoint.y - prevHalo - 10);
          ctx.restore();
        }
      });
    },
  }), [dataPoints]);

  // Draw $0 reference line
  const zeroLinePlugin = useMemo(() => ({
    id: "zeroLine",
    beforeDatasetsDraw(chart: ChartJS) {
      const ctx = chart.ctx;
      const yScale = chart.scales.y;
      const xScale = chart.scales.x;
      const zeroY = yScale.getPixelForValue(0);

      if (zeroY >= yScale.top && zeroY <= yScale.bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xScale.left, zeroY);
        ctx.lineTo(xScale.right, zeroY);
        ctx.strokeStyle = "#2D2D2D";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    },
  }), []);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        borderColor: "#2DB89A",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      tooltip: {
        backgroundColor: "#FAF8F4",
        titleColor: "#1a1a1a",
        bodyColor: "#666",
        borderColor: "#eee",
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        boxPadding: 4,
        displayColors: false,
        callbacks: {
          title(items) {
            const i = items[0]?.dataIndex ?? 0;
            const dp = dpRef[i];
            if (!dp) return "";
            return dp.label;
          },
          label(ctx) {
            const v = ctx.parsed.y ?? 0;
            const nwStr = v < 0 ? `-$${Math.abs(v).toLocaleString()}` : `$${v.toLocaleString()}`;
            return `Net Worth: ${nwStr}`;
          },
          afterBody(items) {
            const i = items[0]?.dataIndex ?? 0;
            const dp = dpRef[i];
            if (!dp || dp.change === null) return ["MoM: —"];
            const ch = dp.change;
            const sign = ch >= 0 ? "+" : "";
            const dollarStr = ch >= 0 ? `+$${ch.toLocaleString()}` : `-$${Math.abs(ch).toLocaleString()}`;
            const prevVal = i > 0 ? valRef[i - 1] : null;
            let pctStr = "";
            if (prevVal !== null && prevVal !== undefined && prevVal !== 0) {
              const pct = (ch / Math.abs(prevVal)) * 100;
              pctStr = ` (${sign}${pct.toFixed(1)}%)`;
            }
            return [`MoM: ${dollarStr}${pctStr}`];
          },
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#999",
          font: { size: 11 },
        },
      },
      y: {
        grid: {
          color: "#E5E5E0",
          drawTicks: false,
        },
        border: { display: false, dash: [4, 4] },
        ticks: {
          color: "#999",
          font: { size: 11 },
          callback(value) {
            const v = Number(value);
            if (v === 0) return "$0";
            if (v < 0) return `-$${Math.abs(v).toLocaleString()}`;
            return `$${v.toLocaleString()}`;
          },
          stepSize: 5000,
        },
      },
    },
    layout: {
      padding: { top: 30, right: 10 },
    },
  };

  useEffect(() => {
    chartRef.current?.update();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Net Worth + Gains</h2>
          <span
            className="px-3 py-1 rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: nwChange >= 0 ? "#1A8F78" : "#DC2626" }}
          >
            {nwChange >= 0 ? "+" : "-"}${Math.abs(Math.round(nwChange)).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#999]">
          <div className="flex items-center gap-1.5">
            <span className="relative w-5 h-5 flex items-center justify-center">
              <span className="absolute w-4 h-4 rounded-full" style={{ backgroundColor: "rgba(45, 184, 154, 0.2)" }} />
              <span className="relative w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#2DB89A", border: "1.5px solid white", boxShadow: "0 0 0 0.5px #2DB89A" }} />
            </span>
            Gain
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative w-5 h-5 flex items-center justify-center">
              <span className="absolute w-4 h-4 rounded-full" style={{ backgroundColor: "rgba(220, 38, 38, 0.2)" }} />
              <span className="relative w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#DC2626", border: "1.5px solid white", boxShadow: "0 0 0 0.5px #DC2626" }} />
            </span>
            Loss
          </div>
        </div>
      </div>
      <div style={{ height: 300 }}>
        <Line ref={chartRef} data={data} options={options} plugins={[customPlugin, zeroLinePlugin]} />
      </div>
    </div>
  );
}
