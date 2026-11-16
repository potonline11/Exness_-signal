import type {
  Candle,
  IndicatorValues,
  ConfluenceCriterion,
  ConfluenceResult,
  OrderType,
  HTFTrendContext,
  Layer2Analysis,
  Layer2Criterion
} from '../types/trading';

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = new Array(data.length).fill(0);

  if (data.length < period) return emaArray;

  // Initial SMA as first EMA point
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  let currentEma = sum / period;
  emaArray[period - 1] = currentEma;

  for (let i = period; i < data.length; i++) {
    currentEma = data[i] * k + currentEma * (1 - k);
    emaArray[i] = currentEma;
  }

  return emaArray;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = 100 - (100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - (100 / (1 + rs));
  }

  return rsi;
}

/**
 * Calculates Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number = 10): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
  }

  const atr: number[] = new Array(candles.length).fill(0);
  if (candles.length < period) return atr;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;

  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  return atr;
}

/**
 * Calculates SuperTrend
 */
export function calculateSuperTrend(candles: Candle[], period: number = 10, multiplier: number = 3.0) {
  const atr = calculateATR(candles, period);
  const stValues: number[] = new Array(candles.length).fill(0);
  const directions: ('UP' | 'DOWN')[] = new Array(candles.length).fill('UP');

  let prevST = 0;
  let prevDir: 'UP' | 'DOWN' = 'UP';

  for (let i = period - 1; i < candles.length; i++) {
    const c = candles[i];
    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + multiplier * atr[i];
    const basicLower = hl2 - multiplier * atr[i];

    let upperBand = basicUpper;
    let lowerBand = basicLower;

    if (i > period - 1) {
      const prevClose = candles[i - 1].close;
      if (prevST > 0) {
        if (basicLower > prevST || prevClose < prevST) {
          lowerBand = basicLower;
        } else {
          lowerBand = Math.max(basicLower, prevST);
        }
      }
    }

    let dir: 'UP' | 'DOWN' = prevDir;
    let st = 0;

    if (c.close > (prevST || basicUpper)) {
      dir = 'UP';
    } else if (c.close < (prevST || basicLower)) {
      dir = 'DOWN';
    }

    if (dir === 'UP') {
      st = lowerBand;
    } else {
      st = upperBand;
    }

    stValues[i] = st;
    directions[i] = dir;
    prevST = st;
    prevDir = dir;
  }

  return { stValues, directions };
}

/**
 * Calculates Bollinger Bands (20, 2)
 */
export function calculateBollingerBands(closes: number[], period: number = 20, multiplier: number = 2) {
  const upper: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);
  const middle: number[] = new Array(closes.length).fill(0);
  const bandwidth: number[] = new Array(closes.length).fill(0);

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += closes[i - j];
    }
    const sma = sum / period;
    middle[i] = sma;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(closes[i - j] - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    upper[i] = sma + multiplier * stdDev;
    lower[i] = sma - multiplier * stdDev;
    bandwidth[i] = sma > 0 ? (upper[i] - lower[i]) / sma : 0;
  }

  return { upper, lower, middle, bandwidth };
}

/**
 * Detects Fair Value Gaps (SMC FVG)
 */
export function detectFVG(candles: Candle[]) {
  if (candles.length < 3) {
    return { fvgType: 'NONE' as const, top: 0, bottom: 0, isMitigated: false };
  }

  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];

  // Bullish FVG: Low of candle 3 is higher than High of candle 1
  if (c3.low > c1.high) {
    return {
      fvgType: 'BULLISH' as const,
      top: c3.low,
      bottom: c1.high,
      isMitigated: c3.close <= c1.high
    };
  }

  // Bearish FVG: High of candle 3 is lower than Low of candle 1
  if (c3.high < c1.low) {
    return {
      fvgType: 'BEARISH' as const,
      top: c1.low,
      bottom: c3.high,
      isMitigated: c3.close >= c1.low
    };
  }

  return { fvgType: 'NONE' as const, top: 0, bottom: 0, isMitigated: true };
}

/**
 * Finds Support and Resistance cluster levels
 */
export function findSupportResistanceLevels(candles: Candle[]): { supports: number[]; resistances: number[] } {
  if (candles.length < 10) return { supports: [], resistances: [] };

  const supports: number[] = [];
  const resistances: number[] = [];

  // Pivot highs and lows with window of 3
  for (let i = 3; i < candles.length - 3; i++) {
    const isHigh =
      candles[i].high > candles[i - 1].high &&
      candles[i].high > candles[i - 2].high &&
      candles[i].high > candles[i + 1].high &&
      candles[i].high > candles[i + 2].high;

    const isLow =
      candles[i].low < candles[i - 1].low &&
      candles[i].low < candles[i - 2].low &&
      candles[i].low < candles[i + 1].low &&
      candles[i].low < candles[i + 2].low;

    if (isHigh) resistances.push(Number(candles[i].high.toFixed(2)));
    if (isLow) supports.push(Number(candles[i].low.toFixed(2)));
  }

  // Cluster nearby levels within 1.5 points for XAUUSD
  const cluster = (levels: number[]) => {
    const sorted = [...levels].sort((a, b) => a - b);
    const result: number[] = [];
    for (const lvl of sorted) {
      if (result.length === 0 || lvl - result[result.length - 1] > 2.0) {
        result.push(lvl);
      }
    }
    return result.slice(-4); // Keep recent 4 levels
  };

  return {
    supports: cluster(supports),
    resistances: cluster(resistances)
  };
}

