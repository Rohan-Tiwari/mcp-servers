/* ═══════════════════════════════════════════════════════════
   Research Digest — app.js  (Rohan Tiwari's research intelligence)
   • Top Picks: 40 Claude-Opus-ranked digest cards
   • "— Also Fetched —" reference cards for unranked raw papers
   • Most Cited tab (OpenAlex, citation-ranked)
   • Inverted-index prefix search over EVERYTHING, with <mark> highlight
   • Built-in + custom topic filters (localStorage "rt_customTopics")
   • Placeholder suppression, abstract fallback
   • Sort (rank / score / date) + digest/compact view toggle
   • Dark / light theme (localStorage "rt_theme")
   • SSE non-blocking refresh with toast progress
   • Live countdown to next scheduled fetch
═══════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────
let rankedPapers   = []      // /api/papers — Claude-ranked top picks
let rawPapers      = []      // /api/raw-papers — unranked reference set
let citedPapers    = []      // /api/cited — most-cited
let newsItems       = []      // /api/news — intel feed
let archiveSessions = []      // /api/news/archive — saved sessions
let filteredRanked = []
let filteredRaw    = []
let activeTopic    = ""
let searchQuery    = ""
let sortBy         = "rank"
let viewMode       = "digest"
let newsFilter     = ""      // sig filter for news: ""|"high"|"medium"|"lab"|"framework"|"research"
let customTopics   = JSON.parse(localStorage.getItem("rt_customTopics") || "[]")
let fetchSSE       = null
let newsCountdown  = null    // interval for live news timer

// ── Placeholder detection ────────────────────────────────
// Strings that are useless filler — never surface them in the UI.
const PLACEHOLDER_PATTERNS = [
  /^see abstract/i,
  /^refer to the full paper/i,
  /^read the paper/i,
  /^no (abstract|results|data|summary) available/i,
  /^not (stated|mentioned|provided|specified|available)/i,
  /^n\/?a$/i,
  /^none$/i,
  /^-+$/,
  /^tbd$/i,
  /^unknown$/i,
]
function isPlaceholder(text) {
  if (!text || !text.trim()) return true
  return PLACEHOLDER_PATTERNS.some(r => r.test(text.trim()))
}

// ── Inverted index (prefix search over ranked + raw combined) ──
let invertedIndex = {}          // token -> Set(paperRef)

function paperText(p) {
  return [
    p.title, p.abstract, p.headline,
    p.problem, p.solution, p.results, p.impact,
    p.topicLabel, p.topic, p.source, p.venue,
    ...(p.authors || [])
  ].filter(Boolean).join(" ").toLowerCase()
}

function buildIndex(papers) {
  invertedIndex = {}
  for (const p of papers) {
    const tokens = paperText(p).match(/\b\w{2,}\b/g) || []
    for (const tok of new Set(tokens)) {
      if (!invertedIndex[tok]) invertedIndex[tok] = new Set()
      invertedIndex[tok].add(p)
    }
  }
}

// Returns a Set of matching paper refs, or null when query is empty.
function searchIndex(query) {
  if (!query.trim()) return null
  const tokens = query.toLowerCase().match(/\b\w{2,}\b/g) || []
  if (!tokens.length) return new Set()
  const keys = Object.keys(invertedIndex)
  let result = null
  for (const tok of tokens) {
    const union = new Set()
    for (const k of keys) {
      if (k.startsWith(tok)) for (const ref of invertedIndex[k]) union.add(ref)
    }
    result = result === null ? union : new Set([...result].filter(x => union.has(x)))
    if (!result.size) break
  }
  return result || new Set()
}

// ── Topic matching ───────────────────────────────────────
function paperTopic(p) { return p.topicLabel || p.topic || "AI" }

function matchesTopic(p) {
  if (!activeTopic) return true
  const tl = activeTopic.toLowerCase()
  const pt = paperTopic(p).toLowerCase()
  if (pt === tl) return true
  // custom / free-text topics: fall back to content match
  return `${p.title || ""} ${p.abstract || ""}`.toLowerCase().includes(tl)
}

// ── Filter + sort ────────────────────────────────────────
function applyFilters() {
  const hits = searchIndex(searchQuery)   // null == no query

  // Ranked (top picks)
  let ranked = rankedPapers.filter(matchesTopic)
  if (hits) ranked = ranked.filter(p => hits.has(p))

  const sorted = [...ranked]
  if (sortBy === "date")       sorted.sort((a, b) => new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0))
  else if (sortBy === "score") sorted.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
  else                         sorted.sort((a, b) => (a.rank || 99) - (b.rank || 99))
  filteredRanked = sorted

  // Reference (also fetched) — exclude anything already in the ranked set
  const rankedIds = new Set(rankedPapers.map(p => p.id))
  let raw = rawPapers.filter(p => !rankedIds.has(p.id)).filter(matchesTopic)
  if (hits) raw = raw.filter(p => hits.has(p))
  raw.sort((a, b) => new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0))
  filteredRaw = raw

  renderAll()
  updateSearchBanner()
  updateRankedStat()
}

function updateRankedStat() {
  const el = document.getElementById("stat-ranked")
  if (el) el.innerHTML = `<i class="fas fa-star"></i> ${rankedPapers.length} top picks`
}

function updateSearchBanner() {
  const banner = document.getElementById("search-banner")
  const label  = document.getElementById("search-query-label")
  if (!banner) return
  if (searchQuery) {
    if (label) label.textContent = searchQuery
    banner.classList.remove("hidden")
  } else {
    banner.classList.add("hidden")
  }
}

// ── Escaping + highlight ─────────────────────────────────
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
function hl(text, q) {
  if (!text) return ""
  if (!q) return esc(text)
  const toks = q.toLowerCase().match(/\b\w{2,}\b/g) || []
  if (!toks.length) return esc(text)
  return esc(text).replace(new RegExp(`(${toks.map(escRe).join("|")})`, "gi"), "<mark>$1</mark>")
}

// ── Class + format helpers ───────────────────────────────
function rankClass(rank) {
  if (rank === 1) return "rank-1"
  if (rank === 2) return "rank-2"
  if (rank === 3) return "rank-3"
  return "rank-n"
}
function scoreClass(s) { return s >= 80 ? "score-hi" : s >= 60 ? "score-md" : "score-lo" }
function topicClass(t) { return "t-" + String(t || "ai").toLowerCase().replace(/\s+/g, "") }
function srcClass(s)   { return "src-" + String(s || "").toLowerCase().replace(/\s+/g, "-") }
function authorLine(p) {
  const a = p.authors || []
  return a.slice(0, 3).join(", ") + (a.length > 3 ? ` +${a.length - 3}` : "")
}
function formatDate(d) {
  if (!d) return ""
  const dt = new Date(d)
  if (isNaN(dt)) return d
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

// ── Summary row (hides placeholders) ─────────────────────
function summaryRow(key, icon, label, text, q) {
  if (isPlaceholder(text)) return ""   // hide entirely — never show filler
  return `<div class="summary-row">
    <div class="summary-icon icon-${key}"><i class="fas fa-${icon}"></i></div>
    <div class="summary-text">
      <div class="summary-label">${label}</div>
      <div class="summary-content">${hl(text, q)}</div>
    </div>
  </div>`
}

// Build the summary grid; if every structured field is filler, fall back
// to a trimmed abstract (280 chars) so the card is never empty.
function summaryBlock(p, q) {
  const rows = [
    summaryRow("problem",  "bomb",      "Problem",  p.problem,  q),
    summaryRow("solution", "lightbulb", "Solution", p.solution, q),
    summaryRow("results",  "chart-bar", "Results",  p.results,  q),
    summaryRow("impact",   "rocket",    "Impact",   p.impact,   q),
  ].join("")

  if (rows.trim()) return `<div class="summary-grid">${rows}</div>`

  // Fallback: trimmed abstract
  if (p.abstract && !isPlaceholder(p.abstract)) {
    const trimmed = p.abstract.slice(0, 280)
    return `<div class="summary-grid">
      <div class="summary-row">
        <div class="summary-icon icon-solution"><i class="fas fa-align-left"></i></div>
        <div class="summary-text">
          <div class="summary-label">Abstract</div>
          <div class="summary-content">${hl(trimmed, q)}${p.abstract.length > 280 ? "…" : ""}</div>
        </div>
      </div>
    </div>`
  }
  return ""
}

// ── Card HTML builders ───────────────────────────────────
function digestCardHTML(p, q) {
  const rk = p.rank || "?"
  const sc = p.rankScore || 70
  const tp = paperTopic(p)
  const hasComic = p.comic && (p.comic.problem || p.comic.method || p.comic.result || p.comic.takeaway)
  const hasSvg   = typeof p.svg === "string" && p.svg.includes("<svg")
  const cardId   = `card-${esc(p.id || Math.random().toString(36).slice(2))}`

  // Comic tab content
  const comicTab = hasComic ? `
    <div class="comic-grid">
      ${p.comic.problem  ? `<div class="comic-row"><div class="comic-icon ci-problem"><i class="fas fa-bomb"></i></div><div><div class="comic-label">Problem</div><div class="comic-text">${esc(p.comic.problem)}</div></div></div>` : ""}
      ${p.comic.method   ? `<div class="comic-row"><div class="comic-icon ci-method"><i class="fas fa-lightbulb"></i></div><div><div class="comic-label">Method</div><div class="comic-text">${esc(p.comic.method)}</div></div></div>` : ""}
      ${p.comic.result   ? `<div class="comic-row"><div class="comic-icon ci-result"><i class="fas fa-chart-bar"></i></div><div><div class="comic-label">Results</div><div class="comic-text">${esc(p.comic.result)}</div></div></div>` : ""}
      ${p.comic.takeaway ? `<div class="comic-row"><div class="comic-icon ci-takeaway"><i class="fas fa-rocket"></i></div><div><div class="comic-label">Takeaway</div><div class="comic-text">${esc(p.comic.takeaway)}</div></div></div>` : ""}
    </div>` : ""

  const svgTab = hasSvg ? `<div class="card-svg-wrap">${p.svg}</div>` : ""

  const showTabs = hasComic || hasSvg

  return `<article class="paper-card" id="${cardId}">
    <div class="card-strip">
      <div class="rank-badge ${rankClass(p.rank)}">${rk}</div>
      <span class="score-pill ${scoreClass(sc)}">${sc}</span>
      <span class="topic-badge ${topicClass(tp)}">${esc(tp)}</span>
    </div>
    <div class="card-body">
      <h2 class="card-headline"><a href="${esc(p.url || "#")}" target="_blank" rel="noopener">${hl(p.headline || p.title, q)}</a></h2>
      <p class="card-authors"><i class="fas fa-users"></i>&nbsp;${hl(authorLine(p), q)}</p>
      ${showTabs ? `
      <div class="card-tabs">
        <button class="card-tab-btn active" data-card="${cardId}" data-panel="digest">Digest</button>
        ${hasComic ? `<button class="card-tab-btn" data-card="${cardId}" data-panel="comic"><i class="fas fa-film"></i> Comic</button>` : ""}
        ${hasSvg   ? `<button class="card-tab-btn" data-card="${cardId}" data-panel="svg"><i class="fas fa-project-diagram"></i> Diagram</button>` : ""}
      </div>
      <div class="card-tab-panel active" data-card="${cardId}" data-panel="digest">${summaryBlock(p, q)}</div>
      ${hasComic ? `<div class="card-tab-panel" data-card="${cardId}" data-panel="comic">${comicTab}</div>` : ""}
      ${hasSvg   ? `<div class="card-tab-panel" data-card="${cardId}" data-panel="svg">${svgTab}</div>` : ""}
      ` : summaryBlock(p, q)}
    </div>
    <div class="card-foot">
      <span class="source-badge ${srcClass(p.source)}">${esc(p.source || "Unknown")}</span>
      ${p.publishedDate ? `<span class="card-date">${formatDate(p.publishedDate)}</span>` : ""}
      <a href="${esc(p.url || "#")}" target="_blank" rel="noopener" class="read-link">Read paper <i class="fas fa-external-link-alt"></i></a>
    </div>
  </article>`
}

function compactCardHTML(p, q) {
  const tp = paperTopic(p)
  const sc = p.rankScore || 70
  return `<article class="compact-card">
    <div class="compact-rank">#${p.rank || "?"}</div>
    <div class="compact-body">
      <div class="compact-title"><a href="${esc(p.url || "#")}" target="_blank" rel="noopener">${hl(p.title, q)}</a></div>
      <div class="compact-meta">
        <span class="topic-badge ${topicClass(tp)}">${esc(tp)}</span>
        <span class="score-pill ${scoreClass(sc)}">${sc}</span>
        <span class="compact-headline">${hl(p.headline || "", q)}</span>
      </div>
    </div>
  </article>`
}

// Small reference card for unranked "also fetched" papers.
function referenceCardHTML(p, q) {
  const tp = paperTopic(p)
  const abs = p.abstract && !isPlaceholder(p.abstract)
    ? `${hl(p.abstract.slice(0, 120), q)}${p.abstract.length > 120 ? "…" : ""}`
    : ""
  return `<article class="reference-card">
    <div class="reference-head">
      <span class="topic-badge ${topicClass(tp)}">${esc(tp)}</span>
      ${p.publishedDate ? `<span class="reference-date">${formatDate(p.publishedDate)}</span>` : ""}
    </div>
    <h3 class="reference-title"><a href="${esc(p.url || "#")}" target="_blank" rel="noopener">${hl(p.title, q)}</a></h3>
    ${abs ? `<p class="reference-abstract">${abs}</p>` : ""}
    <div class="reference-foot">
      <span class="source-badge ${srcClass(p.source)}">${esc(p.source || "Unknown")}</span>
      <a href="${esc(p.url || "#")}" target="_blank" rel="noopener" class="read-link">Read <i class="fas fa-external-link-alt"></i></a>
    </div>
  </article>`
}

// ── Render ranked + reference into one grid ──────────────
function renderAll() {
  const grid = document.getElementById("ranked-grid")
  if (!grid) return

  const q = searchQuery
  const hasRanked = filteredRanked.length > 0
  const hasRaw    = filteredRaw.length > 0

  if (!hasRanked && !hasRaw) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fas fa-search empty-icon"></i>
      <h3>${searchQuery || activeTopic ? "No matching papers" : "No papers yet"}</h3>
      <p>${
        searchQuery
          ? `Nothing matches "<strong>${esc(searchQuery)}</strong>". Try different keywords.`
          : activeTopic
            ? `No papers under "<strong>${esc(activeTopic)}</strong>" yet. Click <strong>Refresh</strong> to fetch some.`
            : "Click <strong>Refresh</strong> to fetch today's research."
      }</p>
    </div>`
    return
  }

  let html = ""

  // (a) Ranked header + (b) full cards
  if (hasRanked) {
    const suffix = (searchQuery || activeTopic) ? ` (${filteredRanked.length} shown)` : ""
    html += `<div class="ranked-header">
      <i class="fas fa-trophy"></i>
      <span>Top ${rankedPapers.length} papers, ranked by <strong>Claude Opus</strong>${suffix}</span>
    </div>`

    const cardFn = viewMode === "compact" ? compactCardHTML : digestCardHTML
    html += filteredRanked.map(p => cardFn(p, q)).join("")
  }

  // (c) "— Also Fetched —" divider + (d) reference cards
  if (hasRaw) {
    html += `<div class="reference-divider">
      <span>— Also Fetched —</span>
      <small>${filteredRaw.length} unranked paper${filteredRaw.length === 1 ? "" : "s"} from today's sweep</small>
    </div>`
    html += filteredRaw.map(p => referenceCardHTML(p, q)).join("")
  }

  grid.innerHTML = html
}

// ── Render cited papers ──────────────────────────────────
function renderCited(papers) {
  const grid = document.getElementById("cited-grid")
  const el   = document.getElementById("stat-cited")
  if (el) el.innerHTML = `<i class="fas fa-quote-right"></i> ${papers.length} most cited`
  if (!grid) return

  if (!papers.length) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fas fa-quote-right empty-icon"></i>
      <h3>No cited papers yet</h3>
      <p>Click <strong>Refresh</strong> to fetch highly-cited papers.</p>
    </div>`
    return
  }

  grid.innerHTML = papers.map(p => {
    const tp = paperTopic(p)
    return `<article class="paper-card">
      <div class="card-strip">
        <span class="cited-count"><i class="fas fa-quote-right"></i> ${(p.citationCount || 0).toLocaleString()} citations</span>
        <span class="topic-badge ${topicClass(tp)}" style="margin-left:auto">${esc(tp)}</span>
      </div>
      <div class="card-body">
        <h2 class="card-headline"><a href="${esc(p.url || "#")}" target="_blank" rel="noopener">${esc(p.headline || p.title)}</a></h2>
        <p class="card-authors"><i class="fas fa-users"></i>&nbsp;${esc(authorLine(p))}</p>
        ${summaryBlock(p, "")}
      </div>
      <div class="card-foot">
        <span class="source-badge ${srcClass(p.source)}">${esc(p.source || "Unknown")}</span>
        ${p.publishedDate ? `<span class="card-date">${formatDate(p.publishedDate)}</span>` : ""}
        ${p.venue ? `<span class="card-date" style="font-style:italic">${esc(p.venue)}</span>` : ""}
        <a href="${esc(p.url || "#")}" target="_blank" rel="noopener" class="read-link">Read paper <i class="fas fa-external-link-alt"></i></a>
      </div>
    </article>`
  }).join("")
}

// ── Topic sidebar (built-in) ─────────────────────────────
let lastTopicCounts = []
function renderTopics(topicCounts) {
  lastTopicCounts = Array.isArray(topicCounts) ? topicCounts : []
  const list = document.getElementById("topic-list")
  if (!list) return
  const counts = Object.fromEntries(lastTopicCounts.map(t => [t.topic, t.count]))
  const all = ["", ...lastTopicCounts.map(t => t.topic)]
  list.innerHTML = all.map(t => {
    const label  = t || "All Topics"
    const cnt    = t ? (counts[t] || 0) : rankedPapers.length
    const active = activeTopic === t ? "active" : ""
    return `<button class="topic-pill ${active}" data-topic="${esc(t)}">
      ${esc(label)}<span class="pill-count">${cnt}</span>
    </button>`
  }).join("")

  list.querySelectorAll(".topic-pill").forEach(btn =>
    btn.addEventListener("click", () => {
      activeTopic = btn.dataset.topic
      renderTopics(lastTopicCounts)
      renderCustomTopics()
      applyFilters()
    })
  )
}

// ── Topic sidebar (custom, localStorage) ─────────────────
function renderCustomTopics() {
  const wrap = document.getElementById("custom-topics")
  if (!wrap) return
  if (!customTopics.length) { wrap.innerHTML = ""; return }
  wrap.innerHTML = customTopics.map(t => {
    const active = activeTopic === t ? "active" : ""
    return `<button class="custom-pill ${active}" data-topic="${esc(t)}">
      ${esc(t)}<button class="rm-btn" data-remove="${esc(t)}" title="Remove"><i class="fas fa-times"></i></button>
    </button>`
  }).join("")

  wrap.querySelectorAll(".custom-pill").forEach(btn =>
    btn.addEventListener("click", e => {
      if (e.target.closest(".rm-btn")) return
      activeTopic = btn.dataset.topic
      renderTopics(lastTopicCounts)
      renderCustomTopics()
      applyFilters()
    })
  )
  wrap.querySelectorAll(".rm-btn").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation()
      const val = btn.dataset.remove
      customTopics = customTopics.filter(x => x !== val)
      localStorage.setItem("rt_customTopics", JSON.stringify(customTopics))
      if (activeTopic === val) activeTopic = ""
      renderTopics(lastTopicCounts)
      renderCustomTopics()
      applyFilters()
    })
  )
}

// ── Add custom topic ─────────────────────────────────────
function setupAddTopic() {
  const input = document.getElementById("new-topic-input")
  const btn   = document.getElementById("add-topic-btn")
  if (!input || !btn) return

  function add() {
    const val = input.value.trim()
    if (!val || customTopics.includes(val)) { input.value = ""; return }
    customTopics.push(val)
    localStorage.setItem("rt_customTopics", JSON.stringify(customTopics))
    input.value = ""
    activeTopic = val
    renderTopics(lastTopicCounts)
    renderCustomTopics()
    applyFilters()
    // Hint the user to refresh to fetch papers on this topic.
    showToast(`Topic "${val}" added — Refresh to fetch papers on this topic.`, false)
    setTimeout(hideToast, 5000)
  }

  btn.addEventListener("click", add)
  input.addEventListener("keydown", e => { if (e.key === "Enter") add() })
}

// ── Search (100ms debounce, "/" shortcut) ────────────────
function setupSearch() {
  const input = document.getElementById("search-input")
  const clear = document.getElementById("search-clear")
  if (!input) return
  let timer = null

  input.addEventListener("input", () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      searchQuery = input.value
      if (clear) clear.classList.toggle("hidden", !searchQuery)
      applyFilters()
    }, 100)
  })

  clear?.addEventListener("click", () => {
    input.value = ""; searchQuery = ""
    clear.classList.add("hidden")
    applyFilters()
    input.focus()
  })

  document.getElementById("search-banner-clear")?.addEventListener("click", () => {
    input.value = ""; searchQuery = ""
    clear?.classList.add("hidden")
    applyFilters()
  })

  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); input.select() }
    if (e.key === "Escape" && document.activeElement === input) input.blur()
  })
}

// ── Sort + view toggle ───────────────────────────────────
function setupControls() {
  document.getElementById("sort-select")?.addEventListener("change", e => {
    sortBy = e.target.value
    applyFilters()
  })

  document.querySelectorAll(".view-btn").forEach(btn =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"))
      btn.classList.add("active")
      viewMode = btn.dataset.view
      applyFilters()
    })
  )

  // Quick-filter buttons (sidebar shortcuts — sync with topic pills)
  document.querySelectorAll(".quick-filter").forEach(btn =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".quick-filter").forEach(b => b.classList.remove("active"))
      btn.classList.add("active")
      activeTopic = btn.dataset.topic || ""
      // Also deactivate the full topic-pill list so state is consistent
      document.querySelectorAll(".topic-pill, .custom-pill").forEach(p => p.classList.remove("active"))
      if (!activeTopic) document.querySelector(".topic-pill[data-topic='']")?.classList.add("active")
      applyFilters()
    })
  )
}

// ── Tabs ─────────────────────────────────────────────────
let keywordsLoaded = false
let kgExplorerLoaded = false
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"))
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"))
      tab.classList.add("active")
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add("active")
      if (tab.dataset.tab === "keywords" && !keywordsLoaded) {
        keywordsLoaded = true
        loadKeywordsUI()
      }
      if (tab.dataset.tab === "kg" && !kgExplorerLoaded) {
        kgExplorerLoaded = true
        loadKGGraph()
      }
    })
  )
}

// ── Theme ────────────────────────────────────────────────
function setupTheme() {
  const html = document.documentElement
  const icon = document.getElementById("theme-icon")
  const stored = localStorage.getItem("rt_theme") || "light"

  function apply(theme) {
    html.setAttribute("data-theme", theme)
    if (icon) icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon"
    localStorage.setItem("rt_theme", theme)
  }
  apply(stored)
  document.getElementById("theme-btn")?.addEventListener("click", () =>
    apply(html.getAttribute("data-theme") === "dark" ? "light" : "dark")
  )
}

// ── Toast ────────────────────────────────────────────────
function showToast(msg, progress = true) {
  const toast = document.getElementById("toast")
  const msgEl = document.getElementById("toast-msg")
  const bar   = document.getElementById("toast-progress")
  if (!toast) return
  if (msgEl) msgEl.textContent = msg
  toast.classList.remove("hidden")
  if (bar) {
    if (progress) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "" }
    else { bar.style.width = "100%" }
  }
}
function hideToast() {
  document.getElementById("toast")?.classList.add("hidden")
}
document.getElementById("toast-close")?.addEventListener("click", hideToast)

// ── Refresh (non-blocking SSE) ───────────────────────────
function setupRefresh() {
  const btn = document.getElementById("refresh-btn")
  if (!btn) return

  function connectSSE() {
    if (fetchSSE) { fetchSSE.close(); fetchSSE = null }
    fetchSSE = new EventSource("/api/progress")
    fetchSSE.onmessage = e => {
      let d
      try { d = JSON.parse(e.data) } catch { return }

      if ((d.type === "state" && d.running) || d.type === "progress") {
        showToast(d.message || "Fetching papers…", true)
        btn.disabled = true; btn.classList.add("spinning")
      }

      // Phase 1 done — papers fetched, show them immediately (unranked)
      if (d.type === "papers_ready") {
        showToast(d.message || "Papers fetched — ranking with Claude Opus…", true)
        loadRanked()   // reload grid right away with unranked snapshot
        loadRaw()
        loadTopics()
      }

      // Phase 2 done — ranking complete, final reload
      if (d.type === "done") {
        hideToast()
        btn.disabled = false; btn.classList.remove("spinning")
        loadAll()      // full reload with ranked papers
        fetchSSE.close(); fetchSSE = null
      }

      if (d.type === "error") {
        showToast("Fetch failed — check console", false)
        setTimeout(hideToast, 4000)
        btn.disabled = false; btn.classList.remove("spinning")
        fetchSSE.close(); fetchSSE = null
      }
    }
    fetchSSE.onerror = () => {
      btn.disabled = false; btn.classList.remove("spinning")
      if (fetchSSE) { fetchSSE.close(); fetchSSE = null }
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true
    const topicNote = customTopics.length ? ` + "${customTopics.join('", "')}"` : ""
    showToast(`Fetching latest papers${topicNote}…`, true)
    try {
      const res  = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTopics })
      })
      const data = await res.json()
      if (data.running) connectSSE()
      else { hideToast(); btn.disabled = false }
    } catch {
      showToast("Could not reach server", false)
      setTimeout(hideToast, 4000)
      btn.disabled = false
    }
  })

  connectSSE()
}

// ── Countdown (ticks every second) ───────────────────────
let cTimer = null
function startCountdown(nextFetchAt) {
  if (cTimer) clearInterval(cTimer)
  const el = document.getElementById("countdown")
  if (!el || !nextFetchAt) return
  function tick() {
    const diff = new Date(nextFetchAt) - Date.now()
    if (diff <= 0) { el.textContent = "fetching soon"; clearInterval(cTimer); return }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    el.textContent = `next refresh in ${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
  }
  tick(); cTimer = setInterval(tick, 1000)
}

// ── Status bar ───────────────────────────────────────────
function updateStatus(data) {
  const el = document.getElementById("stat-updated")
  if (el && data.fetchedAt) {
    const d = new Date(data.fetchedAt)
    el.innerHTML = `<i class="fas fa-clock"></i> Updated ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }
  if (data.nextFetchAt) startCountdown(data.nextFetchAt)
}

function updateDigestDate() {
  const el = document.getElementById("digest-date")
  if (!el) return
  el.textContent = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
}

// ── API loaders ───────────────────────────────────────────
async function loadRanked() {
  const res  = await fetch("/api/papers?limit=50")
  const data = await res.json()
  rankedPapers = data.papers || []
  updateStatus(data)
}

async function loadRaw() {
  try {
    const res  = await fetch("/api/raw-papers")
    const data = await res.json()
    rawPapers = Array.isArray(data.papers) ? data.papers : []
  } catch {
    rawPapers = []
  }
}

async function loadCited() {
  try {
    const res  = await fetch("/api/cited")
    const data = await res.json()
    citedPapers = data.papers || []
  } catch {
    citedPapers = []
  }
  renderCited(citedPapers)
}

async function loadTopics() {
  try {
    const res    = await fetch("/api/topics")
    const topics = await res.json()
    renderTopics(Array.isArray(topics) ? topics : [])
  } catch {
    renderTopics([])
  }
  renderCustomTopics()
}

async function loadStatus() {
  try {
    const res  = await fetch("/api/status")
    const data = await res.json()
    updateStatus(data)
  } catch { /* non-fatal */ }
}

