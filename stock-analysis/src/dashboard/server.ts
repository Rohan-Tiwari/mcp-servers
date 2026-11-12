import "dotenv/config";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { store } from "../data/store.js";
import { startMonitor } from "../monitor.js";

const PORT = parseInt(process.env.DASHBOARD_PORT ?? "3838", 10);

export async function startDashboard(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/snapshot", (_req, res) => {
    const s = store.getSnapshot();
    res.json(s ?? { error: "Initializing — market monitor starting up" });
  });
  app.get("/api/quotes/:symbol", (req, res) => {
    const q = store.getQuote(req.params.symbol.toUpperCase());
    if (!q) return res.status(404).json({ error: "Symbol not found" });
    res.json(q);
  });
  app.get("/api/alerts", (req, res) => {
    res.json(store.getAlerts(req.query.unread === "true", 50));
  });
  app.post("/api/alerts/read-all", (_req, res) => {
    store.markAllRead();
    res.json({ ok: true });
  });
  app.get("/api/rankings", (req, res) => {
    const type = req.query.type as "stock" | "etf" | "bond" | undefined;
    res.json(store.getRankings(type, 15));
  });
  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildDashboardHTML());
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const wsClients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    wsClients.add(ws);
    const current = store.getSnapshot();
    if (current) ws.send(JSON.stringify({ type: "snapshot", data: current }));
    ws.on("close", () => wsClients.delete(ws));
  });

  wss.on("error", () => { /* HTTP server error handler manages this */ });

  store.subscribe((snapshot) => {
    const msg = JSON.stringify({ type: "snapshot", data: snapshot });
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[dashboard] Port ${PORT} already in use — dashboard likely already running at http://localhost:${PORT}`);
    } else {
      console.error("[dashboard] Server error:", err);
    }
  });

  server.listen(PORT, () => {
    console.log(`[dashboard] Running at http://localhost:${PORT}`);
  });
}

function buildDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>📊 Market Intelligence · Scalable Capital</title>
<style>
/* ═══════════════════════════════════════════════════════════════════
   TOKENS — dark / light
═══════════════════════════════════════════════════════════════════ */
:root {
  color-scheme: dark;
  --bg:        #07090f;
  --bg2:       #0c0f1a;
  --surface:   #101520;
  --surface2:  #161d2e;
  --surface3:  #1c2540;
  --border:    #1e2d45;
  --border2:   #253555;
  --text:      #e8edf5;
  --dim:       #9bacc8;
  --muted:     #5a6e8a;
  --green:     #00e5a0;
  --green2:    #00b87a;
  --red:       #ff4d6d;
  --red2:      #c9233f;
  --yellow:    #ffb627;
  --blue:      #3d7eff;
  --blue2:     #6fa3ff;
  --purple:    #b47dff;
  --cyan:      #00d4e8;
  --orange:    #ff7a2f;
  --shadow:    0 8px 32px rgba(0,0,0,.55);
  --radius:    12px;
  --radius-sm: 8px;
}
[data-theme="light"] {
  color-scheme: light;
  --bg:        #f0f4ff;
  --bg2:       #e4eaf8;
  --surface:   #ffffff;
  --surface2:  #f2f5fc;
  --surface3:  #e8edf8;
  --border:    #d0d9ee;
  --border2:   #b8c5e0;
  --text:      #0d1526;
  --dim:       #3a4f70;
  --muted:     #8090b0;
  --green:     #00a372;
  --green2:    #007a54;
  --red:       #e02040;
  --red2:      #b01030;
  --yellow:    #d48000;
  --blue:      #1a5fe8;
  --blue2:     #1a5fe8;
  --purple:    #7c3aed;
  --cyan:      #0098b0;
  --orange:    #d05a00;
  --shadow:    0 4px 20px rgba(0,30,80,.12);
}

/* ═══════════════════════════════════════════════════════════════════
   RESET & BASE
═══════════════════════════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', sans-serif;
  font-size: 13px; line-height: 1.5; min-height: 100vh;
  transition: background .3s, color .3s;
}
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
a { color: inherit; text-decoration: none; }

/* ═══════════════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════════════ */
header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
  height: 56px;
  display: flex; align-items: center; gap: 14px;
  position: sticky; top: 0; z-index: 200;
  box-shadow: 0 1px 0 var(--border), var(--shadow);
}
.logo { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
.logo-mark {
  width: 34px; height: 34px; border-radius: 9px;
  background: linear-gradient(135deg, #1a5fe8 0%, #7c3aed 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; box-shadow: 0 2px 10px rgba(58,130,246,.4);
}
.logo-copy .l1 { font-size: 14px; font-weight: 800; letter-spacing: -.4px; }
.logo-copy .l2 { font-size: 10px; color: var(--muted); margin-top: -2px; }

.hstats { display: flex; gap: 2px; margin-left: 10px; }
.hstat {
  display: flex; flex-direction: column; gap: 1px;
  padding: 4px 12px; border-radius: var(--radius-sm);
  background: var(--surface2); border: 1px solid var(--border);
  min-width: 80px;
}
.hstat-l { font-size: 9px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
.hstat-v { font-size: 12px; font-weight: 800; }

.spacer { flex: 1; }

/* sentiment pill */
.sent-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 13px; border-radius: 20px; font-size: 11px;
  font-weight: 800; letter-spacing: .4px; border: 1.5px solid;
  text-transform: uppercase;
}
.sent-pill.bullish { background: rgba(0,229,160,.1); color: var(--green); border-color: rgba(0,229,160,.3); }
.sent-pill.bearish { background: rgba(255,77,109,.1); color: var(--red); border-color: rgba(255,77,109,.3); }
.sent-pill.neutral  { background: rgba(61,126,255,.1); color: var(--blue2); border-color: rgba(61,126,255,.3); }
.sent-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }

/* live badge */
.live-badge {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 20px;
  background: rgba(0,229,160,.07); border: 1.5px solid rgba(0,229,160,.25);
  font-size: 10px; font-weight: 800; color: var(--green); letter-spacing: .5px;
}
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: blink 1.1s infinite; }

