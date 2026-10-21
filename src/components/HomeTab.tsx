import React from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  PlusCircle,
  Check,
  ShieldAlert,
  Gamepad2,
  Store,
} from "lucide-react";
import { MemeCoin, UserStats } from "../types";
import { playSound } from "../utils/sound";

interface HomeTabProps {
  coins: MemeCoin[];
  userStats: UserStats;
  onTradeCoin: (coinId: string) => void;
}

export default function HomeTab({
  coins,
  userStats,
  onTradeCoin,
}: HomeTabProps) {
  const navigate = useNavigate();

  const hotCoins = [...coins]
    .sort((a, b) => (Number(b.change24h) || 0) - (Number(a.change24h) || 0))
    .slice(0, 3);

  const topMarketCoins = [...coins]
    .sort((a, b) => (Number(b.marketCap) || 0) - (Number(a.marketCap) || 0))
    .slice(0, 6);

  const [dismissedNoticeIds, setDismissedNoticeIds] = React.useState<string[]>(
    () => {
      try {
        const saved = localStorage.getItem("dismissed_notices");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
  );

  const handleDismissNotice = (id: string) => {
    const nextDismissed = [...dismissedNoticeIds, id];
    setDismissedNoticeIds(nextDismissed);
    localStorage.setItem("dismissed_notices", JSON.stringify(nextDismissed));
  };

  const manualNotices = (userStats.activityLog || []).filter(
    (log) =>
      log.id.startsWith("manual_") && !dismissedNoticeIds.includes(log.id),
  );

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {manualNotices.map((notice, index) => (
        <div
          key={notice.id ? `${notice.id}-${index}` : `notice-${index}`}
          className="rounded-2xl border border-indigo-500/30 bg-[#141417] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-xs text-white">Admin Notice</span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {notice.action}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleDismissNotice(notice.id)}
            className="px-3.5 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 self-end sm:self-center"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dismiss</span>
          </button>
        </div>
      ))}

      {/* Clean Overview Bar */}
      <div className="bg-[#141417] border border-white/[0.07] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Overview
          </h1>
          <p className="text-xs text-zinc-400">
            Trade community tokens, play fast arcade games, and track your portfolio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              playSound("click");
              navigate("/market");
            }}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-zinc-950 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Market</span>
          </button>
          <button
            onClick={() => {
              playSound("click");
              navigate("/arcade");
            }}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-zinc-200 border border-white/[0.07] transition flex items-center gap-1.5 cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Arcade</span>
          </button>
          <button
            onClick={() => {
              playSound("click");
              navigate("/create-coin");
            }}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-zinc-200 border border-white/[0.07] transition flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Create Coin</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Balance & Account Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#141417] border border-white/[0.07] p-4 rounded-2xl flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Cash Balance</span>
          <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
            $
            {userStats.cash.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-[#141417] border border-white/[0.07] p-4 rounded-2xl flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Gems</span>
          <span className="text-base sm:text-lg font-bold text-cyan-400 font-mono">
            💎 {userStats.gems.toLocaleString()}
          </span>
        </div>
        <div className="bg-[#141417] border border-white/[0.07] p-4 rounded-2xl flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Prestige</span>
          <span className="text-base sm:text-lg font-bold text-white font-mono">
            Level {userStats.prestigeLevel || 0}
          </span>
        </div>
        <div className="bg-[#141417] border border-white/[0.07] p-4 rounded-2xl flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Trades</span>
          <span className="text-base sm:text-lg font-bold text-zinc-200 font-mono">
            {userStats.tradesCount || 0}
          </span>
        </div>
      </div>

      {/* Top Movers */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-zinc-300">Top Gainers</h2>
          <button
            onClick={() => navigate("/market")}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View Market</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(hotCoins || []).map((coin, index) => {
            const change = Number(coin.change24h) || 0;
            const isUp = change >= 0;
            return (
              <div
                key={coin.id ? `${coin.id}-${index}` : `hot-coin-${index}`}
                className="bg-[#141417] hover:bg-[#19191e] border border-white/[0.07] p-4 rounded-2xl flex flex-col justify-between select-none cursor-pointer transition-colors"
                onClick={() => {
                  playSound("click");
                  onTradeCoin(coin.id);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-lg shrink-0 ${coin.avatarBg}`}
                    >
                      {coin.avatarEmoji}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-sm truncate">
                        {coin.name}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        *{coin.symbol}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-lg font-mono font-semibold border ${
                      isUp
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                    }`}
                  >
                    {isUp ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] text-xs font-mono">
                  <span className="text-zinc-500">
                    MCap $
                    {(Number(coin.marketCap) || 0) >= 1000
                      ? `${((Number(coin.marketCap) || 0) / 1000).toFixed(1)}K`
                      : (Number(coin.marketCap) || 0).toFixed(0)}
                  </span>
                  <span className="font-bold text-white">
                    ${Number(coin.price || 0).toFixed(4)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clean Market Snapshot List */}
      <div className="bg-[#141417] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">
            Active Coins
          </span>
          <button
            onClick={() => navigate("/market")}
            className="text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            All Coins ({coins.length})
          </button>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {topMarketCoins.map((coin) => {
            const change = Number(coin.change24h) || 0;
            const isUp = change >= 0;
            return (
              <div
                key={coin.id}
                onClick={() => {
                  playSound("click");
                  onTradeCoin(coin.id);
                }}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-base shrink-0 ${coin.avatarBg}`}
                  >
                    {coin.avatarEmoji}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-white truncate">
                      {coin.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      *{coin.symbol}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                  <span className="text-white font-semibold">
                    ${Number(coin.price || 0).toFixed(4)}
                  </span>
                  <span
                    className={`w-16 text-right font-semibold flex items-center justify-end gap-0.5 ${
                      isUp ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isUp ? (
                      <TrendingUp className="w-3 h-3 shrink-0" />
                    ) : (
                      <TrendingDown className="w-3 h-3 shrink-0" />
                    )}
                    {isUp ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
