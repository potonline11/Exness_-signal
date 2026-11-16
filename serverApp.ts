import express from 'express';
import dotenv from 'dotenv';
import type { Candle, HTFTrendContext, TrendBias } from './src/types/trading.js';
import {
  computeAllIndicators,
  evaluateConfluence,
  formatTelegramSignalMessage
} from './src/utils/technicalAnalysis.js';

dotenv.config();

// In-memory trade signal and webhook event logs
interface WebhookEvent {
  id: string;
  timestamp: string;
  type: string;
  symbol: string;
  price?: number;
  data: Record<string, any>;
}

const webhookEvents: WebhookEvent[] = [];
const notificationLogs: Array<{ id: string; timestamp: string; message: string; success: boolean; target: string }> = [];

// Warm-instance Cron anti-spam state
const cronState = {
  lastSignalAt: 0,
  lastDirection: '' as '' | 'BUY' | 'SELL',
  lastCandleTime: 0,
  signalsSentDate: '',
  signalsSentToday: 0
};

function getEnvTelegramCredentials() {
  const rawToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const rawChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  const envBotToken = rawToken && rawToken !== 'MY_TELEGRAM_BOT_TOKEN' ? rawToken : '';
  const envChatId = rawChatId && rawChatId !== 'MY_TELEGRAM_CHAT_ID' ? rawChatId : '';
  return { envBotToken, envChatId };
}

