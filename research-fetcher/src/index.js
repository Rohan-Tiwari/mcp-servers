import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { startScheduler, runNow } from "./scheduler.js";
import storage from "./storage.js";
import { fetchAndRankPapers } from "./fetcher.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new Server(
  {
    name: "research-fetcher",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_research_papers",
        description: "Get latest research papers, optionally filtered by topic",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Optional topic to filter papers by",
            },
            limit: {
              type: "number",
              description: "Maximum number of papers to return (default 10)",
            },
          },
        },
      },
      {
        name: "fetch_research_now",
        description: "Trigger immediate research paper fetch from all sources",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_paper_details",
        description: "Get detailed information about a specific paper",
        inputSchema: {
          type: "object",
          properties: {
            paper_id: {
              type: "string",
              description: "The unique identifier of the paper",
            },
          },
          required: ["paper_id"],
        },
      },
      {
        name: "get_topics",
        description: "Get list of research topics with paper counts",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_last_updated",
        description: "Get timestamp of last research fetch",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_research_papers") {
      const topic = args?.topic;
      const limit = args?.limit ?? 10;

      const data = await storage.loadPapers();
      let papers = (data && data.papers) ? data.papers : [];

      if (topic) {
        const topicLower = topic.toLowerCase();
        papers = papers.filter(
          (paper) =>
            (paper.topicLabel && paper.topicLabel.toLowerCase().includes(topicLower)) ||
            (paper.topic && paper.topic.toLowerCase().includes(topicLower)) ||
            (paper.title && paper.title.toLowerCase().includes(topicLower)) ||
            (paper.abstract && paper.abstract.toLowerCase().includes(topicLower))
        );
      }

      papers = papers.slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ papers, count: papers.length }, null, 2),
          },
        ],
      };
    }

    if (name === "fetch_research_now") {
      runNow().catch(err => console.error("Background fetch error:", err));
      return {
        content: [
          {
            type: "text",
            text: "Research paper fetch triggered successfully. Papers will be updated shortly.",
          },
        ],
      };
    }

    if (name === "get_paper_details") {
      const paperId = args?.paper_id;

      if (!paperId) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "paper_id is required" }),
            },
          ],
          isError: true,
        };
      }

      const data = await storage.loadPapers();
      const papers = (data && data.papers) ? data.papers : [];
      const paper = papers.find((p) => p.id === paperId);

      if (!paper) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Paper with id '${paperId}' not found` }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(paper, null, 2),
          },
        ],
      };
    }

    if (name === "get_topics") {
      const topics = await storage.getTopics();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ topics }, null, 2),
          },
        ],
      };
    }

    if (name === "get_last_updated") {
      const data = await storage.loadPapers();
      const lastUpdated = data ? data.fetchedAt : null;
      const nextFetchAt = data ? data.nextFetchAt : null;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              last_updated: lastUpdated,
              next_fetch_at: nextFetchAt,
              total_fetched: data ? data.totalFetched : 0,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: `Unknown tool: ${name}` }),
        },
      ],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: error.message || String(error) }),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  try {
    await storage.initStorage();
  } catch (error) {
    console.error("Failed to initialize storage:", error);
    process.exit(1);
  }

  startScheduler();

  try {
    const data = await storage.loadPapers();
    if (!data || !data.papers || data.papers.length === 0) {
      try {
        const fetched = await fetchAndRankPapers();
        if (fetched && fetched.papers && fetched.papers.length > 0) {
          await storage.savePapers(fetched);
          console.log(`[startup] Initial fetch complete: ${fetched.papers.length} papers saved.`);
        }
      } catch (fetchError) {
        console.error("Initial paper fetch failed:", fetchError);
      }
    }
  } catch (error) {
    console.error("Error checking initial papers:", error);
  }

  const webServer = spawn("node", ["web/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });

  webServer.on("error", (error) => {
    console.error("Failed to start web server:", error);
  });

  webServer.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`Web server exited with code ${code}, signal ${signal}`);
    }
  });

  process.on("exit", () => {
    webServer.kill();
  });

  process.on("SIGINT", () => {
    webServer.kill();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    webServer.kill();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
