import React, { useState } from 'react';
import {
  ConfluenceResult,
  OrderType,
  TradeSignal,
  UserSettings,
  HTFTrendContext,
  AntiSpamStatus
} from '../types/trading';
import {
  Copy,
  Check,
  Send,
  ExternalLink,
  Zap,
  Clock,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Radio,
  ShieldCheck,
  Lock
} from 'lucide-react';

interface ExnessSignalStationProps {
  confluence: ConfluenceResult;
  signals: TradeSignal[];
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onSendSignalToLine: (direction: OrderType, confluence: ConfluenceResult) => Promise<boolean>;
  onSendSignalToTelegram: (direction: OrderType, confluence: ConfluenceResult) => Promise<boolean>;
  onSimulateSignal: () => void;
  bid: number;
  ask: number;
  rawBid: number;
  marketSource: string;
  htfContext?: HTFTrendContext;
  antiSpam: AntiSpamStatus;
  onResetWaveLock: () => void;
}

export const ExnessSignalStation: React.FC<ExnessSignalStationProps> = ({
  confluence,
  signals,
  settings,
  onUpdateSettings,
  onSendSignalToLine,
  onSendSignalToTelegram,
  onSimulateSignal,
  bid,
  ask,
  rawBid,
  marketSource,
  htfContext,
  antiSpam,
  onResetWaveLock
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean | null>(null);
  const [isSendingTg, setIsSendingTg] = useState<boolean>(false);
  const [sendTgSuccess, setSendTgSuccess] = useState<boolean | null>(null);
  const [exnessRefPrice, setExnessRefPrice] = useState<string>('');
  const [showCalibrate, setShowCalibrate] = useState<boolean>(false);

  const activeDirection: OrderType = confluence.direction === 'SELL' ? 'SELL' : 'BUY';
  const entryPrice = confluence.suggestedEntry;
  const slPrice = confluence.suggestedSl;
  const tpPrice = confluence.suggestedTp;
  const lotSize = settings.fixedLotSize;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = `${settings.symbol} ${activeDirection}
Entry: ${entryPrice.toFixed(3)}
SL: ${slPrice.toFixed(3)}
TP: ${tpPrice.toFixed(3)}
Lot: ${lotSize}`;
    copyToClipboard(fullText, 'ALL');
  };

  const handleManualPushToLine = async () => {
    setIsSending(true);
    setSendSuccess(null);
    try {
      const ok = await onSendSignalToLine(activeDirection, confluence);
      setSendSuccess(ok);
      setTimeout(() => setSendSuccess(null), 3000);
    } catch {
      setSendSuccess(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleManualPushToTelegram = async () => {
    setIsSendingTg(true);
    setSendTgSuccess(null);
    try {
      const ok = await onSendSignalToTelegram(activeDirection, confluence);
      setSendTgSuccess(ok);
      setTimeout(() => setSendTgSuccess(null), 3000);
    } catch {
      setSendTgSuccess(false);
    } finally {
      setIsSendingTg(false);
    }
  };

  const handleSyncExnessPrice = () => {
    const parsed = parseFloat(exnessRefPrice);
    if (!isNaN(parsed) && parsed > 100 && rawBid > 100) {
      const offset = Number((parsed - rawBid).toFixed(3));
      onUpdateSettings({ priceOffset: offset });
      setExnessRefPrice('');
      setShowCalibrate(false);
    }
  };

  const isCriteriaPassed = confluence.totalScore >= settings.confluenceThreshold;

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Banner: Concept & Live Feed Calibration */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex flex-wrap items-center gap-2">
                <span>Exness Signal Station (วิเคราะห์ &gt; ส่งเข้า LINE &gt; นำไปวางใน Exness)</span>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  <span>{marketSource}</span>
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                อ้างอิงราคาตลาดทองคำจริง Real-time · สอดคล้องข้อ 1 (Confluence &gt; 90%) + ข้อ 2 (SL &le; 5%, TP ~10%)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Symbol Switcher (XAUUSDc vs XAUUSD) */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              {(['XAUUSDc', 'XAUUSD'] as const).map(sym => (
                <button
                  key={sym}
                  onClick={() => onUpdateSettings({ symbol: sym })}
                  className={`px-2 py-0.5 rounded font-mono-numbers font-semibold transition-colors cursor-pointer ${
                    settings.symbol === sym
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* Exness Price Calibration Toggle */}
            <button
              onClick={() => setShowCalibrate(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                settings.priceOffset !== 0
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              title="ชดเชยส่วนต่างราคาหากกระดาน Exness ต่างจาก Spot กลางเล็กน้อย"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {settings.priceOffset !== 0
                  ? `Offset: ${settings.priceOffset >= 0 ? '+' : ''}${settings.priceOffset.toFixed(3)}`
                  : 'เทียบราคาตรงกับ Exness'}
              </span>
            </button>

            {/* Auto Send Toggle */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-300 font-medium">ส่ง LINE / TG อัตโนมัติ:</span>
              <button
                onClick={() => onUpdateSettings({ autoSendSignalToLine: !settings.autoSendSignalToLine })}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settings.autoSendSignalToLine
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.autoSendSignalToLine ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span>{settings.autoSendSignalToLine ? 'เปิด (Auto-Send ON)' : 'ปิด (Manual)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Optional Exness Price Calibration Bar */}
        {showCalibrate && (
          <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-cyan-300">
                ปรับเทียบราคาให้ตรงกับหน้าจอ Exness MT5 ({settings.symbol}) แบบ 100%
              </div>
              <div className="text-[11px] text-slate-400 font-mono-numbers">
                ราคา Spot Feed ปัจจุบัน: <strong className="text-slate-200">{rawBid.toFixed(3)}</strong> · Offset ปัจจุบัน:{' '}
                <strong className="text-cyan-400">{settings.priceOffset >= 0 ? '+' : ''}{settings.priceOffset.toFixed(3)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                value={exnessRefPrice}
                onChange={e => setExnessRefPrice(e.target.value)}
                placeholder={`กรอกราคา Bid บน Exness (เช่น ${bid.toFixed(3)})`}
                className="w-56 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 font-mono-numbers text-xs focus:outline-hidden focus:border-cyan-500"
              />
              <button
                onClick={handleSyncExnessPrice}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Sync ราคา Exness
              </button>
              {settings.priceOffset !== 0 && (
                <button
                  onClick={() => onUpdateSettings({ priceOffset: 0 })}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer flex items-center gap-1"
                  title="รีเซ็ต Offset เป็น 0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>รีเซ็ต</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3-Layer High-Precision Sniper & Anti-Spam Gatekeeper Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
          {/* Layer 1 */}
          <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
            isCriteriaPassed
              ? 'bg-emerald-950/25 border-emerald-500/40'
              : 'bg-slate-950/60 border-slate-800/60'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
              <div>
                <div className="font-semibold text-slate-200">ชั้นที่ 1: Confluence 6 มิติ</div>
                <div className="text-[10px] text-slate-400">
                  คะแนน: <strong className="font-mono-numbers text-amber-300">{confluence.totalScore}%</strong> (เกณฑ์ &gt; {settings.confluenceThreshold}%)
                </div>
              </div>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isCriteriaPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {isCriteriaPassed ? 'PASS' : 'WAIT'}
            </span>
          </div>

          {/* Layer 2: Sniper Profit Filter */}
          <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
            confluence.layer2?.passed
              ? 'bg-emerald-950/25 border-emerald-500/40'
              : 'bg-slate-950/60 border-slate-800/60'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>ชั้นที่ 2: Sniper Profit Filter</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Sniper: <strong className="font-mono-numbers text-cyan-300">{confluence.layer2?.sniperScore ?? 0}%</strong> (&ge;{settings.sniperThreshold}%) · M15:{htfContext?.m15Trend ?? '...'} / H1:{htfContext?.h1Trend ?? '...'}
                </div>
              </div>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
              !settings.sniperFilterEnabled
                ? 'bg-slate-800 text-slate-400'
                : confluence.layer2?.passed
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/15 text-amber-300'
            }`}>
              {!settings.sniperFilterEnabled ? 'OFF' : confluence.layer2?.passed ? confluence.layer2.profitGrade : 'FILTERED'}
            </span>
          </div>

          {/* Layer 3: Anti-Spam & Wave Lock */}
          <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
            antiSpam.canSend
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : 'bg-rose-950/20 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>กันส่งถี่ &amp; ล็อกคลื่นเดิม</span>
                  <span className="text-[10px] font-mono-numbers text-slate-400">
                    ({antiSpam.signalsSentToday}/{antiSpam.maxSignalsPerDay} วันนี้)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {antiSpam.canSend
                    ? `พร้อมส่งสัญญาณ Sniper ระดับดีที่สุด (Cooldown ${settings.signalCooldownMinutes} นาที)`
                    : antiSpam.blockReason}
                </div>
              </div>
            </div>
            {!antiSpam.canSend && (
              <button
                onClick={onResetWaveLock}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 shrink-0 cursor-pointer"
                title="ปลดล็อก Cooldown/คลื่นเดิมชั่วคราว"
              >
                ปลดล็อก
              </button>
            )}
          </div>
        </div>

        {/* Anti-Spam & Layer 2 Tuning Controls Bar */}
        <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Layer 2 Sniper Filter Switch */}
            <button
              onClick={() => onUpdateSettings({ sniperFilterEnabled: !settings.sniperFilterEnabled })}
              className={`px-2.5 py-1 rounded border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                settings.sniperFilterEnabled
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ตัวกรอง Sniper ชั้น 2: {settings.sniperFilterEnabled ? 'เปิดใช้งาน' : 'ปิด'}</span>
            </button>

            {/* Sniper Threshold Selector */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 mr-1">คัดเกรดกำไรขั้นต่ำ:</span>
              {[80, 85, 90].map(val => (
                <button
                  key={val}
                  onClick={() => onUpdateSettings({ sniperThreshold: val })}
                  className={`px-2 py-0.5 rounded font-mono-numbers font-semibold cursor-pointer ${
                    settings.sniperThreshold === val
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>

            {/* Anti-Spam Cooldown Selector */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 mr-1">ห่างกันอย่างน้อย:</span>
              {[15, 30, 60, 120].map(mins => (
                <button
                  key={mins}
                  onClick={() => onUpdateSettings({ signalCooldownMinutes: mins })}
                  className={`px-2 py-0.5 rounded font-mono-numbers font-semibold cursor-pointer ${
                    settings.signalCooldownMinutes === mins
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {mins}น.
                </button>
              ))}
            </div>
          </div>

          {/* Same-Wave Lock Toggle */}
          <button
            onClick={() => onUpdateSettings({ sameWaveLockEnabled: !settings.sameWaveLockEnabled })}
            className={`px-2.5 py-1 rounded border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              settings.sameWaveLockEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="ป้องกันการส่งสัญญาณซ้ำทิศทางเดิมในโซนราคาเดียวกัน จนกว่าจะถึงเป้า TP/SL หรือราคาย่อตัวสร้างฐานใหม่"
          >
            <Lock className="w-3 h-3" />
            <span>ล็อกห้ามยิงซ้ำคลื่นเดิม: {settings.sameWaveLockEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Active Signal Card (Designed for Quick Copy to Exness) */}
        <div className={`p-4 rounded-xl border transition-all ${
          isCriteriaPassed
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/40 shadow-sm'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          {/* Card Title & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded text-xs font-bold tracking-wide ${
                activeDirection === 'BUY'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}>
                {activeDirection === 'BUY' ? '🟢 SIGNAL BUY (LONG)' : '🔴 SIGNAL SELL (SHORT)'}
              </span>

              <span className="text-xs font-mono-numbers text-slate-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                {settings.symbol} · Bid {bid.toFixed(3)} / Ask {ask.toFixed(3)}
              </span>

              <span className={`text-xs px-2 py-0.5 rounded font-mono-numbers font-semibold ${
                isCriteriaPassed
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                Confluence {confluence.totalScore}% {isCriteriaPassed ? '(ผ่านเกณฑ์ > 90%)' : '(กำลังสะสมกำลัง)'}
              </span>
            </div>

            {/* Quick Test Trigger Button */}
            <button
              onClick={onSimulateSignal}
              className="text-xs px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
              title="ส่ง Signal ทดสอบด้วยราคาตลาดจริงปัจจุบันเข้า LINE"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>ทดสอบส่ง Signal ราคาจริงเข้า LINE</span>
            </button>
          </div>

          {/* Quick Copy Parameter Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono-numbers mb-3">
            {/* Entry Price */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 relative group hover:border-slate-700 transition-colors">
              <span className="text-[10px] text-slate-400 block mb-0.5">ราคาเข้าซื้อ (Entry Price)</span>
              <div className="text-base font-bold text-slate-100">{entryPrice > 0 ? entryPrice.toFixed(3) : '---'}</div>
              <button
                onClick={() => copyToClipboard(entryPrice.toFixed(3), 'ENTRY')}
                disabled={entryPrice <= 0}
                className="mt-1.5 w-full py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {copiedField === 'ENTRY' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{copiedField === 'ENTRY' ? 'คัดลอกแล้ว' : 'คัดลอก Entry'}</span>
              </button>
            </div>

            {/* Stop Loss (SL) */}
            <div className="bg-slate-950 p-3 rounded-lg border border-rose-900/40 relative group hover:border-rose-700/60 transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-rose-400">Stop Loss (SL ไม่เกิน 5%)</span>
                <span className="text-[9px] bg-rose-950 text-rose-300 px-1 rounded">-{confluence.slPips}p</span>
              </div>
              <div className="text-base font-bold text-rose-400">{slPrice > 0 ? slPrice.toFixed(3) : '---'}</div>
              <button
                onClick={() => copyToClipboard(slPrice.toFixed(3), 'SL')}
                disabled={slPrice <= 0}
                className="mt-1.5 w-full py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-rose-300 border border-slate-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {copiedField === 'SL' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-rose-400" />}
                <span>{copiedField === 'SL' ? 'คัดลอกแล้ว' : 'คัดลอก SL'}</span>
              </button>
            </div>

            {/* Take Profit (TP) */}
            <div className="bg-slate-950 p-3 rounded-lg border border-emerald-900/40 relative group hover:border-emerald-700/60 transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-emerald-400">Take Profit (TP ~10%)</span>
                <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 rounded">+{confluence.tpPips}p</span>
              </div>
              <div className="text-base font-bold text-emerald-400">{tpPrice > 0 ? tpPrice.toFixed(3) : '---'}</div>
              <button
                onClick={() => copyToClipboard(tpPrice.toFixed(3), 'TP')}
                disabled={tpPrice <= 0}
                className="mt-1.5 w-full py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-emerald-300 border border-slate-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {copiedField === 'TP' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-emerald-400" />}
                <span>{copiedField === 'TP' ? 'คัดลอกแล้ว' : 'คัดลอก TP'}</span>
              </button>
            </div>

            {/* Lot Size & R:R */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 relative group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-slate-400">ขนาดล็อต &amp; R:R</span>
                <span className="text-[9px] bg-amber-950 text-amber-300 px-1 rounded">1:{confluence.rrRatio}</span>
              </div>
              <div className="text-base font-bold text-cyan-400">{lotSize.toFixed(2)} lot</div>
              <button
                onClick={() => copyToClipboard(lotSize.toFixed(2), 'LOT')}
                className="mt-1.5 w-full py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-cyan-300 border border-slate-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {copiedField === 'LOT' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                <span>{copiedField === 'LOT' ? 'คัดลอกแล้ว' : 'คัดลอก Lot'}</span>
              </button>
            </div>
          </div>

          {/* Action Strip: Copy All & Open Exness */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              {/* Copy Full Set */}
              <button
                onClick={handleCopyAll}
                disabled={entryPrice <= 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-100 font-semibold text-xs rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {copiedField === 'ALL' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                <span>{copiedField === 'ALL' ? 'คัดลอกชุดตัวเลขทั้งหมดแล้ว!' : 'คัดลอกชุดคำสั่งทั้งหมด (Copy All)'}</span>
              </button>

              {/* Push to LINE button */}
              <button
                onClick={handleManualPushToLine}
                disabled={isSending || entryPrice <= 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'กำลังส่ง LINE...' : 'ส่งเข้า LINE'}</span>
              </button>

              {/* Push to Telegram Group button */}
              <button
                onClick={handleManualPushToTelegram}
                disabled={isSendingTg || entryPrice <= 0}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTg ? 'กำลังส่ง Telegram...' : 'ส่งเข้ากลุ่ม Telegram'}</span>
              </button>

              {sendSuccess !== null && (
                <span className={`text-xs font-semibold ${sendSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {sendSuccess ? '✓ ส่งเข้า LINE เรียบร้อย' : '✕ ส่ง LINE ไม่สำเร็จ'}
                </span>
              )}
              {sendTgSuccess !== null && (
                <span className={`text-xs font-semibold ${sendTgSuccess ? 'text-sky-400' : 'text-rose-400'}`}>
                  {sendTgSuccess ? '✓ ส่งเข้ากลุ่ม Telegram เรียบร้อย' : '✕ ส่ง Telegram ไม่สำเร็จ'}
                </span>
              )}
            </div>

            {/* Direct Link to Exness Web Terminal */}
            <a
              href="https://trade.exness.com/"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>เปิด Exness Web Terminal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Signals Stream & History Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 px-0.5">
            <span className="font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>ประวัติ Signal ที่วิเคราะห์และส่งเข้า LINE (Signal History)</span>
            </span>
            <span className="text-slate-500 font-mono-numbers">{signals.length} รายการ</span>
          </div>

          {signals.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-400 border border-slate-800 rounded-lg bg-slate-900/30">
              ยังไม่มี Signal ที่ส่งออกในเซสชันนี้ — ระบบจะส่งเฉพาะสัญญาณที่ผ่านทั้ง ชั้นที่ 1 (Confluence &gt; {settings.confluenceThreshold}%) และ ชั้นที่ 2 (Sniper &ge; {settings.sniperThreshold}%) เท่านั้น เพื่อป้องกันการแจ้งเตือนถี่เกินไป
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">เวลาส่ง</th>
                    <th className="py-2.5 px-3">คำสั่ง</th>
                    <th className="py-2.5 px-3 text-right">ราคาเข้า (Entry)</th>
                    <th className="py-2.5 px-3 text-right">Stop Loss (SL)</th>
                    <th className="py-2.5 px-3 text-right">Take Profit (TP)</th>
                    <th className="py-2.5 px-3 text-right">ชั้น 1 / ชั้น 2</th>
                    <th className="py-2.5 px-3 text-center">ช่องทางที่ส่ง</th>
                    <th className="py-2.5 px-3 text-center">คัดลอกไป Exness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono-numbers">
                  {signals.map(sig => (
                    <tr key={sig.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(sig.timestamp).toLocaleTimeString('th-TH')}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          sig.type === 'BUY'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {sig.type}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right text-slate-200 font-bold">{sig.entryPrice.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right text-rose-400">{sig.sl.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">{sig.tp.toFixed(3)}</td>

                      <td className="py-2.5 px-3 text-right">
                        <span className="text-amber-400 font-bold">{sig.confluenceScore}%</span>
                        {sig.sniperScore !== undefined && (
                          <span className="text-cyan-400 font-bold ml-1.5">/ {sig.sniperScore}%</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {sig.sentToLine && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ✓ LINE
                            </span>
                          )}
                          {sig.sentToTelegram && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              ✓ TG
                            </span>
                          )}
                          {!sig.sentToLine && !sig.sentToTelegram && (
                            <span className="text-[10px] text-slate-500">-</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            const text = `${sig.symbol} ${sig.type} Entry:${sig.entryPrice.toFixed(3)} SL:${sig.sl.toFixed(3)} TP:${sig.tp.toFixed(3)} Lot:${sig.lotSize}`;
                            copyToClipboard(text, sig.id);
                          }}
                          className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          {copiedField === sig.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span>{copiedField === sig.id ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
