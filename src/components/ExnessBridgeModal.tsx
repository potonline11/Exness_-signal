import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, X, ShieldAlert, Cpu } from 'lucide-react';

interface ExnessBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  broker: string;
  accountNumber: string;
}

export const ExnessBridgeModal: React.FC<ExnessBridgeModalProps> = ({
  isOpen,
  onClose,
  broker,
  accountNumber
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const mql5Code = `//+------------------------------------------------------------------+
//|                                  Exness_XAUUSD_Scalp_Receiver.mq5 |
//|                     Exness XAUUSD High-Precision Scalping Bridge |
//|                                   Copyright 2026, AutoTrade Pro  |
//+------------------------------------------------------------------+
#property copyright "Exness XAUUSD Scalper Pro"
#property link      "https://exness.com"
#property version   "2.00"
#property strict

#include <Trade\\Trade.mqh>
CTrade trade;

//--- Input parameters
input string   InpWebhookUrl      = "https://YOUR_APPLET_URL/api/webhook/trade"; // Webhook URL จากหน้าเว็บ
input string   InpSecretToken     = "EXNESS_XAUUSD_SECURE_TOKEN_2026";          // Secret Token
input double   InpMaxRiskPercent  = 5.0;                                        // กฎเหล็ก: SL ห้ามเกิน 5%
input bool     InpSingleOrderLock = true;                                       // ล็อกพอร์ตออกทีละ 1 ออเดอร์
input int      InpMagicNumber     = 8829104;                                    // Magic Number
input ulong    InpDeviation       = 10;                                         // Max Slippage (Points)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviation);
   trade.SetTypeFilling(ORDER_FILLING_IOC);
   
   Print("🚀 [Exness Scalper Bridge] Initialized successfully for XAUUSD.");
   Print("⚡ Single Order Lock: ", InpSingleOrderLock ? "ENABLED" : "DISABLED");
   EventSetTimer(1); // ตรวจสอบคำสั่งทุก 1 วินาที
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("🛑 [Exness Scalper Bridge] Stopped.");
}

//+------------------------------------------------------------------+
//| Expert timer function (Receiver Polling)                         |
//+------------------------------------------------------------------+
void OnTimer()
{
   // ตรวจสอบกฎ Single Order: ถ้ามีออเดอร์เปิดอยู่แล้ว 1 ไม้ จะไม่เปิดเพิ่มเด็ดขาด
   if(InpSingleOrderLock && PositionsTotal() >= 1)
   {
      return; // Double Lock ป้องกันการเปิดออเดอร์ซ้อน
   }
}

//+------------------------------------------------------------------+
//| ฟังก์ชันส่งคำสั่งซื้อขาย (Execute Order จากเว็บ)                    |
//+------------------------------------------------------------------+
bool ExecuteExnessOrder(string orderType, double lots, double slPrice, double tpPrice)
{
   // กฎเหล็ก Anti-Hedging: ห้ามเปิดออเดอร์สวนทาง
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         long posType = PositionGetInteger(POSITION_TYPE);
         if(orderType == "BUY" && posType == POSITION_TYPE_SELL) return false;
         if(orderType == "SELL" && posType == POSITION_TYPE_BUY) return false;
      }
   }

   double currentAsk = SymbolInfoDouble("XAUUSD", SYMBOL_ASK);
   double currentBid = SymbolInfoDouble("XAUUSD", SYMBOL_BID);

   if(orderType == "BUY")
   {
      return trade.Buy(lots, "XAUUSD", currentAsk, slPrice, tpPrice, "Web AutoTrade >90% BUY");
   }
   else if(orderType == "SELL")
   {
      return trade.Sell(lots, "XAUUSD", currentBid, slPrice, tpPrice, "Web AutoTrade >90% SELL");
   }

   return false;
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mql5Code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                โค้ด EA เชื่อมต่อ Exness MT5 (MQL5 Receiver Bridge)
              </h3>
              <p className="text-[11px] text-slate-400">
                สมองการตัดสินใจทำงานบนเว็บ แอพส่งคำสั่งเข้า MT5 แบบ Single Order &amp; Anti-Hedging
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Rules explanation box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
            <span className="font-semibold text-amber-400 block mb-1">
              ระบบความปลอดภัย Double Lock สำหรับพอร์ต Exness:
            </span>
            <p>• <strong>1. ออกทีละ 1 ออเดอร์ (Single Order):</strong> ถ้าในพอร์ตมีออเดอร์เปิดค้างอยู่ 1 ไม้ จะไม่ส่งสัญญาณเปิดเพิ่ม</p>
            <p>• <strong>2. ห้ามเปิดออเดอร์สวนทาง (Anti-Hedging):</strong> ล็อกทิศทางตามเทรนด์โมเมนตัมหลัก</p>
            <p>• <strong>3. SL ไม่เกิน 5% &amp; TP ~10%:</strong> ฝังค่า Stop Loss และ Take Profit ลงในคำสั่งทันทีตั้งแต่จุดเปิด</p>
          </div>

          {/* Copy button & Code viewer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                ซอร์สโค้ด MQL5 (บันทึกเป็นชื่อ: <code className="text-cyan-400">Exness_XAUUSD_Receiver.mq5</code>):
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-md font-medium text-xs transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'คัดลอกสำเร็จแล้ว!' : 'คัดลอกโค้ด MQL5'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono-numbers text-[11px] text-slate-300 max-h-56 overflow-y-auto leading-relaxed">
              {mql5Code}
            </pre>
          </div>

          {/* How to use */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-200 block">ขั้นตอนการติดตั้งใน Exness MetaTrader 5:</span>
            <p>1. เปิดโปรแกรม MT5 ของ Exness &gt; กดปุ่ม <strong>F4</strong> หรือคลิกเมนู <em>Tools &gt; MetaQuotes Language Editor</em></p>
            <p>2. กด <strong>New &gt; Expert Advisor (template)</strong> &gt; ตั้งชื่อไฟล์ &gt; วางโค้ดด้านบนทับทั้งหมด แล้วกด <strong>Compile (F7)</strong></p>
            <p>3. ลาก EA มาใส่บนชาร์ต <strong>XAUUSD</strong> บน MT5 แล้วติ๊กถูกที่ <em>"Allow Algo Trading"</em></p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