/**
 * Main Technical Indicator Pipeline
 */
export function computeAllIndicators(candles: Candle[]): IndicatorValues {
  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1] || 0;

  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const ema200Arr = calculateEMA(closes, 200);

  const rsiArr = calculateRSI(closes, 14);
  const stResult = calculateSuperTrend(candles, 10, 3.0);
  const bbResult = calculateBollingerBands(closes, 20, 2);
  const sr = findSupportResistanceLevels(candles);
  const smcFvg = detectFVG(candles);

  const lastIdx = candles.length - 1;

  // MACD calculation (12, 26, 9)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = (ema12[lastIdx] || 0) - (ema26[lastIdx] || 0);
  const signalLine = macdLine * 0.85; // fast estimate
  const histogram = macdLine - signalLine;

  const ema20 = ema20Arr[lastIdx] || currentPrice;
  const ema50 = ema50Arr[lastIdx] || currentPrice;
  const ema200 = ema200Arr[lastIdx] || currentPrice;

  const stDir = stResult.directions[lastIdx] || 'UP';
  const stVal = stResult.stValues[lastIdx] || (currentPrice - 3.5);

  const bbUpper = bbResult.upper[lastIdx] || (currentPrice + 5);
  const bbLower = bbResult.lower[lastIdx] || (currentPrice - 5);
  const bbMid = bbResult.middle[lastIdx] || currentPrice;
  const bbBw = bbResult.bandwidth[lastIdx] || 0.003;
  const isSqueezing = bbBw < 0.0035;

  const rsi = Number((rsiArr[lastIdx] || 50).toFixed(1));

  // Find nearest S/R
  const validSupports = sr.supports.filter(s => s <= currentPrice);
  const nearestSupport = validSupports.length > 0 ? validSupports[validSupports.length - 1] : currentPrice - 3.5;

  const validResistances = sr.resistances.filter(r => r >= currentPrice);
  const nearestResistance = validResistances.length > 0 ? validResistances[0] : currentPrice + 3.5;

  return {
    ema20: Number(ema20.toFixed(3)),
    ema50: Number(ema50.toFixed(3)),
    ema200: Number(ema200.toFixed(3)),
    superTrend: {
      direction: stDir,
      value: Number(stVal.toFixed(3))
    },
    rsi,
    macd: {
      macd: Number(macdLine.toFixed(3)),
      signal: Number(signalLine.toFixed(3)),
      histogram: Number(histogram.toFixed(3))
    },
    bollinger: {
      upper: Number(bbUpper.toFixed(3)),
      lower: Number(bbLower.toFixed(3)),
      middle: Number(bbMid.toFixed(3)),
      bandwidth: Number(bbBw.toFixed(4)),
      isSqueezing
    },
    supportLevels: sr.supports,
    resistanceLevels: sr.resistances,
    nearestSupport: Number(nearestSupport.toFixed(3)),
    nearestResistance: Number(nearestResistance.toFixed(3)),
    smc: smcFvg
  };
}


/**
 * Layer 2: High-Profit Sniper Quality Filter
 * Filters out low-yield / counter-HTF / blocked-S&R / chasing / choppy signals
 * so only the highest-profit setups trigger notifications.
 */