/* theme toggle */
.theme-btn {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--surface2); border: 1.5px solid var(--border2);
  color: var(--dim); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .2s, transform .2s; flex-shrink: 0;
}
.theme-btn:hover { background: var(--surface3); transform: rotate(20deg); }

#hdr-time { font-size: 10px; color: var(--muted); flex-shrink: 0; }
#hdr-model { font-size: 10px; color: var(--purple); flex-shrink: 0; display: flex; align-items: center; gap: 3px; }

@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes blink  { 0%,100%{opacity:1} 50%{opacity:.1} }

/* ═══════════════════════════════════════════════════════════════════
   TICKER TAPE
═══════════════════════════════════════════════════════════════════ */
.ticker-bar {
  background: var(--bg2); border-bottom: 1px solid var(--border);
  height: 30px; overflow: hidden; position: relative;
}
.ticker-track {
  display: inline-flex; align-items: center; white-space: nowrap;
  animation: scroll-ticker 55s linear infinite; height: 30px;
}
.ticker-track:hover { animation-play-state: paused; }
@keyframes scroll-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
.tick {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 0 16px; height: 30px; font-size: 11.5px; font-weight: 700;
  border-right: 1px solid var(--border); cursor: default;
}
.tick-sym { color: var(--dim); }
.tick-price { color: var(--text); }
.tick-arrow { font-size: 9px; }
.tick-chg.up   { color: var(--green); }
.tick-chg.down { color: var(--red); }

/* ═══════════════════════════════════════════════════════════════════
   MAIN GRID
═══════════════════════════════════════════════════════════════════ */
main { padding: 16px 18px 50px; max-width: 1640px; margin: 0 auto; }
.grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 14px; }
@media(max-width:1060px){ .grid3 { grid-template-columns: 1fr 1fr; } }
@media(max-width:680px){  .grid3 { grid-template-columns: 1fr; } }

/* ═══════════════════════════════════════════════════════════════════
   CARD
═══════════════════════════════════════════════════════════════════ */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
  transition: border-color .2s, box-shadow .2s;
}
.card:hover { border-color: var(--border2); box-shadow: 0 4px 20px rgba(0,0,0,.25); }
.card-hdr {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 9px;
  background: var(--surface2);
}
.card-icon { font-size: 20px; line-height: 1; }
.card-title { font-size: 13px; font-weight: 800; }
.card-sub { font-size: 10px; color: var(--muted); margin-top: 1px; }
.card-badge {
  margin-left: auto; padding: 2px 9px; border-radius: 10px;
  font-size: 10px; font-weight: 700; color: var(--muted);
  background: var(--surface3); border: 1px solid var(--border);
}

/* ═══════════════════════════════════════════════════════════════════
   ASSET TABLE — smooth in-place updates
═══════════════════════════════════════════════════════════════════ */
.asset-tbl { width: 100%; border-collapse: collapse; }
.asset-tbl thead th {
  padding: 6px 10px; text-align: left;
  font-size: 9px; font-weight: 800; color: var(--muted);
  text-transform: uppercase; letter-spacing: .7px;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
  position: sticky; top: 56px; /* stick under header */
}
.asset-tbl thead th:nth-child(3),
.asset-tbl thead th:nth-child(4) { text-align: right; }
.asset-tbl thead th:nth-child(6),
.asset-tbl thead th:nth-child(7) { text-align: center; }

/* Each row keyed by symbol — never destroyed, just updated */
.arow { cursor: pointer; transition: background .12s; }
.arow:hover { background: rgba(61,126,255,.06); }
.arow td { padding: 8px 10px; border-bottom: 1px solid rgba(30,45,69,.45); vertical-align: middle; }
.arow:last-child td { border-bottom: none; }

