import YahooFinance from "yahoo-finance2";
import type { Quote } from "../types.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const result = await yf.quote(symbol);
    if (!result || !result.regularMarketPrice) return null;

    return {
      symbol,
      name: result.longName ?? result.shortName ?? symbol,
      price: result.regularMarketPrice,
      previousClose: result.regularMarketPreviousClose ?? result.regularMarketPrice,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      volume: result.regularMarketVolume ?? 0,
      marketCap: result.marketCap ?? undefined,
      currency: result.currency ?? "USD",
      exchange: result.fullExchangeName ?? "",
      timestamp: new Date(),
    };
  } catch {
    return null;
  }
}

// Sequential batching with a small delay to avoid Yahoo Finance rate limits
export async function fetchBatchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const results = new Map<string, Quote>();
  const chunkSize = 10;

  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (sym) => {
        const q = await fetchQuote(sym);
        if (q) results.set(sym, q);
      })
    );
    // 300ms between chunks — 70 symbols in ~2s
    if (i + chunkSize < symbols.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

export async function fetchMomentum(symbol: string): Promise<number> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const history = await yf.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!history || history.length < 2) return 0;
    const oldest = history[0].close;
    const newest = history[history.length - 1].close;
    return ((newest - oldest) / oldest) * 100;
  } catch {
    return 0;
  }
}

export async function fetchMultipleMomentum(symbols: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  // Sequential to avoid rate limits — momentum is background data, latency is fine
  for (const sym of symbols) {
    const m = await fetchMomentum(sym);
    results.set(sym, m);
    await new Promise((r) => setTimeout(r, 150));
  }
  return results;
}

// Live EUR/USD rate — EURUSD=X on Yahoo Finance
// Returns how many EUR 1 USD buys (e.g. 0.92 means $1 = €0.92)
let cachedEurRate = 0.92; // fallback
let eurRateFetchedAt = 0;

export async function fetchEurUsdRate(): Promise<number> {
  // Cache for 60s — don't need sub-second FX accuracy
  if (Date.now() - eurRateFetchedAt < 60_000) return cachedEurRate;
  try {
    const r = await yf.quote("EURUSD=X");
    if (r?.regularMarketPrice && r.regularMarketPrice > 0) {
      // EURUSD=X gives how many USD 1 EUR buys (e.g. 1.08)
      // We want how many EUR 1 USD buys → invert
      cachedEurRate = 1 / r.regularMarketPrice;
      eurRateFetchedAt = Date.now();
    }
  } catch {
    // keep cached value
  }
  return cachedEurRate;
}
