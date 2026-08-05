import Anthropic from "@anthropic-ai/sdk";
import type { Quote, RankedAsset, MarketSnapshot } from "../types.js";
import { store } from "../data/store.js";
import { ALL_SYMBOLS } from "../data/assets.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
});

const MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "claude-opus-4-8";

// ── Rank and analyze all assets using Claude Opus ─────────────────────────────

export async function analyzeAndRankAssets(
  quotes: Map<string, Quote>,
  momentumMap: Map<string, number>
): Promise<RankedAsset[]> {
  if (quotes.size === 0) return [];

  // Build a compact market summary for Claude to analyze
  const quoteSummary = ALL_SYMBOLS.filter((a) => quotes.has(a.symbol))
    .map((a) => {
      const q = quotes.get(a.symbol)!;
      const momentum = momentumMap.get(a.symbol) ?? 0;
      return (
        `${a.symbol} (${a.name}, ${a.type.toUpperCase()}): ` +
        `price=${q.price.toFixed(2)} ${q.currency}, ` +
        `change=${q.changePercent.toFixed(2)}%, ` +
        `volume=${q.volume.toLocaleString()}, ` +
        `5d_momentum=${momentum.toFixed(2)}%, ` +
        `marketCap=${q.marketCap ? (q.marketCap / 1e9).toFixed(1) + "B" : "N/A"}`
      );
    })
    .join("\n");

  const prompt = `You are an expert financial analyst specializing in stocks, ETFs, and bonds available to retail investors in Germany via Scalable Capital.

Analyze the following real-time market data and rank the TOP 15 assets in each category (stocks, ETFs, bonds) that represent the best buying opportunities RIGHT NOW for long-term wealth building.

Market Data (as of now):
${quoteSummary}

For each ranked asset, evaluate:
1. Price momentum and trend direction
2. Volume relative to norm (volume surge = high interest)
3. Risk-adjusted return potential
4. Suitability for a German retail investor (EUR-denominated preferred, but USD OK if excellent)
5. Long-term wealth building potential

Return a JSON array of ranked assets. Each asset must have:
{
  "rank": number (1=best),
  "symbol": string,
  "type": "stock" | "etf" | "bond",
  "signal": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "trendScore": number (0-100, higher=better trend),
  "momentum": number (5-day % change),
  "reasoning": string (2-3 sentences why this is a good/bad buy NOW),
  "scalableCapitalAvailable": true
}

Return ONLY valid JSON array, no markdown, no explanation outside the array.`;

  try {
    // Use non-streaming with a hard 60s timeout — thinking disabled to avoid proxy timeouts
    const response = await Promise.race([
      client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Claude ranking timed out after 60s")), 60_000)
      ),
    ]) as ReturnType<typeof client.messages.create> extends Promise<infer T> ? T : never;

    const response2 = response as { content: Array<{ type: string; text?: string }> };
    const textBlock = response2.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text) return buildFallbackRankings(quotes, momentumMap);

    let jsonText = textBlock.text.trim();
    // Strip markdown code fences
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    // Extract just the JSON array — find first [ to last ] to tolerate any surrounding prose
    const start = jsonText.indexOf("[");
    const end = jsonText.lastIndexOf("]");
    if (start === -1 || end === -1) {
      console.error("[analyzer] No JSON array found in response");
      return buildFallbackRankings(quotes, momentumMap);
    }
    jsonText = jsonText.slice(start, end + 1);

    const parsed: Array<{
      rank: number;
      symbol: string;
      type: "stock" | "etf" | "bond";
      signal: RankedAsset["signal"];
      trendScore: number;
      momentum: number;
      reasoning: string;
      scalableCapitalAvailable: boolean;
    }> = JSON.parse(jsonText);

    return parsed.map((item) => {
      const q = quotes.get(item.symbol);
      const assetMeta = ALL_SYMBOLS.find((a) => a.symbol === item.symbol);
      return {
        rank: item.rank,
        symbol: item.symbol,
        name: q?.name ?? assetMeta?.name ?? item.symbol,
        type: item.type,
        price: q?.price ?? 0,
        changePercent: q?.changePercent ?? 0,
        volume: q?.volume ?? 0,
        marketCap: q?.marketCap,
        trendScore: item.trendScore,
        momentum: item.momentum,
        signal: item.signal,
        reasoning: item.reasoning,
        scalableCapitalAvailable: item.scalableCapitalAvailable ?? true,
        currency: q?.currency ?? "USD",
        exchange: q?.exchange ?? "",
        lastUpdated: new Date(),
      };
    });
  } catch (err) {
    console.error("[analyzer] Claude ranking failed:", err);
    return buildFallbackRankings(quotes, momentumMap);
  }
}