async function loadNews() {
  try {
    const res  = await fetch("/api/news")
    const data = await res.json()
    newsItems = data.items || []
    renderNews(newsItems)
    // Update meta
    const countEl = document.getElementById("news-count")
    if (countEl) countEl.innerHTML = `<i class="fas fa-newspaper"></i> ${newsItems.length} posts`
    const updEl = document.getElementById("news-updated")
    if (updEl && data.fetchedAt) {
      const d = new Date(data.fetchedAt)
      updEl.innerHTML = `<i class="fas fa-clock"></i> Updated ${d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`
    }
    startNewsCountdown()
  } catch {
    newsItems = []
    renderNews([])
  }
}

function startNewsCountdown() {
  const el = document.getElementById("news-next")
  if (!el) return
  if (newsCountdown) clearInterval(newsCountdown)
  let secsLeft = 300  // 5 minutes
  function tick() {
    if (secsLeft <= 0) {
      el.innerHTML = `<i class="fas fa-circle"></i> Refreshing…`
      loadNews()
      secsLeft = 300
    } else {
      const m = Math.floor(secsLeft / 60)
      const s = secsLeft % 60
      el.innerHTML = `<i class="fas fa-circle"></i> Next in ${m}:${String(s).padStart(2,"0")}`
    }
    secsLeft--
  }
  tick()
  newsCountdown = setInterval(tick, 1000)
}

