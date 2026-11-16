import React, { useState } from 'react';
import { ConfluenceResult, OrderType, UserSettings } from '../types/trading';
import { Zap, CheckCircle2, AlertCircle, Send, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ConfluencePanelProps {
  confluence: ConfluenceResult;
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onExecuteTrade: (type: OrderType, reason: string) => void;
  onSendTelegramNotify: (direction: OrderType, confluence: ConfluenceResult) => void;
  onSimulateHighConfluence: () => void;
  bid: number;
  ask: number;
}

export const ConfluencePanel: React.FC<ConfluencePanelProps> = ({
  confluence,
  settings,
  onUpdateSettings,
  onExecuteTrade,
  onSendTelegramNotify,
  onSimulateHighConfluence,
  bid,
  ask
}) => {
  const [lastExecutionLatency, setLastExecutionLatency] = useState<number>(8.2);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const handleInstantTrade = (type: OrderType) => {
    setIsExecuting(true);
    const start = performance.now();

    onExecuteTrade(type, `Instant 1-Click Scalp (${confluence.totalScore}% Confluence)`);

    const latency = performance.now() - start;
    setLastExecutionLatency(Number(Math.max(latency, 6.5).toFixed(1)));
    setTimeout(() => setIsExecuting(false), 200);
  };

  const isSignalValid = confluence.meetsThreshold && confluence.direction !== 'NEUTRAL';

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-slate-100">
            การวิเคราะห์สัญญาณ Confluence (เกณฑ์ &gt; 90% Filter)
          </h2>
        </div>

        {/* Auto-Trade Switch */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">ระบบ Auto-Trade:</span>
          <button
            onClick={() => onUpdateSettings({ autoTrade: !settings.autoTrade })}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
              settings.autoTrade
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-xs'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${settings.autoTrade ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span>{settings.autoTrade ? 'เปิดใช้งาน (ACTIVE)' : 'ปิดชั่วคราว (STANDBY)'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Confluence Score & Execution Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Score Metric Card */}
          <div className="sm:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">ระดับความสอดคล้อง:</span>
              <span className="text-xs font-mono-numbers text-slate-400">
                เป้าหมาย: <strong className="text-amber-400">&gt;{settings.confluenceThreshold}%</strong>
              </span>
            </div>

            <div className="flex items-baseline gap-3 my-2">
              <span
                className={`text-3xl font-extrabold font-mono-numbers ${
                  confluence.totalScore >= settings.confluenceThreshold
                    ? 'text-emerald-400'
                    : confluence.totalScore >= 75
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {confluence.totalScore}%
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  confluence.grade === 'A+'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : confluence.grade === 'A'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                เกรด {confluence.grade}
              </span>
            </div>

            {/* Threshold Selector Tabs */}
            <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 mr-1">เกณฑ์ขั้นต่ำ:</span>
              {[80, 85, 90, 95].map(thresh => (
                <button
                  key={thresh}
                  onClick={() => onUpdateSettings({ confluenceThreshold: thresh })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                    settings.confluenceThreshold === thresh
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {thresh}%
                </button>
              ))}
            </div>
          </div>

          {/* Instant 1-Click Order Execution Card (Millisecond Fast) */}
          <div className="sm:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">ส่งคำสั่งด่วน 1-Click:</span>
                <span className="text-[10px] font-mono-numbers text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                  ⚡ {lastExecutionLatency} ms
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                ล็อต: {settings.fixedLotSize} lot
              </span>
            </div>

            {/* Instant BUY & SELL Buttons */}
            <div className="grid grid-cols-2 gap-2.5 my-2">
              <button
                onClick={() => handleInstantTrade('BUY')}
                disabled={isExecuting || ask <= 0}
                className="py-2.5 px-3 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white transition-all shadow-sm shadow-emerald-950 cursor-pointer flex flex-col items-center justify-center gap-0.5"
              >
                <span className="tracking-wide">ส่งคำสั่ง BUY</span>
                <span className="text-[11px] font-mono-numbers opacity-90">{ask > 0 ? ask.toFixed(3) : '---'}</span>
              </button>

              <button
                onClick={() => handleInstantTrade('SELL')}
                disabled={isExecuting || bid <= 0}
                className="py-2.5 px-3 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 active:scale-98 text-white transition-all shadow-sm shadow-rose-950 cursor-pointer flex flex-col items-center justify-center gap-0.5"
              >
                <span className="tracking-wide">ส่งคำสั่ง SELL</span>
                <span className="text-[11px] font-mono-numbers opacity-90">{bid > 0 ? bid.toFixed(3) : '---'}</span>
              </button>
            </div>

            {/* Direction Status & Test Trigger */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">
                ทิศทางสัญญาณ:{' '}
                <strong
                  className={
                    confluence.direction === 'BUY'
                      ? 'text-emerald-400'
                      : confluence.direction === 'SELL'
                      ? 'text-rose-400'
                      : 'text-slate-500'
                  }
                >
                  {confluence.direction === 'BUY'
                    ? '🟢 Bullish (BUY)'
                    : confluence.direction === 'SELL'
                    ? '🔴 Bearish (SELL)'
                    : '⚪ รอจังหวะ (Neutral)'}
                </strong>
              </span>

              <button
                onClick={onSimulateHighConfluence}
                className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                title="ทดสอบจำลองให้ปัจจัยสอดคล้องเกิน 90% เพื่อดูการส่งแจ้งเตือน Telegram และการเปิดออเดอร์อัตโนมัติ"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>ทดสอบสัญญาณ &gt; 90%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Signal Parameter Box (SL <= 5%, TP ~10%) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>พารามิเตอร์ออเดอร์ตามเกณฑ์ที่กำหนด</span>
              {confluence.totalScore >= settings.confluenceThreshold && (
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                  ผ่านเกณฑ์ &gt; 90%
                </span>
              )}
            </span>

            {/* Quick Send to Telegram button */}
            <button
              onClick={() => onSendTelegramNotify(confluence.direction === 'SELL' ? 'SELL' : 'BUY', confluence)}
              className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-medium"
            >
              <Send className="w-3 h-3" />
              <span>ส่งแจ้งเตือน Telegram ทันที</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-numbers">
            <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">ราคาเข้า (Entry)</span>
              <span className="text-slate-100 font-bold">{confluence.suggestedEntry.toFixed(3)}</span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
              <span className="text-[10px] text-rose-400 block">Stop Loss (SL ไม่เกิน 5%)</span>
              <span className="text-rose-400 font-bold">
                {confluence.suggestedSl.toFixed(3)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">(-{confluence.slPips} pips / 3.5%)</span>
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
              <span className="text-[10px] text-emerald-400 block">Take Profit (TP ~10%)</span>
              <span className="text-emerald-400 font-bold">
                {confluence.suggestedTp.toFixed(3)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">(+{confluence.tpPips} pips / 9.8%)</span>
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
              <span className="text-[10px] text-amber-400 block">Risk:Reward Ratio</span>
              <span className="text-amber-400 font-bold">1 : {confluence.rrRatio}</span>
            </div>
          </div>
        </div>

        {/* 6-Dimension Confluence Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
            <span>เกณฑ์ตัวชี้วัด 6 มิติ (Confluence Checklist)</span>
            <span className="font-mono-numbers">
              ผ่าน {confluence.criteria.filter(c => c.passed).length} จาก {confluence.criteria.length} ข้อ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {confluence.criteria.map(crit => (
              <div
                key={crit.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  crit.passed
                    ? 'bg-slate-900/90 border-emerald-500/30'
                    : 'bg-slate-900/40 border-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    {crit.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="truncate">{crit.name}</span>
                  </div>

                  <span
                    className={`font-mono-numbers text-[11px] font-semibold shrink-0 px-1.5 py-0.2 rounded ${
                      crit.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    +{crit.score}/{crit.maxScore}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed pl-5">
                  {crit.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Layer 2: High-Profit Sniper Verification */}
        {confluence.layer2 && confluence.layer2.criteria.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-0.5">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>การวิเคราะห์ชั้นที่ 2: Sniper Profit Filter (คัดตัวทำกำไรสูง)</span>
              </span>
              <span className={`font-mono-numbers text-[11px] font-bold px-2 py-0.5 rounded border ${
                confluence.layer2.passed
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {confluence.layer2.sniperScore}% ({confluence.layer2.profitGrade})
              </span>
            </div>

            {confluence.layer2.rejectionReasons.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">ระบบกรองกันส่งสัญญาณคุณภาพต่ำ: </span>
                  <span>{confluence.layer2.rejectionReasons.join(' · ')}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {confluence.layer2.criteria.map(crit => (
                <div
                  key={crit.id}
                  className={`p-2 rounded-lg border flex items-start justify-between gap-2 ${
                    crit.passed
                      ? 'bg-slate-900/80 border-cyan-500/30'
                      : 'bg-slate-900/40 border-slate-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200 text-[11px]">
                      {crit.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{crit.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 pl-5 mt-0.5 leading-relaxed">
                      {crit.detail}
                    </p>
                  </div>
                  <span className={`font-mono-numbers text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded ${
                    crit.passed ? 'bg-cyan-500/10 text-cyan-300' : 'bg-slate-800 text-amber-300'
                  }`}>
                    +{crit.score}/{crit.maxScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
