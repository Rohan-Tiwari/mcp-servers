# Research Fetcher MCP Server

Fetches top research papers every 3 hours from arXiv, Semantic Scholar, and Papers With Code. Uses **Claude Opus** to rank and summarize the top 10 by impact and relevance.

## Topics Tracked

AI · LLMs · Agents · Performance · Algorithms · Distributed Systems · Kubernetes · ML Infrastructure

## Quick Start

```bash
cd /Users/I758976/Documents/Joule_Dev/architecture/R_D/mcp_servers/research-fetcher
npm install
node src/index.js   # starts MCP server + web platform on port 3737
```

Open your browser: **http://localhost:3737**

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_research_papers` | Get latest papers, optional `topic` + `limit` filters |
| `fetch_research_now` | Trigger an immediate fetch from all sources |
| `get_paper_details` | Get full details for a paper by `paper_id` |
| `get_topics` | Get all topics with paper counts |
| `get_last_updated` | Get last fetch timestamp + next scheduled fetch |

## Claude Global Settings

The server is registered as `research-fetcher` in `~/.claude/settings.json`. After adding it, restart Claude Code to load the server.

```json
"research-fetcher": {
  "command": "node",
  "args": ["/Users/I758976/Documents/Joule_Dev/architecture/R_D/mcp_servers/research-fetcher/src/index.js"],
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "...",
    "ANTHROPIC_BASE_URL": "http://localhost:6655/anthropic/",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-latest"
  },
  "autoApprove": ["get_research_papers", "get_topics", "get_last_updated", "get_paper_details"],
  "type": "stdio"
}
```

## Architecture

```
src/index.js     — MCP server (5 tools)
src/fetcher.js   — Fetches from arXiv, Semantic Scholar, Papers With Code
src/ranker.js    — Claude Opus ranks top 10 papers
src/scheduler.js — Cron job every 3 hours (0 */3 * * *)
src/storage.js   — Persists to data/papers.json
web/server.js    — Express API + static server on :3737
web/public/      — Dark-theme frontend with topic filters
data/papers.json — Paper cache (auto-created)
```