/* rank */
.rank { font-size: 11px; font-weight: 800; color: var(--muted); width: 22px; }
.rank.gold   { color: #ffd700; }
.rank.silver { color: #c0c0c0; }
.rank.bronze { color: #cd7f32; }

/* symbol cell */
.sym-wrap { display: flex; flex-direction: column; }
.sym-code { font-size: 12px; font-weight: 800; }
.sym-name { font-size: 10px; color: var(--muted); max-width: 115px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* price — transitions instead of flash */
.price-cell {
  font-size: 13px; font-weight: 800; text-align: right;
  transition: color .4s ease;
  will-change: color;
}
.price-cell.flash-up   { color: var(--green) !important; }
.price-cell.flash-down { color: var(--red)   !important; }

/* change */
.chg { text-align: right; font-size: 12px; font-weight: 800; transition: color .3s; }
.chg.up   { color: var(--green); }
.chg.down { color: var(--red); }

/* trend bar */
.tbar-wrap { display: flex; align-items: center; gap: 5px; }
.tbar-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; min-width: 36px; }
.tbar-fill { height: 100%; border-radius: 2px; transition: width .6s ease, background .6s ease; }
.tbar-num { font-size: 10px; color: var(--muted); width: 22px; text-align: right; }

/* signal badge */
.sig {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 7px; border-radius: 10px; font-size: 10px;
  font-weight: 800; letter-spacing: .2px; white-space: nowrap;
  border: 1px solid; transition: background .3s;
}
.sig.strong_buy  { background:rgba(0,229,160,.15); color:var(--green);  border-color:rgba(0,229,160,.3); }
.sig.buy         { background:rgba(0,229,160,.08); color:var(--green);  border-color:rgba(0,229,160,.2); }
.sig.hold        { background:rgba(255,182,39,.09); color:var(--yellow); border-color:rgba(255,182,39,.25); }
.sig.sell        { background:rgba(255,77,109,.08); color:var(--red);    border-color:rgba(255,77,109,.2); }
.sig.strong_sell { background:rgba(255,77,109,.16); color:var(--red);    border-color:rgba(255,77,109,.35); }

/* info button */
.ibtn {
  width: 21px; height: 21px; border-radius: 50%;
  background: var(--surface2); border: 1px solid var(--border2);
  color: var(--blue2); font-size: 11px; font-weight: 900;
  cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; transition: background .15s, transform .15s;
}
.ibtn:hover { background: rgba(61,126,255,.22); transform: scale(1.18); }

/* skeleton */
.skel { background: linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.3s infinite; border-radius:4px; height:12px; }
@keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

/* ═══════════════════════════════════════════════════════════════════
   ALERTS PANEL
═══════════════════════════════════════════════════════════════════ */
.alerts-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.alert-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 14px; border-bottom: 1px solid rgba(30,45,69,.45);
  transition: background .12s, opacity .3s;
}
.alert-row:last-child { border-bottom: none; }
.alert-row:hover { background: rgba(61,126,255,.04); }
.alert-row.read { opacity: .52; }
.alert-row.unread { border-left: 3px solid var(--blue); }
.asev { flex-shrink:0; padding:2px 8px; border-radius:9px; font-size:9px; font-weight:800; letter-spacing:.4px; margin-top:2px; }
.asev.critical { background:rgba(255,77,109,.2); color:var(--red); }
.asev.warning  { background:rgba(255,182,39,.15); color:var(--yellow); }
.asev.info     { background:rgba(61,126,255,.13); color:var(--blue2); }
.alert-body { flex:1; }
.alert-sym { font-size:12px; font-weight:800; }
.alert-msg { font-size:11.5px; color:var(--dim); margin-top:1px; }
.alert-time { font-size:10px; color:var(--muted); flex-shrink:0; padding-top:3px; }
.no-alerts { padding:24px; text-align:center; color:var(--muted); font-size:13px; }

/* ═══════════════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════════════ */
.overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.72);
  backdrop-filter:blur(6px); z-index:500;
  display:flex; align-items:center; justify-content:center;
  opacity:0; pointer-events:none; transition:opacity .22s;
}
.overlay.open { opacity:1; pointer-events:all; }
.modal {
  background:var(--surface); border:1px solid var(--border2);
  border-radius:16px; box-shadow:var(--shadow);
  width:500px; max-width:94vw; max-height:88vh;
  overflow:hidden; display:flex; flex-direction:column;
  transform:translateY(14px) scale(.96); transition:transform .22s;
}
.overlay.open .modal { transform:none; }
.modal-hdr {
  padding:16px 18px 12px; border-bottom:1px solid var(--border);
  display:flex; align-items:flex-start; gap:11px;
  background:var(--surface2);
}
.modal-sym {
  padding:4px 12px; border-radius:8px; font-size:15px; font-weight:900;
  background:rgba(61,126,255,.12); color:var(--blue2); flex-shrink:0;
  border:1px solid rgba(61,126,255,.2);
}
.modal-name { font-size:14px; font-weight:800; }
.modal-meta { font-size:10px; color:var(--muted); margin-top:2px; }
.modal-x {
  width:28px; height:28px; border-radius:50%;
  background:var(--surface3); border:1px solid var(--border);
  color:var(--muted); font-size:13px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:background .15s;
}
.modal-x:hover { background:var(--border2); color:var(--text); }
.modal-body { padding:16px 18px; overflow-y:auto; }
.stats-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
.mstat {
  background:var(--surface2); border:1px solid var(--border);
  border-radius:var(--radius-sm); padding:8px 12px; flex:1; min-width:80px;
}
.mstat-l { font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; }
.mstat-v { font-size:15px; font-weight:800; margin-top:2px; }
.modal-sec { margin-bottom:14px; }
.modal-sec-title { font-size:9px; font-weight:800; color:var(--muted); text-transform:uppercase; letter-spacing:.8px; margin-bottom:7px; }
.reasoning-box {
  background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm);
  padding:11px 13px; font-size:12.5px; color:var(--dim); line-height:1.7;
}
.src-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
.src-item {
  display:flex; align-items:center; gap:9px;
  padding:8px 12px; background:var(--surface2);
  border:1px solid var(--border); border-radius:var(--radius-sm);
  font-size:11.5px; color:var(--dim); transition:border-color .15s;
}
.src-item:hover { border-color:var(--blue); color:var(--blue2); }
.src-ico { font-size:16px; flex-shrink:0; }
.disclaimer {
  font-size:10px; color:var(--muted); line-height:1.6;
  padding:9px 12px; background:var(--bg2);
  border-radius:var(--radius-sm); border:1px solid var(--border);
}

