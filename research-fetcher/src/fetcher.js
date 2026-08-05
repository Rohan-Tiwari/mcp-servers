import axios from "axios"
import xml2js from "xml2js"
import { rankPapers, summariseCitedPapers } from "./ranker.js"

const { parseStringPromise } = xml2js

// ── Topic keyword map ───────────────────────────────────────────
const TOPICS = {
  "LLMs": ["language model", "llm", "gpt", "bert", "transformer", "tokenizer", "fine-tun", "instruct", "prompt"],
  "Agents": ["agent", "harness", "autonomous", "multi-agent", "agentic", "tool use", "planning", "reasoning", "orchestration"],
  "Performance": ["optimization", "efficiency", "inference", "latency", "throughput", "benchmark", "speed", "acceleration"],
  "Algorithms": ["algorithm", "complexity", "graph", "search", "sorting", "dynamic programming", "approximation"],
  "Distributed": ["distributed", "federated", "consensus", "fault tolerant", "replication", "sharding", "cluster"],
  "Kubernetes": ["kubernetes", "k8s", "container", "pod", "microservice", "orchestration", "docker", "cloud native"],
  "MLInfra": ["training", "infrastructure", "pipeline", "mlops", "dataset", "batch", "gpu", "tpu", "model serving"],
  "AI": ["neural", "deep learning", "machine learning", "artificial intelligence", "reinforcement", "computer vision", "nlp"],
}

export function assignTopic(title, abstract) {
  const text = `${title} ${abstract}`.toLowerCase()
  for (const [topic, keywords] of Object.entries(TOPICS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return topic
    }
  }
  return "AI"
}

function titleHash(title) {
  let h = 0
  for (let i = 0; i < title.length; i++) h += title.charCodeAt(i)
  return `hash-${h}`
}

function normalizeTitle(title) {
  return (title || "").toLowerCase().replace(/\s+/g, " ").trim()
}

// ── Source 1: arXiv broad category sweep ────────────────────────
async function fetchArxiv() {
  const cats = "cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.MA+OR+cat:cs.DC+OR+cat:cs.NI+OR+cat:cs.SE+OR+cat:cs.CL+OR+cat:cs.CR"
  const url = `https://export.arxiv.org/api/query?search_query=${cats}&sortBy=submittedDate&sortOrder=descending&max_results=50`
  const res = await axios.get(url, { timeout: 20000 })
  const parsed = await parseStringPromise(res.data)
  const entries = parsed.feed.entry || []
  return entries.map(e => {
    const idRaw = e.id[0]
    const id = idRaw.split("/").pop()
    const title = (e.title[0] || "").replace(/\s+/g, " ").trim()
    const abstract = (e.summary[0] || "").replace(/\s+/g, " ").trim()
    const authors = (e.author || []).map(a => a.name[0])
    const publishedDate = e.published[0]
    const links = e.link || []
    const htmlLink = links.find(l => l.$ && l.$.type === "text/html")
    const url2 = htmlLink ? htmlLink.$.href : `https://arxiv.org/abs/${id}`
    return { id, title, abstract, authors, publishedDate, url: url2, source: "arXiv" }
  })
}

// ── Source 2: arXiv keyword queries for Rohan's core topics ─────
// Fires targeted searches so RAG, agent harness, agentic systems
// always get representation even if category sweep misses them
async function fetchArxivTargeted() {
  const queries = [
    "retrieval augmented generation RAG",
    "LLM agent harness orchestration",
    "agentic AI multi-agent system",
    "tool use planning language model",
    "enterprise large language model",
  ]
  const seen = new Set()
  const papers = []
  for (const q of queries) {
    try {
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&sortBy=relevance&sortOrder=descending&max_results=12`
      const res = await axios.get(url, { timeout: 15000 })
      const parsed = await parseStringPromise(res.data)
      for (const e of parsed.feed.entry || []) {
        const idRaw = e.id[0]
        const id = idRaw.split("/").pop()
        if (seen.has(id)) continue
        seen.add(id)
        const title = (e.title[0] || "").replace(/\s+/g, " ").trim()
        const abstract = (e.summary[0] || "").replace(/\s+/g, " ").trim()
        const authors = (e.author || []).map(a => a.name[0])
        const publishedDate = e.published[0]
        const links = e.link || []
        const htmlLink = links.find(l => l.$ && l.$.type === "text/html")
        const url2 = htmlLink ? htmlLink.$.href : `https://arxiv.org/abs/${id}`
        papers.push({ id, title, abstract, authors, publishedDate, url: url2, source: `arXiv · ${q.split(" ").slice(0,3).join(" ")}` })
      }
    } catch (err) {
      console.error(`[arxiv-targeted] "${q}" failed:`, err.message)
    }
    await new Promise(r => setTimeout(r, 600)) // be polite to arXiv
  }
  return papers
}

// ── Source 2: HuggingFace Daily Papers ──────────────────────────
async function fetchHuggingFace() {
  const res = await axios.get("https://huggingface.co/api/daily_papers?limit=30", { timeout: 15000 })
  const items = res.data || []
  return items.map(item => {
    const p = item.paper || {}
    const id = p.id || titleHash(p.title || "")
    return {
      id,
      title: p.title || "",
      abstract: p.summary || "",
      authors: (p.authors || []).map(a => a.name || a),
      publishedDate: p.publishedAt || item.publishedAt || "",
      url: `https://arxiv.org/abs/${id}`,
      source: "HuggingFace Daily",
    }
  })
}

