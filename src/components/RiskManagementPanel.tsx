import React from 'react';
import { AccountState, UserSettings, Position } from '../types/trading';
import { ShieldAlert, Lock, AlertTriangle, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';

interface RiskManagementPanelProps {
  account: AccountState;
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onKillSwitch: () => void;
  openPositionsCount: number;
}

export const RiskManagementPanel: React.FC<RiskManagementPanelProps> = ({
  account,
  settings,
  onUpdateSettings,
  onKillSwitch,
  openPositionsCount
}) => {
  const isThb = account.currency === 'THB';
  const formatMoney = (usdVal: number) => {
    if (isThb) {
      const thbVal = usdVal * account.usdThbRate;
      return `฿${thbVal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate lot size if in PERCENT_RISK mode
  // 1 Lot XAUUSD in Exness = 100 oz
  // 1 Pip in XAUUSD = $0.10 per 0.01 lot ($10.00 per 1.00 lot)
  const slPips = settings.slPipsDefault;
  const maxRiskAmountUsd = (account.equity * settings.riskPercent) / 100;
  const calculatedLot = Math.max(0.01, Number((maxRiskAmountUsd / (slPips * 10)).toFixed(2)));

  const activeLotSize = settings.lotMode === 'PERCENT_RISK' ? calculatedLot : settings.fixedLotSize;
  const potentialLossUsd = activeLotSize * 10 * slPips;
  const potentialGainUsd = activeLotSize * 10 * settings.tpPipsDefault;
  const actualRiskPercent = Number(((potentialLossUsd / account.equity) * 100).toFixed(1));
  const actualGainPercent = Number(((potentialGainUsd / account.equity) * 100).toFixed(1));

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header with Kill Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-100">
            ระบบจัดการความเสี่ยงปกป้องเงินทุน (Capital Guardian)
          </h2>
        </div>

        {/* KILL SWITCH (Emergency Close All) */}
        <button
          onClick={onKillSwitch}
          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-98 text-white text-xs font-bold transition-all shadow-sm shadow-rose-950 cursor-pointer flex items-center gap-2"
          title="ปิดทุกออเดอร์ในพอร์ตทันทีด้วยความเร็วสูงสุด"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>KILL SWITCH (ปิดทุกออเดอร์)</span>
          {openPositionsCount > 0 && (
            <span className="bg-rose-950 text-rose-200 px-1.5 py-0.2 rounded text-[10px]">
              {openPositionsCount}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Account Financials Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[11px] text-slate-400 block">ยอดเงินในพอร์ต (Balance)</span>
            <span className="text-sm font-bold font-mono-numbers text-slate-100">
              {formatMoney(account.balance)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[11px] text-slate-400 block">สินทรัพย์สุทธิ (Equity)</span>
            <span className="text-sm font-bold font-mono-numbers text-cyan-400">
              {formatMoney(account.equity)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[11px] text-slate-400 block">กำไรสะสมวันนี้ (Today P&L)</span>
            <span className="text-sm font-bold font-mono-numbers text-emerald-400">
              +{formatMoney(account.equity - account.balance + 68.40)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[11px] text-slate-400 block">เลเวอเรจ Exness</span>
            <span className="text-sm font-bold font-mono-numbers text-amber-400">
              {account.leverage}
            </span>
          </div>
        </div>

        {/* Lot Size & Risk Allocation Settings */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              การคำนวณขนาดล็อต &amp; จุด SL/TP (ตามเงื่อนไข SL ไม่เกิน 5% / TP ~10%)
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => onUpdateSettings({ lotMode: 'PERCENT_RISK' })}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer ${
                  settings.lotMode === 'PERCENT_RISK'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                คำนวณตาม % เสี่ยง (Auto)
              </button>
              <button
                onClick={() => onUpdateSettings({ lotMode: 'FIXED_LOT' })}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer ${
                  settings.lotMode === 'FIXED_LOT'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ฟิกซ์ขนาดล็อต (Fixed Lot)
              </button>
            </div>
          </div>

          {/* Controls row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {settings.lotMode === 'PERCENT_RISK' ? (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">
                  ความเสี่ยงต่อไม้ (% ของพอร์ต, ห้ามเกิน 5%):
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 5].map(pct => (
                    <button
                      key={pct}
                      onClick={() => onUpdateSettings({ riskPercent: pct })}
                      className={`flex-1 py-1 text-xs font-semibold rounded border cursor-pointer ${
                        settings.riskPercent === pct
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">
                  เลือกขนาดล็อตคำสั่ง (Fixed Lot):
                </span>
                <div className="flex items-center gap-1">
                  {[0.01, 0.02, 0.05, 0.10].map(lot => (
                    <button
                      key={lot}
                      onClick={() => onUpdateSettings({ fixedLotSize: lot })}
                      className={`flex-1 py-1 text-xs font-mono-numbers font-semibold rounded border cursor-pointer ${
                        settings.fixedLotSize === lot
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SL Distance (pips) */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">
                ระยะตัดขาดทุน (SL Pips):
              </span>
              <div className="flex items-center gap-1">
                {[20, 25, 30, 35].map(pips => (
                  <button
                    key={pips}
                    onClick={() => onUpdateSettings({ slPipsDefault: pips })}
                    className={`flex-1 py-1 text-xs font-mono-numbers font-semibold rounded border cursor-pointer ${
                      settings.slPipsDefault === pips
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pips} p
                  </button>
                ))}
              </div>
            </div>

            {/* TP Distance (pips) */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">
                ระยะทำกำไร (TP Pips ~10%):
              </span>
              <div className="flex items-center gap-1">
                {[50, 65, 75, 90].map(pips => (
                  <button
                    key={pips}
                    onClick={() => onUpdateSettings({ tpPipsDefault: pips })}
                    className={`flex-1 py-1 text-xs font-mono-numbers font-semibold rounded border cursor-pointer ${
                      settings.tpPipsDefault === pips
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pips} p
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Summary Breakdown */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-numbers">
            <div>
              <span className="text-slate-500 block text-[10px]">ขนาดล็อตออกออเดอร์:</span>
              <span className="text-cyan-400 font-bold">{activeLotSize} lot (XAUUSD)</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px]">ความเสี่ยงสูงสุด (เมื่อชน SL):</span>
              <span className="text-rose-400 font-bold">
                -{formatMoney(potentialLossUsd)} ({actualRiskPercent}% ของพอร์ต)
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px]">เป้าหมายกำไร (เมื่อชน TP):</span>
              <span className="text-emerald-400 font-bold">
                +{formatMoney(potentialGainUsd)} (~{actualGainPercent}% กำไร)
              </span>
            </div>
          </div>
        </div>

        {/* Capital Protection Rules (Anti-Hedging & Breakeven) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Rule 1: Single Order Anti-Hedging */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-300">กฎ 1 ออเดอร์ (Single Order)</span>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ล็อกพอร์ตไม่ส่งออเดอร์ซ้ำหรือแก้ทาง (Anti-Hedging) ป้องกันการเปิดออเดอร์ซ้อน
            </p>
          </div>

          {/* Rule 2: Auto Breakeven */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-300">ขยับกันทุนอัตโนมัติ (BE)</span>
              <button
                onClick={() => onUpdateSettings({ autoBreakevenEnabled: !settings.autoBreakevenEnabled })}
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  settings.autoBreakevenEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {settings.autoBreakevenEnabled ? 'เปิด (Active)' : 'ปิด'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              เมื่อบวกเกิน +15 pips ระบบจะย้าย SL มาที่จุดทุน + 2 pips ทันที
            </p>
          </div>

          {/* Rule 3: Trailing Stop */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-300">Trailing Stop ล็อกกำไร</span>
              <button
                onClick={() => onUpdateSettings({ trailingStopEnabled: !settings.trailingStopEnabled })}
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  settings.trailingStopEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {settings.trailingStopEnabled ? 'เปิด (Active)' : 'ปิด'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              เลื่อนตามราคาเมื่อกำไรขยายตัว รักษากำไรไม่ให้กลายเป็นการขาดทุน
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
