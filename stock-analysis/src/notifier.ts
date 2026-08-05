import { randomUUID } from "crypto";
import type { Quote, Alert } from "./types.js";
import { store } from "./data/store.js";

// Volume surge threshold: 2x average volume triggers an alert
const VOLUME_SURGE_MULTIPLIER = 2.0;
// Price spike/drop threshold
const PRICE_CHANGE_ALERT_THRESHOLD = 3.0; // %

const volumeHistory: Map<string, number[]> = new Map();

function avgVolume(symbol: string): number {
  const hist = volumeHistory.get(symbol) ?? [];
  if (hist.length === 0) return 0;
  return hist.reduce((a, b) => a + b, 0) / hist.length;
}

function recordVolume(symbol: string, volume: number): void {
  const hist = volumeHistory.get(symbol) ?? [];
  hist.push(volume);
  if (hist.length > 20) hist.shift(); // Keep last 20 readings
  volumeHistory.set(symbol, hist);
}

export function detectAlerts(
  current: Map<string, Quote>,
  previous: Map<string, Quote>
): Alert[] {
  const newAlerts: Alert[] = [];

  for (const [symbol, quote] of current) {
    recordVolume(symbol, quote.volume);
    const prev = previous.get(symbol);

    // Price spike
    if (Math.abs(quote.changePercent) >= PRICE_CHANGE_ALERT_THRESHOLD) {
      const isSpike = quote.changePercent > 0;
      const alert: Alert = {
        id: randomUUID(),
        symbol,
        type: isSpike ? "price_spike" : "price_drop",
        severity: Math.abs(quote.changePercent) >= 5 ? "critical" : "warning",
        message: `${quote.name} ${isSpike ? "surged" : "dropped"} ${Math.abs(quote.changePercent).toFixed(2)}% to ${quote.currency} ${quote.price.toFixed(2)}`,
        price: quote.price,
        changePercent: quote.changePercent,
        timestamp: new Date(),
        read: false,
      };
      store.addAlert(alert);
      newAlerts.push(alert);
    }

    // Volume surge
    const avg = avgVolume(symbol);
    if (avg > 0 && quote.volume > avg * VOLUME_SURGE_MULTIPLIER) {
      const alert: Alert = {
        id: randomUUID(),
        symbol,
        type: "volume_surge",
        severity: "info",
        message: `${quote.name} volume spike: ${(quote.volume / 1e6).toFixed(1)}M vs avg ${(avg / 1e6).toFixed(1)}M (${((quote.volume / avg) * 100 - 100).toFixed(0)}% above average)`,
        price: quote.price,
        changePercent: quote.changePercent,
        timestamp: new Date(),
        read: false,
      };
      store.addAlert(alert);
      newAlerts.push(alert);
    }

    // All-time high (approximate: price > previous close by >5% and prev was also up)
    if (prev && quote.changePercent > 5 && prev.changePercent > 2) {
      const alert: Alert = {
        id: randomUUID(),
        symbol,
        type: "new_ath",
        severity: "info",
        message: `${quote.name} may be approaching new highs — consecutive up days with strong momentum`,
        price: quote.price,
        changePercent: quote.changePercent,
        timestamp: new Date(),
        read: false,
      };
      store.addAlert(alert);
      newAlerts.push(alert);
    }
  }

  return newAlerts;
}

// System notification using native macOS/Linux notifications
export async function sendSystemNotification(alert: Alert): Promise<void> {
  try {
    const { default: notifier } = await import("node-notifier");
    const icon = alert.severity === "critical" ? "⚠️" : alert.severity === "warning" ? "⚡" : "📈";
    notifier.notify({
      title: `${icon} Stock Alert: ${alert.symbol}`,
      message: alert.message,
      sound: alert.severity === "critical",
    });
  } catch {
    // node-notifier optional — log to console as fallback
    console.log(`[ALERT] ${alert.severity.toUpperCase()} | ${alert.symbol} | ${alert.message}`);
  }
}
