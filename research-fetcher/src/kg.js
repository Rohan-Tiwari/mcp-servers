/**
 * In-memory Property Graph for Research Papers
 *
 * Node types  : Paper | Concept | Result | Relevance
 * Edge types  : uses_method | introduces | produced | is_relevant_for_joule | related_to
 *
 * Hot-reload  : call buildGraph(papers) — it clears and rebuilds from scratch in ~5-10s
 */

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
})
const MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "claude-opus-latest"

// ─── PropertyGraph ────────────────────────────────────────────────────────────

export class PropertyGraph {
  constructor() {
    this.nodes    = new Map()   // id → { id, type, ...props }
    this.edges    = new Map()   // edgeId → { id, type, from, to, ...props }
    this.outIndex = new Map()   // nodeId → Map<edgeType, Set<edgeId>>
    this.inIndex  = new Map()   // nodeId → Map<edgeType, Set<edgeId>>
    this._seq     = 0
    this.builtAt  = null
  }

  _ensureIndex(nodeId) {
    if (!this.outIndex.has(nodeId)) this.outIndex.set(nodeId, new Map())
    if (!this.inIndex.has(nodeId))  this.inIndex.set(nodeId, new Map())
  }

  // Idempotent — merges props if the node already exists
  addNode(id, type, props = {}) {
    if (this.nodes.has(id)) {
      Object.assign(this.nodes.get(id), props)
    } else {
      this.nodes.set(id, { id, type, ...props })
      this._ensureIndex(id)
    }
    return id
  }

  addEdge(fromId, toId, type, props = {}) {
    // Deduplicate: skip if this exact (from, to, type) already exists
    const outMap = this.outIndex.get(fromId)
    if (outMap?.has(type)) {
      for (const eid of outMap.get(type)) {
        const e = this.edges.get(eid)
        if (e && e.to === toId) return eid   // already exists
      }
    }

    const edgeId = `e${++this._seq}`
    this.edges.set(edgeId, { id: edgeId, type, from: fromId, to: toId, ...props })

    const out = this.outIndex.get(fromId)
    if (!out.has(type)) out.set(type, new Set())
    out.get(type).add(edgeId)

    const inn = this.inIndex.get(toId) || new Map()
    if (!inn.has(type)) inn.set(type, new Set())
    inn.get(type).add(edgeId)
    this.inIndex.set(toId, inn)

    return edgeId
  }

  getNode(id) { return this.nodes.get(id) ?? null }

  // Returns [{ node, edge }] for neighbors reachable via edgeType in given direction
  getNeighbors(nodeId, edgeType = null, direction = "out") {
    const index = direction === "out" ? this.outIndex : this.inIndex
    const typeMap = index.get(nodeId)
    if (!typeMap) return []

    const results = []
    for (const [type, edgeIds] of typeMap) {
      if (edgeType && type !== edgeType) continue
      for (const eid of edgeIds) {
        const edge = this.edges.get(eid)
        if (!edge) continue
        const neighborId = direction === "out" ? edge.to : edge.from
        const node = this.nodes.get(neighborId)
        if (node) results.push({ node, edge })
      }
    }
    return results
  }

  findNodes(type, filter = null) {
    const results = []
    for (const node of this.nodes.values()) {
      if (node.type !== type) continue
      if (filter && !filter(node)) continue
      results.push(node)
    }
    return results
  }

  clear() {
    this.nodes.clear(); this.edges.clear()
    this.outIndex.clear(); this.inIndex.clear()
    this._seq = 0; this.builtAt = null
  }

  stats() {
    const nodesByType = {}, edgesByType = {}
    for (const n of this.nodes.values()) nodesByType[n.type] = (nodesByType[n.type] || 0) + 1
    for (const e of this.edges.values()) edgesByType[e.type] = (edgesByType[e.type] || 0) + 1
    return {
      totalNodes: this.nodes.size, totalEdges: this.edges.size,
      nodesByType, edgesByType, builtAt: this.builtAt,
    }
  }

  // Full graph as plain JSON — for the /api/kg/graph endpoint + UI
  serialize() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      stats: this.stats(),
    }
  }
}

// ─── Entity Extraction ────────────────────────────────────────────────────────

