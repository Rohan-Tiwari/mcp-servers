import axios from "axios"
import xml2js from "xml2js"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { rankPapers, summariseCitedPapers, generateComics } from "./ranker.js"

const { parseStringPromise } = xml2js
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Current + previous year only — drops stale results from 2+ years ago
function recentYearFilter() {
  const y = new Date().getFullYear()
  return `${y - 1}|${y}`
}
// 6-month rolling window for CrossRef/ACM date filters
function fromPubDate() {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}
// arXiv submittedDate filter string for last N days
function arxivDateFilter(days = 90) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fmt = d => d.toISOString().slice(0,10).replace(/-/g,"") + "000000"
  return `submittedDate:[${fmt(from)} TO 99991231235959]`
}
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return ""
  const positions = {}
  for (const [word, posArr] of Object.entries(invertedIndex)) {
    for (const pos of posArr) positions[pos] = word
  }
  return Object.keys(positions).sort((a, b) => a - b).map(k => positions[k]).join(" ")
}

// Load user-editable keywords from src/keywords.txt
export async function loadKeywords() {
  try {
    const raw = await fs.readFile(path.join(__dirname, "keywords.txt"), "utf8")
    return raw.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
  } catch {
    return ["LLM agent", "RAG", "agent harness", "enterprise AI", "multi-agent"]
  }
}

