import express from "express"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"
import cron from "node-cron"
import storage, { loadRawPapers, archiveNewsSession, loadNewsArchive, purgeOldNewsArchive } from "../src/storage.js"
import { fetchAndRankPapers, fetchMostCited, fetchPapers, rankFetchedPapers, loadKeywords } from "../src/fetcher.js"
import { rankPapers } from "../src/ranker.js"
import { generateComics } from "../src/ranker.js"
import { setExtraTopics } from "../src/scheduler.js"
import { fetchNewsFeeds } from "../src/newsFetcher.js"
import { notify, notifyList } from "../src/notifier.js"
import { PropertyGraph, buildGraph, queryGraph } from "../src/kg.js"

// In-memory caches
let citedCache = { papers: [], fetchedAt: null }
let newsCache  = { items: [], fetchedAt: null, totalFound: 0 }
let newsFetchTimer = null

// Knowledge graph — single in-memory instance, hot-rebuilt after each paper fetch
let kg = new PropertyGraph()
let kgBuilding = false

async function rebuildKG(papers) {
  if (kgBuilding || !papers?.length) return
  kgBuilding = true
  try {
    await buildGraph(papers, kg)
    console.log(`[kg] Graph ready — ${kg.stats().totalNodes} nodes, ${kg.stats().totalEdges} edges`)
  } catch (err) {
    console.error("[kg] Rebuild failed:", err.message)
  } finally {
    kgBuilding = false
  }
}

