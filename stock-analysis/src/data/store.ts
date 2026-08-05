import type { Quote, RankedAsset, Alert, MarketSnapshot } from "../types.js";

// In-memory store — single source of truth shared across MCP tools, dashboard, and monitor
class MarketStore {
  private quotes: Map<string, Quote> = new Map();
  private rankings: RankedAsset[] = [];
  private alerts: Alert[] = [];
  private snapshot: MarketSnapshot | null = null;
  private lastFullRefresh: Date | null = null;
  private subscribers: Set<(snapshot: MarketSnapshot) => void> = new Set();

  // ── Quotes ──────────────────────────────────────────────────────────────────

  setQuote(q: Quote): void {
    this.quotes.set(q.symbol, q);
  }

  setQuotes(qs: Map<string, Quote>): void {
    for (const [sym, q] of qs) this.quotes.set(sym, q);
  }

  getQuote(symbol: string): Quote | undefined {
    return this.quotes.get(symbol);
  }

  getAllQuotes(): Quote[] {
    return Array.from(this.quotes.values());
  }

  // ── Rankings ─────────────────────────────────────────────────────────────────

  setRankings(assets: RankedAsset[]): void {
    this.rankings = assets;
  }

  getRankings(
    type?: "stock" | "etf" | "bond",
    limit = 15
  ): RankedAsset[] {
    const filtered = type
      ? this.rankings.filter((a) => a.type === type)
      : this.rankings;
    return filtered.slice(0, limit);
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────

  addAlert(alert: Alert): void {
    this.alerts.unshift(alert);
    // Keep last 200 alerts
    if (this.alerts.length > 200) this.alerts.length = 200;
  }

  getAlerts(unreadOnly = false, limit = 20): Alert[] {
    const filtered = unreadOnly ? this.alerts.filter((a) => !a.read) : this.alerts;
    return filtered.slice(0, limit);
  }

  markAlertRead(id: string): void {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) alert.read = true;
  }

  markAllRead(): void {
    this.alerts.forEach((a) => (a.read = true));
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  setSnapshot(s: MarketSnapshot): void {
    this.snapshot = s;
    this.lastFullRefresh = new Date();
    this.notifySubscribers(s);
  }

  getSnapshot(): MarketSnapshot | null {
    return this.snapshot;
  }

  getLastRefresh(): Date | null {
    return this.lastFullRefresh;
  }

  // ── Subscriptions (for WebSocket push to dashboard) ──────────────────────────

  subscribe(fn: (snapshot: MarketSnapshot) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notifySubscribers(snapshot: MarketSnapshot): void {
    for (const fn of this.subscribers) fn(snapshot);
  }
}

export const store = new MarketStore();