/* ═══════════════════════════════════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════════════════════════════════ */
.statusbar {
  position:fixed; bottom:0; left:0; right:0; height:28px;
  background:var(--bg2); border-top:1px solid var(--border);
  display:flex; align-items:center; gap:8px; padding:0 14px;
  font-size:10.5px; color:var(--muted); z-index:300;
}
.sdot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.sdot.ok  { background:var(--green); animation:blink 2s infinite; }
.sdot.err { background:var(--red); }
.sdot.wait{ background:var(--yellow); }
.sr { margin-left:auto; display:flex; gap:12px; }
</style>
</head>
<body>

<!-- ═══ HEADER ════════════════════════════════════════════════════ -->
<header>
  <div class="logo">
    <div class="logo-mark">📊</div>
    <div class="logo-copy">
      <div class="l1">Market Intelligence</div>
      <div class="l2">Scalable Capital · Germany 🇩🇪</div>
    </div>
  </div>

  <div class="hstats">
    <div class="hstat"><span class="hstat-l">🌡 Sentiment</span><span class="hstat-v" id="hv-sent">—</span></div>
    <div class="hstat"><span class="hstat-l">🚀 Top Gainer</span><span class="hstat-v" id="hv-gain" style="color:var(--green)">—</span></div>
    <div class="hstat"><span class="hstat-l">💥 Top Loser</span><span class="hstat-v" id="hv-lose" style="color:var(--red)">—</span></div>
    <div class="hstat"><span class="hstat-l">🔔 Alerts</span><span class="hstat-v" id="hv-alrt" style="color:var(--yellow)">—</span></div>
  </div>

  <div class="spacer"></div>

  <div id="sent-pill" class="sent-pill neutral"><span class="sent-dot"></span><span id="sent-txt">Loading…</span></div>
  <div class="live-badge"><span class="live-dot"></span>LIVE</div>
  <span id="hdr-time">—</span>
  <span id="hdr-model">🤖 <span id="hdr-model-name">—</span></span>

  <button class="theme-btn" id="theme-toggle" title="Toggle theme" onclick="toggleTheme()">🌙</button>
</header>

<!-- ═══ TICKER TAPE ═══════════════════════════════════════════════ -->
<div class="ticker-bar">
  <div class="ticker-track" id="ticker-track">
    <span style="padding:0 24px;color:var(--muted);font-size:11px">⏳ Loading market data…</span>
  </div>
</div>

<!-- ═══ MAIN ══════════════════════════════════════════════════════ -->
<main>
  <div class="grid3">

    <div class="card">
      <div class="card-hdr">
        <span class="card-icon">🏆</span>
        <div><div class="card-title">Top Stocks</div><div class="card-sub">AI-ranked · Real-time · Scalable Capital</div></div>
        <span class="card-badge" id="stocks-ct">— assets</span>
      </div>
      <table class="asset-tbl">
        <thead><tr>
          <th>#</th><th>Symbol</th><th>Price</th><th>Chg %</th><th>Trend</th><th>Signal</th><th>ℹ️</th>
        </tr></thead>
        <tbody id="tbody-stocks">${skelRows(8)}</tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-hdr">
        <span class="card-icon">📈</span>
        <div><div class="card-title">Top ETFs</div><div class="card-sub">AI-ranked · Real-time · Scalable Capital</div></div>
        <span class="card-badge" id="etfs-ct">— assets</span>
      </div>
      <table class="asset-tbl">
        <thead><tr>
          <th>#</th><th>Symbol</th><th>Price</th><th>Chg %</th><th>Trend</th><th>Signal</th><th>ℹ️</th>
        </tr></thead>
        <tbody id="tbody-etfs">${skelRows(8)}</tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-hdr">
        <span class="card-icon">🏛️</span>
        <div><div class="card-title">Top Bonds</div><div class="card-sub">AI-ranked · Real-time · Scalable Capital</div></div>
        <span class="card-badge" id="bonds-ct">— assets</span>
      </div>
      <table class="asset-tbl">
        <thead><tr>
          <th>#</th><th>Symbol</th><th>Price</th><th>Chg %</th><th>Trend</th><th>Signal</th><th>ℹ️</th>
        </tr></thead>
        <tbody id="tbody-bonds">${skelRows(8)}</tbody>
      </table>
    </div>

  </div>

  <!-- ═══ ALERTS ════════════════════════════════════════════════ -->
  <div class="alerts-panel">
    <div class="card-hdr">
      <span class="card-icon">🔔</span>
      <div><div class="card-title">Live Alerts</div><div class="card-sub">⚡ Price spikes · 📊 Volume surges · 🔄 Trend reversals</div></div>
      <span class="card-badge" id="alerts-ct" style="margin-left:auto">0 alerts</span>
      <button onclick="markAllRead()" style="margin-left:8px;background:var(--surface3);border:1px solid var(--border2);color:var(--dim);padding:4px 11px;border-radius:8px;cursor:pointer;font-size:10px;font-weight:700;transition:border-color .15s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border2)'">✅ Mark all read</button>
      <button onclick="openSrcModal()" style="margin-left:5px;background:var(--surface3);border:1px solid var(--border2);color:var(--blue2);padding:4px 11px;border-radius:8px;cursor:pointer;font-size:10px;font-weight:700;transition:border-color .15s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border2)'">📡 Sources</button>
    </div>
    <div id="alerts-body"><div class="no-alerts">☀️ Market is calm — no alerts yet</div></div>
  </div>
