// Shared helpers for the investment portfolio UI.

export const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", PLN: "zł", BYN: "Br" };

// "$1,234.56", "€27.03"; negatives carry a true minus before the symbol.
export function fmtMoney(n: number, currency = "USD", decimals = 2): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 ? "−" : "") + sym + abs;
}

// "+$1.29" / "−$27.15"
export function fmtSigned(n: number, currency = "USD", decimals = 2): string {
  return (n >= 0 ? "+" : "") + fmtMoney(n, currency, decimals);
}

export function fmtPct(n: number, decimals = 2): string {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(decimals) + "%";
}

// Stable identity colors per holding rank (largest position first).
export function holdingColors(isDark: boolean): string[] {
  return isDark
    ? ["#2BB89D", "#8FA3BF", "#D9C27E", "#8FE6D4", "#A99BD9", "#6E7683"]
    : ["#188A74", "#1F2A3A", "#D6A636", "#7AD6C2", "#8E7CC3", "#9A9A9F"];
}
