import cron from "node-cron";
import { fetchAndRankPapers } from "./fetcher.js";
import storage from "./storage.js";

// Shared state so server.js can push latest custom topics into the next scheduled run
let _extraTopics = []
export function setExtraTopics(topics) { _extraTopics = Array.isArray(topics) ? topics.slice(0, 5) : [] }

export function startScheduler() {
  const schedule = "0 */3 * * *";

  const task = cron.schedule(schedule, async () => {
    console.log(`[scheduler] Running scheduled fetch at ${new Date().toISOString()} (custom topics: ${_extraTopics.join(", ") || "none"})`);
    try {
      const result = await fetchAndRankPapers(_extraTopics);
      await storage.savePapers(result);
      console.log(`[scheduler] Saved ${result.papers ? result.papers.length : 0} papers.`);
    } catch (err) {
      console.error("[scheduler] Error during scheduled fetch:", err);
    }
  });

  console.log(`[scheduler] Cron job started with schedule: ${schedule}`);
  return task;
}

export async function runNow(extraTopics = []) {
  console.log(`[scheduler] Running immediate fetch at ${new Date().toISOString()}`);
  const result = await fetchAndRankPapers(extraTopics);
  await storage.savePapers(result);
  console.log(`[scheduler] Saved ${result.papers ? result.papers.length : 0} papers.`);
  return result;
}
