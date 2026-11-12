import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
})
const MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "claude-opus-latest"

const ROHAN_CONTEXT = `The reader is Rohan Tiwari, a senior engineer at SAP building the Joule AI assistant. His work and interests:
- AI agent harnesses and orchestration frameworks (multi-agent systems, planning, tool use)
- LLM skills/scenarios for enterprise AI (SAP S/4HANA, SuccessFactors, ERP, CRM, HR)
- Enterprise RAG: grounding LLMs on business data, knowledge graphs, structured enterprise data
- Distributed systems, Kubernetes, cloud-native infrastructure
- ML infrastructure, model serving, inference optimization
- Enterprise AI integration patterns — AI copilots, business process automation, conversational AI for ERP
- Innovation for companies like SAP: AI agents for finance, supply chain, HR, procurement, analytics

Rank HIGHER: agent architectures, LLM orchestration, enterprise RAG, tool use, planning, inference optimization, enterprise LLM integration, multi-agent coordination, business process AI, ERP/CRM AI, AI copilots, production ML systems, Kubernetes/cloud-native AI.
Rank LOWER: pure theory with no engineering application, unrelated domains (biology, chemistry unless AI-applied), incremental results with no bearing on building AI systems.`

const CONTENT_RULES = `STRICT CONTENT RULES — read carefully:
- "results": MUST contain real content. If the abstract has benchmark numbers (accuracy %, latency ms, speedup X, cost reduction), copy them verbatim. If no numbers, describe the concrete qualitative outcome in 1 sentence. NEVER write filler.
- "impact": explain why Rohan specifically should care, grounded in his work on Joule/agent harnesses/LLM infra. 1-2 sentences. NEVER write generic filler.
- NEVER write: "See abstract", "Refer to paper", "Read the paper", "N/A", "See full paper", "Not mentioned", or any restatement of the title.
- If you genuinely cannot extract a field from the abstract, set it to null — do NOT emit filler text.`

function cleanField(v) {
  if (v == null) return null
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  if (/^(see|refer to|read)\b.*\b(abstract|paper|full text)\b|^n\/?a$|^none$|^tbd$/i.test(t)) return null
  if (t.length < 8) return null
  return t
}

function clampHeadline(h) {
  if (!h || typeof h !== "string") return null
  const t = h.trim()
  if (!t) return null
  return t.length > 110 ? t.slice(0, 107).trimEnd() + "…" : t
}

function extractJson(text) {
  if (!text) throw new Error("empty response")
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.search(/[\[{]/)
  if (start === -1) throw new Error("no JSON in response")
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"))
  const parsed = JSON.parse(s.slice(start, end + 1))
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed.papers)) return parsed.papers
  throw new Error("parsed JSON is not an array")
}

export async function rankPapers(papers, extraTopics = []) {
  if (!papers || papers.length === 0) return []

  const fallback = () => papers.slice(0, 30).map((p, i) => ({
    ...p, rank: i + 1, rankScore: null, topicLabel: p.topic || null,
    headline: null, problem: null, solution: null, results: null, impact: null,
  }))

  const candidates = papers.slice(0, 50)
  const byId = new Map(candidates.map(p => [p.id, p]))

  const paperList = candidates.map((p, i) =>
    `${i+1}. ID: ${p.id}\nTitle: ${p.title}\nAbstract: ${(p.abstract||"").slice(0, 450)}`
  ).join("\n\n")

  const extraLine = extraTopics.length
    ? `\nThe user specifically added these topics — boost papers touching them: ${extraTopics.join(", ")}.`
    : ""

  const topicLabels = ["AI","LLMs","Agents","RAG","Enterprise","Performance","Algorithms","Distributed","Kubernetes","MLInfra",...extraTopics.slice(0,5)].join(", ")

  const prompt = `${ROHAN_CONTEXT}
${extraLine}

You have ${candidates.length} research papers. Select and rank the TOP 30 most relevant to Rohan. Rank 1 = most relevant.

${CONTENT_RULES}

Return ONLY a raw JSON array (no prose, no markdown). Each element:
{
  "rank": 1-30 (unique integers),
  "id": exact paper ID from input,
  "rankScore": 0-100,
  "topicLabel": one of (${topicLabels}),
  "headline": punchy ≤110 char summary,
  "problem": 1-2 sentences on the problem,
  "solution": 2-3 sentences on the approach,
  "results": real extracted results — numbers if present, concrete qualitative outcome if not — NEVER filler,
  "impact": 1-2 sentences why Rohan specifically should care — NEVER filler
}

PAPERS:
${paperList}

Return ONLY the JSON array:`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    })

    const text = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("")
    const items = extractJson(text)

    const ranked = items.map(it => {
      const orig = byId.get(it?.id) || byId.get(String(it?.id))
      if (!orig) return null
      return {
        ...orig,
        rank: Number.isFinite(it?.rank) ? it.rank : null,
        rankScore: Number.isFinite(it?.rankScore) ? it.rankScore : null,
        topicLabel: cleanField(it?.topicLabel),
        headline: clampHeadline(it?.headline),
        problem: cleanField(it?.problem),
        solution: cleanField(it?.solution),
        results: cleanField(it?.results),
        impact: cleanField(it?.impact),
      }
    }).filter(Boolean)

    if (!ranked.length) return fallback()

    ranked.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    return ranked.slice(0, 30).map((p, i) => ({ ...p, rank: i + 1 }))

  } catch (err) {
    console.error("[ranker] rankPapers failed:", err.message)
    return fallback()
  }
}

