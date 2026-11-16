export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4';
export type OrderType = 'BUY' | 'SELL';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
  ema20: number;
  ema50: number;
  ema200: number;
  superTrend: {
    direction: 'UP' | 'DOWN';
    value: number;
  };
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    lower: number;
    middle: number;
    bandwidth: number;
    isSqueezing: boolean;
  };
  supportLevels: number[];
  resistanceLevels: number[];
  nearestSupport: number;
  nearestResistance: number;
  smc: {
    fvgType: 'BULLISH' | 'BEARISH' | 'NONE';
    top: number;
    bottom: number;
    isMitigated: boolean;
  };
}

export interface ConfluenceCriterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  score: number;
  passed: boolean;
  weight: number;
  detail: string;
  badge: string;
}

export type TrendBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface HTFTrendContext {
  m15Trend: TrendBias;
  h1Trend: TrendBias;
  m15Ema20: number;
  m15Ema50: number;
  h1Ema20: number;
  h1Ema50: number;
  updatedAt: number;
}

export interface Layer2Criterion {
  id: string;
  name: string;
  maxScore: number;
  score: number;
  passed: boolean;
  detail: string;
}

export interface Layer2Analysis {
  sniperScore: number; // 0 - 100
  sniperThreshold: number; // e.g. 85
  passed: boolean;
  profitGrade: 'A++ SNIPER' | 'A+ PRIME' | 'B STANDARD' | 'REJECTED';
  expectedProfitLabel: string;
  clearancePips: number;
  atrPips: number;
  volumeRatio: number;
  rejectionReasons: string[];
  criteria: Layer2Criterion[];
}

export interface AntiSpamStatus {
  canSend: boolean;
  blockReason: string | null;
  cooldownRemainingSec: number;
  isSameWaveLocked: boolean;
  signalsSentToday: number;
  maxSignalsPerDay: number;
}

export interface ConfluenceResult {
  totalScore: number; // 0 - 100%
  threshold: number;  // Default 90%
  grade: 'A+' | 'A' | 'B' | 'WAIT';
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  meetsThreshold: boolean;
  criteria: ConfluenceCriterion[];
  timestamp: number;
  suggestedEntry: number;
  suggestedSl: number;
  suggestedTp: number;
  slPips: number;
  tpPips: number;
  rrRatio: number;
  slRiskPercent: number; // <= 5%
  tpTargetPercent: number; // ~10%
  layer2?: Layer2Analysis;
}

export interface Position {
  id: string;
  ticket: number;
  broker: string;
  symbol: string;
  type: OrderType;
  lots: number;
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  pnlUsd: number;
  pnlThb: number;
  pnlPips: number;
  openTime: number;
  isBreakevenLocked: boolean;
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
  closeTime?: number;
  closeReason?: 'TP_HIT' | 'SL_HIT' | 'MANUAL_CLOSE' | 'KILL_SWITCH';
}

export interface TradingStats {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  profitFactor: number;
  netProfitUsd: number;
  netProfitThb: number;
  maxDrawdownPercent: number;
  avgWinUsd: number;
  avgLossUsd: number;
  confluenceHitsCount: number;
}

export interface AccountState {
  broker: string;
  server: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: string;
  currency: 'USD' | 'THB';
  usdThbRate: number;
}

export interface UserSettings {
  symbol: 'XAUUSDc' | 'XAUUSD';
  priceOffset: number; // Calibration offset vs Exness server price
  confluenceThreshold: number; // 90% default
  sniperFilterEnabled: boolean; // Layer-2 High-Profit Filter toggle
  sniperThreshold: number; // 85% default for Layer 2
  signalCooldownMinutes: number; // Anti-spam cooldown (default 30 mins)
  sameWaveLockEnabled: boolean; // Block duplicate signals in the same active wave
  maxSignalsPerDay: number; // Daily cap to ensure only best setups
  autoTrade: boolean;
  maxOpenPositions: number; // 1 (Anti-hedging single order)
  lotMode: 'PERCENT_RISK' | 'FIXED_LOT';
  riskPercent: number; // <= 5% (default 2%)
  fixedLotSize: number; // 0.01 default
  tpTargetPercent: number; // ~10% target
  slMaxPercent: number; // strictly <= 5%
  slPipsDefault: number;
  tpPipsDefault: number;
  autoBreakevenEnabled: boolean;
  autoBreakevenTriggerPips: number;
  trailingStopEnabled: boolean;
  trailingStopDistancePips: number;
  telegramBotToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  autoSendSignalToTelegram: boolean; // Auto dispatch signal to Telegram when Layer 1 & Layer 2 match
  soundEnabled: boolean;
  showIndicators: {
    ema: boolean;
    supertrend: boolean;
    bollinger: boolean;
    smcFvg: boolean;
    supportResistance: boolean;
  };
}

export interface TradeSignal {
  id: string;
  timestamp: number;
  type: OrderType;
  symbol: string;
  entryPrice: number;
  sl: number;
  tp: number;
  slPips: number;
  tpPips: number;
  rrRatio: number;
  confluenceScore: number;
  sniperScore?: number;
  grade: 'A+' | 'A' | 'B';
  lotSize: number;
  status: 'ACTIVE' | 'HIT_TP' | 'HIT_SL' | 'EXPIRED';
  sentToTelegram: boolean;
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'SIGNAL_BUY' | 'SIGNAL_SELL' | 'TP_HIT' | 'SL_HIT' | 'KILL_SWITCH' | 'TEST';
  channel?: 'TELEGRAM' | 'SYSTEM';
  success: boolean;
}

export interface TelegramEnvStatus {
  hasEnvBotToken: boolean;
  hasEnvChatId: boolean;
  configuredViaEnv: boolean;
  maskedChatId: string;
}
