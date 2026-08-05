export interface Quote {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  currency: string;
  exchange: string;
  timestamp: Date;
}

export interface RankedAsset {
  rank: number;
  symbol: string;
  name: string;
  type: "stock" | "etf" | "bond";
  price: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  trendScore: number;
  momentum: number;
  signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  reasoning: string;
  scalableCapitalAvailable: boolean;
  currency: string;
  exchange: string;
  lastUpdated: Date;
}

export interface Alert {
  id: string;
  symbol: string;
  type: "price_spike" | "price_drop" | "volume_surge" | "trend_reversal" | "new_ath" | "analyst_upgrade";
  severity: "info" | "warning" | "critical";
  message: string;
  price: number;
  changePercent: number;
  timestamp: Date;
  read: boolean;
}

export interface MarketSnapshot {
  topStocks: RankedAsset[];
  topETFs: RankedAsset[];
  topBonds: RankedAsset[];
  alerts: Alert[];
  marketSentiment: "bullish" | "bearish" | "neutral";
  lastUpdated: Date;
  analysisModel: string;
  eurUsdRate: number; // 1 USD = X EUR
}

export interface WatchlistItem {
  symbol: string;
  addedAt: Date;
  alertOnChange: number; // percent threshold
}

export interface PortfolioEntry {
  symbol: string;
  shares: number;
  buyPrice: number;
  buyDate: Date;
}