// ── Determine market sentiment ────────────────────────────────────────────────

export async function analyzeMarketSentiment(
  rankings: RankedAsset[]
): Promise<"bullish" | "bearish" | "neutral"> {
  if (rankings.length === 0) return "neutral";

  const buySignals = rankings.filter(
    (r) => r.signal === "strong_buy" || r.signal === "buy"
  ).length;
  const sellSignals = rankings.filter(
    (r) => r.signal === "strong_sell" || r.signal === "sell"
  ).length;

  const avgChange =
    rankings.reduce((sum, r) => sum + r.changePercent, 0) / rankings.length;

  if (buySignals > sellSignals * 2 && avgChange > 0.5) return "bullish";
  if (sellSignals > buySignals * 2 && avgChange < -0.5) return "bearish";
  return "neutral";
}

// ── Build full market snapshot ─────────────────────────────────────────────────

export async function buildMarketSnapshot(
  quotes: Map<string, Quote>,
  momentumMap: Map<string, number>,
  eurUsdRate = 0.92
): Promise<MarketSnapshot> {
  const allRanked = await analyzeAndRankAssets(quotes, momentumMap);

  const topStocks = allRanked.filter((r) => r.type === "stock").slice(0, 15);
  const topETFs = allRanked.filter((r) => r.type === "etf").slice(0, 15);
  const topBonds = allRanked.filter((r) => r.type === "bond").slice(0, 15);

  const sentiment = await analyzeMarketSentiment(allRanked);
  const alerts = store.getAlerts(false, 50);

  store.setRankings(allRanked);

  return {
    topStocks,
    topETFs,
    topBonds,
    alerts,
    marketSentiment: sentiment,
    lastUpdated: new Date(),
    analysisModel: MODEL,
    eurUsdRate,
  };
}

// ── Ask Claude a freeform question about the market ───────────────────────────

export async function askMarketQuestion(question: string): Promise<string> {
  const snapshot = store.getSnapshot();
  const recentAlerts = store.getAlerts(false, 10);

  let context = "No market data available yet.";
  if (snapshot) {
    const topAssets = [
      ...snapshot.topStocks.slice(0, 5),
      ...snapshot.topETFs.slice(0, 5),
    ];
    context =
      `Market sentiment: ${snapshot.marketSentiment}\n` +
      `Last updated: ${snapshot.lastUpdated.toISOString()}\n\n` +
      `Top trending assets:\n` +
      topAssets
        .map(
          (a) =>
            `- ${a.symbol} (${a.name}): ${a.changePercent.toFixed(2)}%, signal=${a.signal}, ${a.reasoning}`
        )
        .join("\n") +
      (recentAlerts.length > 0
        ? `\n\nRecent alerts:\n` +
          recentAlerts
            .slice(0, 5)
            .map((a) => `- [${a.severity.toUpperCase()}] ${a.message}`)
            .join("\n")
        : "");
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a financial advisor for a German retail investor using Scalable Capital.\n\nCurrent market context:\n${context}\n\nUser question: ${question}\n\nProvide a clear, actionable answer. Focus on assets available on Scalable Capital in Germany.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text"
    ? textBlock.text
    : "Unable to generate analysis.";
}

// ── Fallback ranking (pure heuristic, no AI) ──────────────────────────────────

function buildFallbackRankings(
  quotes: Map<string, Quote>,
  momentumMap: Map<string, number>
): RankedAsset[] {
  return ALL_SYMBOLS.filter((a) => quotes.has(a.symbol))
    .map((a) => {
      const q = quotes.get(a.symbol)!;
      const momentum = momentumMap.get(a.symbol) ?? 0;
      const trendScore = Math.min(
        100,
        Math.max(0, 50 + q.changePercent * 5 + momentum * 2)
      );
      return {
        rank: 0,
        symbol: a.symbol,
        name: q.name,
        type: a.type,
        price: q.price,
        changePercent: q.changePercent,
        volume: q.volume,
        marketCap: q.marketCap,
        trendScore,
        momentum,
        signal: (q.changePercent > 2 ? "buy" : q.changePercent < -2 ? "sell" : "hold") as RankedAsset["signal"],
        reasoning: "Heuristic ranking based on price change and momentum.",
        scalableCapitalAvailable: true,
        currency: q.currency,
        exchange: q.exchange,
        lastUpdated: new Date(),
      };
    })
    .sort((a, b) => b.trendScore - a.trendScore)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}