function slugify(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
}

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const s = fence ? fence[1].trim() : text.trim()
  const start = s.search(/\[/)
  if (start === -1) throw new Error("no JSON array in response")
  return JSON.parse(s.slice(start))
}

const EXTRACT_PROMPT = `You are extracting structured knowledge graph entities from AI/ML research paper abstracts.

For EACH paper, extract:
- concepts_used     : existing methods/techniques the paper relies on (e.g. Transformer, RAG, RLHF)
- concepts_introduced : new methods/architectures/frameworks the paper proposes (original contributions)
- results           : concrete outcomes — benchmark numbers, speedups, accuracy gains (strings)
- joule_relevance   : how this paper is relevant to building Joule (SAP's enterprise LLM assistant). Focus on: agent harnesses, enterprise RAG, LLM orchestration, multi-agent systems, SAP ERP/CRM AI, production ML, Kubernetes.

Rules:
- concepts_used and concepts_introduced: each item has "name" (2-4 words max) and "category" (one of: technique, architecture, dataset, tool, framework, metric)
- results: only include if a concrete number or qualitative outcome is explicitly stated — never make them up
- joule_relevance: 1-3 items max; be specific (e.g. "Multi-agent orchestration for SAP workflows" > "AI agent"); skip if not relevant
- Return ONLY a JSON array, no prose

Return format:
[{
  "paper_id": "...",
  "concepts_used": [{ "name": "...", "category": "..." }],
  "concepts_introduced": [{ "name": "...", "category": "..." }],
  "results": ["..."],
  "joule_relevance": ["..."]
}]`

export async function extractPaperEntities(papers) {
  if (!papers?.length) return []

  // Batch all papers — truncate to keep prompt size manageable
  const paperList = papers.map((p, i) =>
    `${i + 1}. ID: ${p.id}\nTitle: ${p.title}\nAbstract: ${(p.abstract || "").slice(0, 400)}\n` +
    `Problem: ${(p.problem || "").slice(0, 200)}\nSolution: ${(p.solution || "").slice(0, 200)}\n` +
    `Results: ${(p.results || "").slice(0, 200)}`
  ).join("\n\n---\n\n")

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: `${EXTRACT_PROMPT}\n\nPAPERS:\n${paperList}` }],
    })
    const text = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("")
    return extractJson(text)
  } catch (err) {
    console.error("[kg] extractPaperEntities failed:", err.message)
    return []
  }
}

// ─── Graph Builder ────────────────────────────────────────────────────────────

export async function buildGraph(papers, graph) {
  if (!graph) graph = new PropertyGraph()
  else graph.clear()

  console.log(`[kg] Building graph from ${papers.length} papers…`)
  const t0 = Date.now()

  // Step 1: add Paper nodes first
  for (const p of papers) {
    graph.addNode(`paper:${p.id}`, "Paper", {
      title: p.title, rank: p.rank, rankScore: p.rankScore,
      topicLabel: p.topicLabel, publishedDate: p.publishedDate,
      url: p.url, source: p.source,
      headline: p.headline, impact: p.impact,
    })
  }

  // Step 2: extract entities via Claude
  const entities = await extractPaperEntities(papers)
  console.log(`[kg] Extracted entities for ${entities.length} papers`)

  // Step 3: add Concept / Result / Relevance nodes and edges
  for (const ent of entities) {
    const paperId = `paper:${ent.paper_id}`
    if (!graph.getNode(paperId)) continue

    for (const c of (ent.concepts_used || [])) {
      if (!c?.name) continue
      const cId = `concept:${slugify(c.name)}`
      graph.addNode(cId, "Concept", { name: c.name, category: c.category || "technique" })
      graph.addEdge(paperId, cId, "uses_method")
    }

    for (const c of (ent.concepts_introduced || [])) {
      if (!c?.name) continue
      const cId = `concept:${slugify(c.name)}`
      graph.addNode(cId, "Concept", { name: c.name, category: c.category || "architecture" })
      graph.addEdge(paperId, cId, "introduces")
    }

    for (const r of (ent.results || [])) {
      if (!r?.trim()) continue
      const rId = `result:${slugify(r.slice(0, 50))}-${graph._seq}`
      graph.addNode(rId, "Result", { description: r })
      graph.addEdge(paperId, rId, "produced")
    }

    for (const rel of (ent.joule_relevance || [])) {
      if (!rel?.trim()) continue
      const relId = `relevance:${slugify(rel)}`
      graph.addNode(relId, "Relevance", { aspect: rel })
      graph.addEdge(paperId, relId, "is_relevant_for_joule")
    }
  }

  // Step 4: concept → concept related_to (co-occur in 2+ papers)
  const conceptPapers = new Map()
  for (const edge of graph.edges.values()) {
    if (edge.type !== "uses_method" && edge.type !== "introduces") continue
    const set = conceptPapers.get(edge.to) || new Set()
    set.add(edge.from)
    conceptPapers.set(edge.to, set)
  }
  const conceptIds = Array.from(conceptPapers.keys())
  for (let i = 0; i < conceptIds.length; i++) {
    for (let j = i + 1; j < conceptIds.length; j++) {
      const setA = conceptPapers.get(conceptIds[i])
      const setB = conceptPapers.get(conceptIds[j])
      const shared = [...setA].filter(p => setB.has(p)).length
      if (shared >= 2) {
        graph.addEdge(conceptIds[i], conceptIds[j], "related_to", { sharedPapers: shared })
      }
    }
  }

  graph.builtAt = new Date().toISOString()
  const s = graph.stats()
  console.log(`[kg] Done in ${Date.now() - t0}ms — ${s.totalNodes} nodes, ${s.totalEdges} edges`)
  return graph
}