function renderNews(items) {
  const grid = document.getElementById("news-grid")
  if (!grid) return

  const filtered = newsFilter
    ? newsFilter === "high" || newsFilter === "medium"
      ? items.filter(i => i.significance === newsFilter)
      : items.filter(i => (i.category || "").toLowerCase() === newsFilter)
    : items

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fas fa-rss empty-icon"></i>
      <h3>${items.length ? "No items match this filter" : "Loading Intel Feed…"}</h3>
      <p>${items.length ? "Try a different filter." : "News is being fetched from research labs, companies, and top AI blogs."}</p>
    </div>`
    return
  }

  // Group by significance: high first, then medium, then rest
  const high   = filtered.filter(i => i.significance === "high")
  const medium = filtered.filter(i => i.significance === "medium")
  const low    = filtered.filter(i => i.significance === "low" || !i.significance)

  const sections = []
  if (high.length)   sections.push({ label: "🔥 High Impact", items: high })
  if (medium.length) sections.push({ label: "📌 Noteworthy", items: medium })
  if (low.length)    sections.push({ label: "📰 Also in AI", items: low })

  grid.innerHTML = sections.map(sec => `
    <div class="news-section">
      <div class="news-section-label">${sec.label}</div>
      <div class="news-section-items">
        ${sec.items.map(item => newsCardHTML(item)).join("")}
      </div>
    </div>
  `).join("")
}

function newsCardHTML(item) {
  const sigClass = `sig-${item.significance || "medium"}`
  const catClass = `cat-${(item.category || "news").toLowerCase()}`
  const dateStr  = item.publishedDate ? new Date(item.publishedDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""

  return `<article class="news-card ${sigClass}">
    <div class="news-card-head">
      <span class="news-source-badge ${catClass}">${esc(item.source)}</span>
      ${dateStr ? `<span class="news-date">${dateStr}</span>` : ""}
      ${item.significance === "high" ? `<span class="sig-badge high">High Impact</span>` : ""}
    </div>
    <h3 class="news-headline"><a href="${esc(item.url||"#")}" target="_blank" rel="noopener">${esc(item.headline || item.title)}</a></h3>
    ${item.summary ? `<p class="news-summary">${esc(item.summary)}</p>` : ""}
    <a href="${esc(item.url||"#")}" target="_blank" rel="noopener" class="news-read-link">Read post <i class="fas fa-external-link-alt"></i></a>
  </article>`
}

function setupNewsFilters() {
  document.querySelectorAll(".news-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".news-filter-btn").forEach(b => b.classList.remove("active"))
      btn.classList.add("active")
      newsFilter = btn.dataset.sig
      renderNews(newsItems)
    })
  })
}

// ── Archive ───────────────────────────────────────────────
async function loadArchive() {
  try {
    const res  = await fetch("/api/news/archive?limit=90")
    const data = await res.json()
    archiveSessions = data.sessions || []
    populateArchiveSelect()
    const badge = document.getElementById("archive-session-count")
    if (badge) badge.textContent = archiveSessions.length ? `${archiveSessions.length} sessions` : ""
  } catch { archiveSessions = [] }
}

function populateArchiveSelect() {
  const sel = document.getElementById("archive-session-select")
  if (!sel) return
  sel.innerHTML = archiveSessions.map((s, i) => {
    const d = new Date(s.fetchedAt)
    const label = isNaN(d) ? s.fetchedAt : d.toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })
    return `<option value="${i}">${label} — ${s.items?.length || 0} posts</option>`
  }).join("")
  sel.addEventListener("change", () => {
    const session = archiveSessions[parseInt(sel.value, 10)]
    if (session) renderArchiveSession(session)
  })
  // Show the newest session by default
  if (archiveSessions.length) renderArchiveSession(archiveSessions[0])
}

function renderArchiveSession(session) {
  const grid = document.getElementById("archive-grid")
  if (!grid) return
  const items = session?.items || []
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox empty-icon"></i><h3>No posts in this session</h3></div>`
    return
  }
  const high   = items.filter(i => i.significance === "high")
  const medium = items.filter(i => i.significance === "medium")
  const low    = items.filter(i => i.significance === "low" || !i.significance)
  const sections = []
  if (high.length)   sections.push({ label: "🔥 High Impact", items: high })
  if (medium.length) sections.push({ label: "📌 Noteworthy",  items: medium })
  if (low.length)    sections.push({ label: "📰 Also in AI",  items: low })
  grid.innerHTML = sections.map(sec => `
    <div class="news-section">
      <div class="news-section-label">${sec.label}</div>
      <div class="news-section-items">${sec.items.map(newsCardHTML).join("")}</div>
    </div>
  `).join("")
}