async function dispatchTelegramSend(params: {
  botToken?: string;
  chatId?: string;
  message: string;
  parseMode?: string;
}) {
  const { envBotToken, envChatId } = getEnvTelegramCredentials();
  const uiToken = (params.botToken || '').trim();
  const uiChatId = (params.chatId || '').trim();

  const activeToken = uiToken || envBotToken;
  const activeChatId = uiChatId || envChatId;
  const usedSource = uiToken && uiChatId
    ? 'ui_override'
    : envBotToken && envChatId
    ? 'env_secrets'
    : 'simulation';

  const isSimulated = !activeToken ||
    !activeChatId ||
    activeToken.toUpperCase() === 'DEMO' ||
    activeToken.toUpperCase().includes('TEST') ||
    activeChatId.toUpperCase().includes('DEMO');

  if (isSimulated) {
    const logEntry = {
      id: 'tg_msg_' + Date.now(),
      timestamp: new Date().toISOString(),
      message: params.message,
      success: true,
      target: `Telegram Group Simulation (${activeChatId || '-100...Demo'})`
    };
    notificationLogs.unshift(logEntry);
    if (notificationLogs.length > 50) notificationLogs.pop();

    return {
      status: 200,
      body: {
        success: true,
        mode: 'simulated',
        usedSource: 'simulation',
        message: 'ส่งการแจ้งเตือน Telegram จำลองสำเร็จ! (กรุณาระบุ TELEGRAM_BOT_TOKEN และ TELEGRAM_CHAT_ID ใน Secrets/Environment Variables เพื่อส่งเข้ากลุ่มจริง)',
        log: logEntry
      }
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(activeToken)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: activeChatId,
      text: params.message,
      parse_mode: params.parseMode || 'HTML',
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(7000)
  });

  const data = await response.json().catch(() => ({}));
  const isSuccess = response.ok && data.ok;

  const logEntry = {
    id: 'tg_msg_' + Date.now(),
    timestamp: new Date().toISOString(),
    message: params.message,
    success: isSuccess,
    target: isSuccess
      ? `Telegram Group (${usedSource === 'env_secrets' ? 'Environment Secrets' : 'UI'}) -> ${activeChatId}`
      : `Telegram Error: ${data.description || response.statusText}`
  };
  notificationLogs.unshift(logEntry);
  if (notificationLogs.length > 50) notificationLogs.pop();

  if (!isSuccess) {
    return {
      status: response.status || 400,
      body: {
        success: false,
        error: data.description || `Telegram API Error (HTTP ${response.status})`,
        details: data
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      mode: 'live',
      usedSource,
      message: usedSource === 'env_secrets'
        ? 'ส่งสัญญาณเข้ากลุ่ม Telegram ผ่าน Environment Secrets เรียบร้อยแล้ว!'
        : 'ส่งสัญญาณเข้ากลุ่ม Telegram เรียบร้อยแล้ว!',
      data
    }
  };
}

// Helper: Fetch Live Spot XAU/USD quote from Swissquote (with Binance/Yahoo fallback)
async function fetchLiveSpotQuote(): Promise<{
  bid: number;
  ask: number;
  spreadPips: number;
  source: string;
  timestamp: number;
}> {
  // 1. Primary: Swissquote Institutional Forex Spot Feed (XAU/USD)
  try {
    const res = await fetch('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const serverEntry of data) {
          const profiles = serverEntry?.spreadProfilePrices;
          if (Array.isArray(profiles) && profiles.length > 0) {
            const elite = profiles.find((p: any) => p.spreadProfile === 'elite') ||
                          profiles.find((p: any) => p.spreadProfile === 'prime') ||
                          profiles[0];
            if (elite && typeof elite.bid === 'number' && typeof elite.ask === 'number') {
              const bid = Number(elite.bid.toFixed(3));
              const ask = Number(elite.ask.toFixed(3));
              const spreadPips = Number(((ask - bid) * 10).toFixed(1));
              return {
                bid,
                ask,
                spreadPips,
                source: 'Swissquote Live Spot XAU/USD',
                timestamp: serverEntry.ts || Date.now()
              };
            }
          }
        }
      }
    }
  } catch {
    // Fallback below
  }

  // 2. Fallback: Binance PAXGUSDT (1 PAXG = 1 troy oz physical gold)
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=PAXGUSDT', {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const d = await res.json();
      const bid = Number(parseFloat(d.bidPrice).toFixed(3));
      const ask = Number((parseFloat(d.askPrice) + 0.24).toFixed(3));
      return {
        bid,
        ask,
        spreadPips: Number(((ask - bid) * 10).toFixed(1)),
        source: 'Binance Gold Spot (PAXG/USDT)',
        timestamp: Date.now()
      };
    }
  } catch {
    // Fallback below
  }

  // 3. Fallback: Yahoo Finance COMEX Gold Futures GC=F
  const yRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(4000)
  });
  if (yRes.ok) {
    const yData = await yRes.json();
    const meta = yData?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      const bid = Number(meta.regularMarketPrice.toFixed(3));
      const ask = Number((bid + 0.24).toFixed(3));
      return {
        bid,
        ask,
        spreadPips: 2.4,
        source: 'COMEX Gold (GC=F)',
        timestamp: Date.now()
      };
    }
  }

  throw new Error('Unable to fetch live XAUUSD market quote');
}

