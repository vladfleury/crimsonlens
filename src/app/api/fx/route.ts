// FX proxy — fetches "TARGET per 1 USD" rates server-side and returns them
// normalized. The client invokes this from useFinanceData (its own client-side
// fallbacks still apply if this route is unreachable).
//
// Sources:
//   - Yahoo Finance quote API (PRIMARY for PLN + EUR) — intraday market rates,
//     updates continuously while FX markets trade. A stable JSON API, not HTML
//     scraping (the old Google Finance scraper broke when their markup changed).
//   - Frankfurter (ECB daily reference) — fallback for PLN + EUR when Yahoo is
//     unreachable. Daily, not intraday, but always available and keyless.
//   - NBRB (National Bank of Belarus) for BYN — the official managed rate,
//     which is the rate that actually matters for BYN.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };
const yahooUrl = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

// frankfurter.app 301-redirects to the canonical .dev host; pin it directly.
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=PLN,EUR";
// parammode=2 selects the currency by ISO code rather than internal Cur_ID.
const NBRB_URL = "https://api.nbrb.by/exrates/rates/USD?parammode=2";

// Intraday quote from Yahoo: "TARGET per 1 USD" for symbols like USDPLN=X.
async function fetchYahoo(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(yahooUrl(symbol), { cache: "no-store", headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// Fetch PLN + EUR from Frankfurter (ECB daily). Returns "TARGET per 1 USD".
async function fetchFrankfurter(): Promise<{ PLN?: number; EUR?: number }> {
  try {
    const res = await fetch(FRANKFURTER_URL, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    const out: { PLN?: number; EUR?: number } = {};
    const pln = data?.rates?.PLN;
    const eur = data?.rates?.EUR;
    if (typeof pln === "number" && pln > 0) out.PLN = pln;
    if (typeof eur === "number" && eur > 0) out.EUR = eur;
    return out;
  } catch {
    return {};
  }
}

// Fetch BYN from NBRB. NBRB quotes BYN per Cur_Scale USD, so divide by scale to
// get "BYN per 1 USD".
async function fetchNbrb(): Promise<number | null> {
  try {
    const res = await fetch(NBRB_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.Cur_OfficialRate;
    const scale =
      typeof data?.Cur_Scale === "number" && data.Cur_Scale > 0 ? data.Cur_Scale : 1;
    if (typeof rate === "number" && rate > 0) return rate / scale;
    return null;
  } catch {
    return null;
  }
}

// Tiny in-memory cache so a burst of polls doesn't hammer the upstreams. Yahoo
// quotes move continuously, so keep it short — the client polls every 60s.
type Cache = { at: number; payload: unknown } | null;
let cache: Cache = null;
const CACHE_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json(cache.payload, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [yahooPln, yahooEur, byn] = await Promise.all([
    fetchYahoo("USDPLN=X"),
    fetchYahoo("USDEUR=X"),
    fetchNbrb(),
  ]);

  let pln = yahooPln;
  let eur = yahooEur;
  let usedFrankfurter = false;
  if (pln === null || eur === null) {
    const fallback = await fetchFrankfurter();
    if (pln === null && fallback.PLN !== undefined) { pln = fallback.PLN; usedFrankfurter = true; }
    if (eur === null && fallback.EUR !== undefined) { eur = fallback.EUR; usedFrankfurter = true; }
  }

  const rates: Record<string, number> = {};
  if (pln !== null) rates.PLN = pln;
  if (eur !== null) rates.EUR = eur;
  if (byn !== null) rates.BYN = byn;

  const sources = [
    yahooPln !== null || yahooEur !== null ? "yahoo" : null,
    usedFrankfurter ? "frankfurter" : null,
    byn !== null ? "nbrb" : null,
  ].filter(Boolean);

  const payload = {
    base: "USD",
    rates, // PLN, EUR, BYN — each is "TARGET per 1 USD"
    fetchedAt: Date.now(),
    source: sources.join("+") || "none",
  };

  if (Object.keys(rates).length > 0) {
    cache = { at: Date.now(), payload };
  }

  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
    status: Object.keys(rates).length > 0 ? 200 : 502,
  });
}