// ── Card tab switching (event delegation on ranked-grid) ─────────
function setupCardTabs() {
  document.getElementById("ranked-grid")?.addEventListener("click", e => {
    const btn = e.target.closest(".card-tab-btn")
    if (!btn) return
    const cardId = btn.dataset.card
    const panel  = btn.dataset.panel
    // Toggle buttons
    document.querySelectorAll(`.card-tab-btn[data-card="${cardId}"]`)
      .forEach(b => b.classList.toggle("active", b.dataset.panel === panel))
    // Toggle panels
    document.querySelectorAll(`.card-tab-panel[data-card="${cardId}"]`)
      .forEach(p => p.classList.toggle("active", p.dataset.panel === panel))
  })
}

// ── Keywords editor ──────────────────────────────────────────────
let keywords = []

async function loadKeywordsUI() {
  try {
    const res = await fetch("/api/keywords")
    const data = await res.json()
    keywords = data.keywords || []
    renderKeywords()
  } catch { keywords = [] }
}

function renderKeywords() {
  const list = document.getElementById("keywords-list")
  const count = document.getElementById("kw-count")
  if (!list) return
  if (count) count.textContent = keywords.length
  if (!keywords.length) {
    list.innerHTML = `<span style="font-size:12px;color:var(--ink3);padding:4px 8px">No keywords yet — add some above</span>`
    return
  }
  list.innerHTML = keywords.map((kw, i) => `
    <span class="kw-chip">
      ${esc(kw)}
      <button data-idx="${i}" title="Remove keyword"><i class="fas fa-times"></i></button>
    </span>`).join("")
  list.querySelectorAll(".kw-chip button").forEach(btn => {
    btn.addEventListener("click", () => {
      keywords.splice(parseInt(btn.dataset.idx), 1)
      renderKeywords()
    })
  })
}