</main>

<!-- ═══ DETAIL MODAL ══════════════════════════════════════════════ -->
<div class="overlay" id="detail-modal" onclick="if(event.target===this)closeDetail()">
  <div class="modal">
    <div class="modal-hdr">
      <div class="modal-sym" id="m-sym">—</div>
      <div style="flex:1"><div class="modal-name" id="m-name">—</div><div class="modal-meta" id="m-meta">—</div></div>
      <button class="modal-x" onclick="closeDetail()">✕</button>
    </div>
    <div class="modal-body">
      <div class="stats-row" id="m-stats"></div>
      <div class="modal-sec">
        <div class="modal-sec-title">🤖 AI Reasoning — Claude Opus</div>
        <div class="reasoning-box" id="m-reason">—</div>
      </div>
      <div class="modal-sec">
        <div class="modal-sec-title">📡 Data Sources</div>
        <ul class="src-list">
          <li><a class="src-item" href="https://finance.yahoo.com" target="_blank"><span class="src-ico">📈</span><div><strong>Yahoo Finance</strong><br><span style="font-size:10px;color:var(--muted)">Real-time quotes, volume, market cap — refreshed every 5 seconds</span></div></a></li>
          <li><a class="src-item" href="https://scalable.capital" target="_blank"><span class="src-ico">🏦</span><div><strong>Scalable Capital</strong><br><span style="font-size:10px;color:var(--muted)">Asset universe for German retail investors</span></div></a></li>
          <li><a class="src-item" href="https://anthropic.com/claude" target="_blank"><span class="src-ico">🧠</span><div><strong>Claude Opus (Anthropic)</strong><br><span style="font-size:10px;color:var(--muted)">AI-powered ranking, buy/sell signals & reasoning — re-ranked every ~60s</span></div></a></li>
        </ul>
      </div>
      <div class="disclaimer">⚠️ <strong>Not financial advice.</strong> For informational purposes only. AI rankings are algorithmic and do not constitute professional investment advice.</div>
    </div>
  </div>
</div>

<!-- ═══ SOURCES MODAL ═════════════════════════════════════════════ -->
<div class="overlay" id="src-modal" onclick="if(event.target===this)closeSrcModal()">
  <div class="modal">
    <div class="modal-hdr">
      <div class="modal-sym" style="background:rgba(100,200,255,.1);color:var(--cyan);border-color:rgba(100,200,255,.2)">📡</div>
      <div style="flex:1"><div class="modal-name">Data Sources & Methodology</div><div class="modal-meta">How this dashboard works</div></div>
      <button class="modal-x" onclick="closeSrcModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-sec">
        <div class="modal-sec-title">⚡ Real-Time Data</div>
        <ul class="src-list">
          <li><a class="src-item" href="https://finance.yahoo.com" target="_blank"><span class="src-ico">📈</span><div><strong>Yahoo Finance API</strong><br><span style="font-size:11px;color:var(--muted)">Live price, volume, change %, market cap — 70+ assets refreshed every 5s</span></div></a></li>
          <li><a class="src-item" href="https://scalable.capital" target="_blank"><span class="src-ico">🏦</span><div><strong>Scalable Capital</strong><br><span style="font-size:11px;color:var(--muted)">Curated universe: DAX stocks, MSCI World ETFs, bond ETFs — all tradeable in Germany</span></div></a></li>
        </ul>
      </div>
      <div class="modal-sec">
        <div class="modal-sec-title">🧠 AI Analysis</div>
        <ul class="src-list">
          <li><a class="src-item" href="https://anthropic.com/claude" target="_blank"><span class="src-ico">🤖</span><div><strong>Claude Opus (Anthropic)</strong><br><span style="font-size:11px;color:var(--muted)">Ranks all assets every ~60s using live price, volume & 5-day momentum. Generates buy/sell signals with plain-language reasoning.</span></div></a></li>
        </ul>
      </div>
      <div class="modal-sec">
        <div class="modal-sec-title">🔔 Alert System</div>
        <div class="reasoning-box">
          Alerts fire automatically when:<br>
          🚀 <strong>Price spike</strong> — daily change ≥ +3%<br>
          💥 <strong>Price drop</strong> — daily change ≤ −3%<br>
          ⚡ <strong>Volume surge</strong> — volume ≥ 2× rolling average<br>
          🏆 <strong>Momentum signal</strong> — consecutive strong up days
        </div>
      </div>
      <div class="modal-sec">
        <div class="modal-sec-title">🔄 Update Cadence</div>
        <div class="reasoning-box">
          🕐 <strong>Quote prices</strong> — every 5 seconds (Yahoo Finance)<br>
          🧠 <strong>AI ranking</strong> — every ~60 seconds (Claude Opus)<br>
          ⚡ <strong>Dashboard push</strong> — instant via WebSocket on every change
        </div>
      </div>
      <div class="disclaimer">⚠️ <strong>Not financial advice.</strong> Past performance does not guarantee future results. Always conduct your own research.</div>
    </div>
  </div>
</div>