// ── Source 3: arXiv keyword search for custom topics ────────────
// Replaces Semantic Scholar which rate-limits aggressively
async function fetchArxivKeyword(topic) {
  const q = encodeURIComponent(`all:${topic}`)
  const url = `https://export.arxiv.org/api/query?search_query=${q}&sortBy=relevance&sortOrder=descending&max_results=15`
  const res = await axios.get(url, { timeout: 15000 })
  const parsed = await parseStringPromise(res.data)
  const entries = parsed.feed.entry || []
  return entries.map(e => {
    const idRaw = e.id[0]
    const id = idRaw.split("/").pop()
    const title = (e.title[0] || "").replace(/\s+/g, " ").trim()
    const abstract = (e.summary[0] || "").replace(/\s+/g, " ").trim()
    const authors = (e.author || []).map(a => a.name[0])
    const publishedDate = e.published[0]
    const links = e.link || []
    const htmlLink = links.find(l => l.$ && l.$.type === "text/html")
    const url2 = htmlLink ? htmlLink.$.href : `https://arxiv.org/abs/${id}`
    return { id, title, abstract, authors, publishedDate, url: url2, source: `arXiv · ${topic}` }
  })
}

// ── Main fetch + rank ────────────────────────────────────────────
export async function fetchAndRankPapers(extraTopics = []) {
  // All paper fetches in parallel (arXiv targeted runs sequentially internally)
  const baseResults = await Promise.allSettled([
    fetchArxiv(),
    fetchHuggingFace(),
    fetchArxivTargeted(),
  ])

  // Fetch custom topic keyword searches in parallel
  const topicResults = extraTopics.length
    ? await Promise.allSettled(extraTopics.map(t => fetchArxivKeyword(t)))
    : []

  // Combine all successful results
  const allPapers = []
  for (const r of [...baseResults, ...topicResults]) {
    if (r.status === "fulfilled") allPapers.push(...r.value)
  }

  // Deduplicate by normalised title
  const seen = new Set()
  const deduped = []
  for (const p of allPapers) {
    const key = normalizeTitle(p.title)
    if (key && !seen.has(key)) {
      seen.add(key)
      deduped.push(p)
    }
  }

  // Enrich with topic + id
  const enriched = deduped.map(p => ({
    ...p,
    id: p.id || titleHash(p.title),
    topic: assignTopic(p.title, p.abstract),
  }))

  // Rank top 40 with Claude
  const rankedPapers = await rankPapers(enriched, extraTopics)

  // Raw reference = everything that didn't make the ranked cut
  const rankedIds = new Set(rankedPapers.map(p => p.id))
  const rawPapers = enriched.filter(p => !rankedIds.has(p.id))

  return {
    papers: rankedPapers,
    rawPapers,
    fetchedAt: new Date().toISOString(),
    totalFetched: allPapers.length,
  }
}

// ── Most-cited via OpenAlex (no auth, no rate limits) ────────────
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return ""
  const positions = {}
  for (const [word, posArr] of Object.entries(invertedIndex)) {
    for (const pos of posArr) positions[pos] = word
  }
  return Object.keys(positions).sort((a, b) => a - b).map(k => positions[k]).join(" ")
}

export async function fetchMostCited() {
  const filter = "concepts.id:C154945302|C108583219,publication_year:2024|2025,type:article"
  const url = `https://api.openalex.org/works?filter=${filter}&sort=cited_by_count:desc&per-page=20&mailto=research@digest.ai&select=id,title,abstract_inverted_index,authorships,publication_date,doi,cited_by_count,primary_location,open_access`

  try {
    const res = await axios.get(url, { timeout: 20000 })
    const items = (res.data.results || []).filter(p => p.title && p.cited_by_count > 0)

    const papers = items.map(p => {
      const abstract = reconstructAbstract(p.abstract_inverted_index)
      const authors = (p.authorships || []).slice(0, 5).map(a => a.author?.display_name).filter(Boolean)
      const doi = p.doi || ""
      const oaUrl = p.open_access?.oa_url || doi || p.id
      return {
        id: p.id.replace("https://openalex.org/", ""),
        title: p.title,
        abstract,
        authors,
        publishedDate: p.publication_date || "",
        url: oaUrl,
        citationCount: p.cited_by_count || 0,
        venue: p.primary_location?.source?.display_name || "",
        source: "OpenAlex",
        topic: assignTopic(p.title, abstract),
      }
    })

    console.log(`[cited] OpenAlex: ${papers.length} papers, top ${papers[0]?.citationCount ?? 0} citations`)
    const summarised = await summariseCitedPapers(papers.slice(0, 15))
    return { papers: summarised, fetchedAt: new Date().toISOString() }

  } catch (err) {
    console.error("[cited] OpenAlex failed:", err.message)
    return { papers: [], fetchedAt: new Date().toISOString() }
  }
}
