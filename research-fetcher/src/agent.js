/**
 * Research Digest Agent
 *
 * Autonomous Claude agent that runs daily at 07:05, checks if papers are stale,
 * triggers a fetch if needed, and writes a curated markdown digest to data/.
 *
 * Run standalone:   node src/agent.js
 * Auto-start:       launchd plist at com.research-fetcher.agent.plist (install once)
 */

import Anthropic from "@anthropic-ai/sdk"
import cron from "node-cron"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import storage from "./storage.js"
import { fetchAndRankPapers } from "./fetcher.js"
import { notifyList } from "./notifier.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LOG_FILE    = path.join(__dirname, "..", "data", "agent-log.json")
const DIGESTS_DIR = path.join(__dirname, "..", "data", "digests")

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
})
const MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "claude-opus-latest"

// ── Agent tool definitions ──────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_research_status",
    description: "Check last fetch time, paper count, topics, and whether data is stale (>20 h old)",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "fetch_papers_now",
    description: "Trigger a full multi-source fetch + Claude ranking. Takes 1-3 min. Call only when data is stale.",
    input_schema: {
      type: "object",
      properties: {
        extra_topics: {
          type: "array",
          items: { type: "string" },
          description: "Optional extra topics to inject into this fetch run",
        },
      },
    },
  },
  {
    name: "get_top_papers",
    description: "Return the current top ranked papers from storage",
    input_schema: {
      type: "object",
      properties: {
        limit:  { type: "number",  description: "Max papers (default 15)" },
        topic:  { type: "string",  description: "Optional topic filter" },
      },
    },
  },
  {
    name: "write_daily_digest",
    description: "Persist the markdown digest for today to data/digests/YYYY-MM-DD.md",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Full markdown content" },
        date:    { type: "string", description: "Date string YYYY-MM-DD" },
      },
      required: ["content", "date"],
    },
  },
]

// ── Tool implementations ────────────────────────────────────────────────────