function setupKeywordsEditor() {
  const addBtn    = document.getElementById("kw-add-btn")
  const addRow    = document.querySelector(".kw-add-row")
  const newInput  = document.getElementById("kw-new-input")
  const confirmBtn= document.getElementById("kw-confirm-add")
  const cancelBtn = document.getElementById("kw-cancel-add")
  const saveBtn   = document.getElementById("kw-save-btn")

  addBtn?.addEventListener("click", () => {
    addRow?.classList.remove("hidden")
    newInput?.focus()
  })
  cancelBtn?.addEventListener("click", () => {
    addRow?.classList.add("hidden")
    if (newInput) newInput.value = ""
  })

  function addKw() {
    const val = newInput?.value.trim()
    if (!val) return
    if (!keywords.includes(val)) {
      keywords.push(val)
      renderKeywords()
    }
    if (newInput) newInput.value = ""
    addRow?.classList.add("hidden")
  }

  confirmBtn?.addEventListener("click", addKw)
  newInput?.addEventListener("keydown", e => { if (e.key === "Enter") addKw() })

  saveBtn?.addEventListener("click", async () => {
    if (!saveBtn) return
    saveBtn.disabled = true
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving…`
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      })
      const data = await res.json()
      if (data.success) {
        saveBtn.innerHTML = `<i class="fas fa-check"></i> Saved!`
        setTimeout(() => { saveBtn.innerHTML = `<i class="fas fa-save"></i> Save & Apply`; saveBtn.disabled = false }, 2000)
      } else throw new Error(data.error)
    } catch (err) {
      saveBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error`
      setTimeout(() => { saveBtn.innerHTML = `<i class="fas fa-save"></i> Save & Apply`; saveBtn.disabled = false }, 2000)
    }
  })
}

