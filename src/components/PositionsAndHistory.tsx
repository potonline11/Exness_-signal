import React, { useState } from 'react';
import { Position, TradingStats, AccountState } from '../types/trading';
import { Check, X, ShieldCheck, Download, BarChart3, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface PositionsAndHistoryProps {
  positions: Position[];
  history: Position[];
  stats: TradingStats;
  account: AccountState;
  onClosePosition: (id: string, reason: 'MANUAL_CLOSE' | 'TP_HIT' | 'SL_HIT') => void;
  onMoveToBreakeven: (id: string) => void;
}

export const PositionsAndHistory: React.FC<PositionsAndHistoryProps> = ({
  positions,
  history,
  stats,
  account,
  onClosePosition,
  onMoveToBreakeven
}) => {
  const [tab, setTab] = useState<'positions' | 'history'>('positions');
  const isThb = account.currency === 'THB';

  const formatMoney = (usdVal: number) => {
    if (isThb) {
      const thbVal = usdVal * account.usdThbRate;
      return `฿${thbVal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const exportHistoryCSV = () => {
    if (history.length === 0) return;
    const headers = ['Ticket,Symbol,Type,Lots,EntryPrice,ClosePrice,OpenTime,CloseTime,PnlUSD,Result'];
    const rows = history.map(h => 
      `${h.ticket},${h.symbol},${h.type},${h.lots},${h.entryPrice},${h.closePrice || 0},"${new Date(h.openTime).toISOString()}","${new Date(h.closeTime || h.openTime).toISOString()}",${h.pnlUsd},${h.closeReason || 'CLOSED'}`
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exness_xauusd_trading_history_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Navigation Tabs & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setTab('positions')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                tab === 'positions'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>ออเดอร์ที่เปิดอยู่ (Active Positions)</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${tab === 'positions' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                {positions.length}
              </span>
            </button>

            <button
              onClick={() => setTab('history')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                tab === 'history'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>ประวัติการเทรด (History &amp; Stats)</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${tab === 'history' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                {history.length}
              </span>
            </button>
          </div>
        </div>

        {/* Real-time Performance Summary Header */}
        <div className="flex items-center gap-4 text-xs font-mono-numbers">
          <div className="text-slate-400">
            Win Rate: <strong className="text-emerald-400">{stats.winRate}%</strong>
          </div>
          <div className="text-slate-400">
            Profit Factor: <strong className="text-cyan-400">{stats.profitFactor}</strong>
          </div>
          <div className="text-slate-400">
            Net P&amp;L:{' '}
            <strong className={stats.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {stats.netProfitUsd >= 0 ? '+' : ''}{formatMoney(stats.netProfitUsd)}
            </strong>
          </div>
          {tab === 'history' && history.length > 0 && (
            <button
              onClick={exportHistoryCSV}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="ส่งออกประวัติการเทรดเป็นไฟล์ CSV"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {tab === 'positions' ? (
        <div className="overflow-x-auto">
          {positions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Clock className="w-6 h-6 text-slate-600" />
              <p className="text-slate-400 font-medium">ไม่มีออเดอร์เปิดค้างอยู่ในระบบ</p>
              <p className="text-[11px] text-slate-500">
                ระบบกำลังสแกนวิเคราะห์ความสอดคล้องปัจจัย (Confluence &gt; 90%) เพื่อส่งแจ้งเตือนและเข้าเทรด
              </p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Ticket / Symbol</th>
                  <th className="py-2.5 px-3">ประเภท</th>
                  <th className="py-2.5 px-3 text-right">Lots</th>
                  <th className="py-2.5 px-3 text-right">ราคาเข้า</th>
                  <th className="py-2.5 px-3 text-right">ราคาปัจจุบัน</th>
                  <th className="py-2.5 px-3 text-right">Stop Loss</th>
                  <th className="py-2.5 px-3 text-right">Take Profit</th>
                  <th className="py-2.5 px-3 text-right">กำไร/ขาดทุน (P&amp;L)</th>
                  <th className="py-2.5 px-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono-numbers">
                {positions.map(pos => {
                  const isProfit = pos.pnlUsd >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-200">#{pos.ticket}</div>
                        <div className="text-[10px] text-amber-400/90">{pos.symbol} (Exness)</div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            pos.type === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {pos.type}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right text-slate-200">{pos.lots.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{pos.entryPrice.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-100 font-bold">{pos.currentPrice.toFixed(3)}</td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className={pos.isBreakevenLocked ? 'text-cyan-400 font-bold' : 'text-rose-400'}>
                            {pos.sl.toFixed(3)}
                          </span>
                          {pos.isBreakevenLocked && (
                            <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1 py-0.2 rounded font-bold">
                              BE
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right text-emerald-400">{pos.tp.toFixed(3)}</td>

                      <td className="py-2.5 px-3 text-right">
                        <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{formatMoney(pos.pnlUsd)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isProfit ? '+' : ''}{pos.pnlPips.toFixed(1)} pips
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!pos.isBreakevenLocked && (
                            <button
                              onClick={() => onMoveToBreakeven(pos.id)}
                              className="px-2 py-1 text-[10px] rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 transition-colors cursor-pointer"
                              title="ย้าย Stop Loss มาที่จุดคุ้มทุน (Lock BE)"
                            >
                              ล็อก BE
                            </button>
                          )}
                          <button
                            onClick={() => onClosePosition(pos.id, 'MANUAL_CLOSE')}
                            className="px-2.5 py-1 text-[10px] rounded bg-rose-600/90 hover:bg-rose-500 text-white font-bold transition-colors cursor-pointer"
                            title="ปิดออเดอร์นี้ทันที"
                          >
                            ปิดออเดอร์
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Statistics KPI Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block">อัตราชนะ (Win Rate)</span>
              <span className="text-base font-bold font-mono-numbers text-emerald-400">
                {stats.winRate}%
              </span>
              <span className="text-[10px] text-slate-500 block">
                {stats.winTrades} ชนะ / {stats.lossTrades} แพ้
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block">Profit Factor</span>
              <span className="text-base font-bold font-mono-numbers text-cyan-400">
                {stats.profitFactor}
              </span>
              <span className="text-[10px] text-slate-500 block">เป้าหมาย &gt; 1.8</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block">กำไรสุทธิ (Net P&amp;L)</span>
              <span
                className={`text-base font-bold font-mono-numbers ${
                  stats.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.netProfitUsd >= 0 ? '+' : ''}{formatMoney(stats.netProfitUsd)}
              </span>
              <span className="text-[10px] text-slate-500 block">จาก {stats.totalTrades} ออเดอร์</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block">Max Drawdown (DD)</span>
              <span className="text-base font-bold font-mono-numbers text-amber-400">
                {stats.maxDrawdownPercent}%
              </span>
              <span className="text-[10px] text-slate-500 block">คุมความเสี่ยงเข้มงวด</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block">ค่าเฉลี่ย Win / Loss</span>
              <span className="text-xs font-bold font-mono-numbers text-slate-200 block">
                +{formatMoney(stats.avgWinUsd)} / -{formatMoney(stats.avgLossUsd)}
              </span>
              <span className="text-[10px] text-slate-500 block">R:R จริง 1:2.4</span>
            </div>
          </div>

          {/* History Records Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                  <th className="py-2 px-3">Ticket</th>
                  <th className="py-2 px-3">ประเภท</th>
                  <th className="py-2 px-3 text-right">Lots</th>
                  <th className="py-2 px-3 text-right">ราคาเข้า</th>
                  <th className="py-2 px-3 text-right">ราคาปิด</th>
                  <th className="py-2 px-3">เวลาปิด</th>
                  <th className="py-2 px-3 text-center">ผลลัพธ์</th>
                  <th className="py-2 px-3 text-right">P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono-numbers">
                {history.map(item => {
                  const isWin = item.pnlUsd >= 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 text-slate-300 font-semibold">#{item.ticket}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            item.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300">{item.lots.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{item.entryPrice.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right text-slate-200">{(item.closePrice || item.currentPrice).toFixed(3)}</td>
                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        {new Date(item.closeTime || item.openTime).toLocaleTimeString('th-TH')}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.closeReason === 'TP_HIT'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : item.closeReason === 'SL_HIT'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.closeReason === 'TP_HIT'
                            ? 'TP HIT 🎯'
                            : item.closeReason === 'SL_HIT'
                            ? 'SL HIT 🛑'
                            : 'ปิดด้วยตนเอง'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                          {isWin ? '+' : ''}{formatMoney(item.pnlUsd)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