function keywordMatches(text, keywords) {
  const t = text.toLowerCase()
  return keywords.some(kw => {
    const re = new RegExp("\\b" + kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b")
    return re.test(t)
  })
}

// ── Source: arXiv RSS feeds (fast, today's papers with keyword filter) ──
// Inspired by DAS/claude-arxiv-agent — RSS is much faster than the REST API
async function fetchArxivRSS(keywords) {
  const feeds = [
    "https://rss.arxiv.org/rss/cs.AI",
    "https://rss.arxiv.org/rss/cs.LG",
    "https://rss.arxiv.org/rss/cs.MA",
    "https://rss.arxiv.org/rss/cs.CL",
    "https://rss.arxiv.org/rss/cs.SE",
    "https://rss.arxiv.org/rss/cs.DC",
  ]
  const DC_NS = "http://purl.org/dc/elements/1.1/"
  const seen = new Set()
  const papers = []

  await Promise.allSettled(feeds.map(async feedUrl => {
    try {
      const res = await axios.get(feedUrl, { timeout: 12000, headers: { "User-Agent": "ResearchDigest/1.0" } })
      const parsed = await parseStringPromise(res.data)
      const items = parsed?.rss?.channel?.[0]?.item || []
      for (const item of items) {
        const link = (item.link?.[0] || "").trim()
        if (!link.includes("arxiv.org/abs/")) continue
        const arxivId = link.split("/abs/")[1]?.split("?")[0]?.replace(/v\d+$/, "")
        if (!arxivId || seen.has(arxivId)) continue
        const title = (item.title?.[0] || "").trim()
        const desc = item.description?.[0] || ""
        const abstract = desc.replace(/Abstract:\s*/i, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        const combined = `${title} ${abstract}`
        if (!keywordMatches(combined, keywords)) continue
        seen.add(arxivId)
        const creators = item[`${DC_NS}creator`] || item["dc:creator"] || []
        const authors = (typeof creators[0] === "string" ? creators[0] : "").split(",").map(a => a.trim()).filter(Boolean)
        const pubDate = item.pubDate?.[0] || ""
        const published = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
        papers.push({
          id: arxivId,
          title,
          abstract,
          authors,
          publishedDate: published,
          url: `https://arxiv.org/abs/${arxivId}`,
          pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
          source: "arXiv RSS",
        })
      }
    } catch (err) {
      console.error(`[rss] ${feedUrl}: ${err.message}`)
    }
  }))

  return papers
}

// ── Topic keyword map ───────────────────────────────────────────
const TOPICS = {
  "LLMs": ["language model", "llm", "gpt", "bert", "transformer", "tokenizer", "fine-tune", "instruct", "prompt"],
  "Agents": ["agent", "autonomous", "multi-agent", "agentic", "tool use", "planning", "reasoning", "orchestration"],
  "Harness": ["evaluation harness", "test harness", "agent harness", "harness management", "harness design", "tool execution harness", "llm harness", "agent evaluation framework"],
  "Sandbox": ["sandbox", "sandboxed execution", "runtime isolation", "process isolation", "container sandbox", "capability sandbox", "isolated execution environment", "code execution sandbox", "agent sandbox"],
  "RAG": ["retrieval augmented", "rag", "retrieval-augmented", "document retrieval", "knowledge retrieval", "dense retrieval", "hybrid search"],
  "Enterprise": ["enterprise", "erp", "crm", "sap", "business process", "workflow automation", "supply chain", "procurement", "hr automation", "finance ai", "business intelligence", "copilot", "conversational business", "knowledge graph enterprise"],
  "Performance": ["optimization", "efficiency", "inference", "latency", "throughput", "benchmark", "speed", "acceleration"],
  "Algorithms": ["algorithm", "complexity", "graph", "search", "sorting", "dynamic programming", "approximation"],
  "Distributed": ["distributed", "federated", "consensus", "fault tolerant", "replication", "sharding", "cluster"],
  "Kubernetes": ["kubernetes", "k8s", "container", "pod", "microservice", "docker", "cloud native"],
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

// ── Source 2: arXiv targeted keyword queries ─────────────────────
// Run all in parallel (max 4 concurrent) instead of sequentially
async function fetchArxivTargeted() {
  const queries = [
    "retrieval augmented generation RAG agent",
    "LLM agent harness orchestration multi-agent",
    "enterprise large language model business process",
    "agentic RAG enterprise document retrieval copilot",
    "AI agent ERP CRM workflow automation supply chain",
    "agent harness evaluation sandbox management",
    "sandboxed code execution LLM agent isolation",
  ]

  // arXiv allows parallel requests — run all at once, short timeout
  const dateFilter = encodeURIComponent(arxivDateFilter(90))
  const results = await Promise.allSettled(
    queries.map(q =>
      axios.get(
        `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}+AND+${dateFilter}&sortBy=submittedDate&sortOrder=descending&max_results=8`,
        { timeout: 8000 }
      )
      .then(res => parseStringPromise(res.data))
      .then(parsed => (parsed.feed.entry || []).map(e => {
        const id = e.id[0].split("/").pop()
        return {
          id,
          title: (e.title[0] || "").replace(/\s+/g, " ").trim(),
          abstract: (e.summary[0] || "").replace(/\s+/g, " ").trim(),
          authors: (e.author || []).map(a => a.name[0]),
          publishedDate: e.published[0],
          url: (e.link || []).find(l => l.$?.type === "text/html")?.$.href || `https://arxiv.org/abs/${id}`,
          source: `arXiv · ${q.split(" ").slice(0,3).join(" ")}`,
        }
      }))
    )
  )

  const seen = new Set()
  const papers = []
  for (const r of results) {
    if (r.status !== "fulfilled") continue
    for (const p of r.value) {
      if (!seen.has(p.id)) { seen.add(p.id); papers.push(p) }
    }
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
  const df = encodeURIComponent(arxivDateFilter(90))
  const url = `https://export.arxiv.org/api/query?search_query=${q}+AND+${df}&sortBy=submittedDate&sortOrder=descending&max_results=15`
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

// ── Source 4: CrossRef — 130M+ cross-publisher papers ────────────
// Free, no auth. Covers ACM DL, Springer, Elsevier, IEEE, AAAI, etc.
async function fetchCrossRef(query) {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&filter=from-pub-date:${fromPubDate()},type:journal-article,type:proceedings-article&rows=15&sort=is-referenced-by-count&order=desc&select=DOI,title,author,published,abstract,is-referenced-by-count,URL,container-title`
  const res = await axios.get(url, { timeout: 8000, headers: { "User-Agent": "ResearchDigest/1.0 (mailto:research@digest.ai)" } })
  const items = res.data?.message?.items || []
  return items.filter(p => p.title?.[0]).map(p => {
    const rawAbstract = p.abstract || ""
    const abstract = rawAbstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    const authors = (p.author || []).slice(0, 6).map(a => [a.given, a.family].filter(Boolean).join(" "))
    const dateArr = p.published?.["date-parts"]?.[0] || []
    const publishedDate = dateArr.length ? `${dateArr[0]}-${String(dateArr[1]||1).padStart(2,"0")}-01` : ""
    const venue = (p["container-title"] || [])[0] || ""
    const url2 = p.URL || (p.DOI ? `https://doi.org/${p.DOI}` : "")
    const id = p.DOI ? `doi-${p.DOI.replace(/[^a-zA-Z0-9]/g, "-")}` : titleHash(p.title[0])
    return { id, title: p.title[0], abstract, authors, publishedDate, url: url2, source: `CrossRef · ${venue.slice(0,30)||"Journal"}`, venue, citationCount: p["is-referenced-by-count"] || 0 }
  })
}

// ── Source 5: DBLP — comprehensive CS conference/journal index ────
// Covers NeurIPS, ICML, ICLR, ACL, EMNLP, SIGKDD, VLDB, ICDE, WWW, etc.
async function fetchDBLP(query) {
  const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(query)}&format=json&h=15&f=0`
  const res = await axios.get(url, { timeout: 7000, headers: { "User-Agent": "ResearchDigest/1.0" } })
  const hits = res.data?.result?.hits?.hit || []
  return hits.map(h => {
    const info = h.info || {}
    const title = info.title || ""
    const authors = info.authors?.author
      ? (Array.isArray(info.authors.author) ? info.authors.author : [info.authors.author]).map(a => a.text || a)
      : []
    const venue = info.venue || info.booktitle || info.journal || ""
    const id = info.key ? `dblp-${info.key.replace(/[^a-zA-Z0-9]/g,"-")}` : titleHash(title)
    return { id, title, abstract: "", authors, publishedDate: info.year ? `${info.year}-01-01` : "", url: info.ee || info.url || "", source: `DBLP · ${venue.slice(0,30)||"CS"}`, venue }
  }).filter(p => p.title)
}

// ── Source 6: DOAJ — Directory of Open Access Journals ───────────
async function fetchDOAJ(query) {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=10&sort=most_recent`
  const res = await axios.get(url, { timeout: 7000 })
  const results = res.data?.results || []
  return results.map(r => {
    const bib = r.bibjson || {}
    const title = bib.title || ""
    const abstract = bib.abstract || ""
    const authors = (bib.author || []).map(a => a.name).filter(Boolean)
    const journal = bib.journal?.title || ""
    const year = bib.year || ""
    const links = bib.link || []
    const url2 = links.find(l => l.type === "fulltext")?.url || links[0]?.url || ""
    const id = r.id ? `doaj-${r.id}` : titleHash(title)
    return { id, title, abstract, authors, publishedDate: year ? `${year}-01-01` : "", url: url2, source: `DOAJ · ${journal.slice(0,30)||"Open Access"}`, venue: journal }
  }).filter(p => p.title)
}

// ── Source 8: Microsoft Research Blog (RSS) ──────────────────────
async function fetchMSRBlog() {
  const res = await axios.get("https://www.microsoft.com/en-us/research/feed/", { timeout: 8000, headers: { "User-Agent": "ResearchDigest/1.0" } })
  const items = (res.data.match(/<item>[\s\S]*?<\/item>/g) || [])
  return items.map(item => {
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || "").trim()
    const link  = (item.match(/<link>(.*?)<\/link>/)?.[1] || item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || "").trim()
    const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]>/s)?.[1] || item.match(/<description>(.*?)<\/description>/s)?.[1] || "").replace(/<[^>]+>/g," ").trim().slice(0,400)
    const date  = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ""
    if (!title) return null
    return { id: titleHash(title), title, abstract: desc, authors: ["Microsoft Research"], publishedDate: date ? new Date(date).toISOString().slice(0,10) : "", url: link, source: "MSR Blog" }
  }).filter(Boolean)
}

