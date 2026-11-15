import React, { useRef, useEffect, useState } from 'react';
import { Candle, IndicatorValues, Timeframe, Position } from '../types/trading';
import { Eye, EyeOff, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  indicators: IndicatorValues;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  positions: Position[];
  bid: number;
  ask: number;
  spreadPips: number;
  symbol?: string;
  isLoading?: boolean;
  showIndicators: {
    ema: boolean;
    supertrend: boolean;
    bollinger: boolean;
    smcFvg: boolean;
    supportResistance: boolean;
  };
  onToggleIndicator: (key: 'ema' | 'supertrend' | 'bollinger' | 'smcFvg' | 'supportResistance') => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  indicators,
  timeframe,
  setTimeframe,
  positions,
  bid,
  ask,
  spreadPips,
  symbol = 'XAUUSDc',
  isLoading = false,
  showIndicators,
  onToggleIndicator
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(45); // number of candles visible
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI display
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Padding for axes
    const paddingRight = 75;
    const paddingBottom = 26;
    const chartWidth = width - paddingRight;
    const chartHeight = height - paddingBottom;

    // Slice candles according to zoom
    const visibleCount = Math.min(zoomLevel, candles.length);
    const visibleCandles = candles.slice(-visibleCount);
    const startIndex = candles.length - visibleCount;

    // Find min and max price
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    visibleCandles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    // Expand price range for indicators and breathing room
    if (showIndicators.ema) {
      if (indicators.ema20 < minPrice) minPrice = indicators.ema20;
      if (indicators.ema20 > maxPrice) maxPrice = indicators.ema20;
      if (indicators.ema50 < minPrice) minPrice = indicators.ema50;
      if (indicators.ema50 > maxPrice) maxPrice = indicators.ema50;
    }
    if (showIndicators.bollinger) {
      if (indicators.bollinger.lower < minPrice) minPrice = indicators.bollinger.lower;
      if (indicators.bollinger.upper > maxPrice) maxPrice = indicators.bollinger.upper;
    }

    const priceBuffer = Math.max((maxPrice - minPrice) * 0.12, 1.5);
    minPrice -= priceBuffer;
    maxPrice += priceBuffer;

    const priceRange = maxPrice - minPrice;
    const priceToY = (p: number) => chartHeight - ((p - minPrice) / priceRange) * chartHeight;
    const yToPrice = (y: number) => maxPrice - (y / chartHeight) * priceRange;

    const candleWidth = Math.max(chartWidth / visibleCount, 3);
    const candleSpacing = candleWidth * 0.28;
    const barWidth = candleWidth - candleSpacing;

    // Clear canvas
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal grid lines and price axis labels
    const gridSteps = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridSteps; i++) {
      const y = (chartHeight / gridSteps) * i;
      const price = yToPrice(y);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      ctx.fillText(price.toFixed(2), chartWidth + 8, y + 4);
    }

    // Draw Support & Resistance zones
    if (showIndicators.supportResistance) {
      indicators.supportLevels.forEach(s => {
        if (s >= minPrice && s <= maxPrice) {
          const sy = priceToY(s);
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.moveTo(0, sy);
          ctx.lineTo(chartWidth, sy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#10b981';
          ctx.fillText(`Sup ${s.toFixed(1)}`, chartWidth + 8, sy + 3);
        }
      });

      indicators.resistanceLevels.forEach(r => {
        if (r >= minPrice && r <= maxPrice) {
          const ry = priceToY(r);
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.moveTo(0, ry);
          ctx.lineTo(chartWidth, ry);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#f43f5e';
          ctx.fillText(`Res ${r.toFixed(1)}`, chartWidth + 8, ry + 3);
        }
      });
    }

    // Draw SMC Fair Value Gap (FVG)
    if (showIndicators.smcFvg && indicators.smc.fvgType !== 'NONE') {
      const topY = priceToY(indicators.smc.top);
      const botY = priceToY(indicators.smc.bottom);
      const isBull = indicators.smc.fvgType === 'BULLISH';

      ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
      ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1;

      const fvgHeight = Math.abs(botY - topY);
      const startFvgY = Math.min(topY, botY);
      const fvgStartX = chartWidth * 0.45;

      ctx.fillRect(fvgStartX, startFvgY, chartWidth - fvgStartX, fvgHeight);
      ctx.strokeRect(fvgStartX, startFvgY, chartWidth - fvgStartX, fvgHeight);

      ctx.fillStyle = isBull ? '#34d399' : '#f87171';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`SMC ${isBull ? 'Bullish' : 'Bearish'} FVG`, fvgStartX + 8, startFvgY + 12);
    }

    // Draw Bollinger Bands
    if (showIndicators.bollinger) {
      const bbYUpper = priceToY(indicators.bollinger.upper);
      const bbYLower = priceToY(indicators.bollinger.lower);
      const bbYMid = priceToY(indicators.bollinger.middle);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.fillRect(0, bbYUpper, chartWidth, bbYLower - bbYUpper);

      // Upper band
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bbYUpper);
      ctx.lineTo(chartWidth, bbYUpper);
      ctx.stroke();

      // Lower band
      ctx.beginPath();
      ctx.moveTo(0, bbYLower);
      ctx.lineTo(chartWidth, bbYLower);
      ctx.stroke();

      // Middle (Basis)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, bbYMid);
      ctx.lineTo(chartWidth, bbYMid);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw SuperTrend line
    if (showIndicators.supertrend) {
      const stY = priceToY(indicators.superTrend.value);
      const isUp = indicators.superTrend.direction === 'UP';
      ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(chartWidth * 0.3, stY);
      ctx.lineTo(chartWidth, stY);
      ctx.stroke();

      ctx.fillStyle = isUp ? '#10b981' : '#ef4444';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`SuperTrend ${indicators.superTrend.value.toFixed(1)}`, chartWidth * 0.32, stY - 4);
    }

    // Draw EMA Lines (EMA20 gold, EMA50 cyan, EMA200 purple)
    if (showIndicators.ema) {
      const ema20Y = priceToY(indicators.ema20);
      const ema50Y = priceToY(indicators.ema50);
      const ema200Y = priceToY(indicators.ema200);

      // EMA20
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartWidth * 0.2, ema20Y);
      ctx.lineTo(chartWidth, ema20Y);
      ctx.stroke();

      // EMA50
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartWidth * 0.1, ema50Y);
      ctx.lineTo(chartWidth, ema50Y);
      ctx.stroke();

      // EMA200
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, ema200Y);
      ctx.lineTo(chartWidth, ema200Y);
      ctx.stroke();
    }

    // Draw Candlesticks
    visibleCandles.forEach((c, idx) => {
      const x = idx * candleWidth + candleSpacing / 2;
      const centerX = x + barWidth / 2;
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);

      const isBullish = c.close >= c.open;
      const color = isBullish ? '#10b981' : '#ef4444';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX, highY);
      ctx.lineTo(centerX, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);

      ctx.fillStyle = color;
      ctx.fillRect(x, bodyTop, barWidth, bodyHeight);
    });

    // Draw active position markers on chart
    positions.forEach(pos => {
      if (pos.entryPrice >= minPrice && pos.entryPrice <= maxPrice) {
        const posY = priceToY(pos.entryPrice);
        const isBuy = pos.type === 'BUY';

        // Order entry line
        ctx.strokeStyle = isBuy ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(0, posY);
        ctx.lineTo(chartWidth, posY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Order badge
        ctx.fillStyle = isBuy ? '#059669' : '#dc2626';
        ctx.fillRect(10, posY - 10, 110, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${pos.type} ${pos.lots}L @ ${pos.entryPrice.toFixed(2)}`, 14, posY + 4);

        // SL line
        if (pos.sl > 0) {
          const slY = priceToY(pos.sl);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(0, slY);
          ctx.lineTo(chartWidth, slY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`SL ${pos.sl.toFixed(2)}`, chartWidth - 70, slY - 3);
        }

        // TP line
        if (pos.tp > 0) {
          const tpY = priceToY(pos.tp);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(0, tpY);
          ctx.lineTo(chartWidth, tpY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#10b981';
          ctx.fillText(`TP ${pos.tp.toFixed(2)}`, chartWidth - 70, tpY - 3);
        }
      }
    });

    // Draw Current Live Price Line & Spread Box
    const currentPriceY = priceToY(bid);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, currentPriceY);
    ctx.lineTo(chartWidth, currentPriceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live Price Tag on right axis
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(chartWidth, currentPriceY - 11, paddingRight, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(bid.toFixed(3), chartWidth + 6, currentPriceY + 4);

    // Crosshair and hover tooltip
    if (mousePos && mousePos.x <= chartWidth && mousePos.y <= chartHeight) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);

      // Vertical crosshair
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, chartHeight);
      ctx.stroke();

      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(chartWidth, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip price on right axis
      const hoverPrice = yToPrice(mousePos.y);
      ctx.fillStyle = '#334155';
      ctx.fillRect(chartWidth, mousePos.y - 10, paddingRight, 20);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(hoverPrice.toFixed(3), chartWidth + 6, mousePos.y + 4);

      // Tooltip candle info
      const candleIdx = Math.floor(mousePos.x / candleWidth);
      if (candleIdx >= 0 && candleIdx < visibleCandles.length) {
        const hc = visibleCandles[candleIdx];
        const dateStr = new Date(hc.time).toLocaleTimeString('th-TH');

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
        ctx.lineWidth = 1;
        ctx.fillRect(12, 12, 280, 24);
        ctx.strokeRect(12, 12, 280, 24);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`T: ${dateStr}  O:${hc.open} H:${hc.high} L:${hc.low} C:${hc.close}`, 18, 28);
      }
    }
  }, [candles, indicators, zoomLevel, showIndicators, positions, bid, ask, spreadPips, mousePos]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Chart Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        {/* Symbol and Timeframe Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-100 font-mono-numbers pr-2 border-r border-slate-800">
            <span>{symbol}</span>
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              LIVE GOLD
            </span>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800/80">
            {(['M1', 'M5', 'M15', 'H1', 'H4'] as Timeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 font-semibold rounded text-[11px] transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onToggleIndicator('ema')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              showIndicators.ema
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <span>EMA (20/50/200)</span>
          </button>

          <button
            onClick={() => onToggleIndicator('supertrend')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              showIndicators.supertrend
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <span>SuperTrend</span>
          </button>

          <button
            onClick={() => onToggleIndicator('bollinger')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              showIndicators.bollinger
                ? 'bg-sky-500/10 text-sky-300 border-sky-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <span>BB(20,2)</span>
          </button>

          <button
            onClick={() => onToggleIndicator('smcFvg')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              showIndicators.smcFvg
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <span>SMC FVG</span>
          </button>

          <button
            onClick={() => onToggleIndicator('supportResistance')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              showIndicators.supportResistance
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <span>แนวรับ-ต้าน</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 15, 120))}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 15, 20))}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(45)}
            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
            title="Reset Zoom"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div ref={containerRef} className="relative flex-1 w-full min-h-[380px] lg:min-h-[460px] bg-slate-950">
        {isLoading || candles.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-400 bg-slate-950 z-10">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
            <span>กำลังเชื่อมต่อราคาตลาดทองคำสด XAU/USD (Live Feed)...</span>
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="absolute inset-0 cursor-crosshair block"
        />

        {/* Live Indicator Legend Overlay */}
        <div className="absolute top-2 left-3 flex flex-wrap items-center gap-3 text-[11px] font-mono-numbers pointer-events-none bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800/60">
          <span className="text-amber-400">EMA20: {indicators.ema20.toFixed(3)}</span>
          <span className="text-cyan-400">EMA50: {indicators.ema50.toFixed(3)}</span>
          <span className="text-purple-400">EMA200: {indicators.ema200.toFixed(3)}</span>
          <span className="text-slate-300">RSI(14): {indicators.rsi.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