// Helper: Compute EMA values on closing prices
function computeEmaLast(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

let cachedHtf: HTFTrendContext | null = null;
let lastHtfFetchAt = 0;

async function fetchHtfTrendContext(spotBid: number): Promise<HTFTrendContext> {
  const now = Date.now();
  if (cachedHtf && now - lastHtfFetchAt < 45_000) {
    return cachedHtf;
  }

  const analyzeInterval = async (interval: '15m' | '1h') => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${interval}&limit=100`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return null;
      const klines = await res.json();
      if (!Array.isArray(klines) || klines.length < 50) return null;

      const rawCloses = klines.map((k: any[]) => parseFloat(k[4]));
      const basisDelta = spotBid > 0 ? spotBid - rawCloses[rawCloses.length - 1] : 0;
      const closes = rawCloses.map(c => c + basisDelta);
      const lastClose = closes[closes.length - 1];
      const ema20 = Number(computeEmaLast(closes, 20).toFixed(3));
      const ema50 = Number(computeEmaLast(closes, 50).toFixed(3));

      let trend: TrendBias = 'NEUTRAL';
      if (lastClose > ema20 && ema20 > ema50) trend = 'BULLISH';
      else if (lastClose < ema20 && ema20 < ema50) trend = 'BEARISH';
      else if (lastClose > ema50) trend = 'BULLISH';
      else if (lastClose < ema50) trend = 'BEARISH';

      return { trend, ema20, ema50 };
    } catch {
      return null;
    }
  };

  const [m15, h1] = await Promise.all([analyzeInterval('15m'), analyzeInterval('1h')]);

  const result: HTFTrendContext = {
    m15Trend: m15?.trend ?? cachedHtf?.m15Trend ?? 'NEUTRAL',
    h1Trend: h1?.trend ?? cachedHtf?.h1Trend ?? 'NEUTRAL',
    m15Ema20: m15?.ema20 ?? cachedHtf?.m15Ema20 ?? spotBid,
    m15Ema50: m15?.ema50 ?? cachedHtf?.m15Ema50 ?? spotBid,
    h1Ema20: h1?.ema20 ?? cachedHtf?.h1Ema20 ?? spotBid,
    h1Ema50: h1?.ema50 ?? cachedHtf?.h1Ema50 ?? spotBid,
    updatedAt: now
  };

  cachedHtf = result;
  lastHtfFetchAt = now;
  return result;
}

async function fetchXauUsdMarketData(timeframeInput: string) {
  const tf = timeframeInput.toUpperCase();
  const intervalMap: Record<string, string> = {
    M1: '1m',
    M5: '5m',
    M15: '15m',
    H1: '1h',
    H4: '4h'
  };
  const binanceInterval = intervalMap[tf] || '1m';

  const [quote, klineRes] = await Promise.all([
    fetchLiveSpotQuote(),
    fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${binanceInterval}&limit=220`, {
      signal: AbortSignal.timeout(5000)
    })
  ]);

  const htfContext = await fetchHtfTrendContext(quote.bid);
  let candles: Candle[] = [];

  if (klineRes.ok) {
    const rawKlines = await klineRes.json();
    if (Array.isArray(rawKlines) && rawKlines.length > 0) {
      const lastRawClose = parseFloat(rawKlines[rawKlines.length - 1][4]);
      const basisDelta = quote.bid - lastRawClose;

      candles = rawKlines.map((k: any[], idx: number) => {
        const open = Number((parseFloat(k[1]) + basisDelta).toFixed(3));
        const high = Number((parseFloat(k[2]) + basisDelta).toFixed(3));
        const low = Number((parseFloat(k[3]) + basisDelta).toFixed(3));
        const close = idx === rawKlines.length - 1
          ? quote.bid
          : Number((parseFloat(k[4]) + basisDelta).toFixed(3));
        return {
          time: Number(k[0]),
          open,
          high: Math.max(high, close, open),
          low: Math.min(low, close, open),
          close,
          volume: Math.round(parseFloat(k[5]) * 100) || 50
        };
      });
    }
  }

  // Fallback to Yahoo Finance candles if Binance klines failed
  if (candles.length === 0) {
    const yInterval = tf === 'M1' ? '1m' : tf === 'M5' ? '5m' : tf === 'M15' ? '15m' : '1h';
    const yRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${yInterval}&range=5d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (yRes.ok) {
      const yData = await yRes.json();
      const result = yData?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const q = result?.indicators?.quote?.[0] || {};
      const rawList: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (q.open?.[i] != null && q.close?.[i] != null) {
          rawList.push({
            time: timestamps[i] * 1000,
            open: q.open[i],
            high: q.high[i] ?? q.close[i],
            low: q.low[i] ?? q.close[i],
            close: q.close[i],
            volume: q.volume?.[i] || 50
          });
        }
      }
      if (rawList.length > 0) {
        const basisDelta = quote.bid - rawList[rawList.length - 1].close;
        candles = rawList.slice(-220).map((c, idx, arr) => ({
          time: c.time,
          open: Number((c.open + basisDelta).toFixed(3)),
          high: Number((c.high + basisDelta).toFixed(3)),
          low: Number((c.low + basisDelta).toFixed(3)),
          close: idx === arr.length - 1 ? quote.bid : Number((c.close + basisDelta).toFixed(3)),
          volume: c.volume
        }));
      }
    }
  }

  return {
    timeframe: tf,
    quote,
    htfContext,
    candles
  };
}