// ── Source 9: EuropePMC — CS/AI cross-disciplinary papers ────────
async function fetchEuropePMC(query) {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&resulttype=core&pageSize=15&format=json&sort=CITED+desc`
  const res = await axios.get(url, { timeout: 8000 })
  const results = res.data?.resultList?.result || []
  return results.filter(p => p.title && (p.doi || p.pmid)).map(p => ({
    id: p.doi ? `epmc-${p.doi.replace(/[^a-zA-Z0-9]/g,"-")}` : `epmc-${p.pmid}`,
    title: p.title,
    abstract: (p.abstractText || "").replace(/<[^>]+>/g," ").trim().slice(0,500),
    authors: (p.authorList?.author || []).slice(0,5).map(a => `${a.firstName||""} ${a.lastName||""}`.trim()),
    publishedDate: p.firstPublicationDate || "",
    url: p.doi ? `https://doi.org/${p.doi}` : `https://europepmc.org/article/med/${p.pmid}`,
    source: `EuropePMC · ${p.journalInfo?.journal?.title?.slice(0,25)||"Journal"}`,
  }))
}

// ── Source 10: ACM Digital Library via CrossRef ───────────────────
async function fetchACM(query) {
  // member:320 = ACM
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&filter=from-pub-date:${fromPubDate()},member:320&rows=15&sort=is-referenced-by-count&order=desc&select=DOI,title,author,published,abstract,is-referenced-by-count,URL,container-title&mailto=research@digest.ai`
  const res = await axios.get(url, { timeout: 8000, headers: { "User-Agent": "ResearchDigest/1.0" } })
  const items = res.data?.message?.items || []
  return items.filter(p => p.title?.[0]).map(p => {
    const rawAbs = p.abstract || ""
    const abstract = rawAbs.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()
    const authors = (p.author||[]).slice(0,5).map(a=>[a.given,a.family].filter(Boolean).join(" "))
    const dateArr = p.published?.["date-parts"]?.[0]||[]
    const venue = (p["container-title"]||[])[0]||""
    return {
      id: `acm-${p.DOI.replace(/[^a-zA-Z0-9]/g,"-")}`,
      title: p.title[0],
      abstract,
      authors,
      publishedDate: dateArr.length ? `${dateArr[0]}-${String(dateArr[1]||1).padStart(2,"0")}-01` : "",
      url: p.URL||`https://doi.org/${p.DOI}`,
      source: `ACM DL · ${venue.slice(0,28)||"Conference"}`,
      citationCount: p["is-referenced-by-count"]||0,
    }
  })
}