// ─── Query Engine ─────────────────────────────────────────────────────────────

// Find nodes whose text properties contain any of the query tokens
function findRelevantNodes(graph, question) {
  const tokens = question.toLowerCase().split(/\W+/).filter(t => t.length > 2)
  const scored = new Map()

  for (const node of graph.nodes.values()) {
    const text = [
      node.name, node.aspect, node.description, node.title,
      node.headline, node.topicLabel, node.impact
    ].filter(Boolean).join(" ").toLowerCase()

    let score = 0
    for (const t of tokens) {
      if (text.includes(t)) score++
    }
    if (score > 0) scored.set(node.id, { node, score })
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(v => v.node)
}

// Collect a 1-hop subgraph around the seed nodes
function collectSubgraph(graph, seedNodes) {
  const nodeSet = new Map()
  const edgeSet = new Map()

  for (const seed of seedNodes) {
    nodeSet.set(seed.id, seed)
    for (const { node, edge } of graph.getNeighbors(seed.id, null, "out")) {
      nodeSet.set(node.id, node)
      edgeSet.set(edge.id, edge)
    }
    for (const { node, edge } of graph.getNeighbors(seed.id, null, "in")) {
      nodeSet.set(node.id, node)
      edgeSet.set(edge.id, edge)
    }
  }

  return { nodes: [...nodeSet.values()], edges: [...edgeSet.values()] }
}

function formatSubgraphForContext(subgraph) {
  const papers = subgraph.nodes.filter(n => n.type === "Paper")
  const concepts = subgraph.nodes.filter(n => n.type === "Concept")
  const results = subgraph.nodes.filter(n => n.type === "Result")
  const relevance = subgraph.nodes.filter(n => n.type === "Relevance")

  const lines = []

  if (papers.length) {
    lines.push("PAPERS IN SUBGRAPH:")
    for (const p of papers.slice(0, 10)) {
      lines.push(`  [Paper] rank=${p.rank ?? "?"} topic=${p.topicLabel ?? "?"} title="${p.title}"`)
      if (p.headline) lines.push(`    headline: ${p.headline}`)
      if (p.impact) lines.push(`    impact: ${p.impact}`)
      const methods = subgraph.edges
        .filter(e => e.from === p.id && e.type === "uses_method")
        .map(e => subgraph.nodes.find(n => n.id === e.to)?.name).filter(Boolean)
      if (methods.length) lines.push(`    uses_method: ${methods.join(", ")}`)
      const intros = subgraph.edges
        .filter(e => e.from === p.id && e.type === "introduces")
        .map(e => subgraph.nodes.find(n => n.id === e.to)?.name).filter(Boolean)
      if (intros.length) lines.push(`    introduces: ${intros.join(", ")}`)
      const rels = subgraph.edges
        .filter(e => e.from === p.id && e.type === "is_relevant_for_joule")
        .map(e => subgraph.nodes.find(n => n.id === e.to)?.aspect).filter(Boolean)
      if (rels.length) lines.push(`    joule_relevance: ${rels.join(", ")}`)
      const res = subgraph.edges
        .filter(e => e.from === p.id && e.type === "produced")
        .map(e => subgraph.nodes.find(n => n.id === e.to)?.description).filter(Boolean)
      if (res.length) lines.push(`    results: ${res.join(" | ")}`)
    }
  }

  if (concepts.length) {
    lines.push("\nCONCEPTS IN SUBGRAPH:")
    for (const c of concepts.slice(0, 15)) {
      const usedBy = subgraph.edges.filter(e => e.to === c.id && e.type === "uses_method")
        .map(e => subgraph.nodes.find(n => n.id === e.from)?.title).filter(Boolean)
      const introdBy = subgraph.edges.filter(e => e.to === c.id && e.type === "introduces")
        .map(e => subgraph.nodes.find(n => n.id === e.from)?.title).filter(Boolean)
      lines.push(`  [Concept] "${c.name}" (${c.category})`)
      if (usedBy.length) lines.push(`    used by: ${usedBy.slice(0, 3).join("; ")}`)
      if (introdBy.length) lines.push(`    introduced by: ${introdBy.slice(0, 3).join("; ")}`)
    }
  }

  if (relevance.length) {
    lines.push("\nJOULE RELEVANCE NODES:")
    for (const r of relevance.slice(0, 8)) {
      const papers = subgraph.edges.filter(e => e.to === r.id && e.type === "is_relevant_for_joule")
        .map(e => subgraph.nodes.find(n => n.id === e.from)?.title).filter(Boolean)
      lines.push(`  [Relevance] "${r.aspect}"`)
      if (papers.length) lines.push(`    papers: ${papers.slice(0, 3).join("; ")}`)
    }
  }

  if (results.length) {
    lines.push("\nRESULTS NODES:")
    for (const r of results.slice(0, 8)) {
      lines.push(`  [Result] ${r.description}`)
    }
  }

  return lines.join("\n")
}

export async function queryGraph(graph, question) {
  if (!graph || graph.nodes.size === 0) {
    return { answer: "Knowledge graph is empty — trigger a rebuild first.", supporting: [], subgraph: null }
  }

  const seedNodes = findRelevantNodes(graph, question)
  const subgraph  = collectSubgraph(graph, seedNodes)
  const context   = formatSubgraphForContext(subgraph)

  const stats = graph.stats()
  const systemCtx = `You are a research assistant answering questions over a knowledge graph of AI/ML research papers.
The knowledge graph has ${stats.totalNodes} nodes (${stats.nodesByType.Paper || 0} papers, ${stats.nodesByType.Concept || 0} concepts, ${stats.nodesByType.Result || 0} results, ${stats.nodesByType.Relevance || 0} relevance nodes) and ${stats.totalEdges} edges.
The papers are curated for Rohan Tiwari, a senior SAP engineer building Joule AI assistant. Focus on enterprise AI, agent harnesses, RAG, LLM orchestration.`

  const prompt = `${systemCtx}

RELEVANT SUBGRAPH (retrieved for your question):
${context || "(no relevant nodes found — answer from general knowledge of the graph)"}

QUESTION: ${question}

Answer the question using the subgraph context above. Be specific and cite paper titles where relevant.
If asking for a list, return a clean bulleted list. If asking for relationships, describe the graph paths.
If the subgraph doesn't fully answer the question, say so and suggest a more specific query.`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    })
    const answer = (response.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim()

    const supporting = subgraph.nodes
      .filter(n => n.type === "Paper")
      .map(n => ({ id: n.id.replace("paper:", ""), title: n.title, rank: n.rank, url: n.url, topicLabel: n.topicLabel }))

    return { answer, supporting, subgraph: { nodeCount: subgraph.nodes.length, edgeCount: subgraph.edges.length } }
  } catch (err) {
    console.error("[kg] queryGraph failed:", err.message)
    return { answer: `Query failed: ${err.message}`, supporting: [], subgraph: null }
  }
}
