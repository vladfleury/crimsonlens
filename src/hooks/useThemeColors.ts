"use client";

import { useEffect, useState } from "react";

/**
 * Charts (Recharts SVG attrs, Chart.js canvas strings, hand-built SVG) cannot
 * read CSS custom properties — `fill="var(--x)"` renders nothing. This hook
 * resolves the theme tokens to concrete hex/rgba strings and re-reads them
 * whenever the `.dark` class on <html> flips, so every chart recolors live.
 */

export interface ThemeColors {
  isDark: boolean;
  // accents
  green: string;
  greenStrong: string;
  greenDeep: string;
  greenSoft: string;
  greenPale: string;
  red: string;
  redStrong: string;
  redDeep: string;
  redPale: string;
  gold: string;
  goldDeep: string;
  // text / surfaces
  text: string;
  textSub: string;
  textMuted: string;
  surface: string;
  chip: string;
  // chart chrome
  grid: string;
  axis: string;
  zeroLine: string;
  baseline: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipSub: string;
  tooltipBorder: string;
  dotStroke: string;
  // derived
  greenHalo: string;
  redHalo: string;
  liabFront: string;
  liabTop: string;
  liabRight: string;
  // chart-role aliases
  income: string;
  incomeLabel: string;
  expense: string;
  expenseLabel: string;
  // sankey
  sankeySources: string[];
  sankeyIncome: string;
  sankeyExpense: string;
  sankeySavings: string;
  sankeyDebt: string;
}

// SSR / pre-mount fallback = light-theme literals (keeps first paint sane).
const LIGHT_FALLBACK: ThemeColors = {
  isDark: false,
  green: "#1EB594",
  greenStrong: "#0E9C7C",
  greenDeep: "#188A74",
  greenSoft: "#7AD6C2",
  greenPale: "#B0EBDE",
  red: "#E5352E",
  redStrong: "#D32F2A",
  redDeep: "#B71F1A",
  redPale: "#FDC9C6",
  gold: "#D6A636",
  goldDeep: "#8B7332",
  text: "#1A1A1C",
  textSub: "#48484C",
  textMuted: "#6B6B70",
  surface: "#FCFAF6",
  chip: "#F2EEE6",
  grid: "#E6E3DC",
  axis: "#9A9A9F",
  zeroLine: "#48484C",
  baseline: "#48484C",
  tooltipBg: "rgba(252,250,246,0.92)",
  tooltipText: "#1A1A1C",
  tooltipSub: "#6B6B70",
  tooltipBorder: "rgba(120,100,80,0.14)",
  dotStroke: "#FFFFFF",
  greenHalo: "rgba(30,181,148,0.16)",
  redHalo: "rgba(229,53,46,0.16)",
  liabFront: "rgba(229,53,46,0.50)",
  liabTop: "rgba(229,53,46,0.30)",
  liabRight: "rgba(183,31,26,0.58)",
  income: "#1EB594",
  incomeLabel: "#0E9C7C",
  expense: "#E5352E",
  expenseLabel: "#D32F2A",
  sankeySources: ["#C9A9B8", "#D4C5A9", "#B8C9D4", "#C4B8D4", "#D4B8B8", "#B8D4C9", "#D4D4B8"],
  sankeyIncome: "#E8D98E",
  sankeyExpense: "#D4C55A",
  sankeySavings: "#7DD8C4",
  sankeyDebt: "#D4A07A",
};

// Cool-pastel source palette for dark (no warm beige/yellow casts).
const SANKEY_SOURCES_DARK = ["#B9C3D6", "#C4BFD6", "#B6CFD2", "#CBBFD0", "#C9C7D2", "#B6D0C9", "#CFD2DC"];

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.trim().replace("#", "");
  if (h.length < 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function read(): ThemeColors {
  if (typeof window === "undefined") return LIGHT_FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => {
    const got = cs.getPropertyValue(name).trim();
    return got || fallback;
  };
  const isDark = document.documentElement.classList.contains("dark");

  const green = v("--accent-green", LIGHT_FALLBACK.green);
  const greenStrong = v("--accent-green-strong", LIGHT_FALLBACK.greenStrong);
  const greenDeep = v("--accent-green-deep", LIGHT_FALLBACK.greenDeep);
  const greenSoft = v("--accent-green-soft", LIGHT_FALLBACK.greenSoft);
  const greenPale = v("--accent-green-pale", LIGHT_FALLBACK.greenPale);
  const red = v("--accent-red", LIGHT_FALLBACK.red);
  const redStrong = v("--accent-red-strong", LIGHT_FALLBACK.redStrong);
  const redDeep = v("--accent-red-deep", LIGHT_FALLBACK.redDeep);
  const redPale = v("--accent-red-pale", LIGHT_FALLBACK.redPale);
  const gold = v("--accent-gold", LIGHT_FALLBACK.gold);
  const goldDeep = v("--accent-gold-deep", LIGHT_FALLBACK.goldDeep);

  return {
    isDark,
    green,
    greenStrong,
    greenDeep,
    greenSoft,
    greenPale,
    red,
    redStrong,
    redDeep,
    redPale,
    gold,
    goldDeep,
    text: v("--text", LIGHT_FALLBACK.text),
    textSub: v("--text-secondary", LIGHT_FALLBACK.textSub),
    textMuted: v("--text-muted", LIGHT_FALLBACK.textMuted),
    surface: v("--surface", LIGHT_FALLBACK.surface),
    chip: v("--chip", LIGHT_FALLBACK.chip),
    grid: v("--grid", LIGHT_FALLBACK.grid),
    axis: v("--axis", LIGHT_FALLBACK.axis),
    zeroLine: v("--chart-zero", LIGHT_FALLBACK.zeroLine),
    baseline: v("--chart-zero", LIGHT_FALLBACK.baseline),
    tooltipBg: v("--tooltip-bg", LIGHT_FALLBACK.tooltipBg),
    tooltipText: v("--tooltip-text", LIGHT_FALLBACK.tooltipText),
    tooltipSub: v("--tooltip-text-sub", LIGHT_FALLBACK.tooltipSub),
    tooltipBorder: v("--tooltip-border", LIGHT_FALLBACK.tooltipBorder),
    dotStroke: v("--dot-stroke", LIGHT_FALLBACK.dotStroke),
    greenHalo: hexToRgba(green, isDark ? 0.22 : 0.16),
    redHalo: hexToRgba(red, isDark ? 0.24 : 0.16),
    liabFront: hexToRgba(red, isDark ? 0.46 : 0.5),
    liabTop: hexToRgba(red, isDark ? 0.3 : 0.3),
    liabRight: hexToRgba(redDeep, isDark ? 0.55 : 0.58),
    income: green,
    incomeLabel: greenStrong,
    expense: red,
    expenseLabel: redStrong,
    sankeySources: isDark ? SANKEY_SOURCES_DARK : LIGHT_FALLBACK.sankeySources,
    sankeyIncome: isDark ? "#D9C27E" : LIGHT_FALLBACK.sankeyIncome,
    sankeyExpense: isDark ? "#BBA968" : LIGHT_FALLBACK.sankeyExpense,
    sankeySavings: isDark ? "#8FE6D4" : LIGHT_FALLBACK.sankeySavings,
    sankeyDebt: isDark ? "#C9A98A" : LIGHT_FALLBACK.sankeyDebt,
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(LIGHT_FALLBACK);

  useEffect(() => {
    setColors(read());
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
