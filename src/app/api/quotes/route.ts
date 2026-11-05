// Stock / ETF quotes for the portfolio — "price per share" in the listing's
// own currency, via Yahoo Finance's quote API (the same pipeline as /api/fx).
// Symbols come from the client: US listings as-is (AAPL), EUR UCITS ETFs via
// Xetra (VUAA.DE). Nothing is stored; the client polls every 60s.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };
const yahooUrl = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

type Quote = { price: number; currency: string; name: string | null; asOf: number };

async function fetchYahooQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(yahooUrl(symbol), { cache: "no-store", headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
    return {
      price,
      currency: typeof meta.currency === "string" ? meta.currency : "USD",
      name: typeof meta.shortName === "string" ? meta.shortName.trim() : null,
      asOf: typeof meta.regularMarketTime === "number" ? meta.regularMarketTime * 1000 : Date.now(),
    };
  } catch {
    return null;
  }
}

// Per-symbol cache so a burst of polls doesn't hammer Yahoo.
const cache = new Map<string, { at: number; quote: Quote }>();
const CACHE_MS = 60_000;
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-=^]{0,19}$/;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)))
  ).slice(0, 50);

  const quotes: Record<string, Quote> = {};
  const now = Date.now();
  await Promise.all(
    symbols.map(async (symbol) => {
      const hit = cache.get(symbol);
      if (hit && now - hit.at < CACHE_MS) {
        quotes[symbol] = hit.quote;
        return;
      }
      const quote = await fetchYahooQuote(symbol);
      if (quote) {
        cache.set(symbol, { at: now, quote });
        quotes[symbol] = quote;
      } else if (hit) {
        quotes[symbol] = hit.quote; // stale beats nothing
      }
    })
  );

  return Response.json(
    { quotes, fetchedAt: now },
    { headers: { "Cache-Control": "no-store" }, status: symbols.length === 0 || Object.keys(quotes).length > 0 ? 200 : 502 }
  );
}
