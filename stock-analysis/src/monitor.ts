import "dotenv/config";
import { ALL_SYMBOLS } from "./data/assets.js";
import { fetchBatchQuotes, fetchMultipleMomentum, fetchEurUsdRate } from "./data/yahooFinance.js";
import { store } from "./data/store.js";
import { buildMarketSnapshot } from "./ai/analyzer.js";
import { detectAlerts, sendSystemNotification } from "./notifier.js";
import type { Quote } from "./types.js";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "5000", 10);
// Full AI re-ranking every N polls
const AI_RANK_EVERY_N_POLLS = 12; // ~1 minute if polling every 5s

let pollCount = 0;
let cycleInFlight = false;
let previousQuotes: Map<string, Quote> = new Map();
let momentumCache: Map<string, number> = new Map();
let monitorTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let rankingInProgress = false;

export async function startMonitor(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  console.log(`[monitor] Starting — polling every ${POLL_INTERVAL_MS}ms, AI rank every ${AI_RANK_EVERY_N_POLLS} polls`);

  // Kick off first cycle without blocking server startup
  runCycle().catch(console.error);

  monitorTimer = setInterval(() => {
    runCycle().catch(console.error);
  }, POLL_INTERVAL_MS);
}

export function stopMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  isRunning = false;
  console.log("[monitor] Stopped.");
}

async function runCycle(): Promise<void> {
  if (cycleInFlight) return; // don't stack cycles
  cycleInFlight = true;
  pollCount++;
  const thisPoll = pollCount;
  const symbols = ALL_SYMBOLS.map((a) => a.symbol);

  try {
    const quotes = await fetchBatchQuotes(symbols);
    store.setQuotes(quotes);

    const newAlerts = detectAlerts(quotes, previousQuotes);
    for (const alert of newAlerts) {
      await sendSystemNotification(alert);
    }
    previousQuotes = new Map(quotes);

    const shouldRank = (thisPoll === 1 || thisPoll % AI_RANK_EVERY_N_POLLS === 0) && !rankingInProgress;
    if (shouldRank) {
      rankingInProgress = true;
      console.log(`[monitor] Poll #${thisPoll} — running AI ranking...`);

      fetchMultipleMomentum(symbols.filter((s) => quotes.has(s)))
        .then((m) => { momentumCache = m; })
        .catch(() => {});

      const eurUsdRate = await fetchEurUsdRate();
      const snapshot = await buildMarketSnapshot(quotes, momentumCache, eurUsdRate);
      store.setSnapshot(snapshot);
      rankingInProgress = false;
      console.log(
        `[monitor] AI ranking done. Sentiment: ${snapshot.marketSentiment}. ` +
        `Top stock: ${snapshot.topStocks[0]?.symbol ?? "N/A"} (${snapshot.topStocks[0]?.signal ?? "N/A"})`
      );
    } else {
      const current = store.getSnapshot();
      if (current) {
        const patch = (assets: typeof current.topStocks) =>
          assets.map((a) => {
            const q = quotes.get(a.symbol);
            return q ? { ...a, price: q.price, changePercent: q.changePercent, volume: q.volume, lastUpdated: new Date() } : a;
          });
        const eurUsdRate = await fetchEurUsdRate();
        store.setSnapshot({
          ...current,
          topStocks: patch(current.topStocks),
          topETFs: patch(current.topETFs),
          topBonds: patch(current.topBonds),
          alerts: store.getAlerts(false, 50),
          eurUsdRate,
          lastUpdated: new Date(),
        });
      }
    }
  } catch (err) {
    rankingInProgress = false;
    console.error("[monitor] Cycle error:", err);
  } finally {
    cycleInFlight = false;
  }
}