<!-- ═══ STATUS BAR ════════════════════════════════════════════════ -->
<div class="statusbar">
  <div class="sdot wait" id="sdot"></div>
  <span id="stxt">Connecting…</span>
  <div class="sr">
    <span id="sr-quotes">0 assets</span>
    <span id="sr-alerts">0 alerts</span>
    <span id="sr-next">—</span>
  </div>
</div>

<script>
// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════
const $  = (id) => document.getElementById(id);
const f2 = (n) => n == null ? '—' : Number(n).toFixed(2);
const fK = (n) => !n ? '—' : n>=1e12?(n/1e12).toFixed(1)+'T':n>=1e9?(n/1e9).toFixed(1)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n.toLocaleString();
const fT = (d) => d ? new Date(d).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
const esc= (s) => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const SIG_LABELS = {
  strong_buy:  '⬆⬆ Strong Buy',
  buy:         '⬆ Buy',
  hold:        '➡ Hold',
  sell:        '⬇ Sell',
  strong_sell: '⬇⬇ Strong Sell',
};
const ALERT_ICONS = { price_spike:'🚀', price_drop:'💥', volume_surge:'⚡', new_ath:'🏆', trend_reversal:'🔄', analyst_upgrade:'⭐' };

function scoreColor(s) {
  if (s >= 75) return 'var(--green)';
  if (s >= 55) return '#4ade80';
  if (s >= 40) return 'var(--yellow)';
  return 'var(--red)';
}
function rankClass(r) {
  return r===1?'gold':r===2?'silver':r===3?'bronze':'';
}

// ══════════════════════════════════════════════════════════════════
//  IN-PLACE TABLE UPDATE — never destroys rows, just patches cells
// ══════════════════════════════════════════════════════════════════
const prevPrices = {}; // symbol → last known price

