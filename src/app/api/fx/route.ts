// Google Finance proxy — scrapes USD-X quote pages server-side and returns
// normalized "TARGET per 1 USD" rates. The client invokes this from
// useFinanceData. Falls back is handled client-side (Frankfurter + NBRB).
//
// We hit Google directly with a desktop User-Agent and the consent cookie so
// EU IPs don't get bounced to the consent page.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAIRS = [
  { code: "PLN", url: "https://www.google.com/finance/quote/USD-PLN" },
  { code: "EUR", url: "https://www.google.com/finance/quote/USD-EUR" },
  { code: "BYN", url: "https://www.google.com/finance/quote/USD-BYN" },
] as const;

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Cookie: "CONSENT=YES+1",
};

function parseRate(html: string): number | null {
  // Primary: <div ... data-last-price="3.60242616">
  const m1 = html.match(/data-last-price="([\d.]+)"/);
  if (m1) {
    const n = parseFloat(m1[1]);
    if (!isNaN(n) && n > 0) return n;
  }
  // Fallback: <div class="YMlKec fxKbKc">3.6024</div>
  const m2 = html.match(/class="YMlKec fxKbKc"[^>]*>([\d.,]+)/);
  if (m2) {
    const n = parseFloat(m2[1].replace(/,/g, ""));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

async function fetchOne(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: REQUEST_HEADERS,
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseRate(html);
  } catch {
    return null;
  }
}

// Tiny in-memory cache so a burst of polls doesn't hammer Google. Google's
// quote page already updates ~every minute, so 30s is plenty fresh.
type Cache = { at: number; payload: unknown } | null;
let cache: Cache = null;
const CACHE_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json(cache.payload, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const results = await Promise.all(
    PAIRS.map(async ({ code, url }) => {
      const rate = await fetchOne(url);
      return [code, rate] as const;
    })
  );

  const rates: Record<string, number> = {};
  for (const [code, rate] of results) {
    if (rate !== null) rates[code] = rate;
  }

  const payload = {
    base: "USD",
    rates, // PLN, EUR, BYN — each is "TARGET per 1 USD"
    fetchedAt: Date.now(),
    source: "google-finance",
  };

  if (Object.keys(rates).length > 0) {
    cache = { at: Date.now(), payload };
  }

  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
    status: Object.keys(rates).length > 0 ? 200 : 502,
  });
}