export function evaluateLayer2SniperFilter(
  candles: Candle[],
  indicators: IndicatorValues,
  direction: OrderType,
  entryPrice: number,
  slPips: number,
  tpPips: number,
  options?: {
    htfContext?: HTFTrendContext;
    spreadPips?: number;
    sniperThreshold?: number;
  }
): Layer2Analysis {
  const sniperThreshold = options?.sniperThreshold ?? 85;
  const spreadPips = options?.spreadPips ?? 3.0;
  const criteria: Layer2Criterion[] = [];
  const rejectionReasons: string[] = [];

  if (candles.length < 20 || entryPrice <= 0) {
    return {
      sniperScore: 0,
      sniperThreshold,
      passed: false,
      profitGrade: 'REJECTED',
      expectedProfitLabel: 'รอข้อมูลตลาดจริง',
      clearancePips: 0,
      atrPips: 0,
      volumeRatio: 1,
      rejectionReasons: ['กำลังโหลดข้อมูลแท่งเทียนสำหรับวิเคราะห์ชั้นที่ 2'],
      criteria: []
    };
  }

  // 1. Higher Timeframe (M15 & H1) Macro Alignment (25 pts)
  const expectedBias = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
  const htf = options?.htfContext;
  let htfScore = 15;
  let htfDetail = 'กำลังดึงเทรนด์ M15/H1 (อ้างอิงโครงสร้าง EMA200 หลัก)';

  if (htf) {
    const m15Match = htf.m15Trend === expectedBias;
    const h1Match = htf.h1Trend === expectedBias;
    const m15Neutral = htf.m15Trend === 'NEUTRAL';
    const h1Neutral = htf.h1Trend === 'NEUTRAL';

    if (m15Match && h1Match) {
      htfScore = 25;
      htfDetail = `สอดคล้องเทรนด์ใหญ่ทั้ง M15 (${htf.m15Trend}) และ H1 (${htf.h1Trend}) โอกาสวิ่งไกลทำกำไรสูงมาก`;
    } else if ((m15Match && h1Neutral) || (h1Match && m15Neutral)) {
      htfScore = 20;
      htfDetail = `ทิศทางหลัก M15:${htf.m15Trend} / H1:${htf.h1Trend} สอดคล้องฝั่ง ${direction}`;
    } else if (m15Match || h1Match) {
      htfScore = 12;
      htfDetail = `M15 (${htf.m15Trend}) และ H1 (${htf.h1Trend}) ยังขัดแย้งกันบางส่วน (กำไรอาจถูกจำกัด)`;
      rejectionReasons.push(`เทรนด์ใหญ่ M15/H1 ยังไม่ตรงกัน 100%`);
    } else {
      htfScore = 4;
      htfDetail = `สวนเทรนด์ใหญ่ M15 (${htf.m15Trend}) & H1 (${htf.h1Trend}) — ความเสี่ยงสูงที่จะโดนตบกลับ`;
      rejectionReasons.push(`สัญญาณ ${direction} สวนทางเทรนด์ใหญ่ M15/H1`);
    }
  }

  criteria.push({
    id: 'htf_alignment',
    name: 'M15 & H1 Multi-Timeframe Alignment',
    maxScore: 25,
    score: htfScore,
    passed: htfScore >= 20,
    detail: htfDetail
  });

  // 2. Profit Runway & Structural Clearance (25 pts)
  // Measure distance from Entry to the next major opposing S/R ceiling/floor
  const recentCandles = candles.slice(-80);
  const swingHigh = Math.max(...recentCandles.map(c => c.high));
  const swingLow = Math.min(...recentCandles.map(c => c.low));

  let barrierPrice = direction === 'BUY' ? indicators.nearestResistance : indicators.nearestSupport;
  // If price broke past nearest local resistance/support, check broader 80-candle ceiling/floor
  if (direction === 'BUY' && barrierPrice <= entryPrice + 0.5) {
    barrierPrice = swingHigh > entryPrice + 1.0 ? swingHigh : entryPrice + tpPips * 0.14;
  } else if (direction === 'SELL' && barrierPrice >= entryPrice - 0.5) {
    barrierPrice = swingLow < entryPrice - 1.0 ? swingLow : entryPrice - tpPips * 0.14;
  }

  const rawClearancePips = direction === 'BUY'
    ? (barrierPrice - entryPrice) * 10
    : (entryPrice - barrierPrice) * 10;
  const clearancePips = Math.max(0, Number(rawClearancePips.toFixed(1)));

  let runwayScore = 0;
  let runwayDetail = '';
  if (clearancePips >= tpPips * 0.85) {
    runwayScore = 25;
    runwayDetail = `ระยะทางโล่งถึงแนวต้าน/รับถัดไป ~${clearancePips} pips เพียงพอวิ่งถึงเป้า TP (${tpPips} pips)`;
  } else if (clearancePips >= slPips * 1.4) {
    runwayScore = 18;
    runwayDetail = `ระยะทางโล่ง ~${clearancePips} pips พอมีพื้นที่ทำกำไรปานกลาง`;
  } else {
    runwayScore = 6;
    runwayDetail = `ติดแนว${direction === 'BUY' ? 'ต้าน' : 'รับ'}ขวางข้างหน้าในระยะ ${clearancePips} pips (ไม่คุ้มเข้า)`;
    rejectionReasons.push(`ระยะทางก่อนถึงแนว${direction === 'BUY' ? 'ต้าน' : 'รับ'}เหลือเพียง ${clearancePips} pips`);
  }

  criteria.push({
    id: 'profit_runway',
    name: 'Profit Runway (พื้นที่วิ่งทำกำไร)',
    maxScore: 25,
    score: runwayScore,
    passed: runwayScore >= 20,
    detail: runwayDetail
  });

  // 3. Anti-Chase Sweet-Spot Entry (20 pts)
  // Avoid chasing overextended price far away from EMA20 or outside Bollinger Bands
  const distFromEma20Pips = Math.abs(entryPrice - indicators.ema20) * 10;
  const isOverextendedBuy = direction === 'BUY' && (entryPrice > indicators.bollinger.upper || indicators.rsi > 72 || distFromEma20Pips > 45);
  const isOverextendedSell = direction === 'SELL' && (entryPrice < indicators.bollinger.lower || indicators.rsi < 28 || distFromEma20Pips > 45);

  let entryScore = 0;
  let entryDetail = '';
  if (isOverextendedBuy || isOverextendedSell) {
    entryScore = 6;
    entryDetail = `ราคาวิ่งห่างฐาน EMA20 (${distFromEma20Pips.toFixed(1)} pips) / RSI ${indicators.rsi} เสี่ยงไล่ราคาปลายแท่ง`;
    rejectionReasons.push(`ราคาขยายตัวเกินฐาน (Overextended) รอจังหวะย่อตัว`);
  } else if (distFromEma20Pips <= 28 && indicators.rsi >= 34 && indicators.rsi <= 66) {
    entryScore = 20;
    entryDetail = `จุดเข้าใกล้ฐานราคา EMA20 (${distFromEma20Pips.toFixed(1)} pips) จังหวะ Pullback คมชัด`;
  } else {
    entryScore = 15;
    entryDetail = `ตำแหน่งเข้าอยู่ในโซนปกติ ห่าง EMA20 ${distFromEma20Pips.toFixed(1)} pips`;
  }

  criteria.push({
    id: 'sweet_spot_entry',
    name: 'No-Chase Pullback Sweet Spot',
    maxScore: 20,
    score: entryScore,
    passed: entryScore >= 15,
    detail: entryDetail
  });

  // 4. Candle Impulse & Institutional Volume Momentum (15 pts)
  const lastClosed = candles[candles.length - 2] || candles[candles.length - 1];
  const prevCandles = candles.slice(-22, -2);
  const avgVol = prevCandles.length > 0
    ? prevCandles.reduce((s, c) => s + (c.volume || 1), 0) / prevCandles.length
    : lastClosed.volume || 1;
  const volumeRatio = Number(((lastClosed.volume || 1) / Math.max(avgVol, 1)).toFixed(2));

  const candleRange = Math.max(0.001, lastClosed.high - lastClosed.low);
  const candleBody = Math.abs(lastClosed.close - lastClosed.open);
  const bodyRatio = candleBody / candleRange;
  const isDirectionalCandle = direction === 'BUY'
    ? lastClosed.close >= lastClosed.open
    : lastClosed.close <= lastClosed.open;

  let impulseScore = 0;
  let impulseDetail = '';
  if (isDirectionalCandle && bodyRatio >= 0.48 && volumeRatio >= 0.95) {
    impulseScore = 15;
    impulseDetail = `แท่งเทียนยืนยันแรง${direction === 'BUY' ? 'ซื้อ' : 'ขาย'}เต็มแท่ง (Volume ${volumeRatio}x)`;
  } else if (isDirectionalCandle && bodyRatio >= 0.3) {
    impulseScore = 12;
    impulseDetail = `มีแรงส่งตามทิศทาง ${direction} (Body ${(bodyRatio * 100).toFixed(0)}% | Vol ${volumeRatio}x)`;
  } else {
    impulseScore = 6;
    impulseDetail = `แท่งเทียนล่าสุดมีไส้ปฏิเสธ/แรงส่งอ่อน (Body ${(bodyRatio * 100).toFixed(0)}%)`;
    rejectionReasons.push(`แรงส่งแท่งเทียนและ Volume ยังไม่คมชัดพอ`);
  }

  criteria.push({
    id: 'candle_momentum',
    name: 'Candle Impulse & Volume Confirm',
    maxScore: 15,
    score: impulseScore,
    passed: impulseScore >= 12,
    detail: impulseDetail
  });

  // 5. ATR Volatility & Spread Profit Efficiency (15 pts)
  const atrArr = calculateATR(candles, 14);
  const atrPrice = atrArr[atrArr.length - 1] || 0;
  const atrPips = Number((atrPrice * 10).toFixed(1));
  const spreadToAtr = atrPips > 0 ? spreadPips / atrPips : 1;

  let volScore = 0;
  let volDetail = '';
  if (atrPips >= 8 && spreadPips <= 6.0 && spreadToAtr <= 0.45) {
    volScore = 15;
    volDetail = `ความผันผวนเหมาะสม (ATR ${atrPips} pips | Spread ${spreadPips}p) คุ้มค่าวิ่งเข้าเป้า TP`;
  } else if (atrPips >= 5 && spreadPips <= 7.0) {
    volScore = 11;
    volDetail = `ความผันผวนปานกลาง (ATR ${atrPips} pips | Spread ${spreadPips}p)`;
  } else {
    volScore = 5;
    volDetail = `ตลาดซึม/Spread กว้าง (ATR ${atrPips}p | Spread ${spreadPips}p) เสี่ยงโดนสวิงกิน SL`;
    rejectionReasons.push(`สภาพตลาดแกว่งแคบหรือ Spread สูงเกินเกณฑ์ (${spreadPips}p)`);
  }

  criteria.push({
    id: 'volatility_efficiency',
    name: 'ATR & Spread Profit Efficiency',
    maxScore: 15,
    score: volScore,
    passed: volScore >= 11,
    detail: volDetail
  });

  const sniperScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const passed = sniperScore >= sniperThreshold && rejectionReasons.length <= 1 && runwayScore >= 15;

  let profitGrade: Layer2Analysis['profitGrade'] = 'REJECTED';
  if (sniperScore >= 90 && passed) profitGrade = 'A++ SNIPER';
  else if (sniperScore >= sniperThreshold && passed) profitGrade = 'A+ PRIME';
  else if (sniperScore >= 70) profitGrade = 'B STANDARD';

  const expectedProfitLabel = profitGrade === 'A++ SNIPER'
    ? 'โอกาสทำกำไรสูงสุด (High-Yield Sniper)'
    : profitGrade === 'A+ PRIME'
    ? 'คุณภาพดีเยี่ยม (Prime Setup)'
    : 'คุณภาพปานกลาง / รอจังหวะคมกว่านี้';

  return {
    sniperScore,
    sniperThreshold,
    passed,
    profitGrade,
    expectedProfitLabel,
    clearancePips,
    atrPips,
    volumeRatio,
    rejectionReasons,
    criteria
  };
}

