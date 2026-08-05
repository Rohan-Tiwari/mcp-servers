import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { QUESTIONS, CATEGORIES, getDailyQuestion, getQuestionById, filterQuestions } from "./questions.js"

const server = new McpServer({
  name: "daily-challenge",
  version: "1.0.0",
})

server.tool(
  "get_daily_question",
  "Get today's daily coding challenge question",
  {},
  async () => {
    const q = getDailyQuestion()
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(q, null, 2),
        },
      ],
    }
  }
)

server.tool(
  "get_question",
  "Get a specific coding question by ID",
  { id: z.number().describe("Question ID (1-100)") },
  async ({ id }) => {
    const q = getQuestionById(id)
    if (!q) return { content: [{ type: "text", text: `Question ${id} not found.` }] }
    return { content: [{ type: "text", text: JSON.stringify(q, null, 2) }] }
  }
)

server.tool(
  "list_questions",
  "List coding questions with optional filters",
  {
    category: z.string().optional().describe("Filter by category"),
    difficulty: z.enum(["Easy", "Medium", "Hard"]).optional().describe("Filter by difficulty"),
    search: z.string().optional().describe("Search by title or tag"),
    limit: z.number().optional().default(20).describe("Max results to return"),
  },
  async ({ category, difficulty, search, limit = 20 }) => {
    const results = filterQuestions({ category, difficulty, search }).slice(0, limit)
    const summary = results.map(q => ({
      id: q.id,
      title: q.title,
      category: q.category,
      difficulty: q.difficulty,
      frequency: q.frequency,
      companies: q.companies.slice(0, 3),
    }))
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] }
  }
)

server.tool(
  "get_categories",
  "List all available question categories",
  {},
  async () => {
    const stats = CATEGORIES.map(cat => ({
      category: cat,
      count: QUESTIONS.filter(q => q.category === cat).length,
      easy: QUESTIONS.filter(q => q.category === cat && q.difficulty === "Easy").length,
      medium: QUESTIONS.filter(q => q.category === cat && q.difficulty === "Medium").length,
      hard: QUESTIONS.filter(q => q.category === cat && q.difficulty === "Hard").length,
    }))
    return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] }
  }
)

server.tool(
  "get_hint",
  "Get a hint for a specific coding question (powered by Claude)",
  {
    question_id: z.number().describe("Question ID to get hint for"),
    hint_level: z.enum(["gentle", "approach", "detailed"]).default("gentle").describe("How much detail in the hint"),
  },
  async ({ question_id, hint_level }) => {
    const q = getQuestionById(question_id)
    if (!q) return { content: [{ type: "text", text: `Question ${question_id} not found.` }] }

    const levelInstructions = {
      gentle: "Give a very subtle hint that nudges toward the right direction without revealing the approach. One sentence.",
      approach: "Describe the algorithmic approach or data structure to use, without showing code. 2-3 sentences.",
      detailed: "Explain the key insight and step-by-step approach to solve the problem. Include time/space complexity. 4-6 sentences.",
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            question_id,
            title: q.title,
            hint_level,
            prompt_for_claude: `You are helping a developer practice coding interviews. For the problem "${q.title}" (${q.difficulty}):

Description: ${q.description}

Tags: ${q.tags.join(", ")}

${levelInstructions[hint_level]}

Do NOT provide code. Be encouraging and concise.`,
          }),
        },
      ],
    }
  }
)

server.tool(
  "get_random_question",
  "Get a random coding question, optionally filtered by difficulty",
  {
    difficulty: z.enum(["Easy", "Medium", "Hard"]).optional().describe("Preferred difficulty level"),
    category: z.string().optional().describe("Preferred category"),
  },
  async ({ difficulty, category }) => {
    const pool = filterQuestions({ difficulty, category })
    if (!pool.length) return { content: [{ type: "text", text: "No questions match that filter." }] }
    const q = pool[Math.floor(Math.random() * pool.length)]
    return { content: [{ type: "text", text: JSON.stringify(q, null, 2) }] }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