// Track notified news IDs so we don't spam the same item twice per session
const notifiedNewsIds = new Set()

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
  const topicNote = extraTopics.length ? ` + "${extraTopics.join('", "')}"` : ""
  broadcastSSE({ type: "progress", progress: "fetching", message: `Fetching from arXiv, HuggingFace, CrossRef, DBLP, DOAJ, OpenAlex${topicNote}…` })

  try {
    // ── Phase 1: Fetch all sources in parallel (~10-20s) ──────────
    const [fetchResult, citedResult] = await Promise.allSettled([
      fetchPapers(extraTopics),
      fetchMostCited(),
    ])

    if (citedResult.status === "fulfilled") citedCache = citedResult.value
    if (fetchResult.status !== "fulfilled") throw fetchResult.reason

    const { enriched, totalFetched } = fetchResult.value

    // Save unranked papers immediately so UI can show them right away
    const unrankedSnapshot = {
      papers: enriched.slice(0, 30).map((p, i) => ({ ...p, rank: i + 1, rankScore: null })),
      rawPapers: enriched.slice(30),
      fetchedAt: new Date().toISOString(),
      totalFetched,
    }
    await storage.savePapers(unrankedSnapshot)

    fetchState.progress = "ranking"
    broadcastSSE({
      type: "papers_ready",
      paperCount: unrankedSnapshot.papers.length,
      totalFetched,
      message: `${totalFetched} papers fetched — Claude is ranking…`,
    })

    // ── Phase 2: Rank with Claude (~20-40s with prescore) ─────────
    const ranked = await rankFetchedPapers(enriched, extraTopics)
    ranked.totalFetched = totalFetched
    ranked.nextFetchAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    await storage.savePapers(ranked)

    // Signal done — UI reloads with ranked papers now
    fetchState = { running: false, startedAt: null, progress: "done" }
    broadcastSSE({
      type: "done",
      paperCount: ranked.papers.length,
      fetchedAt: ranked.fetchedAt,
      message: `${ranked.papers.length} papers ranked`,
    })

    // Notify with top trending papers
    try {
      const top = (ranked.papers || []).slice(0, 4)
      if (top.length) {
        const headlines = top.map(p => p.headline || p.title).filter(Boolean)
        const topTopic = top[0]?.topicLabel || "AI Research"
        notifyList(`${ranked.papers.length} Papers Ranked`, headlines, `Trending: ${topTopic}`)
      }
    } catch { /* best-effort */ }

    // ── Phase 3: Comics + KG rebuild in background (non-blocking) ─
    // UI already has ranked papers; these enrich in the background
    generateComics(ranked.papers).then(async withComics => {
      const enrichedResult = { ...ranked, papers: withComics }
      await storage.savePapers(enrichedResult)
      broadcastSSE({ type: "comics_done", message: "Architecture diagrams ready — refresh to view" })
    }).catch(err => console.error("[comics] Background generation failed:", err))

    // Rebuild knowledge graph in background — doesn't block the UI
    rebuildKG(ranked.papers).catch(err => console.error("[kg] Background build failed:", err))

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

// Keywords API — read/write the user-editable keywords.txt
app.get("/api/keywords", async (req, res) => {
  try {
    const keywords = await loadKeywords()
    res.json({ keywords })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post("/api/keywords", async (req, res) => {
  try {
    const { keywords } = req.body
    if (!Array.isArray(keywords)) return res.status(400).json({ error: "keywords must be an array" })
    const { default: fs } = await import("fs/promises")
    const { fileURLToPath } = await import("url")
    const { default: path } = await import("path")
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const kFile = path.join(__dirname, "../src/keywords.txt")
    await fs.writeFile(kFile, keywords.filter(Boolean).join("\n") + "\n", "utf8")
    res.json({ success: true, count: keywords.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
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

// ── Knowledge Graph endpoints ─────────────────────────────────────

// GET  /api/kg/stats  — node/edge counts by type
app.get("/api/kg/stats", (req, res) => {
  res.json({ ...kg.stats(), building: kgBuilding })
})

// GET  /api/kg/graph  — full serialised graph (nodes + edges) for UI visualisation
app.get("/api/kg/graph", (req, res) => {
  res.json({ ...kg.serialize(), building: kgBuilding })
})

// POST /api/kg/rebuild  — hot-reload the graph from current ranked papers
app.post("/api/kg/rebuild", async (req, res) => {
  if (kgBuilding) return res.json({ success: false, message: "Build already in progress" })
  const data = await storage.loadPapers().catch(() => null)
  const papers = data?.papers || []
  if (!papers.length) return res.json({ success: false, message: "No ranked papers available yet" })
  rebuildKG(papers)  // non-blocking — returns immediately
  res.json({ success: true, message: `Rebuilding graph from ${papers.length} papers…` })
})

// POST /api/kg/query  — natural-language question answered over the graph
app.post("/api/kg/query", async (req, res) => {
  const { question } = req.body || {}
  if (!question?.trim()) return res.status(400).json({ error: "question is required" })
  if (kgBuilding) return res.status(503).json({ error: "Graph is being built — try again in a moment" })
  try {
    const result = await queryGraph(kg, question.trim())
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3737, () => {
  console.log("Research Platform running at http://localhost:3737")
  storage.initStorage().catch(err => console.error("[startup] storage init failed:", err.message))

  // Build KG from any papers already on disk at startup
  storage.loadPapers().then(data => {
    if (data?.papers?.length) {
      console.log(`[kg] Startup: rebuilding graph from ${data.papers.length} stored papers`)
      rebuildKG(data.papers).catch(err => console.error("[kg] Startup build failed:", err.message))
    }
  }).catch(() => {})

  async function refreshNews() {
    try {
      const result = await fetchNewsFeeds()
      // Archive the outgoing session BEFORE replacing the cache
      if (newsCache.items?.length) await archiveNewsSession(newsCache)
      newsCache = result
      console.log(`[news] Refreshed: ${result.items.length} items (${result.totalFound} found)`)

      // Notify on high-significance items not yet seen this session
      const fresh = (result.items || []).filter(
        item => item.significance === "high" && item.id && !notifiedNewsIds.has(item.id)
      )
      if (fresh.length) {
        fresh.forEach(item => notifiedNewsIds.add(item.id))
        const headlines = fresh.slice(0, 4).map(item => item.headline || item.title)
        notifyList(
          `Trending Now — ${fresh.length} hot item${fresh.length > 1 ? "s" : ""}`,
          headlines,
          fresh[0]?.source || "AI & Research News"
        )
      }
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
