import axios from "axios"
import xml2js from "xml2js"
import Anthropic from "@anthropic-ai/sdk"

const { parseStringPromise } = xml2js
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
})
const MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "claude-opus-latest"

// ── Feed registry ────────────────────────────────────────────────
// Curated list of RSS/Atom feeds relevant to AI research, agents, LLMs
const FEEDS = [
  // Research labs
  { url: "https://openai.com/blog/rss.xml",             name: "OpenAI",            category: "Lab" },
  { url: "https://blog.research.google/feeds/posts/default?alt=rss", name: "Google Research", category: "Lab" },
  { url: "https://blog.langchain.dev/rss.xml",          name: "LangChain",         category: "Framework" },
  { url: "https://engineering.fb.com/category/ai-research/feed/", name: "Meta AI Eng", category: "Lab" },
  // Engineering & research blogs
  { url: "https://lilianweng.github.io/index.xml",      name: "Lilian Weng",       category: "Research" },
  { url: "https://bair.berkeley.edu/blog/feed.xml",     name: "BAIR Blog",         category: "Research" },
  { url: "https://ai.stanford.edu/blog/feed.xml",       name: "Stanford AI Lab",   category: "Research" },
  { url: "https://thegradient.pub/rss/",                name: "The Gradient",      category: "Research" },
  { url: "https://jack-clark.net/feed/",                name: "Import AI",         category: "Newsletter" },
  // Industry & startups
  { url: "https://venturebeat.com/category/ai/feed/",  name: "VentureBeat AI",    category: "News" },
  { url: "https://techcrunch.com/tag/artificial-intelligence/feed/", name: "TechCrunch AI", category: "News" },
  { url: "https://towardsdatascience.com/feed",         name: "Towards Data Science", category: "Blog" },
  { url: "https://newsletter.pragmaticengineer.com/feed", name: "Pragmatic Engineer", category: "Newsletter" },
  { url: "https://mistral.ai/news/rss",                 name: "Mistral AI",        category: "Lab" },
  { url: "https://huggingface.co/blog/feed.xml",        name: "HuggingFace Blog",  category: "Framework" },
]

// AI/agent relevance keywords — only keep articles that mention these
const RELEVANCE_KEYWORDS = [
  "agent", "rag", "retrieval", "llm", "language model", "gpt", "claude", "gemini",
  "mistral", "transformer", "fine-tun", "inference", "orchestration", "harness",
  "multi-agent", "agentic", "tool use", "chain-of-thought", "reasoning",
  "embedding", "vector", "benchmark", "evaluation", "foundation model",
  "generative ai", "openai", "anthropic", "deepmind", "meta ai", "ai agent",
  "copilot", "assistant", "autonomous", "diffusion", "multimodal", "sam ",
  "moe", "mixture of experts", "context window", "attention", "prompt",
  "knowledge graph", "enterprise ai", "ai infrastructure", "mlops",
]

function isRelevant(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  return RELEVANCE_KEYWORDS.some(kw => text.includes(kw))
}

function stripHtml(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#\d+;/g, "").replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ").trim()
}

function extractItems(parsed) {
  // RSS 2.0
  if (parsed.rss?.channel?.[0]?.item) return parsed.rss.channel[0].item
  // Atom
  if (parsed.feed?.entry) return parsed.feed.entry
  return []
}

function parseItem(item, feedName, feedCategory) {
  // Handle both RSS and Atom
  const title = stripHtml(
    Array.isArray(item.title) ? item.title[0]?._ || item.title[0] : item.title || ""
  )
  const link = (
    item.link?.[0]?.$ ? item.link[0].$.href :
    Array.isArray(item.link) ? item.link[0] : item.link || ""
  )
  const pubDate = (
    item.pubDate?.[0] || item.published?.[0] || item.updated?.[0] || ""
  )
  const rawDesc = (
    item.description?.[0]?._ || item.description?.[0] ||
    item["content:encoded"]?.[0] ||
    item.summary?.[0]?._ || item.summary?.[0] ||
    item.content?.[0]?._ || item.content?.[0] || ""
  )
  const description = stripHtml(rawDesc).slice(0, 500)

  const id = (typeof link === "string" ? link : String(link)).replace(/https?:\/\//, "").replace(/\W+/g, "-").slice(0, 80)

  return { id, title, description, url: link, publishedDate: pubDate, source: feedName, category: feedCategory }
}

// ── Fetch all feeds ──────────────────────────────────────────────
export async function fetchNewsFeeds() {
  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const res = await axios.get(feed.url, {
        timeout: 10000,
        headers: { "User-Agent": "ResearchDigest/1.0 (research tool)" },
      })
      const parsed = await parseStringPromise(res.data, { explicitArray: true })
      const items = extractItems(parsed)
      return items
        .slice(0, 8) // latest 8 per feed
        .map(item => parseItem(item, feed.name, feed.category))
        .filter(item => item.title && item.url)
        .filter(item => isRelevant(item.title, item.description))
    })
  )

  const all = []
  const seenUrls = new Set()
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const item of r.value) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url)
          all.push(item)
        }
      }
    }
  }

  // Sort by date, newest first
  all.sort((a, b) => new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0))

  // Summarise with Claude (top 20 most recent relevant items)
  const top = all.slice(0, 20)
  const summarised = await summariseNewsItems(top)

  return {
    items: summarised,
    fetchedAt: new Date().toISOString(),
    totalFound: all.length,
  }
}

// ── Summarise news items with Claude ────────────────────────────
async function summariseNewsItems(items) {
  if (!items.length) return items

  const list = items.map((item, i) =>
    `${i+1}. SOURCE: ${item.source} (${item.category})\nTITLE: ${item.title}\nDESC: ${item.description.slice(0, 300)}\nURL: ${item.url}`
  ).join("\n\n")

  const prompt = `You are summarising AI/ML industry news for Rohan Tiwari, a senior engineer at SAP building Joule AI assistant — expert in LLM agent harnesses, orchestration frameworks, enterprise AI.

For each news item, write a tight digest entry. Focus on: what's new, why it matters for AI engineers building agents/LLMs, and any specific technical detail.

Items:
${list}

For each return:
{ "index": 1-based number, "headline": "punchy 1-sentence summary ≤100 chars", "summary": "2-3 sentences: what happened + why engineers should care + specific technical detail", "significance": "high" | "medium" | "low" based on impact on AI/agent engineering }

Rules:
- Only include items genuinely relevant to AI engineering (drop pure business news with no technical substance)
- "high" significance = new model/technique/framework that changes how engineers build systems
- "medium" = useful update, new tool, benchmark, or company news with engineering implications
- "low" = general AI news, funding, minor updates
- Never write filler. Be direct and specific.

Return ONLY a JSON array:`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    })
    const text = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("")
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return items

    const summaries = JSON.parse(match[0])
    return summaries.map(s => {
      const orig = items[s.index - 1]
      if (!orig) return null
      return {
        ...orig,
        headline: s.headline || orig.title,
        summary: s.summary || orig.description,
        significance: s.significance || "medium",
      }
    }).filter(Boolean)
  } catch (err) {
    console.error("[news] summarise failed:", err.message)
    // Return items as-is with title as headline
    return items.map(item => ({
      ...item,
      headline: item.title,
      summary: item.description || "",
      significance: "medium",
    }))
  }
}
