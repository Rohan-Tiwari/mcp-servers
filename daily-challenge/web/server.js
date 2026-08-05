import express from "express"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"
import cron from "node-cron"
import Anthropic from "@anthropic-ai/sdk"
import { QUESTIONS, CATEGORIES, DIFFICULTIES, getDailyQuestion, getQuestionById, filterQuestions } from "../src/questions.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

const anthropic = new Anthropic()

// ── SSE clients for daily-refresh broadcast ──────────────────────────────
const sseClients = new Set()

function broadcastDailyRefresh() {
  const daily = getDailyQuestion()
  const msg = `data: ${JSON.stringify({ type: "daily_refresh", daily })}\n\n`
  for (const res of sseClients) {
    try { res.write(msg) } catch (_) { sseClients.delete(res) }
  }
  console.log(`[cron] Daily question refreshed → #${daily.id} ${daily.title}`)
}

// ── Cron: refresh daily question every day at 13:00 ─────────────────────
cron.schedule("0 13 * * *", () => {
  broadcastDailyRefresh()
})

// ── API: SSE events channel ──────────────────────────────────────────────
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
  sseClients.add(res)
  req.on("close", () => sseClients.delete(res))
})

// ── API: daily question ──────────────────────────────────────────────────
app.get("/api/daily", (req, res) => {
  res.json(getDailyQuestion())
})

// ── API: question by id ──────────────────────────────────────────────────
app.get("/api/question/:id", (req, res) => {
  const q = getQuestionById(req.params.id)
  if (!q) return res.status(404).json({ error: "Not found" })
  res.json(q)
})

// ── API: list/filter questions ───────────────────────────────────────────
app.get("/api/questions", (req, res) => {
  const { category, difficulty, company, search } = req.query
  const results = filterQuestions({ category, difficulty, company, search })
  res.json(results)
})

// ── API: companies with counts ───────────────────────────────────────────
app.get("/api/companies", (req, res) => {
  const counts = {}
  for (const q of QUESTIONS) {
    for (const c of q.companies) {
      counts[c] = (counts[c] || 0) + 1
    }
  }
  const companies = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
  res.json(companies)
})

// ── API: categories with counts ──────────────────────────────────────────
app.get("/api/categories", (req, res) => {
  const stats = CATEGORIES.map(cat => ({
    name: cat,
    count: QUESTIONS.filter(q => q.category === cat).length,
    easy: QUESTIONS.filter(q => q.category === cat && q.difficulty === "Easy").length,
    medium: QUESTIONS.filter(q => q.category === cat && q.difficulty === "Medium").length,
    hard: QUESTIONS.filter(q => q.category === cat && q.difficulty === "Hard").length,
  }))
  res.json(stats)
})

// ── API: random question ─────────────────────────────────────────────────
app.get("/api/random", (req, res) => {
  const { difficulty, category } = req.query
  const pool = filterQuestions({ difficulty, category })
  if (!pool.length) return res.status(404).json({ error: "No questions match" })
  res.json(pool[Math.floor(Math.random() * pool.length)])
})

// ── API: Claude hint (SSE streaming) ────────────────────────────────────
app.get("/api/hint/:id", async (req, res) => {
  const q = getQuestionById(req.params.id)
  if (!q) return res.status(404).json({ error: "Question not found" })

  const level = req.query.level || "gentle"
  const levelInstructions = {
    gentle: "Give exactly one subtle nudge — a single sentence that points the developer in the right direction without naming the algorithm or data structure.",
    approach: "In 2-3 sentences, name the algorithmic approach or key data structure, and explain WHY it fits this problem. No code.",
    detailed: "In 4-6 sentences, explain the core insight, the step-by-step approach, and the expected time and space complexity. No code.",
  }

  const systemPrompt = `You are a patient, encouraging coding interview mentor. You help developers improve their problem-solving skills.
Always be concise, warm, and focused. Never write actual code — help them think.`

  const userPrompt = `I'm working on this coding problem:

**${q.title}** (${q.difficulty} · ${q.category})

${q.description}

Tags: ${q.tags.join(", ")}
${q.examples?.length ? `\nExample: ${q.examples[0].input} → ${q.examples[0].output}` : ""}

Hint level requested: ${level}
${levelInstructions[level]}`

  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()

  try {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }
    res.write("data: [DONE]\n\n")
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
  } finally {
    res.end()
  }
})

// ── API: stats summary ───────────────────────────────────────────────────
app.get("/api/stats", (req, res) => {
  res.json({
    total: QUESTIONS.length,
    byDifficulty: {
      Easy: QUESTIONS.filter(q => q.difficulty === "Easy").length,
      Medium: QUESTIONS.filter(q => q.difficulty === "Medium").length,
      Hard: QUESTIONS.filter(q => q.difficulty === "Hard").length,
    },
    categories: CATEGORIES.length,
    topCompanies: getTopCompanies(),
  })
})

function getTopCompanies() {
  const counts = {}
  for (const q of QUESTIONS) {
    for (const c of q.companies) {
      counts[c] = (counts[c] || 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))
}

const PORT = process.env.PORT || 3939
app.listen(PORT, () => {
  console.log(`Daily Challenge server running at http://localhost:${PORT}`)
  console.log(`Cron: daily question refreshes every day at 13:00 local time`)
})
