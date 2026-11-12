import cron from "node-cron";
import { fetchAndRankPapers } from "./fetcher.js";
import storage from "./storage.js";

// Shared state so server.js can push latest custom topics into the next scheduled run
let _extraTopics = []
export function setExtraTopics(topics) { _extraTopics = Array.isArray(topics) ? topics.slice(0, 5) : [] }

function nextCronDate(schedule) {
  // For "0 */3 * * *" — compute the next occurrence relative to now
  const now = new Date()
  const h = now.getHours()
  const nextH = (Math.floor(h / 3) + 1) * 3
  const next = new Date(now)
  if (nextH >= 24) {
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
  } else {
    next.setHours(nextH, 0, 0, 0)
  }
  return next.toISOString()
}

export function startScheduler() {
  const schedule = "0 */3 * * *";

  const task = cron.schedule(schedule, async () => {
    console.log(`[scheduler] Running scheduled fetch at ${new Date().toISOString()} (custom topics: ${_extraTopics.join(", ") || "none"})`);
    try {
      const result = await fetchAndRankPapers(_extraTopics);
      result.nextFetchAt = nextCronDate(schedule);
      await storage.savePapers(result);
      console.log(`[scheduler] Saved ${result.papers ? result.papers.length : 0} papers.`);
    } catch (err) {
      console.error("[scheduler] Error during scheduled fetch:", err);
    }
  });

  // Write nextFetchAt into current storage so the UI countdown starts immediately
  storage.loadPapers().then(data => {
    if (data) storage.savePapers({ ...data, nextFetchAt: nextCronDate(schedule) })
  }).catch(() => {})

  console.log(`[scheduler] Cron job started with schedule: ${schedule}`);
  return task;
}

export async function runNow(extraTopics = []) {
  console.log(`[scheduler] Running immediate fetch at ${new Date().toISOString()}`);
  const result = await fetchAndRankPapers(extraTopics);
  result.nextFetchAt = nextCronDate("0 */3 * * *");
  await storage.savePapers(result);
  console.log(`[scheduler] Saved ${result.papers ? result.papers.length : 0} papers.`);
  return result;
}