export function createApiApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API: Check if Telegram Bot credentials are configured via Secrets / Environment Variables
  app.get('/api/telegram/status', (_req, res) => {
    const { envBotToken, envChatId } = getEnvTelegramCredentials();
    const maskedChatId = envChatId
      ? envChatId.length > 7
        ? `${envChatId.slice(0, 4)}••••${envChatId.slice(-3)}`
        : `${envChatId.slice(0, 2)}••••`
      : '';
    return res.json({
      hasEnvBotToken: Boolean(envBotToken),
      hasEnvChatId: Boolean(envChatId),
      configuredViaEnv: Boolean(envBotToken && envChatId),
      maskedChatId
    });
  });

  // API: Auto-detect recent Telegram Groups/Channels via Bot getUpdates
  app.post('/api/telegram/get-groups', async (req, res) => {
    try {
      const { envBotToken } = getEnvTelegramCredentials();
      const activeToken = (req.body?.botToken || envBotToken || '').trim();
      if (!activeToken) {
        return res.status(400).json({
          success: false,
          error: 'กรุณาระบุ Telegram Bot Token ก่อนค้นหากลุ่ม'
        });
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(activeToken)}/getUpdates?limit=50`, {
        signal: AbortSignal.timeout(6000)
      });
      const tgData = await tgRes.json().catch(() => ({}));

      if (!tgRes.ok || !tgData.ok) {
        return res.status(tgRes.status || 400).json({
          success: false,
          error: tgData.description || 'ไม่สามารถดึงข้อมูลจาก Telegram Bot API ได้ (ตรวจสอบ Bot Token)'
        });
      }

      const chatsMap = new Map<string, { id: string; title: string; type: string }>();
      const updates = Array.isArray(tgData.result) ? tgData.result : [];
      for (const upd of updates) {
        const chat =
          upd?.message?.chat ||
          upd?.channel_post?.chat ||
          upd?.my_chat_member?.chat ||
          upd?.edited_message?.chat;
        if (chat && chat.id != null) {
          const idStr = String(chat.id);
          chatsMap.set(idStr, {
            id: idStr,
            title: chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || `Chat ${idStr}`,
            type: chat.type || 'group'
          });
        }
      }

      return res.json({
        success: true,
        groups: Array.from(chatsMap.values())
      });
    } catch (error: any) {
      return res.status(502).json({
        success: false,
        error: error.message || 'เกิดข้อผิดพลาดระหว่างเชื่อมต่อ Telegram API'
      });
    }
  });

  // API: Send Trading Signal to Telegram Group via Bot API
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { botToken, chatId, message, parseMode = 'HTML' } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: 'กรุณาระบุข้อความที่ต้องการส่ง' });
      }
      const result = await dispatchTelegramSend({ botToken, chatId, message, parseMode });
      return res.status(result.status).json(result.body);
    } catch (error: any) {
      console.error('Error sending Telegram message:', error);
      return res.status(502).json({
        success: false,
        error: error.message || 'ไม่สามารถเชื่อมต่อ Telegram API ได้'
      });
    }
  });

  // API: 24/7 Server-Side Cron Scanner for cron-job.org (runs Layer 1 + Layer 2 + auto-dispatches Telegram Group)
  app.all('/api/cron/scan', async (req, res) => {
    try {
      const configuredCronSecret = (process.env.CRON_SECRET || '').trim();
      if (configuredCronSecret) {
        const providedSecret = String(
          req.query.secret ||
          req.headers['x-cron-secret'] ||
          (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '') ||
          ''
        ).trim();
        if (providedSecret !== configuredCronSecret) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized cron request: invalid secret'
          });
        }
      }

      const tf = String(req.query.tf || req.query.timeframe || 'M5').toUpperCase();
      const threshold = Math.max(50, Math.min(100, Number(req.query.threshold || 90)));
      const sniperThreshold = Math.max(50, Math.min(100, Number(req.query.sniper || 85)));
      const cooldownMinutes = Math.max(1, Number(req.query.cooldown || 30));
      const symbol = String(req.query.symbol || 'XAUUSDc') === 'XAUUSD' ? 'XAUUSD' : 'XAUUSDc';
      const lotSize = Number(req.query.lot || 0.01);
      const slPips = Number(req.query.slPips || 30);
      const tpPips = Number(req.query.tpPips || 75);
      const slRiskPercent = Math.min(5, Math.max(0.5, Number(req.query.slRiskPercent || 3.5)));
      const tpTargetPercent = Math.max(1, Number(req.query.tpTargetPercent || 9.8));
      const priceOffset = Number(req.query.offset || 0);
      const notifyMode = String(req.query.notify || 'telegram').toLowerCase(); // 'telegram' | 'all' | 'none'
      const forceDispatch = req.query.force === '1' || req.query.force === 'true';

      const market = await fetchXauUsdMarketData(tf);
      if (market.candles.length < 30) {
        return res.status(200).json({
          success: true,
          status: 'INSUFFICIENT_DATA',
          timeframe: market.timeframe,
          message: 'ข้อมูลแท่งเทียนยังไม่เพียงพอสำหรับคำนวณ',
          checkedAt: new Date().toISOString()
        });
      }

      const bid = Number((market.quote.bid + priceOffset).toFixed(3));
      const ask = Number((market.quote.ask + priceOffset).toFixed(3));
      const candles = priceOffset === 0
        ? market.candles
        : market.candles.map(c => ({
            ...c,
            open: Number((c.open + priceOffset).toFixed(3)),
            high: Number((c.high + priceOffset).toFixed(3)),
            low: Number((c.low + priceOffset).toFixed(3)),
            close: Number((c.close + priceOffset).toFixed(3))
          }));

      const htfContext: HTFTrendContext = priceOffset === 0
        ? market.htfContext
        : {
            ...market.htfContext,
            m15Ema20: Number((market.htfContext.m15Ema20 + priceOffset).toFixed(3)),
            m15Ema50: Number((market.htfContext.m15Ema50 + priceOffset).toFixed(3)),
            h1Ema20: Number((market.htfContext.h1Ema20 + priceOffset).toFixed(3)),
            h1Ema50: Number((market.htfContext.h1Ema50 + priceOffset).toFixed(3))
          };

      const indicators = computeAllIndicators(candles);
      const confluence = evaluateConfluence(candles, indicators, threshold, {
        bid,
        ask,
        slPips,
        tpPips,
        slRiskPercent,
        tpTargetPercent,
        htfContext,
        spreadPips: market.quote.spreadPips,
        sniperThreshold,
        sniperFilterEnabled: true
      });

      const layer1Passed = confluence.meetsThreshold && confluence.direction !== 'NEUTRAL';
      const layer2Passed = Boolean(confluence.layer2?.passed);
      const now = Date.now();
      const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      if (cronState.signalsSentDate !== todayKey) {
        cronState.signalsSentDate = todayKey;
        cronState.signalsSentToday = 0;
      }

      const latestCandleTime = candles[candles.length - 1].time;

      let status = 'WAITING_CONFLUENCE';
      let reason = `Confluence ${confluence.totalScore}% (ต้อง > ${threshold}%)`;

      if (layer1Passed && !layer2Passed) {
        status = 'FILTERED_LAYER2';
        reason = `ผ่านชั้นที่ 1 (${confluence.totalScore}%) แต่ถูกคัดกรองชั้นที่ 2 (Sniper ${confluence.layer2?.sniperScore ?? 0}%/${sniperThreshold}%): ${confluence.layer2?.rejectionReasons.join(', ') || 'ยังไม่คมพอ'}`;
      } else if (layer1Passed && layer2Passed) {
        const dir = confluence.direction as 'BUY' | 'SELL';

        // Warm-instance anti-spam cooldown & wave lock
        const cooldownMs = cooldownMinutes * 60_000;
        const inCooldown = cronState.lastSignalAt > 0 && now - cronState.lastSignalAt < cooldownMs;
        const inSameWave = cronState.lastDirection === dir && cronState.lastCandleTime === latestCandleTime;

        // Cold-start transition guard: prevent repeating an old wave on Serverless cold start
        let isStaleOngoingWave = false;
        if (cronState.lastSignalAt === 0 && candles.length >= 60) {
          const prev1Slice = candles.slice(0, -1);
          const prev2Slice = candles.slice(0, -2);
          const prev1Eval = evaluateConfluence(prev1Slice, computeAllIndicators(prev1Slice), threshold, {
            bid: prev1Slice[prev1Slice.length - 1].close,
            ask: prev1Slice[prev1Slice.length - 1].close + market.quote.spreadPips * 0.1,
            slPips,
            tpPips,
            htfContext,
            spreadPips: market.quote.spreadPips,
            sniperThreshold,
            sniperFilterEnabled: true
          });
          const prev2Eval = evaluateConfluence(prev2Slice, computeAllIndicators(prev2Slice), threshold, {
            bid: prev2Slice[prev2Slice.length - 1].close,
            ask: prev2Slice[prev2Slice.length - 1].close + market.quote.spreadPips * 0.1,
            slPips,
            tpPips,
            htfContext,
            spreadPips: market.quote.spreadPips,
            sniperThreshold,
            sniperFilterEnabled: true
          });
          isStaleOngoingWave =
            prev1Eval.meetsThreshold &&
            Boolean(prev1Eval.layer2?.passed) &&
            prev1Eval.direction === dir &&
            prev2Eval.meetsThreshold &&
            Boolean(prev2Eval.layer2?.passed) &&
            prev2Eval.direction === dir;
        }

        if (!forceDispatch && (inCooldown || inSameWave || isStaleOngoingWave || cronState.signalsSentToday >= 8)) {
          status = 'ANTI_SPAM_SKIPPED';
          reason = inCooldown
            ? `อยู่ในช่วง Cooldown (${Math.ceil((cooldownMs - (now - cronState.lastSignalAt)) / 60000)} นาทีที่เหลือ)`
            : inSameWave || isStaleOngoingWave
            ? `คลื่นสัญญาณ ${dir} นี้ถูกประมวลผล/แจ้งเตือนไปแล้ว (Same-Wave Lock)`
            : 'ครบโควตาสัญญาณคุณภาพสูงสุดของวันนี้แล้ว (8/8)';
        } else {
          const { envBotToken, envChatId } = getEnvTelegramCredentials();
          let telegramResult: any = { skipped: true };

          if (notifyMode !== 'none' && envBotToken && envChatId) {
            const tgMsg = formatTelegramSignalMessage(dir, confluence, 'EX-7829104', lotSize, symbol, htfContext);
            const r = await dispatchTelegramSend({ message: tgMsg, parseMode: 'HTML' });
            telegramResult = r.body;
          }

          cronState.lastSignalAt = now;
          cronState.lastDirection = dir;
          cronState.lastCandleTime = latestCandleTime;
          cronState.signalsSentToday += 1;

          status = 'SIGNAL_SENT';
          reason = `ตรวจพบสัญญาณ ${dir} คุณภาพ ${confluence.layer2?.profitGrade} (${confluence.totalScore}% / Sniper ${confluence.layer2?.sniperScore}%)`;

          return res.status(200).json({
            success: true,
            status,
            reason,
            timeframe: market.timeframe,
            symbol,
            source: market.quote.source,
            price: { bid, ask, spreadPips: market.quote.spreadPips },
            htfContext: { m15: htfContext.m15Trend, h1: htfContext.h1Trend },
            signal: {
              direction: dir,
              confluenceScore: confluence.totalScore,
              sniperScore: confluence.layer2?.sniperScore,
              profitGrade: confluence.layer2?.profitGrade,
              entry: confluence.suggestedEntry,
              sl: confluence.suggestedSl,
              tp: confluence.suggestedTp,
              rrRatio: confluence.rrRatio
            },
            dispatch: { telegram: telegramResult },
            checkedAt: new Date().toISOString()
          });
        }
      }

      return res.status(200).json({
        success: true,
        status,
        reason,
        timeframe: market.timeframe,
        symbol,
        source: market.quote.source,
        price: { bid, ask, spreadPips: market.quote.spreadPips },
        htfContext: { m15: htfContext.m15Trend, h1: htfContext.h1Trend },
        analysis: {
          direction: confluence.direction,
          confluenceScore: confluence.totalScore,
          sniperScore: confluence.layer2?.sniperScore ?? 0,
          profitGrade: confluence.layer2?.profitGrade ?? 'REJECTED',
          suggestedEntry: confluence.suggestedEntry,
          suggestedSl: confluence.suggestedSl,
          suggestedTp: confluence.suggestedTp
        },
        checkedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error in /api/cron/scan:', error);
      return res.status(502).json({
        success: false,
        error: error.message || 'Cron scan failed'
      });
    }
  });

  // API: Webhook receiver for Exness MT5 / MT4 EA Bridge
  app.post('/api/webhook/trade', (req, res) => {
    const payload = req.body;
    const event: WebhookEvent = {
      id: 'evt_' + Date.now(),
      timestamp: new Date().toISOString(),
      type: payload.type || 'SIGNAL_EXECUTE',
      symbol: payload.symbol || 'XAUUSD',
      price: payload.price,
      data: payload
    };
    webhookEvents.unshift(event);
    if (webhookEvents.length > 50) webhookEvents.pop();

    return res.json({
      status: 'received',
      receivedAt: event.timestamp,
      eventId: event.id
    });
  });

  // API: Get recent notification & webhook logs
  app.get('/api/webhook/history', (_req, res) => {
    return res.json({
      notifications: notificationLogs,
      webhooks: webhookEvents
    });
  });

  // API: Live XAU/USD Tick
  app.get('/api/market/tick', async (_req, res) => {
    try {
      const quote = await fetchLiveSpotQuote();
      const htfContext = await fetchHtfTrendContext(quote.bid);
      return res.json({ success: true, ...quote, htfContext });
    } catch (error: any) {
      return res.status(502).json({ success: false, error: error.message });
    }
  });

  // API: Real Historical OHLCV Candles + Live Spot Quote for XAUUSD
  app.get('/api/market/xauusd', async (req, res) => {
    try {
      const data = await fetchXauUsdMarketData(String(req.query.timeframe || 'M1'));
      return res.json({
        success: true,
        ...data
      });
    } catch (error: any) {
      console.error('Error fetching live XAUUSD market data:', error);
      return res.status(502).json({
        success: false,
        error: error.message || 'Failed to fetch live XAUUSD market data'
      });
    }
  });

  // API: Health & Server status
  app.get('/api/health', (_req, res) => {
    return res.json({
      status: 'online',
      broker: 'Exness',
      instrument: 'XAUUSD',
      notifications: 'Telegram Only',
      time: new Date().toISOString()
    });
  });

  return app;
}