export async function summariseCitedPapers(papers) {
  if (!papers || papers.length === 0) return papers

  const paperList = papers.slice(0, 15).map((p, i) =>
    `${i+1}. ID: ${p.id}\nTitle: ${p.title}\nCitations: ${(p.citationCount||0).toLocaleString()}\nAbstract: ${(p.abstract||"").slice(0,400)}`
  ).join("\n\n")

  const prompt = `You are a research editor. Summarise each paper concisely for a senior AI/ML engineer.

${CONTENT_RULES}

Papers:
${paperList}

For each return:
{ "id": "...", "headline": "≤110 char punchy summary", "problem": "1 sentence", "solution": "1-2 sentences", "results": "real outcome — numbers or qualitative — never filler", "impact": "1 sentence why an AI engineer cares" }

Rules:
- If abstract lacks detail for a field, set it to null (not a filler string)
- Never write "See abstract", "Refer to paper", etc.

Return ONLY a JSON array:`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 5000,
      messages: [{ role: "user", content: prompt }],
    })
    const text = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("")
    const summaries = extractJson(text)
    const map = Object.fromEntries(summaries.map(s => [s.id, s]))
    return papers.map(p => {
      const s = map[p.id]
      if (!s) return p
      return {
        ...p,
        headline: clampHeadline(s.headline),
        problem: cleanField(s.problem),
        solution: cleanField(s.solution),
        results: cleanField(s.results),
        impact: cleanField(s.impact),
      }
    })
  } catch (err) {
    console.error("[ranker] summariseCitedPapers failed:", err.message)
    return papers
  }
}

// ── Comic + SVG generator (inspired by DAS/claude-arxiv-agent) ────────────
// Takes top N ranked papers and enriches them with comic analysis + architecture SVG.
// Called after rankPapers() — does NOT re-rank, only enriches.
export async function generateComics(papers) {
  if (!papers || papers.length === 0) return papers
  // Only generate comics for top 10 — SVG generation is expensive
  const toEnrich = papers.slice(0, 10)
  const rest     = papers.slice(10)

  const paperList = toEnrich.map((p, i) =>
    `${i+1}. ID: ${p.id}\nTitle: ${p.title}\nAbstract: ${(p.abstract||"").slice(0,500)}`
  ).join("\n\n")

  const prompt = `You are a research visualiser for AI engineers at SAP building Joule AI assistant.

For each paper below, produce a 4-field comic analysis AND an SVG architecture diagram.

Comic fields (all required — no filler text, extract from abstract):
- problem: the specific real-world problem (1-2 sentences, plain English)
- method: the core approach and key innovation (2-3 sentences, technical but clear)
- result: concrete numbers/benchmark improvements if present; qualitative outcome if not (1-2 sentences)
- takeaway: one punchy sentence an engineer should remember — what to DO differently
- reason: one sentence on why this paper matters for building AI agent systems / enterprise LLM

SVG rules (paper-figure style, inspired by NeurIPS paper figures):
- viewBox="0 0 800 400"
- White/light-gray background (#fafafa)
- Clean vector modules: rounded rectangles (rx=8), arrows with marker-end
- Colors: dark-gray primary (#1a1a1a), accent blue (#2563eb), coral (#ef4444), green (#16a34a) — pick 1-2
- Show the method's core flow: Input → Key Module(s) → Output, 4-8 boxes max
- Short labels only (no paragraphs in SVG text)
- Must be self-contained valid SVG (no external refs)

Return ONLY a JSON array, no prose:
[{
  "id": "exact paper ID",
  "comic": {
    "problem": "...",
    "method": "...",
    "result": "...",
    "takeaway": "...",
    "reason": "..."
  },
  "svg": "<svg viewBox=\\"0 0 800 400\\" ...>...</svg>"
}]

Papers:
${paperList}`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    })
    const text = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("")
    const comics = extractJson(text)
    const map = Object.fromEntries(comics.map(c => [c.id, c]))

    const enriched = toEnrich.map(p => {
      const c = map[p.id]
      if (!c) return p
      return {
        ...p,
        comic: {
          problem:  cleanField(c.comic?.problem),
          method:   cleanField(c.comic?.method),
          result:   cleanField(c.comic?.result),
          takeaway: cleanField(c.comic?.takeaway),
          reason:   cleanField(c.comic?.reason),
        },
        svg: (typeof c.svg === "string" && c.svg.includes("<svg")) ? c.svg : null,
      }
    })

    return [...enriched, ...rest]
  } catch (err) {
    console.error("[ranker] generateComics failed:", err.message)
    return papers
  }
}