// ── Source 11: OpenAlex concept+keyword — top AI lab papers ──────
async function fetchOpenAlexConceptSearch(query) {
  // Filter to AI/ML/NLP/DeepLearning concept nodes
  const concepts = "C154945302|C108583219|C119857082|C2522767166"
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=concepts.id:${concepts},publication_year:${recentYearFilter()}&sort=relevance_score:desc&per-page=15&select=id,title,abstract_inverted_index,authorships,publication_date,doi,cited_by_count,primary_location,open_access&mailto=research@digest.ai`
  const res = await axios.get(url, { timeout: 8000 })
  const items = (res.data?.results||[]).filter(p=>p.title)
  return items.map(p => {
    const abstract = reconstructAbstract(p.abstract_inverted_index)
    const authors = (p.authorships||[]).slice(0,5).map(a=>a.author?.display_name).filter(Boolean)
    const doi = p.doi||""
    const oaUrl = p.open_access?.oa_url||(doi?doi:p.id)
    const venue = p.primary_location?.source?.display_name||""
    return {
      id: p.id.replace("https://openalex.org/",""),
      title: p.title, abstract, authors,
      publishedDate: p.publication_date||"",
      url: oaUrl, citationCount: p.cited_by_count||0, venue,
      source: `OpenAlex · ${venue.slice(0,28)||"AI Research"}`,
    }
  })
}


// ── Source 7: OpenAlex full-text search ──────────────────────────
async function fetchOpenAlexSearch(query) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=publication_year:${recentYearFilter()},type:article&sort=relevance_score:desc&per-page=20&mailto=research@digest.ai&select=id,title,abstract_inverted_index,authorships,publication_date,doi,cited_by_count,primary_location,open_access`
  const res = await axios.get(url, { timeout: 15000 })
  const items = (res.data?.results || []).filter(p => p.title)
  return items.map(p => {
    const abstract = reconstructAbstract(p.abstract_inverted_index)
    const authors = (p.authorships || []).slice(0, 5).map(a => a.author?.display_name).filter(Boolean)
    const doi = p.doi || ""
    const oaUrl = p.open_access?.oa_url || (doi ? doi : p.id)
    const venue = p.primary_location?.source?.display_name || ""
    return {
      id: p.id.replace("https://openalex.org/", ""),
      title: p.title,
      abstract,
      authors,
      publishedDate: p.publication_date || "",
      url: oaUrl,
      citationCount: p.cited_by_count || 0,
      venue,
      source: `OpenAlex · ${venue.slice(0,28) || "Academic"}`,
    }
  })
}