function setupArchiveToggle() {
  const toggle  = document.getElementById("archive-toggle")
  const panel   = document.getElementById("archive-panel")
  const chevron = document.getElementById("archive-chevron")
  if (!toggle) return
  toggle.addEventListener("click", async () => {
    const isHidden = panel.classList.toggle("hidden")
    chevron.style.transform = isHidden ? "" : "rotate(180deg)"
    // Lazy-load archive on first open
    if (!isHidden && archiveSessions.length === 0) await loadArchive()
  })
}

async function loadAll() {
  await Promise.allSettled([loadRanked(), loadRaw(), loadCited(), loadStatus(), loadNews()])
  buildIndex([...rankedPapers, ...rawPapers])
  await loadTopics()
  applyFilters()
}

// ── Knowledge Graph ──────────────────────────────────────

let kgStats = null

async function loadKGStats() {
  try {
    const data = await fetch("/api/kg/stats").then(r => r.json())
    kgStats = data
    renderKGStats(data)
  } catch { /* silent */ }
}

function renderKGStats(stats) {
  const set = (id, val) => {
    const el = document.querySelector(`#${id} .kg-stat-num`)
    if (el) el.textContent = val ?? "—"
  }
  if (!stats) return
  set("kg-stat-papers",   stats.nodesByType?.Paper    ?? 0)
  set("kg-stat-concepts", stats.nodesByType?.Concept  ?? 0)
  set("kg-stat-results",  stats.nodesByType?.Result   ?? 0)
  set("kg-stat-relevance",stats.nodesByType?.Relevance?? 0)
  set("kg-stat-edges",    stats.totalEdges ?? 0)

  const btn = document.getElementById("kg-rebuild-btn")
  if (btn) {
    if (stats.building) {
      btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Building…`
      btn.disabled = true
    } else {
      btn.innerHTML = `<i class="fas fa-sync-alt"></i> Rebuild Graph`
      btn.disabled = false
    }
  }
}

async function loadKGGraph() {
  try {
    const data = await fetch("/api/kg/graph").then(r => r.json())
    renderKGExplorer(data)
  } catch { /* silent */ }
}

function renderKGExplorer(data) {
  if (!data?.nodes) return

  const concepts  = data.nodes.filter(n => n.type === "Concept")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  const relevance = data.nodes.filter(n => n.type === "Relevance")
    .sort((a, b) => (a.aspect || "").localeCompare(b.aspect || ""))
  const results   = data.nodes.filter(n => n.type === "Result")

  // Count how many papers each concept node is connected to
  const conceptPaperCount = {}
  for (const e of (data.edges || [])) {
    if (e.type === "uses_method" || e.type === "introduces") {
      conceptPaperCount[e.to] = (conceptPaperCount[e.to] || 0) + 1
    }
  }
  const relevancePaperCount = {}
  for (const e of (data.edges || [])) {
    if (e.type === "is_relevant_for_joule") {
      relevancePaperCount[e.to] = (relevancePaperCount[e.to] || 0) + 1
    }
  }

  const renderList = (containerId, items, labelFn, countMap, edgeType) => {
    const el = document.getElementById(containerId)
    if (!el) return
    if (!items.length) { el.innerHTML = `<p class="kg-empty">No nodes yet — rebuild the graph.</p>`; return }
    el.innerHTML = items.slice(0, 40).map(n => {
      const label = labelFn(n)
      const count = (countMap[n.id] || 0)
      const tag   = n.category ? `<span class="kg-cat-tag">${n.category}</span>` : ""
      return `<div class="kg-node-item" data-query="${label}">
        ${tag}<span class="kg-node-label">${label}</span>
        ${count ? `<span class="kg-node-count">${count}p</span>` : ""}
      </div>`
    }).join("")
    // Click a node item to pre-fill the question input
    el.querySelectorAll(".kg-node-item").forEach(item => {
      item.addEventListener("click", () => {
        const q = document.getElementById("kg-question-input")
        if (q) { q.value = `Which papers are related to "${item.dataset.query}"?`; q.focus() }
      })
    })
  }

  renderList("kg-concepts-list", concepts,  n => n.name,   conceptPaperCount,  "uses_method")
  renderList("kg-relevance-list", relevance, n => n.aspect, relevancePaperCount, "is_relevant_for_joule")
  renderList("kg-results-list",   results,   n => n.description, {}, "produced")
}

async function askKG(question) {
  const loading = document.getElementById("kg-answer-loading")
  const area    = document.getElementById("kg-answer-area")
  const text    = document.getElementById("kg-answer-text")
  const papers  = document.getElementById("kg-supporting-papers")
  if (!loading || !area || !text) return

  area.classList.add("hidden")
  loading.classList.remove("hidden")

  try {
    const res  = await fetch("/api/kg/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })
    const data = await res.json()
    loading.classList.add("hidden")

    if (data.error) {
      text.innerHTML = `<span class="kg-error"><i class="fas fa-exclamation-triangle"></i> ${data.error}</span>`
    } else {
      // Convert markdown-style bullets to HTML
      const formatted = (data.answer || "")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/^[-•]\s+(.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
        .replace(/\n/g, "<br>")
      text.innerHTML = formatted

      if (data.supporting?.length) {
        papers.innerHTML = `<div class="kg-supporting-label">Supporting papers (${data.supporting.length})</div>` +
          data.supporting.map(p =>
            `<a class="kg-paper-chip" href="${p.url || "#"}" target="_blank" rel="noopener">
              ${p.rank ? `<span class="kg-chip-rank">#${p.rank}</span>` : ""}
              <span class="kg-chip-title">${p.title}</span>
              ${p.topicLabel ? `<span class="kg-chip-topic">${p.topicLabel}</span>` : ""}
            </a>`
          ).join("")
      } else {
        papers.innerHTML = ""
      }

      if (data.subgraph) {
        const sub = data.subgraph
        const note = document.createElement("div")
        note.className = "kg-subgraph-note"
        note.textContent = `Retrieved subgraph: ${sub.nodeCount} nodes · ${sub.edgeCount} edges`
        text.prepend(note)
      }
    }
    area.classList.remove("hidden")
  } catch (err) {
    loading.classList.add("hidden")
    text.innerHTML = `<span class="kg-error">Request failed: ${err.message}</span>`
    area.classList.remove("hidden")
  }
}

function setupKG() {
  const rebuildBtn = document.getElementById("kg-rebuild-btn")
  rebuildBtn?.addEventListener("click", async () => {
    rebuildBtn.disabled = true
    rebuildBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Rebuilding…`
    try {
      const res = await fetch("/api/kg/rebuild", { method: "POST" })
      const data = await res.json()
      if (!data.success) {
        rebuildBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.message}`
        setTimeout(() => { rebuildBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Rebuild Graph`; rebuildBtn.disabled = false }, 3000)
      } else {
        // Poll stats until build completes
        const poll = setInterval(async () => {
          const s = await fetch("/api/kg/stats").then(r => r.json()).catch(() => null)
          if (s && !s.building) {
            clearInterval(poll)
            kgStats = s
            renderKGStats(s)
            await loadKGGraph()
          }
        }, 2000)
      }
    } catch (err) {
      rebuildBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error`
      setTimeout(() => { rebuildBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Rebuild Graph`; rebuildBtn.disabled = false }, 3000)
    }
  })

  const askBtn   = document.getElementById("kg-ask-btn")
  const inputEl  = document.getElementById("kg-question-input")

  const doAsk = () => {
    const q = inputEl?.value?.trim()
    if (q) askKG(q)
  }

  askBtn?.addEventListener("click", doAsk)
  inputEl?.addEventListener("keydown", e => { if (e.key === "Enter") doAsk() })
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  setupTheme()
  setupTabs()
  setupSearch()
  setupAddTopic()
  setupControls()
  setupRefresh()
  setupNewsFilters()
  setupArchiveToggle()
  setupCardTabs()
  setupKeywordsEditor()
  setupKG()
  updateDigestDate()

  // 1. Load the essential data that fills the page above the fold
  await Promise.allSettled([loadRanked(), loadTopics()])
  applyFilters()

  // 2. Hide splash immediately — page is usable now
  const splash = document.getElementById("splash")
  if (splash) { splash.classList.add("fade-out"); setTimeout(() => splash.style.display = "none", 500) }

  // 3. Load everything else in the background without blocking
  loadRaw().then(() => {
    buildIndex([...rankedPapers, ...rawPapers])
    applyFilters()
  })
  loadCited()
  loadStatus()
  loadNews()
  loadKGStats()

  setInterval(() => Promise.allSettled([loadRanked(), loadCited(), loadStatus()]), 5 * 60 * 1000)
  setInterval(loadKGStats, 30 * 1000)   // refresh KG stats every 30s (picks up background build completion)
}

document.addEventListener("DOMContentLoaded", init)