function upsertTable(tbodyId, ctId, assets, eurRate) {
  const tbody = $(tbodyId);
  if (!assets || assets.length === 0) return;

  // Build a map of existing rows
  const existingRows = {};
  for (const tr of tbody.querySelectorAll('tr.arow')) {
    existingRows[tr.dataset.sym] = tr;
  }

  const fragment = document.createDocumentFragment();
  const toRemove = new Set(Object.keys(existingRows));

  assets.forEach((a, i) => {
    toRemove.delete(a.symbol);
    const pos = (a.changePercent ?? 0) >= 0;
    const sig = a.signal || 'hold';
    const score = Math.round(a.trendScore ?? 0);
    const eurPrice = a.currency !== 'EUR' && eurRate ? (a.price * eurRate).toFixed(2) : null;
    const priceStr = f2(a.price) + ' <span style="font-size:10px;color:var(--muted)">' + esc(a.currency) + '</span>'
      + (eurPrice ? '<br><span style="font-size:10px;color:var(--cyan)">€' + eurPrice + '</span>' : '');

    let tr = existingRows[a.symbol];
    if (!tr) {
      // ── CREATE new row ──────────────────────────────────────────
      tr = document.createElement('tr');
      tr.className = 'arow';
      tr.dataset.sym = a.symbol;
      tr.onclick = () => openDetail(a);
      tr.innerHTML = \`
        <td><span class="rank \${rankClass(a.rank)}">#\${a.rank}</span></td>
        <td><div class="sym-wrap"><span class="sym-code">\${esc(a.symbol)}</span><span class="sym-name">\${esc(a.name)}</span></div></td>
        <td class="price-cell" data-price="\${a.price}">\${priceStr}</td>
        <td class="chg \${pos?'up':'down'}">\${pos?'+':''}\${f2(a.changePercent)}%</td>
        <td>
          <div class="tbar-wrap">
            <div class="tbar-track"><div class="tbar-fill" style="width:\${score}%;background:\${scoreColor(score)}"></div></div>
            <span class="tbar-num">\${score}</span>
          </div>
        </td>
        <td style="text-align:center"><span class="sig \${sig}">\${SIG_LABELS[sig]||sig}</span></td>
        <td style="text-align:center"><button class="ibtn" onclick="event.stopPropagation();openDetail(\${JSON.stringify(a).replace(/'/g,'\\\\u0027')})">ℹ</button></td>
      \`;
    } else {
      // ── PATCH existing row — no DOM tear-down ──────────────────
      // rank
      const rankEl = tr.querySelector('.rank');
      rankEl.className = 'rank ' + rankClass(a.rank);
      rankEl.textContent = '#' + a.rank;

      // symbol name (can change)
      tr.querySelector('.sym-name').textContent = a.name;

      // price — smooth color flash only if changed
      const priceEl = tr.querySelector('.price-cell');
      const prev = prevPrices[a.symbol];
      if (prev != null && a.price !== prev) {
        const dir = a.price > prev ? 'flash-up' : 'flash-down';
        priceEl.classList.add(dir);
        setTimeout(() => priceEl.classList.remove(dir), 500);
      }
      priceEl.innerHTML = priceStr;
      priceEl.dataset.price = a.price;

      // change %
      const chgEl = tr.querySelector('.chg');
      chgEl.className = 'chg ' + (pos ? 'up' : 'down');
      chgEl.textContent = (pos?'+':'') + f2(a.changePercent) + '%';

      // trend bar
      const fill = tr.querySelector('.tbar-fill');
      fill.style.width = score + '%';
      fill.style.background = scoreColor(score);
      tr.querySelector('.tbar-num').textContent = score;

      // signal
      const sigEl = tr.querySelector('.sig');
      sigEl.className = 'sig ' + sig;
      sigEl.textContent = SIG_LABELS[sig] || sig;

      // update onclick data
      tr.onclick = () => openDetail(a);
      tr.querySelector('.ibtn').onclick = (e) => { e.stopPropagation(); openDetail(a); };
    }

    prevPrices[a.symbol] = a.price;
    fragment.appendChild(tr);
  });

  // Remove symbols no longer in the list
  for (const sym of toRemove) {
    existingRows[sym]?.remove();
  }

  // Re-order: append in rank order (avoids full re-render)
  tbody.appendChild(fragment);

  if (ctId) $(ctId).textContent = assets.length + ' assets';
}

// ══════════════════════════════════════════════════════════════════
//  TICKER TAPE — also in-place
// ══════════════════════════════════════════════════════════════════
function updateTicker(stocks, etfs) {
  const items = [...(stocks||[]).slice(0,8), ...(etfs||[]).slice(0,5)];
  if (!items.length) return;
  const html = items.map(a => {
    const pos = (a.changePercent??0) >= 0;
    return \`<span class="tick">
      <span class="tick-sym">\${esc(a.symbol)}</span>
      <span class="tick-price">\${f2(a.price)}</span>
      <span class="tick-arrow \${pos?'up':'down'}">\${pos?'▲':'▼'}</span>
      <span class="tick-chg \${pos?'up':'down'}">\${Math.abs(a.changePercent??0).toFixed(2)}%</span>
    </span>\`;
  }).join('');
  $('ticker-track').innerHTML = html + html; // double for infinite loop
}

// ══════════════════════════════════════════════════════════════════
//  ALERTS — in-place keyed by alert id
// ══════════════════════════════════════════════════════════════════
const renderedAlerts = new Set();
function updateAlerts(alerts) {
  const body = $('alerts-body');
  if (!alerts || alerts.length === 0) {
    body.innerHTML = '<div class="no-alerts">☀️ Market is calm — no alerts yet</div>';
    $('alerts-ct').textContent = '0 alerts';
    return;
  }
  const unread = alerts.filter(a => !a.read).length;
  $('alerts-ct').textContent = alerts.length + ' alerts' + (unread > 0 ? \` · \${unread} 🆕\` : '');

  // Build index of existing alert rows
  const existing = {};
  for (const el of body.querySelectorAll('[data-aid]')) existing[el.dataset.aid] = el;

  const frag = document.createDocumentFragment();
  alerts.slice(0,30).forEach(a => {
    let el = existing[a.id];
    if (!el) {
      el = document.createElement('div');
      el.dataset.aid = a.id;
      const icon = ALERT_ICONS[a.type] || '🔔';
      el.innerHTML = \`
        <span class="asev \${a.severity}">\${a.severity.toUpperCase()}</span>
        <div class="alert-body">
          <div class="alert-sym">\${icon} \${esc(a.symbol)}</div>
          <div class="alert-msg">\${esc(a.message)}</div>
        </div>
        <span class="alert-time">\${fT(a.timestamp)}</span>
      \`;
    }
    el.className = 'alert-row ' + (a.read ? 'read' : 'unread');
    frag.appendChild(el);
  });
  body.innerHTML = '';
  body.appendChild(frag);
}

// ══════════════════════════════════════════════════════════════════
//  HEADER STATS
// ══════════════════════════════════════════════════════════════════
function updateHeader(s) {
  const pill = $('sent-pill');
  const sent = s.marketSentiment || 'neutral';
  pill.className = 'sent-pill ' + sent;
  $('sent-txt').textContent = { bullish:'🐂 Bullish', bearish:'🐻 Bearish', neutral:'😐 Neutral' }[sent] || sent;

  const hv = $('hv-sent');
  hv.textContent = sent.charAt(0).toUpperCase() + sent.slice(1);
  hv.style.color = sent==='bullish'?'var(--green)':sent==='bearish'?'var(--red)':'var(--blue2)';

  const all = [...(s.topStocks||[]),...(s.topETFs||[])];
  if (all.length) {
    const g = all.reduce((a,b) => (b.changePercent||0)>(a.changePercent||0)?b:a);
    const l = all.reduce((a,b) => (b.changePercent||0)<(a.changePercent||0)?b:a);
    $('hv-gain').textContent = g.symbol + ' +' + f2(g.changePercent) + '%';
    $('hv-lose').textContent = l.symbol + ' ' + f2(l.changePercent) + '%';
  }
  const unread = (s.alerts||[]).filter(a=>!a.read).length;
  $('hv-alrt').textContent = unread > 0 ? unread + ' new 🔴' : (s.alerts||[]).length + ' total';
  $('hv-alrt').style.color = unread > 0 ? 'var(--red)' : 'var(--yellow)';
  $('hdr-time').textContent = '🕐 ' + fT(s.lastUpdated);
  $('hdr-model-name').textContent = s.analysisModel || '';
}

// ══════════════════════════════════════════════════════════════════
//  MAIN APPLY — called on every WebSocket push
// ══════════════════════════════════════════════════════════════════
function applySnapshot(s) {
  if (!s || s.error) return;
  const eurRate = s.eurUsdRate || 0.92;
  lastEurRate = eurRate;
  upsertTable('tbody-stocks', 'stocks-ct', s.topStocks, eurRate);
  upsertTable('tbody-etfs',   'etfs-ct',   s.topETFs,   eurRate);
  upsertTable('tbody-bonds',  'bonds-ct',  s.topBonds,  eurRate);
  updateAlerts(s.alerts);
  updateTicker(s.topStocks, s.topETFs);
  updateHeader(s);

  const total = (s.topStocks?.length||0)+(s.topETFs?.length||0)+(s.topBonds?.length||0);
  $('sr-quotes').textContent = total + ' ranked';
  $('sr-alerts').textContent = (s.alerts||[]).length + ' alerts';
  $('sr-next').textContent = eurRate ? '€1 = $' + (1/eurRate).toFixed(4) : '';
}

// ══════════════════════════════════════════════════════════════════
//  DETAIL MODAL
// ══════════════════════════════════════════════════════════════════
let lastEurRate = 0.92;
function openDetail(a) {
  const pos = (a.changePercent??0) >= 0;
  const eurPrice = a.currency !== 'EUR' && lastEurRate ? (a.price * lastEurRate).toFixed(2) : null;
  $('m-sym').textContent = a.symbol;
  $('m-name').textContent = a.name || a.symbol;
  $('m-meta').textContent = (a.type||'').toUpperCase() + ' · ' + (a.exchange||'') + ' · ' + (a.currency||'');
  $('m-stats').innerHTML = [
    stat('💰 Price', f2(a.price) + ' ' + (a.currency||'')),
    eurPrice ? stat('💶 Price (EUR)', '€' + eurPrice) : '',
    stat(pos?'📈 Change':'📉 Change', (pos?'+':'') + f2(a.changePercent) + '%', pos?'var(--green)':'var(--red)'),
    stat('🎯 Trend Score', Math.round(a.trendScore||0) + '/100', scoreColor(a.trendScore||0)),
    stat('📊 Signal', SIG_LABELS[a.signal]||a.signal||'—'),
    stat('📦 Volume', fK(a.volume)),
    a.marketCap ? stat('🏢 Mkt Cap', fK(a.marketCap)) : '',
    a.momentum!=null ? stat((a.momentum>=0?'⬆':'⬇') + ' 5d Mom.', (a.momentum>=0?'+':'')+f2(a.momentum)+'%', a.momentum>=0?'var(--green)':'var(--red)') : '',
  ].join('');
  $('m-reason').innerHTML = a.reasoning
    ? esc(a.reasoning).replace(/\\*\\*(.*?)\\*\\*/g,'<strong>$1</strong>')
    : '<em style="color:var(--muted)">No AI reasoning available yet.</em>';
  $('detail-modal').classList.add('open');
}
function stat(label, value, color) {
  return \`<div class="mstat"><div class="mstat-l">\${esc(label)}</div><div class="mstat-v" \${color?'style="color:'+color+'"':''}>\${esc(value)}</div></div>\`;
}
function closeDetail() { $('detail-modal').classList.remove('open'); }

// ══════════════════════════════════════════════════════════════════
//  SOURCES MODAL
// ══════════════════════════════════════════════════════════════════
function openSrcModal()  { $('src-modal').classList.add('open'); }
function closeSrcModal() { $('src-modal').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key==='Escape') { closeDetail(); closeSrcModal(); }});

async function markAllRead() {
  await fetch('/api/alerts/read-all', { method: 'POST' });
  const s = await (await fetch('/api/snapshot')).json();
  applySnapshot(s);
}

// ══════════════════════════════════════════════════════════════════
//  THEME TOGGLE
// ══════════════════════════════════════════════════════════════════
let dark = true;
function toggleTheme() {
  dark = !dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  $('theme-toggle').textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}
// Restore saved theme
(function() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') { dark = false; document.documentElement.setAttribute('data-theme','light'); $('theme-toggle') && ($('theme-toggle').textContent='☀️'); }
})();

// ══════════════════════════════════════════════════════════════════
//  WEBSOCKET
// ══════════════════════════════════════════════════════════════════
function connect() {
  const ws = new WebSocket('ws://' + location.host + '/ws');
  ws.onopen = () => {
    $('sdot').className = 'sdot ok';
    $('stxt').textContent = '🟢 Connected · Live feed active';
  };
  ws.onmessage = (e) => {
    try { const m = JSON.parse(e.data); if (m.type === 'snapshot') applySnapshot(m.data); } catch {}
  };
  ws.onclose = () => {
    $('sdot').className = 'sdot err';
    $('stxt').textContent = '🔴 Disconnected — reconnecting…';
    setTimeout(connect, 3000);
  };
  ws.onerror = () => ws.close();
}

// Initial REST load then connect WebSocket
fetch('/api/snapshot').then(r=>r.json()).then(applySnapshot).catch(()=>{});
connect();
</script>
</body>
</html>`;
}

function skelRows(n: number): string {
  return Array.from({ length: n }, (_, i) =>
    `<tr style="animation-delay:${i * 60}ms">
      ${Array.from({ length: 7 }, () =>
        `<td><div class="skel" style="width:${55 + Math.random() * 40 | 0}%;opacity:.6"></div></td>`
      ).join("")}
    </tr>`
  ).join("");
}

if (process.argv[1]?.endsWith("dashboard/server.ts") || process.argv[1]?.endsWith("dashboard/server.js")) {
  await startMonitor();
  await startDashboard();
}