// ── Main fetch + rank — split into two phases ────────────────────
// Phase 1: deep multi-source fetch, all parallel
export async function fetchPapers(extraTopics = []) {
  console.log("[fetch] Deep multi-source fetch starting…")
  const t0 = Date.now()

  // Load user-editable keywords for RSS filtering
  const keywords = await loadKeywords()
  if (extraTopics.length) keywords.push(...extraTopics)

  const baseResults = await Promise.allSettled([
    // arXiv RSS — today's papers, keyword-filtered (fast, inspired by DAS/claude-arxiv-agent)
    fetchArxivRSS(keywords),
    // arXiv broad + targeted
    fetchArxiv(),
    fetchHuggingFace(),
    fetchArxivTargeted(),

    // arXiv deep keyword searches
    fetchArxivKeyword("LLM agent orchestration tool use planning"),
    fetchArxivKeyword("retrieval augmented generation RAG knowledge graph"),
    fetchArxivKeyword("multi-agent system coordination enterprise"),
    fetchArxivKeyword("large language model inference optimization serving"),
    fetchArxivKeyword("agentic AI autonomous workflow automation"),
    fetchArxivKeyword("foundation model fine-tuning instruction enterprise"),
    fetchArxivKeyword("AI engineering MLOps production deployment"),
    fetchArxivKeyword("vector database embedding semantic search"),
    fetchArxivKeyword("code generation LLM software engineering"),
    fetchArxivKeyword("knowledge graph enterprise reasoning LLM"),
    fetchArxivKeyword("prompt engineering chain of thought reasoning"),
    fetchArxivKeyword("model compression quantization efficient inference"),
    fetchArxivKeyword("multimodal LLM vision language model"),
    fetchArxivKeyword("reinforcement learning human feedback RLHF agent"),
    fetchArxivKeyword("AI agent planning decision making task"),
    fetchArxivKeyword("long context window memory LLM"),
    fetchArxivKeyword("AI model evaluation benchmark enterprise"),
    fetchArxivKeyword("agent harness evaluation LLM tool execution"),
    fetchArxivKeyword("sandbox isolation secure code execution LLM agent"),
    fetchArxivKeyword("sandboxed execution environment agent safety"),
    fetchArxivKeyword("harness management agent orchestration framework"),
    fetchArxivKeyword("runtime isolation container agent tool use"),

    // CrossRef — published journals + conferences
    fetchCrossRef("LLM agent enterprise orchestration RAG"),
    fetchCrossRef("retrieval augmented generation enterprise knowledge"),
    fetchCrossRef("AI agent harness multi-agent system"),
    fetchCrossRef("sandbox isolation secure execution AI agent"),
    fetchCrossRef("harness management LLM evaluation framework"),
    fetchCrossRef("large language model production deployment engineering"),
    fetchCrossRef("enterprise AI integration business process automation"),
    fetchCrossRef("AI engineering MLOps model serving production"),

    // ACM Digital Library
    fetchACM("LLM agent enterprise RAG orchestration"),
    fetchACM("AI engineering model deployment production system"),

    // DBLP — CS conference index
    fetchDBLP("LLM agent RAG enterprise"),
    fetchDBLP("AI agent orchestration multi-agent"),

    // OpenAlex broad semantic
    fetchOpenAlexSearch("LLM agent harness orchestration enterprise RAG"),
    fetchOpenAlexSearch("retrieval augmented generation knowledge enterprise"),
    fetchOpenAlexSearch("agentic AI autonomous multi-agent tool use"),
    fetchOpenAlexSearch("AI engineering MLOps production model serving"),
    fetchOpenAlexSearch("transformer optimization inference efficiency"),

    // OpenAlex concept-filtered (ML+AI+NLP+DL concepts)
    fetchOpenAlexConceptSearch("agent harness orchestration enterprise LLM RAG"),
    fetchOpenAlexConceptSearch("sandbox isolation secure execution agent tool"),
    fetchOpenAlexConceptSearch("AI engineering model serving production inference"),
    fetchOpenAlexConceptSearch("multi-agent system planning tool use workflow"),

    // DOAJ — open access
    fetchDOAJ("large language model agent enterprise"),
    fetchDOAJ("retrieval augmented generation RAG knowledge"),

    // EuropePMC
    fetchEuropePMC("large language model agent enterprise RAG"),

    // MSR Blog
    fetchMSRBlog(),
  ])

  const topicResults = extraTopics.length
    ? await Promise.allSettled(extraTopics.map(t => fetchArxivKeyword(t)))
    : []

  const allPapers = []
  const sourceSummary = {}
  for (const r of [...baseResults, ...topicResults]) {
    if (r.status === "fulfilled") {
      allPapers.push(...r.value)
      r.value.forEach(p => {
        const s = (p.source||"?").split(" · ")[0]
        sourceSummary[s] = (sourceSummary[s]||0) + 1
      })
    }
  }

  const seen = new Set()
  const deduped = []
  const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000  // 6 months ago
  let droppedOld = 0
  for (const p of allPapers) {
    const key = normalizeTitle(p.title)
    if (!key || seen.has(key)) continue
    // Hard drop papers with a known date older than 6 months
    if (p.publishedDate) {
      const pub = new Date(p.publishedDate).getTime()
      if (!isNaN(pub) && pub < cutoff) { droppedOld++; seen.add(key); continue }
    }
    seen.add(key)
    deduped.push(p)
  }
  if (droppedOld) console.log(`[fetch] Dropped ${droppedOld} papers older than 6 months`)

  const enriched = deduped.map(p => ({
    ...p,
    id: p.id || titleHash(p.title),
    topic: assignTopic(p.title, p.abstract),
  }))

  console.log(`[fetch] Done in ${Date.now()-t0}ms | ${allPapers.length} raw | ${enriched.length} unique | sources: ${JSON.stringify(sourceSummary)}`)
  return { enriched, totalFetched: allPapers.length }
}