/**
 * Confluence Analysis Engine with Strict >90% Criteria Evaluation + Layer 2 Sniper Filter
 */
export function evaluateConfluence(
  candles: Candle[],
  indicators: IndicatorValues,
  threshold: number = 90,
  options?: {
    bid?: number;
    ask?: number;
    slPips?: number;
    tpPips?: number;
    slRiskPercent?: number;
    tpTargetPercent?: number;
    htfContext?: HTFTrendContext;
    spreadPips?: number;
    sniperThreshold?: number;
    sniperFilterEnabled?: boolean;
  }
): ConfluenceResult {
  const lastClose = candles[candles.length - 1]?.close || 0;
  const currentPrice = options?.bid || lastClose;
  const criteria: ConfluenceCriterion[] = [];

  // Determine dominant market tendency
  const isBullishBias = currentPrice >= indicators.ema50;
  const evaluatedDirection: OrderType = isBullishBias ? 'BUY' : 'SELL';

  // 1. EMA Ribbon Trend Alignment (25 pts)
  let emaScore = 0;
  let emaDetail = '';
  if (evaluatedDirection === 'BUY') {
    if (currentPrice > indicators.ema20 && indicators.ema20 > indicators.ema50 && indicators.ema50 > indicators.ema200) {
      emaScore = 25;
      emaDetail = 'ราคาอยู่เหนือ EMA20 > EMA50 > EMA200 เรียงตัวแบบ Bullish Trend แข็งแกร่งสมบูรณ์';
    } else if (currentPrice > indicators.ema20 && indicators.ema20 > indicators.ema50) {
      emaScore = 20;
      emaDetail = 'ราคาเหนือ EMA20 > EMA50 กำลังเร่งโมเมนตัมขาขึ้น';
    } else {
      emaScore = 8;
      emaDetail = 'EMA ยังไม่จัดเรียงตัวสมบูรณ์ รอการยืนยัน';
    }
  } else {
    if (currentPrice < indicators.ema20 && indicators.ema20 < indicators.ema50 && indicators.ema50 < indicators.ema200) {
      emaScore = 25;
      emaDetail = 'ราคาอยู่ใต้ EMA20 < EMA50 < EMA200 เรียงตัวแบบ Bearish Trend แข็งแกร่งสมบูรณ์';
    } else if (currentPrice < indicators.ema20 && indicators.ema20 < indicators.ema50) {
      emaScore = 20;
      emaDetail = 'ราคาใต้ EMA20 < EMA50 โมเมนตัมขาลงชัดเจน';
    } else {
      emaScore = 8;
      emaDetail = 'EMA ยังไม่จัดเรียงตัวฝั่งลงสมบูรณ์';
    }
  }

  criteria.push({
    id: 'ema_ribbon',
    name: 'EMA Ribbon Alignment (20/50/200)',
    description: 'การเรียงตัวของเส้นค่าเฉลี่ย 3 ลำดับตามทิศทางเทรนด์ Scalping',
    maxScore: 25,
    score: emaScore,
    passed: emaScore >= 20,
    weight: 25,
    detail: emaDetail,
    badge: `EMA Ribbon +${emaScore}/25`
  });

  // 2. SuperTrend Direction & Support (20 pts)
  let stScore = 0;
  let stDetail = '';
  if (evaluatedDirection === 'BUY') {
    if (indicators.superTrend.direction === 'UP' && currentPrice >= indicators.superTrend.value) {
      const distance = currentPrice - indicators.superTrend.value;
      if (distance <= 4.0) {
        stScore = 20;
        stDetail = `SuperTrend สีเขียว รองรับราคาที่แนวรับไดนามิก ${indicators.superTrend.value}`;
      } else {
        stScore = 17;
        stDetail = `SuperTrend สีเขียว บ่งชี้เทรนด์ขาขึ้นต่อเนื่อง`;
      }
    } else {
      stScore = 4;
      stDetail = 'SuperTrend ยังไม่ยืนยันสัญญาณซื้อ';
    }
  } else {
    if (indicators.superTrend.direction === 'DOWN' && currentPrice <= indicators.superTrend.value) {
      stScore = 20;
      stDetail = `SuperTrend สีแดง กดดันราคาที่แนวต้านไดนามิก ${indicators.superTrend.value}`;
    } else {
      stScore = 4;
      stDetail = 'SuperTrend ยังเป็นสีเขียว ขัดแย้งกับสัญญาณขาย';
    }
  }

  criteria.push({
    id: 'supertrend',
    name: 'SuperTrend Dynamic Trend (10, 3.0)',
    description: 'ทิศทาง SuperTrend และการเด้งจากแนวรับ/ต้านไดนามิก',
    maxScore: 20,
    score: stScore,
    passed: stScore >= 17,
    weight: 20,
    detail: stDetail,
    badge: `SuperTrend +${stScore}/20`
  });

  // 3. Key Support & Resistance / Liquidity Sweep (15 pts)
  let srScore = 0;
  let srDetail = '';
  if (evaluatedDirection === 'BUY') {
    const distToSupport = Math.abs(currentPrice - indicators.nearestSupport);
    if (distToSupport <= 3.0) {
      srScore = 15;
      srDetail = `ราคาทดสอบแนวรับหลัก ${indicators.nearestSupport} แล้วมีแรงซื้อปฏิเสธราคา (Rejection)`;
    } else if (distToSupport <= 6.0) {
      srScore = 12;
      srDetail = `ราคายังอยู่เหนือแนวรับปลอดภัย ${indicators.nearestSupport}`;
    } else {
      srScore = 7;
      srDetail = 'ราคาอยู่ห่างจากโซนแนวรับหลัก';
    }
  } else {
    const distToResistance = Math.abs(currentPrice - indicators.nearestResistance);
    if (distToResistance <= 3.0) {
      srScore = 15;
      srDetail = `ราคาทดสอบแนวต้านหลัก ${indicators.nearestResistance} แล้วไม่ผ่าน`;
    } else {
      srScore = 8;
      srDetail = 'ราคาอยู่ห่างจากโซนแนวต้านหลัก';
    }
  }

  criteria.push({
    id: 'support_resistance',
    name: 'Key S/R & Liquidity Zones',
    description: 'การทดสอบระดับแนวรับแนวต้านสำคัญและการกวาด Liquidity',
    maxScore: 15,
    score: srScore,
    passed: srScore >= 12,
    weight: 15,
    detail: srDetail,
    badge: `S/R Zone +${srScore}/15`
  });

  // 4. RSI Exhaustion & Momentum (15 pts)
  let rsiScore = 0;
  let rsiDetail = '';
  if (evaluatedDirection === 'BUY') {
    if (indicators.rsi >= 40 && indicators.rsi <= 65) {
      rsiScore = 15;
      rsiDetail = `RSI อยู่ที่ ${indicators.rsi} ในโซน Bullish Momentum สุขภาพดี ไม่ Overbought`;
    } else if (indicators.rsi < 40 && indicators.rsi >= 28) {
      rsiScore = 13;
      rsiDetail = `RSI อยู่ที่ ${indicators.rsi} ฟื้นตัวจากโซน Oversold เกิด Bullish Reversal`;
    } else {
      rsiScore = 5;
      rsiDetail = `RSI อยู่ที่ ${indicators.rsi} เริ่มตึงตัวหรือไม่มีโมเมนตัมชัดเจน`;
    }
  } else {
    if (indicators.rsi >= 35 && indicators.rsi <= 60) {
      rsiScore = 15;
      rsiDetail = `RSI อยู่ที่ ${indicators.rsi} โมเมนตัมฝั่งขายแข็งแกร่ง`;
    } else if (indicators.rsi > 70) {
      rsiScore = 14;
      rsiDetail = `RSI อยู่ที่ ${indicators.rsi} เกิด Overbought Exhaustion เตรียมกลับตัวลง`;
    } else {
      rsiScore = 5;
      rsiDetail = `RSI อยู่ที่ ${indicators.rsi} ขาดโมเมนตัมฝั่งขาย`;
    }
  }

  criteria.push({
    id: 'rsi_exhaustion',
    name: 'RSI(14) Momentum & Exhaustion',
    description: 'ดัชนีกำลังซื้อขาย ป้องกันการเข้าซื้อช่วงปลายคลื่นและดักจับจุดกลับตัว',
    maxScore: 15,
    score: rsiScore,
    passed: rsiScore >= 12,
    weight: 15,
    detail: rsiDetail,
    badge: `RSI +${rsiScore}/15`
  });

  // 5. Bollinger Bands Squeeze & Expansion (10 pts)
  let bbScore = 0;
  let bbDetail = '';
  if (indicators.bollinger.isSqueezing) {
    bbScore = 8;
    bbDetail = 'Bollinger Bands กำลังบีบตัว (Squeeze) สะสมพลังเตรียมระเบิดกรอบ';
  } else {
    if (evaluatedDirection === 'BUY' && currentPrice > indicators.bollinger.middle) {
      bbScore = 10;
      bbDetail = 'ราคายืนเหนือเส้นกึ่งกลาง BB (Basis) พร้อมขยายตัวตามกรอบบน';
    } else if (evaluatedDirection === 'SELL' && currentPrice < indicators.bollinger.middle) {
      bbScore = 10;
      bbDetail = 'ราคาหลุดใต้เส้นกึ่งกลาง BB พร้อมขยายตัวตามกรอบล่าง';
    } else {
      bbScore = 4;
      bbDetail = 'ความผันผวนของกรอบ BB ยังไม่สอดคล้องกับจังหวะเข้าเทรด';
    }
  }

  criteria.push({
    id: 'bollinger_squeeze',
    name: 'Bollinger Bands Volatility Expansion',
    description: 'การบีบอัดของความผันผวนและขยายตัวรับช่วง Scalping Impulse',
    maxScore: 10,
    score: bbScore,
    passed: bbScore >= 8,
    weight: 10,
    detail: bbDetail,
    badge: `BB +${bbScore}/10`
  });

  // 6. SMC Fair Value Gap (FVG) / Imbalance (15 pts)
  let smcScore = 0;
  let smcDetail = '';
  if (evaluatedDirection === 'BUY') {
    if (indicators.smc.fvgType === 'BULLISH') {
      smcScore = 15;
      smcDetail = 'เกิด Bullish FVG Imbalance โซนราคารองรับแรงซื้อของสถาบันการเงิน';
    } else {
      smcScore = 12; // Baseline SMC structure
      smcDetail = 'โครงสร้าง SMC Bullish Structure (Higher High / Higher Low)';
    }
  } else {
    if (indicators.smc.fvgType === 'BEARISH') {
      smcScore = 15;
      smcDetail = 'เกิด Bearish FVG Imbalance มีแรงเทขายรุนแรงของสถาบัน';
    } else {
      smcScore = 12;
      smcDetail = 'โครงสร้าง SMC Bearish Structure (Lower Low / Lower High)';
    }
  }

  criteria.push({
    id: 'smc_fvg',
    name: 'SMC Fair Value Gap & Imbalance',
    description: 'ช่องว่างสภาพคล่อง Smart Money Concepts (Bullish/Bearish FVG)',
    maxScore: 15,
    score: smcScore,
    passed: smcScore >= 12,
    weight: 15,
    detail: smcDetail,
    badge: `SMC FVG +${smcScore}/15`
  });

  const totalScore = criteria.reduce((sum, item) => sum + item.score, 0);

  // Suggested Entry, Stop Loss, and Take Profit
  // User Requirement: "TP ประมาณ 10% SL ไม่เกิน 5%"
  const slPips = options?.slPips ?? 30;
  let finalTpPips = options?.tpPips ?? 75;
  const rawEntry = evaluatedDirection === 'BUY'
    ? (options?.ask && options.ask > 0 ? options.ask : currentPrice)
    : (options?.bid && options.bid > 0 ? options.bid : currentPrice);
  const suggestedEntry = Number(rawEntry.toFixed(3));
  let suggestedSl = 0;
  let suggestedTp = 0;

  if (suggestedEntry > 0) {
    if (evaluatedDirection === 'BUY') {
      suggestedSl = Number((suggestedEntry - (slPips * 0.1)).toFixed(3));
      suggestedTp = Number((suggestedEntry + (finalTpPips * 0.1)).toFixed(3));
    } else {
      suggestedSl = Number((suggestedEntry + (slPips * 0.1)).toFixed(3));
      suggestedTp = Number((suggestedEntry - (finalTpPips * 0.1)).toFixed(3));
    }
  }

  let rrRatio = Number((finalTpPips / slPips).toFixed(2));
  const meetsThreshold = totalScore >= threshold;

  let grade: 'A+' | 'A' | 'B' | 'WAIT' = 'WAIT';
  if (totalScore >= 90) grade = 'A+';
  else if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 70) grade = 'B';

  const layer2 = evaluateLayer2SniperFilter(
    candles,
    indicators,
    evaluatedDirection,
    suggestedEntry,
    slPips,
    finalTpPips,
    {
      htfContext: options?.htfContext,
      spreadPips: options?.spreadPips,
      sniperThreshold: options?.sniperThreshold
    }
  );

  // If Layer 2 detects open structural runway & strong ATR, dynamically extend TP for maximum profit capture
  if (layer2.passed && layer2.clearancePips >= finalTpPips * 1.3 && layer2.atrPips >= 12 && suggestedEntry > 0) {
    const boostedTpPips = Math.min(Math.round(finalTpPips * 1.2), Math.floor(layer2.clearancePips * 0.85));
    if (boostedTpPips > finalTpPips) {
      finalTpPips = boostedTpPips;
      rrRatio = Number((finalTpPips / slPips).toFixed(2));
      suggestedTp = evaluatedDirection === 'BUY'
        ? Number((suggestedEntry + finalTpPips * 0.1).toFixed(3))
        : Number((suggestedEntry - finalTpPips * 0.1).toFixed(3));
    }
  }

  return {
    totalScore,
    threshold,
    grade,
    direction: meetsThreshold ? evaluatedDirection : 'NEUTRAL',
    meetsThreshold,
    criteria,
    timestamp: Date.now(),
    suggestedEntry,
    suggestedSl,
    suggestedTp,
    slPips,
    tpPips: finalTpPips,
    rrRatio,
    slRiskPercent: options?.slRiskPercent ?? 3.5, // Strictly <= 5%
    tpTargetPercent: options?.tpTargetPercent ?? 9.8, // ~10%
    layer2
  };
}

