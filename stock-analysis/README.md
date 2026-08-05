# Stock Analysis MCP Server

Real-time stock, ETF, and bond analysis for **Scalable Capital Germany** users.

## Features

- **Real-time quotes** from Yahoo Finance — refreshed every 5 seconds
- **AI-powered rankings** via Claude Opus 4 — top 10 stocks, ETFs, bonds with buy/sell signals and reasoning
- **Instant alerts** for price spikes/drops (≥3%), volume surges (2× average), and momentum reversals
- **Native OS notifications** for critical market events
- **Live web dashboard** at `http://localhost:3838` with WebSocket push
- **MCP tools** usable directly from Claude Desktop or any MCP client

## Setup

```bash
cd stock-analysis
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm install
```

## Run

```bash
# Start MCP server + dashboard + monitor all at once
npm run dev

# Or build and run
npm run build
npm start
```

The dashboard opens at **http://localhost:3838**.

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_market_snapshot` | Full AI-ranked snapshot: top stocks, ETFs, bonds + alerts |
| `get_top_ranked` | Top 10 by type (`stock`/`etf`/`bond`) with signals |
| `get_quote` | Live price for any Scalable Capital symbol |
| `get_alerts` | Recent price spike/drop/volume alerts |
| `ask_market` | Ask Claude Opus a freeform market question |
| `search_assets` | Find assets by name or symbol |
| `get_dashboard_url` | Get the live dashboard URL |

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stock-analysis": {
      "command": "node",
      "args": ["/Users/I758976/Documents/R_D/mcp_servers/stock-analysis/dist/server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

Or with `tsx` for development (no build step):

```json
{
  "mcpServers": {
    "stock-analysis": {
      "command": "npx",
      "args": ["tsx", "/Users/I758976/Documents/R_D/mcp_servers/stock-analysis/src/server.ts"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | required | Your Anthropic API key |
| `DASHBOARD_PORT` | `3838` | Web dashboard port |
| `POLL_INTERVAL_MS` | `5000` | Quote refresh interval (ms) |

## Architecture

```
src/
  server.ts          — MCP server (stdio transport, 7 tools)
  monitor.ts         — Background polling loop: quotes + AI ranking cycle
  notifier.ts        — Alert detection + OS notifications
  types.ts           — Shared TypeScript types
  ai/
    analyzer.ts      — Claude Opus ranking, sentiment, Q&A
  data/
    assets.ts        — Scalable Capital Germany tradeable universe
    store.ts         — In-memory state shared across all modules
    yahooFinance.ts  — Yahoo Finance quote + momentum fetcher
  dashboard/
    server.ts        — Express + WebSocket dashboard + self-contained HTML UI
```

## Asset Universe

- **40 stocks**: DAX blue chips (SAP, Siemens, BMW…) + US large caps (AAPL, NVDA, META…)
- **20 ETFs**: MSCI World, S&P 500, DAX, EM, NASDAQ 100 trackers (iShares, Vanguard, SPDR)
- **10 bond ETFs**: US Treasury, corporate, global aggregate