// ── Pre-score candidates before sending to Claude ───────────────────────────
// Scores on citation count, keyword relevance to Rohan's interests, and recency.
// Lets Claude focus its 50-slot budget on genuinely promising papers.
const PRIORITY_KEYWORDS = [
  "agent", "agentic", "multi-agent", "rag", "retrieval augmented",
  "enterprise", "llm", "language model", "orchestration", "harness",
  "sandbox", "tool use", "planning", "copilot", "inference", "serving",
  "deployment", "production", "mlops", "kubernetes", "fine-tun",
]

function prescore(papers) {
  const now = Date.now()
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

  return papers.map(p => {
    const text = `${p.title} ${p.abstract || ""}`.toLowerCase()
    const kwScore = PRIORITY_KEYWORDS.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0)
    const citScore = Math.log10((p.citationCount || 0) + 1)
    const hasAbstract = (p.abstract || "").length > 80 ? 1 : 0

    // Recency — dominant factor: last month=10, last 3mo=6, last 6mo=2, older=-5
    const pubMs = p.publishedDate ? new Date(p.publishedDate).getTime() : 0
    const age = pubMs ? now - pubMs : Infinity
    const recencyScore = age < ONE_MONTH_MS ? 10 : age < THREE_MONTHS_MS ? 6 : age < SIX_MONTHS_MS ? 2 : -5

    return { ...p, _ps: kwScore * 2 + citScore + hasAbstract + recencyScore * 3 }
  })
  .sort((a, b) => b._ps - a._ps)
  .map(({ _ps, ...p }) => p)
}

// Phase 2: rank with Claude + generate comics for top 10
export async function rankFetchedPapers(enriched, extraTopics = []) {
  const t0 = Date.now()
  const candidates = prescore(enriched).slice(0, 50)
  const rankedPapers = await rankPapers(candidates, extraTopics)
  console.log(`[rank] Done in ${Date.now()-t0}ms — ${rankedPapers.length} ranked`)

  // Generate comic + SVG for top 10 papers (inspired by DAS/claude-arxiv-agent)
  const withComics = await generateComics(rankedPapers)
  console.log(`[comics] Generated for top ${Math.min(10, rankedPapers.length)} papers`)

  const rankedIds = new Set(withComics.map(p => p.id))
  const rawPapers = enriched.filter(p => !rankedIds.has(p.id))
  return {
    papers: withComics,
    rawPapers,
    fetchedAt: new Date().toISOString(),
    totalFetched: enriched.length,
  }
}

// Combined convenience export (used by scheduler)
export async function fetchAndRankPapers(extraTopics = []) {
  const { enriched, totalFetched } = await fetchPapers(extraTopics)
  const result = await rankFetchedPapers(enriched, extraTopics)
  result.totalFetched = totalFetched
  return result
}

// ── Most-cited via OpenAlex ──────────────────────────────────────

export async function fetchMostCited() {
  const filter = `concepts.id:C154945302|C108583219,publication_year:${recentYearFilter()},type:article`
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
