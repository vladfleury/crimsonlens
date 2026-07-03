// FX proxy — fetches "TARGET per 1 USD" rates server-side and returns them
// normalized. The client invokes this from useFinanceData (its own client-side
// fallbacks still apply if this route is unreachable).
//
// Sources (stable, free, CORS-friendly, no scraping):
//   - Frankfurter (ECB daily reference rates) for PLN + EUR.
//   - NBRB (National Bank of the Republic of Belarus) for BYN.
// We previously scraped Google Finance, but its HTML selectors kept breaking.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// frankfurter.app 301-redirects to the canonical .dev host; pin it directly.
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=PLN,EUR";
// parammode=2 selects the currency by ISO code rather than internal Cur_ID.
const NBRB_URL = "https://api.nbrb.by/exrates/rates/USD?parammode=2";

// Fetch PLN + EUR from Frankfurter. Returns "TARGET per 1 USD" (from=USD).
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

// Tiny in-memory cache so a burst of polls doesn't hammer the upstreams. The
// underlying sources update at most daily, so 30s is plenty fresh.
type Cache = { at: number; payload: unknown } | null;
let cache: Cache = null;
const CACHE_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json(cache.payload, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [frankfurter, byn] = await Promise.all([fetchFrankfurter(), fetchNbrb()]);

  const rates: Record<string, number> = {};
  if (frankfurter.PLN !== undefined) rates.PLN = frankfurter.PLN;
  if (frankfurter.EUR !== undefined) rates.EUR = frankfurter.EUR;
  if (byn !== null) rates.BYN = byn;

  const payload = {
    base: "USD",
    rates, // PLN, EUR, BYN — each is "TARGET per 1 USD"
    fetchedAt: Date.now(),
    source: "frankfurter+nbrb",
  };

  if (Object.keys(rates).length > 0) {
    cache = { at: Date.now(), payload };
  }

  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
    status: Object.keys(rates).length > 0 ? 200 : 502,
  });
}
