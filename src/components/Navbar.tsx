import React from 'react';
import { Shield, Bell, Terminal, Volume2, VolumeX, DollarSign } from 'lucide-react';
import { AccountState, UserSettings, LineEnvStatus, TelegramEnvStatus } from '../types/trading';

interface NavbarProps {
  account: AccountState;
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onOpenLineModal: () => void;
  onOpenBridgeModal: () => void;
  onOpenRiskSettings: () => void;
  activeTab: 'terminal' | 'signal-station' | 'confluence' | 'history' | 'mql5';
  setActiveTab: (tab: 'terminal' | 'signal-station' | 'confluence' | 'history' | 'mql5') => void;
  bid: number;
  ask: number;
  spreadPips: number;
  lineEnvStatus?: LineEnvStatus;
  telegramEnvStatus?: TelegramEnvStatus;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  settings,
  onUpdateSettings,
  onOpenLineModal,
  onOpenBridgeModal,
  activeTab,
  setActiveTab,
  bid,
  ask,
  spreadPips,
  lineEnvStatus,
  telegramEnvStatus
}) => {
  const isLineConnected = Boolean(
    (settings.lineChannelAccessToken && settings.lineUserId) || lineEnvStatus?.configuredViaEnv
  );
  const isTelegramConnected = Boolean(
    (settings.telegramBotToken && settings.telegramChatId) || telegramEnvStatus?.configuredViaEnv
  );
  const hasAnyChannel = isLineConnected || isTelegramConnected;
  return (
    <header className="border-b border-slate-800 bg-slate-950 px-4 lg:px-6 py-3 shrink-0">
      <div className="flex items-center justify-between gap-8 max-w-[1700px] mx-auto">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm tracking-wider shadow-inner">
            EX
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              EXNESS XAUUSD Scalping Pro
            </span>
            <span className="text-[11px] text-slate-400 font-mono-numbers">
              Gold Spot · Exness Signal Engine
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Single-line) */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`transition-colors whitespace-nowrap cursor-pointer pb-0.5 ${
              activeTab === 'terminal' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Terminal &amp; Chart
          </button>
          <button
            onClick={() => setActiveTab('signal-station')}
            className={`transition-colors whitespace-nowrap cursor-pointer pb-0.5 flex items-center gap-1.5 ${
              activeTab === 'signal-station' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            <span>Signal to Exness</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
              LINE
            </span>
          </button>
          <button
            onClick={() => setActiveTab('confluence')}
            className={`transition-colors whitespace-nowrap cursor-pointer pb-0.5 ${
              activeTab === 'confluence' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Confluence (&gt;90%)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`transition-colors whitespace-nowrap cursor-pointer pb-0.5 ${
              activeTab === 'history' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Dashboard &amp; History
          </button>
          <button
            onClick={() => setActiveTab('mql5')}
            className={`transition-colors whitespace-nowrap cursor-pointer pb-0.5 ${
              activeTab === 'mql5' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            MQL5 EA Bridge
          </button>
        </nav>

        {/* Zone 3: Primary Action & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Live Quote Ticker */}
          <div className="hidden xl:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono-numbers">
            <span className="text-slate-400">{settings.symbol}:</span>
            <span className="text-emerald-400 font-semibold">{bid > 0 ? bid.toFixed(3) : '---'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200">{ask > 0 ? ask.toFixed(3) : '---'}</span>
            <span className="text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded text-[10px]">
              Spread {spreadPips.toFixed(1)} pips
            </span>
          </div>

          {/* Currency Toggle (USD / THB) */}
          <button
            onClick={() => onUpdateSettings({ currency: account.currency === 'USD' ? 'THB' : 'USD' } as any)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="สลับสกุลเงินแสดงผล (USD / THB)"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>{account.currency}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title={settings.soundEnabled ? 'เปิดเสียงแจ้งเตือนอยู่' : 'ปิดเสียงแจ้งเตือน'}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* MT4/MT5 Bridge Quick Modal Button */}
          <button
            onClick={onOpenBridgeModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>MT5 Bridge</span>
          </button>

          {/* Primary Action Button: LINE OA & Telegram Group Settings */}
          <button
            onClick={onOpenLineModal}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              hasAnyChannel
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              {isLineConnected && isTelegramConnected
                ? 'LINE + Telegram เชื่อมต่อแล้ว'
                : isTelegramConnected
                ? 'Telegram เชื่อมต่อแล้ว'
                : isLineConnected
                ? 'LINE OA / ตั้งค่า TG'
                : 'ตั้งค่า LINE / Telegram'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
