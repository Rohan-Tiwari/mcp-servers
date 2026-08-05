import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR   = path.join(__dirname, "..", "data")
const DATA_FILE  = path.join(DATA_DIR, "papers.json")
const RAW_FILE   = path.join(DATA_DIR, "raw_papers.json")
const NEWS_ARCHIVE_FILE = path.join(DATA_DIR, "news_archive.json")

// Keep at most 90 fetch sessions in the archive (~3 days at 5-min intervals)
const MAX_ARCHIVE_SESSIONS = 90

const INITIAL_DATA = {
  papers: [], rawPapers: [], fetchedAt: null, totalFetched: 0, nextFetchAt: null
}

export async function initStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  for (const [file, initial] of [
    [DATA_FILE, JSON.stringify({ ...INITIAL_DATA, rawPapers: undefined }, null, 2)],
    [RAW_FILE,  JSON.stringify([], null, 2)],
    [NEWS_ARCHIVE_FILE, JSON.stringify([], null, 2)],
  ]) {
    try { await fs.access(file) }
    catch { await fs.writeFile(file, initial) }
  }
}

export async function savePapers(data) {
  const toSave = {
    papers: data.papers || [],
    fetchedAt: data.fetchedAt ?? null,
    totalFetched: data.totalFetched ?? 0,
    nextFetchAt: data.nextFetchAt ?? null
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(toSave, null, 2))
  if (data.rawPapers) {
    await fs.writeFile(RAW_FILE, JSON.stringify(data.rawPapers, null, 2))
  }
  return toSave
}

export async function loadPapers() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) }
  catch { return null }
}

export async function loadRawPapers() {
  try { return JSON.parse(await fs.readFile(RAW_FILE, "utf8")) }
  catch { return [] }
}

// ── News archive ─────────────────────────────────────────────────

// Called each time new news is fetched. Prepends the session and trims to cap.
export async function archiveNewsSession(session) {
  if (!session?.items?.length) return
  let archive = []
  try { archive = JSON.parse(await fs.readFile(NEWS_ARCHIVE_FILE, "utf8")) }
  catch { archive = [] }

  // Deduplicate: drop any existing session with the same fetchedAt timestamp
  archive = archive.filter(s => s.fetchedAt !== session.fetchedAt)

  // Prepend newest session
  archive.unshift({
    fetchedAt: session.fetchedAt,
    totalFound: session.totalFound || session.items.length,
    items: session.items,
  })

  // Keep rolling window
  if (archive.length > MAX_ARCHIVE_SESSIONS) archive = archive.slice(0, MAX_ARCHIVE_SESSIONS)

  await fs.writeFile(NEWS_ARCHIVE_FILE, JSON.stringify(archive, null, 2))
}

// Purge archive sessions older than 3 days. Returns count of removed sessions.
export async function purgeOldNewsArchive() {
  let archive = []
  try { archive = JSON.parse(await fs.readFile(NEWS_ARCHIVE_FILE, "utf8")) }
  catch { return 0 }

  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000   // 3 days in ms
  const before = archive.length
  archive = archive.filter(s => {
    const ts = s.fetchedAt ? new Date(s.fetchedAt).getTime() : 0
    return ts > cutoff
  })
  const removed = before - archive.length
  await fs.writeFile(NEWS_ARCHIVE_FILE, JSON.stringify(archive, null, 2))
  return removed
}

// Returns array of sessions, newest first
export async function loadNewsArchive(limit = MAX_ARCHIVE_SESSIONS) {
  try {
    const archive = JSON.parse(await fs.readFile(NEWS_ARCHIVE_FILE, "utf8"))
    return Array.isArray(archive) ? archive.slice(0, limit) : []
  } catch { return [] }
}

export async function getTopics() {
  const data = await loadPapers()
  if (!data?.papers) return []
  const counts = {}
  data.papers.forEach(p => {
    const t = p.topicLabel || p.topic || "AI"
    counts[t] = (counts[t] || 0) + 1
  })
  return Object.entries(counts).map(([topic, count]) => ({ topic, count })).sort((a,b) => b.count - a.count)
}

export function getDataPath() { return DATA_FILE }

export default { initStorage, savePapers, loadPapers, loadRawPapers, getTopics, getDataPath, archiveNewsSession, loadNewsArchive, purgeOldNewsArchive }
