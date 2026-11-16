import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  Send,
  AlertCircle,
  ExternalLink,
  X,
  Key,
  Info,
  Copy,
  RefreshCw,
  Lock,
  Search,
  Users
} from 'lucide-react';
import { NotificationLog, ConfluenceResult, TelegramEnvStatus } from '../types/trading';

interface TelegramNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramBotToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  onSaveTelegramCredentials: (botToken: string, chatId: string, enabled: boolean) => void;
  notificationLogs: NotificationLog[];
  onSendTestTelegram: () => Promise<{ success: boolean; message?: string }>;
  confluencePreview: ConfluenceResult;
  telegramEnvStatus: TelegramEnvStatus;
  onRefreshEnvStatus: () => Promise<void>;
}

interface DiscoveredGroup {
  id: string;
  title: string;
  type: string;
}

export const TelegramNotifyModal: React.FC<TelegramNotifyModalProps> = ({
  isOpen,
  onClose,
  telegramBotToken,
  telegramChatId,
  telegramEnabled,
  onSaveTelegramCredentials,
  notificationLogs,
  onSendTestTelegram,
  confluencePreview,
  telegramEnvStatus,
  onRefreshEnvStatus
}) => {
  const [inputTgToken, setInputTgToken] = useState(telegramBotToken);
  const [inputTgChatId, setInputTgChatId] = useState(telegramChatId);
  const [inputTgEnabled, setInputTgEnabled] = useState(telegramEnabled);
  const [isSendingTg, setIsSendingTg] = useState(false);
  const [isDetectingGroups, setIsDetectingGroups] = useState(false);
  const [discoveredGroups, setDiscoveredGroups] = useState<DiscoveredGroup[]>([]);
  const [tgTestResult, setTgTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isRefreshingEnv, setIsRefreshingEnv] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputTgToken(telegramBotToken);
      setInputTgChatId(telegramChatId);
      setInputTgEnabled(telegramEnabled);
    }
  }, [isOpen, telegramBotToken, telegramChatId, telegramEnabled]);

  if (!isOpen) return null;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleRefreshEnv = async () => {
    setIsRefreshingEnv(true);
    try {
      await onRefreshEnvStatus();
    } finally {
      setIsRefreshingEnv(false);
    }
  };

  const handleSaveTelegram = () => {
    onSaveTelegramCredentials(inputTgToken.trim(), inputTgChatId.trim(), inputTgEnabled);
    setTgTestResult({ success: true, message: 'บันทึกการตั้งค่า Telegram Group เรียบร้อยแล้ว' });
    setTimeout(() => setTgTestResult(null), 3000);
  };

  const handleDetectGroups = async () => {
    setIsDetectingGroups(true);
    setTgTestResult(null);
    try {
      const res = await fetch('/api/telegram/get-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: inputTgToken.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTgTestResult({
          success: false,
          message: data.error || 'ไม่สามารถค้นหากลุ่มได้ กรุณาตรวจสอบ Bot Token'
        });
        return;
      }
      const list: DiscoveredGroup[] = data.groups || [];
      setDiscoveredGroups(list);
      if (list.length === 0) {
        setTgTestResult({
          success: false,
          message: 'ยังไม่พบข้อความในกลุ่ม — กรุณาเพิ่มบอทเข้ากลุ่ม Telegram แล้วพิมพ์ข้อความอะไรก็ได้ 1 ครั้ง (เช่น /start) แล้วกดค้นหาใหม่อีกครั้ง'
        });
      } else {
        setTgTestResult({
          success: true,
          message: `พบ ${list.length} แชท/กลุ่มที่เชื่อมกับบอทแล้ว! คลิกเลือกกลุ่มที่ต้องการด้านล่างได้เลย`
        });
      }
    } catch (e: any) {
      setTgTestResult({ success: false, message: e.message || 'ไม่สามารถเชื่อมต่อ Telegram API ได้' });
    } finally {
      setIsDetectingGroups(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsSendingTg(true);
    setTgTestResult(null);
    try {
      onSaveTelegramCredentials(inputTgToken.trim(), inputTgChatId.trim(), inputTgEnabled);
      const res = await onSendTestTelegram();
      setTgTestResult({
        success: res.success,
        message: res.message || (res.success ? 'ส่งสัญญาณทดสอบเข้ากลุ่ม Telegram สำเร็จ!' : 'ไม่สามารถส่งเข้ากลุ่ม Telegram ได้')
      });
    } catch (e: any) {
      setTgTestResult({ success: false, message: e.message || 'เกิดข้อผิดพลาดระหว่างส่งเข้า Telegram' });
    } finally {
      setIsSendingTg(false);
    }
  };

  const cronScanUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://exness-signal.vercel.app'}/api/cron/scan`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                ตั้งค่าแจ้งเตือน Telegram Group Bot
              </h3>
              <p className="text-[11px] text-slate-400">
                ส่งสัญญาณ Sniper (&gt;90% Confluence + Layer 2 Filter) เข้ากลุ่ม Telegram อัตโนมัติ
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Enable/Disable Telegram Auto Send */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div>
              <div className="font-bold text-slate-100">เปิดใช้งานแจ้งเตือนไปยังกลุ่ม Telegram อัตโนมัติ</div>
              <div className="text-[11px] text-slate-400">
                เมื่อสัญญาณผ่านเกณฑ์ Confluence &gt; 90% และ Sniper Layer 2 จะส่งเข้ากลุ่ม Telegram ทันที
              </div>
            </div>
            <button
              onClick={() => {
                const next = !inputTgEnabled;
                setInputTgEnabled(next);
                onSaveTelegramCredentials(inputTgToken.trim(), inputTgChatId.trim(), next);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                inputTgEnabled
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {inputTgEnabled ? 'เปิดใช้งาน (ON)' : 'ปิดอยู่ (OFF)'}
            </button>
          </div>

          {/* Environment Variables / Secrets Status (Telegram) */}
          <div className={`p-3.5 rounded-lg border space-y-2.5 ${
            telegramEnvStatus.configuredViaEnv
              ? 'bg-sky-950/25 border-sky-500/40'
              : 'bg-slate-900/80 border-sky-500/30'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                <span>Environment Variables / Secrets (Telegram)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  telegramEnvStatus.configuredViaEnv
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {telegramEnvStatus.configuredViaEnv ? '✓ เชื่อมต่อจาก Secrets แล้ว' : 'ตั้งค่าผ่าน Secrets หรือช่องด้านล่าง'}
                </span>
              </div>

              <button
                onClick={handleRefreshEnv}
                disabled={isRefreshingEnv}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingEnv ? 'animate-spin' : ''}`} />
                <span>รีเฟรชสถานะ</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${telegramEnvStatus.hasEnvBotToken ? 'bg-sky-400' : 'bg-slate-600'}`} />
                  <code className="font-mono-numbers text-slate-200 truncate">TELEGRAM_BOT_TOKEN</code>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={telegramEnvStatus.hasEnvBotToken ? 'text-sky-400 font-semibold' : 'text-slate-500'}>
                    {telegramEnvStatus.hasEnvBotToken ? 'ตั้งค่าแล้ว' : 'ว่าง'}
                  </span>
                  <button
                    onClick={() => copyText('TELEGRAM_BOT_TOKEN')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="คัดลอกชื่อตัวแปร"
                  >
                    {copiedKey === 'TELEGRAM_BOT_TOKEN' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${telegramEnvStatus.hasEnvChatId ? 'bg-sky-400' : 'bg-slate-600'}`} />
                  <code className="font-mono-numbers text-slate-200 truncate">TELEGRAM_CHAT_ID</code>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={telegramEnvStatus.hasEnvChatId ? 'text-sky-400 font-semibold font-mono-numbers' : 'text-slate-500'}>
                    {telegramEnvStatus.hasEnvChatId ? telegramEnvStatus.maskedChatId : 'ว่าง'}
                  </span>
                  <button
                    onClick={() => copyText('TELEGRAM_CHAT_ID')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="คัดลอกชื่อตัวแปร"
                  >
                    {copiedKey === 'TELEGRAM_CHAT_ID' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Credentials Inputs */}
          <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Telegram Bot Token {telegramEnvStatus.hasEnvBotToken ? '(ไม่บังคับ — Override ค่าจาก Secrets)' : '(จาก @BotFather)'}:</span>
              </label>
              <input
                type="text"
                value={inputTgToken}
                onChange={e => setInputTgToken(e.target.value)}
                placeholder="เช่น: 7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-sky-500 font-mono-numbers text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>2. Group / Channel Chat ID (กลุ่มขึ้นต้นด้วยเครื่องหมายลบ -100...):</span>
                </label>
                <button
                  onClick={handleDetectGroups}
                  disabled={isDetectingGroups}
                  className="px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="ดึงรายชื่อกลุ่มที่บอทถูกเชิญเข้าไปล่าสุดอัตโนมัติ"
                >
                  <Search className="w-3 h-3" />
                  <span>{isDetectingGroups ? 'กำลังค้นหากลุ่ม...' : 'ค้นหา Group Chat ID อัตโนมัติ'}</span>
                </button>
              </div>
              <input
                type="text"
                value={inputTgChatId}
                onChange={e => setInputTgChatId(e.target.value)}
                placeholder="เช่น: -1001234567890"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-sky-500 font-mono-numbers text-xs"
              />
            </div>

            {/* Discovered Groups List */}
            {discoveredGroups.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-sky-500/30 space-y-1.5">
                <div className="text-[11px] font-semibold text-sky-300">คลิกเลือกกลุ่มที่พบ:</div>
                <div className="flex flex-wrap gap-1.5">
                  {discoveredGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setInputTgChatId(g.id)}
                      className={`px-2.5 py-1 rounded text-[11px] border cursor-pointer transition-colors flex items-center gap-1.5 ${
                        inputTgChatId === g.id
                          ? 'bg-sky-600 border-sky-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{g.title}</span>
                      <span className="font-mono-numbers text-[10px] opacity-80">({g.id})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleSaveTelegram}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                บันทึกการตั้งค่า
              </button>

              <button
                onClick={handleTestTelegram}
                disabled={isSendingTg}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-bold rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTg ? 'กำลังส่งเข้ากลุ่ม Telegram...' : 'กดทดสอบส่งข้อความเข้ากลุ่ม Telegram'}</span>
              </button>
            </div>

            {tgTestResult && (
              <div
                className={`p-2.5 rounded-lg flex items-center gap-2 text-xs ${
                  tgTestResult.success
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}
              >
                {tgTestResult.success ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{tgTestResult.message}</span>
              </div>
            )}
          </div>

          {/* Telegram Step-by-Step Instructions */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
            <div className="flex items-center justify-between text-sky-400 font-bold mb-1">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                <span>วิธีตั้งค่าบอทส่งเข้ากลุ่ม Telegram (ฟรี 100%):</span>
              </span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 text-xs"
              >
                <span>เปิด @BotFather</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p>1. ทักแชท <code className="text-slate-100 bg-slate-950 px-1 py-0.5 rounded">@BotFather</code> ใน Telegram แล้วพิมพ์ <strong>/newbot</strong> เพื่อรับ <strong>Bot Token</strong></p>
            <p>2. ดึงบอทตัวนั้นเข้า <strong>กลุ่ม Telegram</strong> ของคุณ (แนะนำตั้งสิทธิ์เป็น Admin หรืออนุญาตให้ส่งข้อความ)</p>
            <p>3. พิมพ์ข้อความในกลุ่ม 1 ครั้ง (เช่น <code>/start</code>) แล้วกดปุ่ม <strong>ค้นหา Group Chat ID อัตโนมัติ</strong> ด้านบน ระบบจะดึงรหัสกลุ่ม <code>-100...</code> มาใส่ให้ทันที</p>
            <p className="text-sky-300">4. นำ <code>TELEGRAM_BOT_TOKEN</code> และ <code>TELEGRAM_CHAT_ID</code> ไปใส่ใน <strong>Vercel Environment Variables</strong> หรือ <strong>Secrets</strong> เพื่อให้ Cron-Job ส่งแจ้งเตือนอัตโนมัติได้ 24 ชม.</p>
          </div>

          {/* 24/7 Cron-Job Automation Endpoint */}
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลิงก์สำหรับ Cron-Job 24/7 (ทำงานอัตโนมัติแม้ปิดหน้าเว็บ)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                cron-job.org Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              นำลิงก์นี้ไปวางใน <strong>cron-job.org</strong> (ตั้งทุก 1 หรือ 5 นาที) ระบบจะสแกน XAUUSD ทั้ง 2 ชั้นและส่งเข้ากลุ่ม Telegram อัตโนมัติเมื่อพบสัญญาณ (ต้องตั้งค่า Environment Variables บน Vercel และ Push โค้ดล่าสุดขึ้น GitHub ก่อน)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-emerald-300 font-mono-numbers text-[11px] truncate">
                {cronScanUrl}
              </code>
              <button
                onClick={() => copyText(cronScanUrl)}
                className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-[11px] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
              >
                {copiedKey === cronScanUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === cronScanUrl ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์ Cron'}</span>
              </button>
            </div>
          </div>

          {/* Alert Format Live Preview */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">
              ตัวอย่างข้อความ Signal ในกลุ่ม Telegram (แตะตัวเลขเพื่อคัดลอกวางใน Exness):
            </span>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono-numbers text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
{`🚨 [EXNESS XAUUSDc SNIPER SIGNAL]
🎯 คำสั่งคัดพิเศษ: 🟢 BUY (LONG)
🏆 เกรดสัญญาณ: ${confluencePreview.layer2?.profitGrade ?? 'A++ SNIPER'}
📊 ชั้นที่ 1 (Confluence): ${confluencePreview.totalScore}% (> ${confluencePreview.threshold}%)
🛡️ ชั้นที่ 2 (Sniper Profit): ${confluencePreview.layer2?.sniperScore ?? 90}%
━━━━━━━━━━━━━━━━━
• Entry: ${confluencePreview.suggestedEntry.toFixed(3)}
• SL: ${confluencePreview.suggestedSl.toFixed(3)} (-${confluencePreview.slPips} pips | คุมเสี่ยง ${confluencePreview.slRiskPercent}% <= 5%)
• TP: ${confluencePreview.suggestedTp.toFixed(3)} (+${confluencePreview.tpPips} pips | เป้ากำไร ${confluencePreview.tpTargetPercent}% ~10%)
• R:R Ratio: 1 : ${confluencePreview.rrRatio}`}
            </div>
          </div>

          {/* History of Sent Notifications */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>ประวัติการส่งแจ้งเตือน Telegram Group:</span>
              <span className="font-mono-numbers">{notificationLogs.length} รายการ</span>
            </div>
            {notificationLogs.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic p-2 bg-slate-900/40 rounded border border-slate-800">
                ยังไม่มีรายการส่งในเซสชันนี้ กดปุ่มทดสอบส่งข้อความเพื่อตรวจสอบการเชื่อมต่อ Telegram
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1.5 border border-slate-800 rounded-lg p-2 bg-slate-900/40">
                {notificationLogs.slice(0, 8).map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-950 border border-slate-800/80 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.success ? 'bg-sky-400' : 'bg-rose-400'}`} />
                      <span className="text-[9px] px-1 rounded font-bold shrink-0 bg-sky-500/20 text-sky-300">
                        TELEGRAM
                      </span>
                      <span className="text-slate-300 font-medium truncate">{log.title}</span>
                    </div>
                    <span className="text-slate-500 font-mono-numbers shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