async function callTool(name, input) {
  switch (name) {

    case "get_research_status": {
      const data   = await storage.loadPapers()
      const topics = await storage.getTopics()
      const now    = Date.now()
      const lastTs = data?.fetchedAt ? new Date(data.fetchedAt).getTime() : 0
      const ageH   = parseFloat(((now - lastTs) / 3_600_000).toFixed(1))
      return {
        lastFetchedAt:  data?.fetchedAt ?? null,
        ageHours:       ageH,
        isStale:        ageH > 20,
        totalPapers:    data?.papers?.length ?? 0,
        totalFetched:   data?.totalFetched   ?? 0,
        topTopics:      topics.slice(0, 8),
        nextFetchAt:    data?.nextFetchAt    ?? null,
      }
    }

    case "fetch_papers_now": {
      const extraTopics = Array.isArray(input?.extra_topics) ? input.extra_topics : []
      console.log(`[agent] Fetching — extra topics: ${extraTopics.join(", ") || "none"}`)
      const result = await fetchAndRankPapers(extraTopics)
      await storage.savePapers(result)
      return {
        success:       true,
        papersRanked:  result.papers?.length  ?? 0,
        totalFetched:  result.totalFetched     ?? 0,
        fetchedAt:     result.fetchedAt,
      }
    }

    case "get_top_papers": {
      const data    = await storage.loadPapers()
      let papers    = data?.papers ?? []
      const topic   = input?.topic?.toLowerCase()
      if (topic) {
        papers = papers.filter(p =>
          (p.topicLabel || p.topic || "").toLowerCase().includes(topic) ||
          (p.title      || "").toLowerCase().includes(topic)
        )
      }
      return papers.slice(0, input?.limit ?? 15).map(p => ({
        rank:          p.rank,
        title:         p.title,
        topicLabel:    p.topicLabel || p.topic,
        headline:      p.headline,
        problem:       p.problem,
        solution:      p.solution,
        results:       p.results,
        impact:        p.impact,
        rankScore:     p.rankScore,
        url:           p.url,
        publishedDate: p.publishedDate,
        authors:       p.authors?.slice(0, 3),
        source:        p.source,
      }))
    }

    case "write_daily_digest": {
      await fs.mkdir(DIGESTS_DIR, { recursive: true })
      const digestPath = path.join(DIGESTS_DIR, `${input.date}.md`)
      await fs.writeFile(digestPath, input.content, "utf8")

      // Also write a symlink / copy as "latest.md" for easy access
      const latestPath = path.join(DIGESTS_DIR, "latest.md")
      await fs.writeFile(latestPath, input.content, "utf8")

      console.log(`[agent] Digest written → ${digestPath}`)

      // Send a macOS notification with the top trending papers
      try {
        const data = await storage.loadPapers()
        const top = (data?.papers || []).slice(0, 4)
        if (top.length) {
          const headlines = top.map(p => p.headline || p.title).filter(Boolean)
          const topTopic = top[0]?.topicLabel || "AI Research"
          notifyList(`Research Digest · ${input.date}`, headlines, `Trending: ${topTopic}`)
        }
      } catch { /* notification is best-effort */ }

      return { success: true, path: digestPath }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ── Agentic loop ────────────────────────────────────────────────────────────

async function runAgent() {
  const today     = new Date().toISOString().slice(0, 10)
  const startedAt = new Date().toISOString()
  console.log(`\n[agent] ── Daily run ${today} ──`)

  const systemPrompt = `You are the Research Digest Agent for Rohan Tiwari, a senior engineer at SAP building the Joule AI assistant (enterprise LLM platform). His focus areas: AI agent harnesses, LLM orchestration, enterprise RAG, multi-agent systems, ML infra, Kubernetes.

Your job each morning:
1. Call get_research_status — check if data is stale (>20 h).
2. If stale, call fetch_papers_now to refresh.
3. Call get_top_papers to review the current top 15.
4. Write a polished daily digest with write_daily_digest.

Digest format (markdown):
# Research Digest — ${today}

**Papers ranked:** N  |  **Topics covered:** X  |  **Last updated:** <timestamp>

## Top 10

| # | Title | Topic | Score | Date |
|---|-------|-------|-------|------|
... (table rows)

## Standouts — Read These Today

For 3-5 best papers: ### N. Title, then: **Why it matters for Joule/enterprise AI:** …, **Key insight:** …, **Link:** url

## Action Item

One concrete recommendation: what to read first and what to do with it.

Be specific, engineering-focused, no filler. Rank Agents/RAG/Enterprise/LLMs topics highest.`

  const messages = [
    {
      role: "user",
      content: `Today is ${today}. Run your daily research digest workflow.`,
    },
  ]

  let totalTokens = 0
  let iterations  = 0
  const MAX_ITER  = 12

  try {
    while (iterations < MAX_ITER) {
      iterations++

      const response = await client.messages.create({
        model:      MODEL,
        max_tokens: 8000,
        system:     systemPrompt,
        tools:      TOOLS,
        messages,
      })

      totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)
      messages.push({ role: "assistant", content: response.content })

      if (response.stop_reason === "end_turn") {
        const finalText = response.content
          .filter(b => b.type === "text")
          .map(b => b.text)
          .join("\n")
          .trim()
        console.log(`[agent] Done — ${iterations} iter, ~${totalTokens} tokens`)
        await appendLog({ date: today, startedAt, status: "success", iterations, totalTokens, summary: finalText.slice(0, 400) })
        return
      }

      if (response.stop_reason !== "tool_use") {
        console.warn(`[agent] Unexpected stop_reason: ${response.stop_reason}`)
        break
      }

      // Execute all tool calls
      const toolResults = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        console.log(`[agent] → ${block.name}`)
        try {
          const result = await callTool(block.name, block.input)
          toolResults.push({
            type:        "tool_result",
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          })
        } catch (err) {
          console.error(`[agent] Tool ${block.name} error:`, err.message)
          toolResults.push({
            type:        "tool_result",
            tool_use_id: block.id,
            content:     `Error: ${err.message}`,
            is_error:    true,
          })
        }
      }
      messages.push({ role: "user", content: toolResults })
    }

    console.warn("[agent] Reached max iterations")
    await appendLog({ date: today, startedAt, status: "max_iter", iterations, totalTokens })

  } catch (err) {
    console.error("[agent] Run failed:", err.message)
    await appendLog({ date: today, startedAt, status: "error", error: err.message, iterations, totalTokens })
  }
}

// ── Log helper ──────────────────────────────────────────────────────────────

async function appendLog(entry) {
  let log = []
  try { log = JSON.parse(await fs.readFile(LOG_FILE, "utf8")) } catch {}
  log.unshift(entry)
  if (log.length > 100) log = log.slice(0, 100)
  await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2))
}

// ── Entry point ─────────────────────────────────────────────────────────────

const DAILY_CRON = "5 7 * * *"   // 07:05 every day

async function main() {
  await storage.initStorage()
  await fs.mkdir(DIGESTS_DIR, { recursive: true })

  console.log("[agent] Research Digest Agent started")
  console.log(`[agent] Daily digest scheduled: ${DAILY_CRON} (07:05 local time)`)
  console.log(`[agent] Model: ${MODEL}`)

  // Run once immediately on start
  runAgent().catch(err => console.error("[agent] Startup run failed:", err))

  cron.schedule(DAILY_CRON, () => {
    runAgent().catch(err => console.error("[agent] Scheduled run failed:", err))
  })
}

main().catch(err => {
  console.error("[agent] Fatal error:", err)
  process.exit(1)
})