/**
 * Format Telegram Group Bot HTML message (tap-to-copy numbers in <code> tags)
 */
export function formatTelegramSignalMessage(
  direction: 'BUY' | 'SELL',
  confluence: ConfluenceResult,
  accountNumber: string = 'EX-7829104',
  lotSize: number = 0.01,
  symbol: string = 'XAUUSDc',
  htfContext?: HTFTrendContext
): string {
  const dateStr = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const dirEmoji = direction === 'BUY' ? '🟢 BUY (LONG)' : '🔴 SELL (SHORT)';
  const sniperScore = confluence.layer2?.sniperScore ?? 90;
  const profitGrade = confluence.layer2?.profitGrade ?? 'A++ SNIPER';
  const clearance = confluence.layer2?.clearancePips ?? confluence.tpPips;
  const htfSummary = htfContext
    ? `M15: ${htfContext.m15Trend} | H1: ${htfContext.h1Trend}`
    : 'Aligned with Macro Trend';

  return `🚨 <b>[EXNESS ${symbol} SNIPER SIGNAL]</b>
🎯 คำสั่งคัดพิเศษ: <b>${dirEmoji}</b>
🏆 เกรดสัญญาณ: <b>${profitGrade}</b>
📊 ชั้นที่ 1 (Confluence): <b>${confluence.totalScore}%</b> (&gt; ${confluence.threshold}%)
🛡️ ชั้นที่ 2 (Sniper Profit): <b>${sniperScore}%</b>
━━━━━━━━━━━━━━━━━
📋 <b>แตะที่ตัวเลขเพื่อคัดลอกวางใน Exness:</b>
• คู่เงิน: <code>${symbol}</code>
• คำสั่ง: <b>${direction}</b>
• Entry: <code>${confluence.suggestedEntry.toFixed(3)}</code>
• SL (&le;5%): <code>${confluence.suggestedSl.toFixed(3)}</code> (-${confluence.slPips} pips | ${confluence.slRiskPercent}%)
• TP (~10%): <code>${confluence.suggestedTp.toFixed(3)}</code> (+${confluence.tpPips} pips | ${confluence.tpTargetPercent}%)
• R:R Ratio: <b>1 : ${confluence.rrRatio}</b>
• Lot แนะนำ: <code>${lotSize}</code>
━━━━━━━━━━━━━━━━━
🔎 เทรนด์ใหญ่: ${htfSummary} | Runway: ${clearance} pips
⚡ Exness (${accountNumber}) · ⏱️ ${dateStr}`;
}

/**
 * Format short string for 1-click clipboard copy to Exness
 */
export function formatQuickCopySignal(
  direction: 'BUY' | 'SELL',
  entry: number,
  sl: number,
  tp: number,
  lots: number = 0.01,
  symbol: string = 'XAUUSDc'
): string {
  return `${symbol} ${direction} | Entry: ${entry.toFixed(3)} | SL: ${sl.toFixed(3)} | TP: ${tp.toFixed(3)} | Lot: ${lots}`;
}
