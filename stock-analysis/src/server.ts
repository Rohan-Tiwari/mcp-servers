import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { store } from "./data/store.js";
import { fetchQuote, fetchBatchQuotes } from "./data/yahooFinance.js";
import { askMarketQuestion } from "./ai/analyzer.js";
import { startMonitor, stopMonitor } from "./monitor.js";
import { startDashboard } from "./dashboard/server.js";

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "get_market_snapshot",
    description:
      "Get the latest AI-powered market snapshot: top 10 stocks, ETFs, and bonds ranked by Claude Opus with buy/sell signals, trend scores, and reasoning. Includes active alerts and overall market sentiment.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_top_ranked",
    description:
      "Get top ranked assets of a specific type (stock, etf, or bond) with AI signals and reasoning for each. Best for focused investment decisions.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["stock", "etf", "bond"],
          description: "Asset type to filter by",
        },
        limit: {
          type: "number",
          description: "Number of results (1-10, default 10)",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "get_quote",
    description:
      "Get a real-time quote for a specific symbol available on Scalable Capital Germany (e.g. SAP.DE, AAPL, VWCE.DE).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Yahoo Finance symbol (e.g. SAP.DE, AAPL, VWCE.DE)",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_alerts",
    description:
      "Get recent market alerts: price spikes/drops, volume surges, and trend reversals detected in real time.",
    inputSchema: {
      type: "object",
      properties: {
        unread_only: {
          type: "boolean",
          description: "Return only unread alerts (default false)",
        },
        limit: {
          type: "number",
          description: "Max number of alerts to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "ask_market",
    description:
      "Ask Claude Opus a freeform question about current market conditions, investment strategy, or specific assets. Claude uses live market data to give contextual advice for a German retail investor on Scalable Capital.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description:
            "Your market or investment question (e.g. 'What should I buy for long-term growth today?', 'Is now a good time to buy SAP?')",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "search_assets",
    description:
      "Search for assets available on Scalable Capital Germany by name or symbol fragment.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term (symbol or company name)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_dashboard_url",
    description:
      "Get the URL of the real-time web dashboard where you can monitor live stock prices, rankings, and alerts visually.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// ── Schema validation ─────────────────────────────────────────────────────────

const GetQuoteArgs = z.object({ symbol: z.string() });
const GetTopRankedArgs = z.object({
  type: z.enum(["stock", "etf", "bond"]),
  limit: z.number().min(1).max(10).optional(),
});
const GetAlertsArgs = z.object({
  unread_only: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
});
const AskMarketArgs = z.object({ question: z.string() });
const SearchAssetsArgs = z.object({ query: z.string() });

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "stock-analysis", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_market_snapshot": {
        const snapshot = store.getSnapshot();
        if (!snapshot) {
          return { content: [{ type: "text", text: "Market data is still loading. Please try again in a few seconds." }] };
        }
        const text = formatSnapshot(snapshot);
        return { content: [{ type: "text", text }] };
      }

      case "get_top_ranked": {
        const { type, limit = 10 } = GetTopRankedArgs.parse(args);
        const ranked = store.getRankings(type, limit);
        if (ranked.length === 0) {
          return { content: [{ type: "text", text: "Rankings not yet available. Market data is loading." }] };
        }
        const text = formatRankings(ranked, type);
        return { content: [{ type: "text", text }] };
      }

      case "get_quote": {
        const { symbol } = GetQuoteArgs.parse(args);
        // Try store first (faster), fall back to live fetch
        let q = store.getQuote(symbol.toUpperCase());
        if (!q) q = await fetchQuote(symbol.toUpperCase()) ?? undefined;
        if (!q) return { content: [{ type: "text", text: `No quote found for ${symbol}. Check the symbol is correct and available on Scalable Capital.` }] };
        const text = [
          `**${q.name}** (${q.symbol})`,
          `Price: ${q.price.toFixed(2)} ${q.currency}`,
          `Change: ${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)} (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)`,
          `Volume: ${q.volume.toLocaleString()}`,
          q.marketCap ? `Market Cap: ${(q.marketCap / 1e9).toFixed(1)}B ${q.currency}` : "",
          `Exchange: ${q.exchange}`,
          `Last updated: ${q.timestamp.toLocaleTimeString()}`,
        ].filter(Boolean).join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "get_alerts": {
        const { unread_only = false, limit = 20 } = GetAlertsArgs.parse(args ?? {});
        const alerts = store.getAlerts(unread_only, limit);
        if (alerts.length === 0) return { content: [{ type: "text", text: "No alerts at this time." }] };
        const text = alerts.map((a) =>
          `[${a.severity.toUpperCase()}] ${a.symbol} — ${a.message} (${new Date(a.timestamp).toLocaleTimeString()})`
        ).join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "ask_market": {
        const { question } = AskMarketArgs.parse(args);
        const answer = await askMarketQuestion(question);
        return { content: [{ type: "text", text: answer }] };
      }

      case "search_assets": {
        const { query } = SearchAssetsArgs.parse(args);
        const { ALL_SYMBOLS } = await import("./data/assets.js");
        const q = query.toLowerCase();
        const matches = ALL_SYMBOLS.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q)
        ).slice(0, 15);
        if (matches.length === 0) return { content: [{ type: "text", text: `No assets found matching "${query}".` }] };
        const text = matches.map((a) => `${a.symbol} — ${a.name} (${a.type}, ${a.exchange})`).join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "get_dashboard_url": {
        const port = process.env.DASHBOARD_PORT ?? "3838";
        return { content: [{ type: "text", text: `Real-time dashboard: http://localhost:${port}\n\nThe dashboard shows live prices, AI-ranked top 10 stocks/ETFs/bonds, and real-time alerts updated every few seconds.` }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatSnapshot(s: Awaited<ReturnType<typeof store.getSnapshot>>): string {
  if (!s) return "No snapshot available.";
  const lines: string[] = [
    `## Market Snapshot — ${new Date(s.lastUpdated).toLocaleString()}`,
    `**Sentiment:** ${s.marketSentiment.toUpperCase()} | **AI Model:** ${s.analysisModel}`,
    "",
  ];

  if (s.topStocks.length > 0) {
    lines.push("### 🏆 Top Stocks");
    s.topStocks.slice(0, 5).forEach((a) =>
      lines.push(`${a.rank}. **${a.symbol}** ${a.name} — ${a.price.toFixed(2)} ${a.currency} (${a.changePercent >= 0 ? "+" : ""}${a.changePercent.toFixed(2)}%) | Signal: ${a.signal.replace("_", " ")} | ${a.reasoning}`)
    );
    lines.push("");
  }

  if (s.topETFs.length > 0) {
    lines.push("### 📊 Top ETFs");
    s.topETFs.slice(0, 5).forEach((a) =>
      lines.push(`${a.rank}. **${a.symbol}** ${a.name} — ${a.price.toFixed(2)} ${a.currency} (${a.changePercent >= 0 ? "+" : ""}${a.changePercent.toFixed(2)}%) | Signal: ${a.signal.replace("_", " ")}`)
    );
    lines.push("");
  }

  if (s.alerts.length > 0) {
    lines.push("### 🔔 Recent Alerts");
    s.alerts.slice(0, 5).forEach((a) =>
      lines.push(`• [${a.severity.toUpperCase()}] ${a.message}`)
    );
  }

  return lines.join("\n");
}

function formatRankings(
  assets: ReturnType<typeof store.getRankings>,
  type: string
): string {
  const emoji = type === "stock" ? "📈" : type === "etf" ? "📊" : "🏛️";
  const lines = [`## ${emoji} Top ${type.toUpperCase()}s\n`];
  assets.forEach((a) =>
    lines.push(
      `**#${a.rank} ${a.symbol}** — ${a.name}\n` +
        `  Price: ${a.price.toFixed(2)} ${a.currency} | Change: ${a.changePercent >= 0 ? "+" : ""}${a.changePercent.toFixed(2)}%\n` +
        `  Signal: **${a.signal.replace("_", " ")}** | Trend Score: ${a.trendScore}/100\n` +
        `  Reasoning: ${a.reasoning}\n`
    )
  );
  return lines.join("\n");
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    console.warn("[server] WARNING: Neither ANTHROPIC_AUTH_TOKEN nor ANTHROPIC_API_KEY set. Using hyperspace proxy defaults.");
  }

  console.log("[server] Starting stock-analysis MCP server…");

  // Start background market monitor
  startMonitor().catch(console.error);

  // Start web dashboard
  startDashboard().catch(console.error);

  // Start MCP server over stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[server] MCP server ready. Dashboard at http://localhost:" + (process.env.DASHBOARD_PORT ?? "3838"));

  process.on("SIGINT", () => { stopMonitor(); process.exit(0); });
  process.on("SIGTERM", () => { stopMonitor(); process.exit(0); });
}

main().catch((err) => {
  console.error("[server] Fatal:", err);
  process.exit(1);
});
