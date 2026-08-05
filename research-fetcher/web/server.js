import express from "express"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"
import cron from "node-cron"
import storage, { loadRawPapers, archiveNewsSession, loadNewsArchive, purgeOldNewsArchive } from "../src/storage.js"
import { fetchAndRankPapers, fetchMostCited } from "../src/fetcher.js"
import { setExtraTopics } from "../src/scheduler.js"
import { fetchNewsFeeds } from "../src/newsFetcher.js"

// In-memory caches
let citedCache = { papers: [], fetchedAt: null }
let newsCache  = { items: [], fetchedAt: null, totalFound: 0 }
let newsFetchTimer = null

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// Track fetch state so UI can show progress without blocking
let fetchState = { running: false, startedAt: null, progress: "idle" }
let lastCustomTopics = []  // persisted across auto-fetch cycles

// SSE clients waiting for fetch progress
const sseClients = new Set()

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try { res.write(msg) } catch (_) { sseClients.delete(res) }
  }
}

async function runFetch(extraTopics = []) {
  if (fetchState.running) return
  fetchState = { running: true, startedAt: new Date().toISOString(), progress: "fetching" }
  broadcastSSE({ type: "progress", progress: "fetching", message: `Fetching papers from arXiv, HuggingFace & Semantic Scholar${extraTopics.length ? ` + "${extraTopics.join('", "')}"` : ""}…` })
  try {
    // Fetch latest + cited in parallel
    const [result, cited] = await Promise.allSettled([
      fetchAndRankPapers(extraTopics),
      fetchMostCited(),
    ])
    fetchState.progress = "ranking"
    broadcastSSE({ type: "progress", progress: "ranking", message: "Claude Opus is ranking & summarising papers…" })
    if (result.status === "fulfilled") await storage.savePapers(result.value)
    if (cited.status === "fulfilled") citedCache = cited.value
    fetchState = { running: false, startedAt: null, progress: "done" }
    broadcastSSE({
      type: "done",
      paperCount: result.status === "fulfilled" ? result.value.papers.length : 0,
      fetchedAt: result.status === "fulfilled" ? result.value.fetchedAt : null
    })
  } catch (err) {
    fetchState = { running: false, startedAt: null, progress: "error" }
    broadcastSSE({ type: "error", message: err.message })
  }
}

// SSE stream for refresh progress
app.get("/api/progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()
  // Send current state immediately
  res.write(`data: ${JSON.stringify({ type: "state", ...fetchState })}\n\n`)
  sseClients.add(res)
  req.on("close", () => sseClients.delete(res))
})

// Non-blocking refresh — returns immediately
app.post("/api/refresh", (req, res) => {
  if (fetchState.running) {
    return res.json({ success: false, message: "Fetch already in progress", running: true })
  }
  const extraTopics = Array.isArray(req.body?.customTopics) ? req.body.customTopics.slice(0, 5) : []
  if (extraTopics.length) {
    lastCustomTopics = extraTopics
    setExtraTopics(extraTopics)  // scheduler picks these up on next cron run too
  }
  runFetch(extraTopics) // fire and forget
  res.json({ success: true, message: "Fetch started", running: true })
})

app.get("/api/papers", async (req, res) => {
  try {
    const data = await storage.loadPapers()
    if (!data) return res.json({ papers: [], fetchedAt: null, totalFetched: 0, nextFetchAt: null })
    let papers = data.papers || []
    if (req.query.topic) {
      const t = req.query.topic.toLowerCase()
      papers = papers.filter(p => (p.topicLabel || p.topic || "").toLowerCase() === t)
    }
    const limit = parseInt(req.query.limit, 10) || 0
    if (limit > 0) papers = papers.slice(0, limit)
    res.json({ papers, fetchedAt: data.fetchedAt, totalFetched: data.totalFetched, nextFetchAt: data.nextFetchAt })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Raw (unranked) papers as fetched from sources
app.get("/api/raw-papers", async (req, res) => {
  try {
    const papers = await loadRawPapers()
    res.json({ papers, count: Array.isArray(papers) ? papers.length : 0 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/api/cited", (req, res) => {
  res.json(citedCache)
})

app.get("/api/topics", async (req, res) => {
  try { res.json(await storage.getTopics()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/api/status", async (req, res) => {
  try {
    const data = await storage.loadPapers()
    if (!data) return res.json({ fetchedAt: null, totalFetched: 0, nextFetchAt: null, paperCount: 0, fetchRunning: fetchState.running })
    res.json({
      fetchedAt: data.fetchedAt, totalFetched: data.totalFetched,
      nextFetchAt: data.nextFetchAt, paperCount: (data.papers || []).length,
      fetchRunning: fetchState.running
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/api/paper/:id", async (req, res) => {
  try {
    const data = await storage.loadPapers()
    const paper = (data?.papers || []).find(p => p.id === req.params.id)
    if (!paper) return res.status(404).json({ error: "Paper not found" })
    res.json(paper)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/api/news", (req, res) => {
  res.json(newsCache)
})

// Returns archived sessions, newest-first. ?limit=N (default 20, max 90)
app.get("/api/news/archive", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 90)
    const archive = await loadNewsArchive(limit)
    res.json({ sessions: archive, total: archive.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.listen(3737, () => {
  console.log("Research Platform running at http://localhost:3737")
  storage.initStorage().catch(err => console.error("[startup] storage init failed:", err.message))

  // Initial news + cited fetch on startup
  async function refreshNews() {
    try {
      const result = await fetchNewsFeeds()
      // Archive the outgoing session BEFORE replacing the cache
      if (newsCache.items?.length) await archiveNewsSession(newsCache)
      newsCache = result
      console.log(`[news] Refreshed: ${result.items.length} items (${result.totalFound} found)`)
    } catch (err) {
      console.error("[news] Refresh failed:", err.message)
    }
  }

  fetchMostCited()
    .then(r => { citedCache = r; console.log(`[startup] Cited: ${r.papers.length} papers`) })
    .catch(err => console.error("[startup] Cited failed:", err.message))

  refreshNews()

  // Auto-refresh news every 5 minutes
  if (newsFetchTimer) clearInterval(newsFetchTimer)
  newsFetchTimer = setInterval(refreshNews, 5 * 60 * 1000)
  console.log("[news] Auto-refresh every 5 minutes")

  // Daily cleanup at 02:17 AM — purge news archive entries older than 3 days
  // Off-minute to avoid bunching with other scheduled jobs
  cron.schedule("17 2 * * *", async () => {
    const removed = await purgeOldNewsArchive()
    console.log(`[archive] Nightly cleanup — purged ${removed} session(s) older than 3 days`)
  })
  console.log("[archive] Nightly cleanup scheduled at 02:17 AM")
})
