import { Candle, Timeframe } from '../types/trading';

/**
 * Generates initial realistic historical candles for XAUUSD (Gold)
 */
export function generateInitialCandles(count: number = 70, basePrice: number = 2742.50): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const intervalMs = 60 * 1000; // 1-minute default

  let currentClose = basePrice - 12.0;

  for (let i = count; i >= 0; i--) {
    const time = now - (i * intervalMs);
    // Add trend momentum with slight upward drift
    const change = (Math.random() - 0.47) * 1.6;
    const open = Number(currentClose.toFixed(2));
    const close = Number((open + change).toFixed(2));
    const high = Number((Math.max(open, close) + Math.random() * 0.9).toFixed(2));
    const low = Number((Math.min(open, close) - Math.random() * 0.9).toFixed(2));
    const volume = Math.floor(40 + Math.random() * 120);

    candles.push({ time, open, high, low, close, volume });
    currentClose = close;
  }

  return candles;
}

/**
 * Updates the latest candle with a new tick price
 */
export function updateCandleWithTick(
  candles: Candle[],
  tickPrice: number,
  timeframe: Timeframe = 'M1'
): { updatedCandles: Candle[]; isNewCandle: boolean } {
  if (candles.length === 0) return { updatedCandles: [], isNewCandle: false };

  const lastCandle = candles[candles.length - 1];
  const now = Date.now();

  const timeframeMsMap: Record<Timeframe, number> = {
    'M1': 60 * 1000,
    'M5': 5 * 60 * 1000,
    'M15': 15 * 60 * 1000,
    'H1': 60 * 60 * 1000,
    'H4': 4 * 60 * 60 * 1000,
  };

  const durationMs = timeframeMsMap[timeframe] || 60000;
  const isNewCandle = now - lastCandle.time >= durationMs;

  if (isNewCandle) {
    const newCandle: Candle = {
      time: now,
      open: lastCandle.close,
      high: Math.max(lastCandle.close, tickPrice),
      low: Math.min(lastCandle.close, tickPrice),
      close: tickPrice,
      volume: 1
    };
    const nextCandles = [...candles.slice(1), newCandle];
    return { updatedCandles: nextCandles, isNewCandle: true };
  } else {
    const updatedLast: Candle = {
      ...lastCandle,
      high: Math.max(lastCandle.high, tickPrice),
      low: Math.min(lastCandle.low, tickPrice),
      close: tickPrice,
      volume: lastCandle.volume + 1
    };
    const nextCandles = [...candles.slice(0, -1), updatedLast];
    return { updatedCandles: nextCandles, isNewCandle: false };
  }
}

/**
 * Sound synthesized chime for high confluence trade alert and order execution
 */
export function playAlertSound(type: 'ALERT_CONFLUENCE' | 'ORDER_FILLED' | 'KILL_SWITCH') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'ALERT_CONFLUENCE') {
      // Harmonic 3-tone chime for >90% Confluence
      const freqs = [587.33, 880.0, 1174.66]; // D5, A5, D6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.15, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } else if (type === 'ORDER_FILLED') {
      // Crisp 2-tone fill confirmation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'KILL_SWITCH') {
      // Low dual warning pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    }
  } catch (e) {
    // Audio autoplay restrictions gracefully handled
  }
}
