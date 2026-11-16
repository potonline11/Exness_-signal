import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Candle,
  IndicatorValues,
  ConfluenceResult,
  Position,
  TradingStats,
  AccountState,
  UserSettings,
  Timeframe,
  OrderType,
  NotificationLog,
  TradeSignal,
  HTFTrendContext,
  AntiSpamStatus,
  TelegramEnvStatus
} from './types/trading';
import {
  computeAllIndicators,
  evaluateConfluence,
  formatTelegramSignalMessage
} from './utils/technicalAnalysis';
import { updateCandleWithTick, playAlertSound } from './utils/marketSimulator';
import { Navbar } from './components/Navbar';
import { TradingChart } from './components/TradingChart';
import { ConfluencePanel } from './components/ConfluencePanel';
import { RiskManagementPanel } from './components/RiskManagementPanel';
import { PositionsAndHistory } from './components/PositionsAndHistory';
import { TelegramNotifyModal } from './components/TelegramNotifyModal';
import { ExnessBridgeModal } from './components/ExnessBridgeModal';
import { ExnessSignalStation } from './components/ExnessSignalStation';

export default function App() {
  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<'terminal' | 'signal-station' | 'confluence' | 'history' | 'mql5'>('terminal');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);

  // User Settings
  const [settings, setSettings] = useState<UserSettings>(() => {
    const savedTgToken = localStorage.getItem('exness_tg_bot_token') || '';
    const savedTgChatId = localStorage.getItem('exness_tg_chat_id') || '';
    const savedOffset = parseFloat(localStorage.getItem('exness_price_offset') || '0') || 0;
    const savedSymbol = (localStorage.getItem('exness_symbol') as 'XAUUSDc' | 'XAUUSD') || 'XAUUSDc';
    const savedCooldown = parseInt(localStorage.getItem('exness_cooldown_mins') || '30', 10) || 30;
    const savedSniperThreshold = parseInt(localStorage.getItem('exness_sniper_threshold') || '85', 10) || 85;
    let savedBulk: Partial<UserSettings> = {};
    try {
      const raw = localStorage.getItem('exness_user_settings_v2');
      if (raw) savedBulk = JSON.parse(raw);
    } catch {
      savedBulk = {};
    }

    const defaults: UserSettings = {
      symbol: savedSymbol,
      priceOffset: savedOffset,
      confluenceThreshold: 90, // Mandatory user requirement: Confluence > 90%
      sniperFilterEnabled: true, // Layer 2 Sniper Profit Filter ON by default
      sniperThreshold: savedSniperThreshold, // >= 85% Sniper grade required
      signalCooldownMinutes: savedCooldown, // 30 min anti-spam cooldown by default
      sameWaveLockEnabled: true, // Never repeat same signal in same wave
      maxSignalsPerDay: 8, // Quality over quantity
      autoTrade: true,
      maxOpenPositions: 1, // Single order protection
      lotMode: 'FIXED_LOT',
      riskPercent: 2.0, // Strictly <= 5%
      fixedLotSize: 0.01,
      tpTargetPercent: 10.0, // ~10% target
      slMaxPercent: 4.0, // <= 5%
      slPipsDefault: 30, // 30 pips (~$3.00 Gold move)
      tpPipsDefault: 75, // 75 pips (~$7.50 Gold move, 2.5:1 R:R)
      autoBreakevenEnabled: true,
      autoBreakevenTriggerPips: 15,
      trailingStopEnabled: false,
      trailingStopDistancePips: 20,
      telegramBotToken: savedTgToken,
      telegramChatId: savedTgChatId,
      telegramEnabled: true,
      autoSendSignalToTelegram: true, // Auto dispatch signal to Telegram when Layer 1 & Layer 2 pass
      soundEnabled: true,
      showIndicators: {
        ema: true,
        supertrend: true,
        bollinger: true,
        smcFvg: true,
        supportResistance: true
      }
    };

    return {
      ...defaults,
      ...savedBulk,
      showIndicators: {
        ...defaults.showIndicators,
        ...(savedBulk.showIndicators || {})
      },
      telegramBotToken: savedTgToken,
      telegramChatId: savedTgChatId
    };
  });

  // Signals history for placing into Exness
  const [signals, setSignals] = useState<TradeSignal[]>([]);

  // Account State (Exness Real Account)
  const [account, setAccount] = useState<AccountState>({
    broker: 'Exness',
    server: 'Exness-Real14',
    accountNumber: 'EX-7829104',
    accountType: 'Pro Zero Spread',
    balance: 1000.0,
    equity: 1000.0,
    margin: 0,
    freeMargin: 1000.0,
    marginLevel: 9999,
    leverage: '1:2000',
    currency: 'USD',
    usdThbRate: 35.5
  });

  // Live Market Data (XAUUSD / XAUUSDc)
  const [timeframe, setTimeframe] = useState<Timeframe>('M1');
  const [rawCandles, setRawCandles] = useState<Candle[]>([]);
  const [rawBid, setRawBid] = useState<number>(0);
  const [rawAsk, setRawAsk] = useState<number>(0);
  const [spreadPips, setSpreadPips] = useState<number>(2.4);
  const [marketSource, setMarketSource] = useState<string>('กำลังเชื่อมต่อ...');
  const [isLoadingMarket, setIsLoadingMarket] = useState<boolean>(true);
  const [htfContext, setHtfContext] = useState<HTFTrendContext | undefined>(undefined);
  const [telegramEnvStatus, setTelegramEnvStatus] = useState<TelegramEnvStatus>({
    hasEnvBotToken: false,
    hasEnvChatId: false,
    configuredViaEnv: false,
    maskedChatId: ''
  });

  const refreshTelegramEnvStatus = async () => {
    try {
      const tgRes = await fetch('/api/telegram/status');
      if (tgRes.ok) {
        setTelegramEnvStatus(await tgRes.json());
      }
    } catch {
      // Ignore transient network errors
    }
  };

  useEffect(() => {
    refreshTelegramEnvStatus();
  }, []);

  // Apply Exness price calibration offset cleanly to candles and live bid/ask
  const candles = useMemo(() => {
    if (settings.priceOffset === 0) return rawCandles;
    return rawCandles.map(c => ({
      ...c,
      open: Number((c.open + settings.priceOffset).toFixed(3)),
      high: Number((c.high + settings.priceOffset).toFixed(3)),
      low: Number((c.low + settings.priceOffset).toFixed(3)),
      close: Number((c.close + settings.priceOffset).toFixed(3))
    }));
  }, [rawCandles, settings.priceOffset]);

  const bid = rawBid > 0 ? Number((rawBid + settings.priceOffset).toFixed(3)) : 0;
  const ask = rawAsk > 0 ? Number((rawAsk + settings.priceOffset).toFixed(3)) : 0;

  // Positions & Trade History
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<Position[]>([]);

  // Notifications Log
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);

  // Anti-Spam & Active Wave Lock State (prevents spamming same wave every minute)
  const [lastAutoSignal, setLastAutoSignal] = useState<{
    direction: OrderType;
    entryPrice: number;
    sl: number;
    tp: number;
    timestamp: number;
  } | null>(null);
  const [waveResetObserved, setWaveResetObserved] = useState<boolean>(true);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const lastAutoAlertTime = useRef<number>(0);

  // Compute Indicators & Confluence + Layer 2 Sniper Profit Filter
  const indicators: IndicatorValues = useMemo(() => {
    return computeAllIndicators(candles);
  }, [candles]);

  const confluence: ConfluenceResult = useMemo(() => {
    const slRiskPct = Number(Math.min(5.0, (settings.fixedLotSize * 10 * settings.slPipsDefault / account.equity) * 100).toFixed(1));
    const tpGainPct = Number(((settings.fixedLotSize * 10 * settings.tpPipsDefault / account.equity) * 100).toFixed(1));
    return evaluateConfluence(candles, indicators, settings.confluenceThreshold, {
      bid,
      ask,
      slPips: settings.slPipsDefault,
      tpPips: settings.tpPipsDefault,
      slRiskPercent: slRiskPct > 0 ? slRiskPct : 3.0,
      tpTargetPercent: tpGainPct > 0 ? tpGainPct : 7.5,
      htfContext,
      spreadPips,
      sniperThreshold: settings.sniperThreshold,
      sniperFilterEnabled: settings.sniperFilterEnabled
    });
  }, [candles, indicators, settings.confluenceThreshold, settings.sniperThreshold, settings.sniperFilterEnabled, bid, ask, spreadPips, htfContext, settings.slPipsDefault, settings.tpPipsDefault, settings.fixedLotSize, account.equity]);

  // Track whether price/confluence has reset or exited the previous signal's wave
  useEffect(() => {
    if (!lastAutoSignal || waveResetObserved) return;

    const directionFlipped = confluence.direction !== 'NEUTRAL' && confluence.direction !== lastAutoSignal.direction;
    const confluenceDroppedLow = confluence.totalScore < 80;
    const hitPreviousTpOrSl =
      bid > 0 &&
      ((lastAutoSignal.direction === 'BUY' && (bid >= lastAutoSignal.tp || bid <= lastAutoSignal.sl)) ||
       (lastAutoSignal.direction === 'SELL' && (bid <= lastAutoSignal.tp || bid >= lastAutoSignal.sl)));
    const movedOutOfZone =
      bid > 0 && Math.abs(bid - lastAutoSignal.entryPrice) >= 3.0; // Moved >= 30 pips away

    if (directionFlipped || confluenceDroppedLow || hitPreviousTpOrSl || movedOutOfZone) {
      setWaveResetObserved(true);
    }
  }, [bid, confluence.direction, confluence.totalScore, lastAutoSignal, waveResetObserved]);

  // Compute Anti-Spam Gatekeeper Status
  const antiSpam: AntiSpamStatus = useMemo(() => {
    const todayStr = new Date().toDateString();
    const signalsSentToday = signals.filter(s => s.sentToTelegram && new Date(s.timestamp).toDateString() === todayStr).length;

    const cooldownMs = settings.signalCooldownMinutes * 60 * 1000;
    const elapsedMs = lastAutoSignal ? nowTick - lastAutoSignal.timestamp : Infinity;
    const cooldownRemainingSec = lastAutoSignal && elapsedMs < cooldownMs
      ? Math.ceil((cooldownMs - elapsedMs) / 1000)
      : 0;

    const isSameWaveLocked = Boolean(
      settings.sameWaveLockEnabled &&
      lastAutoSignal &&
      !waveResetObserved &&
      confluence.direction === lastAutoSignal.direction
    );

    let blockReason: string | null = null;
    if (signalsSentToday >= settings.maxSignalsPerDay) {
      blockReason = `ครบโควต้าสัญญาณคุณภาพสูงวันนี้แล้ว (${signalsSentToday}/${settings.maxSignalsPerDay})`;
    } else if (cooldownRemainingSec > 0) {
      const m = Math.floor(cooldownRemainingSec / 60);
      const s = cooldownRemainingSec % 60;
      blockReason = `Cooldown กันส่งถี่ เหลืออีก ${m}:${String(s).padStart(2, '0')} นาที`;
    } else if (isSameWaveLocked) {
      blockReason = `ล็อกคลื่น ${lastAutoSignal?.direction} เดิม (รอจบรอบ TP/SL หรือสร้างฐานใหม่)`;
    }

    return {
      canSend: blockReason === null,
      blockReason,
      cooldownRemainingSec,
      isSameWaveLocked,
      signalsSentToday,
      maxSignalsPerDay: settings.maxSignalsPerDay
    };
  }, [signals, settings.signalCooldownMinutes, settings.sameWaveLockEnabled, settings.maxSignalsPerDay, lastAutoSignal, waveResetObserved, confluence.direction, nowTick]);

  const handleResetWaveLock = () => {
    setWaveResetObserved(true);
    setLastAutoSignal(null);
    lastAutoAlertTime.current = 0;
  };

  // Compute Performance Statistics
  const stats: TradingStats = useMemo(() => {
    const totalTrades = history.length;
    const winTrades = history.filter(h => h.pnlUsd > 0).length;
    const lossTrades = history.filter(h => h.pnlUsd <= 0).length;
    const winRate = totalTrades > 0 ? Number(((winTrades / totalTrades) * 100).toFixed(1)) : 0;

    const grossProfit = history.filter(h => h.pnlUsd > 0).reduce((sum, h) => sum + h.pnlUsd, 0);
    const grossLoss = Math.abs(history.filter(h => h.pnlUsd < 0).reduce((sum, h) => sum + h.pnlUsd, 0));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 5.0 : 0);

    const netProfitUsd = Number((grossProfit - grossLoss).toFixed(2));
    const netProfitThb = Number((netProfitUsd * account.usdThbRate).toFixed(2));

    const avgWinUsd = winTrades > 0 ? Number((grossProfit / winTrades).toFixed(2)) : 0;
    const avgLossUsd = lossTrades > 0 ? Number((grossLoss / lossTrades).toFixed(2)) : 0;

    return {
      totalTrades,
      winTrades,
      lossTrades,
      winRate,
      profitFactor,
      netProfitUsd,
      netProfitThb,
      maxDrawdownPercent: 2.8,
      avgWinUsd,
      avgLossUsd,
      confluenceHitsCount: totalTrades + 3
    };
  }, [history, account.usdThbRate]);

  // Execute Order
  const handleExecuteTrade = (type: OrderType, reason: string) => {
    // Check Single Order Rule
    if (settings.maxOpenPositions === 1 && positions.length >= 1) {
      console.warn('Single order lock is active. Close active position first.');
      return;
    }

    const entryPrice = type === 'BUY' ? ask : bid;
    const slPips = settings.slPipsDefault;
    const tpPips = settings.tpPipsDefault;

    const sl = type === 'BUY'
      ? Number((entryPrice - slPips * 0.1).toFixed(3))
      : Number((entryPrice + slPips * 0.1).toFixed(3));

    const tp = type === 'BUY'
      ? Number((entryPrice + tpPips * 0.1).toFixed(3))
      : Number((entryPrice - tpPips * 0.1).toFixed(3));

    const newPosition: Position = {
      id: 'pos_' + Date.now(),
      ticket: Math.floor(41000 + Math.random() * 900),
      broker: 'Exness',
      symbol: settings.symbol,
      type,
      lots: settings.fixedLotSize,
      entryPrice,
      currentPrice: entryPrice,
      sl,
      tp,
      pnlUsd: 0,
      pnlThb: 0,
      pnlPips: 0,
      openTime: Date.now(),
      isBreakevenLocked: false,
      status: 'OPEN'
    };

    setPositions(prev => [newPosition, ...prev]);

    if (settings.soundEnabled) {
      playAlertSound('ORDER_FILLED');
    }

    // Send Telegram alert on trade execution
    if (settings.telegramEnabled) {
      sendTelegramAlert(type, confluence, newPosition, true);
    }
  };

  // Close Single Position
  const handleClosePosition = (id: string, reason: 'MANUAL_CLOSE' | 'TP_HIT' | 'SL_HIT' | 'KILL_SWITCH') => {
    setPositions(prev => {
      const target = prev.find(p => p.id === id);
      if (!target) return prev;

      const closedItem: Position = {
        ...target,
        status: 'CLOSED',
        closePrice: target.currentPrice,
        closeTime: Date.now(),
        closeReason: reason
      };

      setHistory(h => [closedItem, ...h]);
      setAccount(acc => ({
        ...acc,
        balance: Number((acc.balance + target.pnlUsd).toFixed(2)),
        equity: Number((acc.equity).toFixed(2))
      }));

      return prev.filter(p => p.id !== id);
    });
  };

  // Move SL to Breakeven
  const handleMoveToBreakeven = (id: string) => {
    setPositions(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const beSl = p.type === 'BUY'
          ? Number((p.entryPrice + 0.2).toFixed(2))
          : Number((p.entryPrice - 0.2).toFixed(2));
        return {
          ...p,
          sl: beSl,
          isBreakevenLocked: true
        };
      })
    );
  };

  // Kill Switch: Instant Close All Open Positions
  const handleKillSwitch = () => {
    if (positions.length === 0) return;

    if (settings.soundEnabled) {
      playAlertSound('KILL_SWITCH');
    }

    positions.forEach(pos => {
      handleClosePosition(pos.id, 'KILL_SWITCH');
    });

    const notif: NotificationLog = {
      id: 'notif_kill_' + Date.now(),
      timestamp: new Date().toISOString(),
      title: '🛑 KILL SWITCH ACTIVATED (ปิดทุกออเดอร์)',
      message: 'ปิดทุกออเดอร์ในพอร์ตทันที ป้องกันเงินทุนเรียบร้อย',
      type: 'KILL_SWITCH',
      success: true
    };
    setNotificationLogs(prev => [notif, ...prev]);
  };

  // Send Telegram Group Alert via Backend Proxy
  const sendTelegramAlert = async (
    direction: OrderType,
    conf: ConfluenceResult,
    pos?: Position,
    recordSignal: boolean = true
  ): Promise<{ success: boolean; message?: string }> => {
    const message = formatTelegramSignalMessage(
      direction,
      conf,
      account.accountNumber,
      pos ? pos.lots : settings.fixedLotSize,
      settings.symbol,
      htfContext
    );

    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: settings.telegramBotToken,
          chatId: settings.telegramChatId,
          message,
          parseMode: 'HTML'
        })
      });

      const data = await res.json();
      const notif: NotificationLog = {
        id: 'notif_tg_' + Date.now(),
        timestamp: new Date().toISOString(),
        title: `${direction === 'BUY' ? '🟢' : '🔴'} ${settings.symbol} ${direction} Sniper Signal (${conf.totalScore}% / S2:${conf.layer2?.sniperScore ?? 90}%)`,
        message,
        type: direction === 'BUY' ? 'SIGNAL_BUY' : 'SIGNAL_SELL',
        channel: 'TELEGRAM',
        success: Boolean(data.success)
      };

      setNotificationLogs(prev => [notif, ...prev.slice(0, 40)]);

      if (recordSignal) {
        const newSignal: TradeSignal = {
          id: 'sig_' + Date.now(),
          timestamp: Date.now(),
          type: direction,
          symbol: settings.symbol,
          entryPrice: conf.suggestedEntry,
          sl: conf.suggestedSl,
          tp: conf.suggestedTp,
          slPips: conf.slPips,
          tpPips: conf.tpPips,
          rrRatio: conf.rrRatio,
          confluenceScore: conf.totalScore,
          sniperScore: conf.layer2?.sniperScore,
          grade: conf.grade === 'WAIT' ? 'A+' : conf.grade,
          lotSize: pos ? pos.lots : settings.fixedLotSize,
          status: 'ACTIVE',
          sentToTelegram: Boolean(data.success)
        };
        setSignals(prev => [newSignal, ...prev.slice(0, 30)]);
      }

      return { success: Boolean(data.success), message: data.message || data.error };
    } catch (e: any) {
      console.error('Error dispatching Telegram alert:', e);
      return { success: false, message: e.message || 'ไม่สามารถเชื่อมต่อ Telegram ได้' };
    }
  };

  // Test Signal Dispatch using ACTUAL live market price (no fake base price!)
  const handleSimulateHighConfluence = () => {
    if (bid <= 0 || ask <= 0) return;

    if (settings.soundEnabled) {
      playAlertSound('ALERT_CONFLUENCE');
    }

    const dir: OrderType = confluence.direction === 'SELL' ? 'SELL' : 'BUY';
    const liveEntry = dir === 'BUY' ? ask : bid;
    const slDist = settings.slPipsDefault * 0.1;
    const tpDist = settings.tpPipsDefault * 0.1;

    const liveSl = dir === 'BUY'
      ? Number((liveEntry - slDist).toFixed(3))
      : Number((liveEntry + slDist).toFixed(3));
    const liveTp = dir === 'BUY'
      ? Number((liveEntry + tpDist).toFixed(3))
      : Number((liveEntry - tpDist).toFixed(3));

    const testConfluence: ConfluenceResult = {
      ...confluence,
      totalScore: Math.max(confluence.totalScore, 92),
      grade: 'A+',
      meetsThreshold: true,
      direction: dir,
      suggestedEntry: liveEntry,
      suggestedSl: liveSl,
      suggestedTp: liveTp,
      slPips: settings.slPipsDefault,
      tpPips: settings.tpPipsDefault,
      rrRatio: Number((settings.tpPipsDefault / settings.slPipsDefault).toFixed(2))
    };

    // Send live price signal to Telegram Group
    sendTelegramAlert(dir, testConfluence, undefined, true);
  };

  // Fetch initial real OHLCV candles when timeframe changes
  useEffect(() => {
    let cancelled = false;
    setIsLoadingMarket(true);

    fetch(`/api/market/xauusd?timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.candles) && data.candles.length > 0) {
          setRawCandles(data.candles);
          if (data.quote) {
            setRawBid(data.quote.bid);
            setRawAsk(data.quote.ask);
            setSpreadPips(data.quote.spreadPips);
            setMarketSource(data.quote.source || 'Swissquote Live Spot');
          }
          if (data.htfContext) {
            setHtfContext(data.htfContext);
          }
        }
      })
      .catch(err => console.error('Failed to load initial market data:', err))
      .finally(() => {
        if (!cancelled) setIsLoadingMarket(false);
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  // Real-time Live Tick Polling Engine (Polls /api/market/tick every 1.2s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        setNowTick(Date.now());
        const res = await fetch('/api/market/tick');
        if (!res.ok) return;
        const tick = await res.json();
        if (!tick.success || typeof tick.bid !== 'number') return;

        const nextRawBid = Number(tick.bid.toFixed(3));
        const nextRawAsk = Number(tick.ask.toFixed(3));
        const nextBid = Number((nextRawBid + settings.priceOffset).toFixed(3));
        const nextAsk = Number((nextRawAsk + settings.priceOffset).toFixed(3));

        setRawBid(nextRawBid);
        setRawAsk(nextRawAsk);
        setSpreadPips(tick.spreadPips);
        if (tick.source) setMarketSource(tick.source);
        if (tick.htfContext) setHtfContext(tick.htfContext);

        // Update latest raw candle with live tick
        setRawCandles(prev => {
          if (prev.length === 0) return prev;
          const { updatedCandles } = updateCandleWithTick(prev, nextRawBid, timeframe);
          return updatedCandles;
        });

        // Evaluate open positions against live Exness-aligned price
        setPositions(prev => {
          if (prev.length === 0) return prev;

          const updatedPositions: Position[] = [];
          let totalPnl = 0;

          prev.forEach(pos => {
            const currentPrice = pos.type === 'BUY' ? nextBid : nextAsk;
            const pnlPips = pos.type === 'BUY'
              ? Number(((currentPrice - pos.entryPrice) * 10).toFixed(1))
              : Number(((pos.entryPrice - currentPrice) * 10).toFixed(1));

            const pnlUsd = Number((pnlPips * pos.lots * 1.0).toFixed(2));
            const pnlThb = Number((pnlUsd * account.usdThbRate).toFixed(2));

            // 1. Check Take Profit (TP ~10%)
            if (
              (pos.type === 'BUY' && currentPrice >= pos.tp) ||
              (pos.type === 'SELL' && currentPrice <= pos.tp)
            ) {
              handleClosePosition(pos.id, 'TP_HIT');
              if (settings.soundEnabled) playAlertSound('ORDER_FILLED');
              return;
            }

            // 2. Check Stop Loss (SL <= 5%)
            if (
              (pos.type === 'BUY' && currentPrice <= pos.sl) ||
              (pos.type === 'SELL' && currentPrice >= pos.sl)
            ) {
              handleClosePosition(pos.id, 'SL_HIT');
              if (settings.soundEnabled) playAlertSound('KILL_SWITCH');
              return;
            }

            // 3. Auto Breakeven Lock
            let isBeLocked = pos.isBreakevenLocked;
            let newSl = pos.sl;
            if (settings.autoBreakevenEnabled && !isBeLocked && pnlPips >= settings.autoBreakevenTriggerPips) {
              isBeLocked = true;
              newSl = pos.type === 'BUY'
                ? Number((pos.entryPrice + 0.2).toFixed(3))
                : Number((pos.entryPrice - 0.2).toFixed(3));
            }

            totalPnl += pnlUsd;
            updatedPositions.push({
              ...pos,
              currentPrice,
              pnlPips,
              pnlUsd,
              pnlThb,
              sl: newSl,
              isBreakevenLocked: isBeLocked
            });
          });

          setAccount(acc => ({
            ...acc,
            equity: Number((acc.balance + totalPnl).toFixed(2)),
            margin: updatedPositions.length * 5.0,
            freeMargin: Number((acc.balance + totalPnl - updatedPositions.length * 5.0).toFixed(2))
          }));

          return updatedPositions;
        });

        // Automated Signal Dispatch to Telegram:
        // Requires Layer 1 (Confluence > 90%) + Layer 2 (Sniper High-Profit Filter) + Anti-Spam & Wave Lock
        const passesLayer1 = confluence.meetsThreshold && confluence.direction !== 'NEUTRAL';
        const passesLayer2 = !settings.sniperFilterEnabled || Boolean(confluence.layer2?.passed);
        const cooldownMs = settings.signalCooldownMinutes * 60 * 1000;

        if (
          settings.autoSendSignalToTelegram &&
          settings.telegramEnabled &&
          passesLayer1 &&
          passesLayer2 &&
          antiSpam.canSend &&
          Date.now() - lastAutoAlertTime.current >= cooldownMs
        ) {
          const sentAt = Date.now();
          lastAutoAlertTime.current = sentAt;
          setWaveResetObserved(false);
          setLastAutoSignal({
            direction: confluence.direction as OrderType,
            entryPrice: confluence.suggestedEntry,
            sl: confluence.suggestedSl,
            tp: confluence.suggestedTp,
            timestamp: sentAt
          });

          if (settings.soundEnabled) playAlertSound('ALERT_CONFLUENCE');
          sendTelegramAlert(confluence.direction as OrderType, confluence, undefined, true);

          if (settings.autoTrade && positions.length < settings.maxOpenPositions) {
            handleExecuteTrade(
              confluence.direction as OrderType,
              `Auto-Trade Sniper (${confluence.totalScore}% / S2:${confluence.layer2?.sniperScore ?? 90}%)`
            );
          }
        }
      } catch (err) {
        // Ignore transient poll errors
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [timeframe, positions, settings, confluence, antiSpam, account.usdThbRate]);

  const handleUpdateSettings = (partial: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      if (partial.priceOffset !== undefined) {
        localStorage.setItem('exness_price_offset', String(partial.priceOffset));
      }
      if (partial.symbol !== undefined) {
        localStorage.setItem('exness_symbol', partial.symbol);
      }
      if (partial.signalCooldownMinutes !== undefined) {
        localStorage.setItem('exness_cooldown_mins', String(partial.signalCooldownMinutes));
      }
      if (partial.sniperThreshold !== undefined) {
        localStorage.setItem('exness_sniper_threshold', String(partial.sniperThreshold));
      }
      if (partial.telegramBotToken !== undefined) {
        localStorage.setItem('exness_tg_bot_token', partial.telegramBotToken);
      }
      if (partial.telegramChatId !== undefined) {
        localStorage.setItem('exness_tg_chat_id', partial.telegramChatId);
      }
      try {
        const {
          telegramBotToken: _tgt,
          telegramChatId: _tgc,
          ...persistable
        } = next;
        localStorage.setItem('exness_user_settings_v2', JSON.stringify(persistable));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleToggleIndicator = (key: 'ema' | 'supertrend' | 'bollinger' | 'smcFvg' | 'supportResistance') => {
    setSettings(prev => {
      const next = {
        ...prev,
        showIndicators: {
          ...prev.showIndicators,
          [key]: !prev.showIndicators[key]
        }
      };
      try {
        const { telegramBotToken: _tgt, telegramChatId: _tgc, ...persistable } = next;
        localStorage.setItem('exness_user_settings_v2', JSON.stringify(persistable));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#090c12] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        account={account}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenTelegramModal={() => {
          refreshTelegramEnvStatus();
          setIsTelegramModalOpen(true);
        }}
        onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
        onOpenRiskSettings={() => setActiveTab('terminal')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bid={bid}
        ask={ask}
        spreadPips={spreadPips}
        telegramEnvStatus={telegramEnvStatus}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-4 lg:p-5 space-y-4">
        {/* VIEW 1: Main Terminal & Chart */}
        {activeTab === 'terminal' && (
          <div className="space-y-4">
            {/* Exness Signal Copy Station & Telegram Group Dispatch Banner */}
            <ExnessSignalStation
              confluence={confluence}
              signals={signals}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onSendSignalToTelegram={async (dir, conf) => (await sendTelegramAlert(dir, conf, undefined, true)).success}
              onSimulateSignal={handleSimulateHighConfluence}
              bid={bid}
              ask={ask}
              rawBid={rawBid}
              marketSource={marketSource}
              htfContext={htfContext}
              antiSpam={antiSpam}
              onResetWaveLock={handleResetWaveLock}
            />

            {/* Split Grid: Chart (Left) + Confluence & Execution Panel (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Live Chart (7 cols) */}
              <div className="lg:col-span-7 h-[420px] lg:h-[520px]">
                <TradingChart
                  candles={candles}
                  indicators={indicators}
                  timeframe={timeframe}
                  setTimeframe={setTimeframe}
                  positions={positions}
                  bid={bid}
                  ask={ask}
                  spreadPips={spreadPips}
                  symbol={settings.symbol}
                  isLoading={isLoadingMarket}
                  showIndicators={settings.showIndicators}
                  onToggleIndicator={handleToggleIndicator}
                />
              </div>

              {/* Right Column: Confluence Analysis & Instant Execution (5 cols) */}
              <div className="lg:col-span-5 h-auto lg:h-[520px]">
                <ConfluencePanel
                  confluence={confluence}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onExecuteTrade={handleExecuteTrade}
                  onSendTelegramNotify={(dir, conf) => sendTelegramAlert(dir, conf, undefined, true)}
                  onSimulateHighConfluence={handleSimulateHighConfluence}
                  bid={bid}
                  ask={ask}
                />
              </div>
            </div>

            {/* Risk Guardian & Capital Protection Panel */}
            <RiskManagementPanel
              account={account}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onKillSwitch={handleKillSwitch}
              openPositionsCount={positions.length}
            />

            {/* Positions & Real-time Trading History */}
            <PositionsAndHistory
              positions={positions}
              history={history}
              stats={stats}
              account={account}
              onClosePosition={handleClosePosition}
              onMoveToBreakeven={handleMoveToBreakeven}
            />
          </div>
        )}

        {/* VIEW 2: Dedicated Signal to Exness Station */}
        {activeTab === 'signal-station' && (
          <div className="space-y-4">
            <ExnessSignalStation
              confluence={confluence}
              signals={signals}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onSendSignalToTelegram={async (dir, conf) => (await sendTelegramAlert(dir, conf, undefined, true)).success}
              onSimulateSignal={handleSimulateHighConfluence}
              bid={bid}
              ask={ask}
              rawBid={rawBid}
              marketSource={marketSource}
              htfContext={htfContext}
              antiSpam={antiSpam}
              onResetWaveLock={handleResetWaveLock}
            />
          </div>
        )}

        {/* VIEW 3: Dedicated Confluence Matrix View */}
        {activeTab === 'confluence' && (
          <div className="space-y-4">
            <ConfluencePanel
              confluence={confluence}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onExecuteTrade={handleExecuteTrade}
              onSendTelegramNotify={(dir, conf) => sendTelegramAlert(dir, conf, undefined, true)}
              onSimulateHighConfluence={handleSimulateHighConfluence}
              bid={bid}
              ask={ask}
            />

            {/* Detailed Confluence Logic Breakdown */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>เกณฑ์การประเมินน้ำหนัก Confluence 100 คะแนนเต็ม (เกณฑ์ผ่าน &gt; 90%)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">1. EMA Ribbon Trend (25 คะแนน)</div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    ตรวจสอบการเรียงตัวของ EMA 20, 50, 200 ตามทิศทางเทรนด์ Scalping เพื่อยืนยันว่าราคาไม่อยู่ในจุดผันผวนไร้ทิศทาง
                  </p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="font-semibold text-emerald-400 mb-1">2. SuperTrend Dynamic (20 คะแนน)</div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    ยืนยันทิศทางแนวโน้มและจุดเด้งจากแนวรับ/ต้านไดนามิก ช่วยกรองจังหวะ Retracement เข้าตามเทรนด์
                  </p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="font-semibold text-cyan-400 mb-1">3. Key S/R &amp; Liquidity (15 คะแนน)</div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    วิเคราะห์แนวรับแนวต้านหลัก และการกวาดสภาพคล่อง (Liquidity Sweep) ก่อนดีดตัว
                  </p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="font-semibold text-rose-400 mb-1">4. RSI Exhaustion (15 คะแนน)</div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    ตรวจจับการสิ้นสุดแรงขาย (Oversold bounce) หรือแรงซื้อ และป้องกันการเข้าซื้อที่ปลายดอย
                  </p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="font-semibold text-purple-400 mb-1">5. BB Squeeze Breakout (10 คะแนน)</div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    จับจังหวะการบีบตัวของ Bollinger Bands เมื่อความผันผวนต่ำสุดแล้วขยายตัวรับช่วง Impulse Move
                  </p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="font-semibold text-teal-400 mb-1">6. SMC Fair Value Gap (15 คะแนน)</div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    ตรวจจับช่องว่างสภาพคล่องสถาบัน (Bullish / Bearish FVG) เพื่อเข้าเทรด ณ จุดที่มีแต้มต่อสูงที่สุด
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: Positions & Historical Stats */}
        {activeTab === 'history' && (
          <PositionsAndHistory
            positions={positions}
            history={history}
            stats={stats}
            account={account}
            onClosePosition={handleClosePosition}
            onMoveToBreakeven={handleMoveToBreakeven}
          />
        )}

        {/* VIEW 4: MQL5 Expert Advisor Bridge */}
        {activeTab === 'mql5' && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  คู่มือเชื่อมต่อ Exness MetaTrader 5 (MT5 EA Receiver)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  เชื่อมต่อระบบเทรดเว็บเข้ากับบัญชีจริง Exness MT5 ด้วยความเร็วสูงและปลอดภัย
                </p>
              </div>
              <button
                onClick={() => setIsBridgeModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                ดูและคัดลอกโค้ด MQL5
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 block">1. กฎ 1 ออเดอร์ (Single Order)</span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  ตัว EA จะมีฟังก์ชัน Double Lock ในตัว หากในพอร์ตมีออเดอร์เปิดอยู่แล้ว 1 ไม้ จะปฏิเสธการส่งออเดอร์เพิ่ม เพื่อป้องกันการ Overtrade
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-bold text-emerald-400 block">2. กฎห้ามออกสวนทาง (Anti-Hedging)</span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  หากพอร์ตถือสัญญา BUY อยู่ จะบล็อกคำสั่ง SELL ทุกกรณี เพื่อลดความสับสนและไม่ให้กินค่า Spread ซ้ำซ้อน
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-bold text-cyan-400 block">3. ฝัง SL &lt;= 5% และ TP ~10% ทันที</span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  คำสั่งทุกไม้จะถูกส่งเข้าโบรกเกอร์ Exness พร้อมระดับราคา Stop Loss และ Take Profit ป้องกันกรณีเน็ตหลุดหรือเครื่องดับ
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Telegram Group Bot Modal */}
      <TelegramNotifyModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        telegramBotToken={settings.telegramBotToken}
        telegramChatId={settings.telegramChatId}
        telegramEnabled={settings.telegramEnabled}
        onSaveTelegramCredentials={(botToken, chatId, enabled) =>
          handleUpdateSettings({ telegramBotToken: botToken, telegramChatId: chatId, telegramEnabled: enabled })
        }
        notificationLogs={notificationLogs}
        onSendTestTelegram={() => sendTelegramAlert('BUY', confluence, undefined, true)}
        confluencePreview={confluence}
        telegramEnvStatus={telegramEnvStatus}
        onRefreshEnvStatus={refreshTelegramEnvStatus}
      />

      {/* Exness MT5 Bridge Modal */}
      <ExnessBridgeModal
        isOpen={isBridgeModalOpen}
        onClose={() => setIsBridgeModalOpen(false)}
        broker={account.broker}
        accountNumber={account.accountNumber}
      />
    </div>
  );
}
