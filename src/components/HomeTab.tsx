import React from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Flame,
  Bomb,
  User,
  Zap,
  ArrowRight,
  PlusCircle,
  AlertOctagon,
  MessageSquare,
  Check,
  ShieldAlert,
  Wallet,
  Coins,
  Crown,
  Gamepad2,
} from "lucide-react";
import { MemeCoin, UserStats } from "../types";

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
  // Sort coins by marketcap or high price changes
  const hotCoins = [...coins]
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 3);

  // Directly handle personalized manual action notices sent by the admin
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
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Personalized Direct Admin Notices */}
      {manualNotices.map((notice) => (
        <div
          key={notice.id}
          className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-indigo-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-fade-in text-indigo-100"
        >
          {/* Subtle decoration gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />

          <div className="flex items-start gap-3.5 z-10">
            <div className="p-2.5 bg-black/40 rounded-xl border border-indigo-500/10 shrink-0 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm tracking-wide text-white uppercase tracking-wider">
                  Direct Admin Dispatch
                </span>
                <span className="text-[8.5px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded text-indigo-400 bg-indigo-500/15">
                  Private Notice
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                {notice.action}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 self-end sm:self-center shrink-0 z-10">
            <span className="text-[10px] text-zinc-500 font-mono font-bold">
              {new Date(notice.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={() => handleDismissNotice(notice.id)}
              className="px-4 py-2 bg-indigo-500 border border-indigo-450/40 hover:bg-indigo-450 active:scale-95 text-white text-xs font-black rounded-xl tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Acknowledge</span>
            </button>
          </div>
        </div>
      ))}
      {/* Hero Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-rose-500/5 to-transparent pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-2.5 max-w-lg z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-pill border border-orange-500/30 text-orange-400 font-mono text-[10px] font-extrabold uppercase tracking-wider self-center md:self-start">
            <Sparkles className="w-3 h-3 text-orange-400 animate-pulse" />
            Season 1 is Live
          </div>
          <h2 className="text-xl md:text-3xl font-black text-white tracking-tight leading-tight">
            Welcome to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-400 to-amber-300">
              PumpForge
            </span>
          </h2>
          <p className="text-xs md:text-sm text-zinc-300 font-medium leading-relaxed">
            Simulate a high-speed meme coin trader! Launch coins, buy low, dump
            high, survive the devs and run the arcade table. Stack gems and build your empire.
          </p>

          <div className="flex items-center gap-3 mt-2 justify-center md:justify-start">
            <button
              onClick={() => navigate("/market")}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-lg shadow-orange-950/40 border border-white/20 active:scale-98 cursor-pointer"
            >
              Start Trading <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate("/create-coin")}
              className="px-5 py-2.5 rounded-xl glass-pill hover:bg-white/[0.08] text-xs font-bold text-zinc-200 hover:text-white transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer active:scale-98"
            >
              Launch Coin <PlusCircle className="w-3.5 h-3.5 text-orange-400" />
            </button>
          </div>
        </div>

        {/* Big visual graphic */}
        <div className="glass-card p-5 rounded-2xl flex flex-col gap-3.5 min-w-[240px] shadow-2xl z-10 relative border border-white/10">
          <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono font-bold flex items-center justify-between">
            <span>Market Status</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          </span>
          <div className="h-px bg-white/[0.08]" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Total Coins</span>
            <span className="text-sm text-white font-black font-mono">
              14,586
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">24h Vol Simulated</span>
            <span className="text-sm text-emerald-400 font-black font-mono">
              $1.48M
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Hot coins & simulator chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (span 2): Hot Meme Coins */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between leading-none">
            <h3 className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" /> Hot Gainers
            </h3>
            <button
              onClick={() => navigate("/market")}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              See all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(hotCoins || []).map((coin) => (
              <div
                key={coin.id}
                className="glass-card-interactive p-4 rounded-2xl flex flex-col justify-between select-none cursor-pointer group border border-white/[0.08]"
                onClick={() => onTradeCoin(coin.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center text-xl shadow-lg ${coin.avatarBg}`}
                  >
                    {coin.avatarEmoji}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-zinc-400 truncate font-mono max-w-[80px] text-right">
                      {coin.creatorName || coin.creator}
                    </span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 border border-emerald-500/30 rounded-md font-bold font-mono">
                      +{coin.change24h.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm tracking-tight truncate group-hover:text-orange-400 transition-colors">
                    {coin.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-mono text-zinc-400">
                      *{coin.symbol}
                    </span>
                    <span className="text-xs font-mono font-black text-white">
                      ${coin.price.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Banner for Custom Coin launch advertisement */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between gap-4 mt-2 border border-teal-500/25 bg-gradient-to-r from-teal-950/30 via-zinc-900/40 to-transparent">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center text-2xl shadow-inner">
                🚀
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-white text-sm">
                  Become a Creator Dev!
                </span>
                <span className="text-xs text-zinc-300">
                  Launch a token for $1,100 list fee and trade with fellow degens.
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate("/create-coin")}
              className="bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg border border-white/20 shrink-0 cursor-pointer"
            >
              Launch Coin
            </button>
          </div>
        </div>

        {/* Right column: Trader Overview & Quick Actions */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 select-none animate-fade-in text-zinc-100 border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1.5 leading-none">
                <Crown className="w-4 h-4 text-orange-400" /> Trader Hub
              </h3>
              <button
                onClick={() => navigate("/profile")}
                className="text-[10px] text-orange-400 hover:text-orange-300 font-extrabold uppercase tracking-wider font-mono glass-pill px-2.5 py-1 rounded-lg border border-orange-500/30 transition-colors cursor-pointer"
              >
                Profile
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.07] p-3 rounded-xl flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Cash Balance</span>
                <span className="text-sm font-black text-emerald-400 mt-0.5">
                  ${userStats.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.07] p-3 rounded-xl flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Gems Vault</span>
                <span className="text-sm font-black text-cyan-400 mt-0.5 flex items-center gap-1">
                  💎 {userStats.gems.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.07] p-3 rounded-xl flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Prestige Rank</span>
                <span className="text-sm font-black text-amber-400 mt-0.5">
                  Lvl {userStats.prestigeLevel} • {userStats.title}
                </span>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.07] p-3 rounded-xl flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Trades Executed</span>
                <span className="text-sm font-black text-zinc-200 mt-0.5">
                  {userStats.tradesCount} Orders
                </span>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">Quick Navigation</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate("/arcade")}
                  className="px-3 py-2 rounded-xl glass-pill hover:bg-white/[0.08] text-xs font-mono font-bold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-purple-400" /> Arcade
                </button>
                <button
                  onClick={() => navigate("/market")}
                  className="px-3 py-2 rounded-xl glass-pill hover:bg-white/[0.08] text-xs font-mono font-bold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Market
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Funny chat room simulator / Telegram room drollery */}
      <div className="glass-panel border border-white/10 rounded-2xl p-5 select-none flex flex-col gap-3">
        <h3 className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-orange-500" /> Degenerate
          Shilling Room
        </h3>
        <div className="h-px bg-white/[0.08]" />
        <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto font-mono text-xs custom-scrollbar">
          <div className="text-zinc-400">
            <span
              onClick={() => {
                const target = coins.find((c) => c.id === "moonbox");
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-400 font-bold hover:underline cursor-pointer"
              title="Click to view @sol_expert coin"
            >
              @sol_expert:
            </span>{" "}
            Giga Chad sent it!{" "}
            <span
              onClick={() => {
                const target = coins.find((c) => c.symbol === "ATI");
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-300 font-black cursor-pointer hover:text-white bg-orange-500/15 px-1.5 py-0.5 border border-orange-500/30 rounded-md font-mono"
            >
              ATI
            </span>{" "}
            is moving, dev didn't dump yet!
          </div>

          <div className="text-zinc-400">
            <span
              onClick={() => {
                const target = coins.find((c) => c.id === "gigachad");
                if (target) onTradeCoin(target.id);
              }}
              className="text-amber-400 font-bold hover:underline cursor-pointer"
              title="Click to view @pump_master coin"
            >
              @pump_master:
            </span>{" "}
            who bought{" "}
            <span
              onClick={() => {
                const target = coins.find((c) => c.symbol === "ROAD");
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-300 font-black cursor-pointer hover:text-white bg-orange-500/15 px-1.5 py-0.5 border border-orange-500/30 rounded-md font-mono"
            >
              ROAD
            </span>{" "}
            below 4c? easy 5x incoming fr, loading up!
          </div>

          <div className="text-zinc-400 mb-1">
            <span
              onClick={() => {
                const target = coins.find((c) => c.id === "bome");
                if (target) onTradeCoin(target.id);
              }}
              className="text-purple-400 font-bold hover:underline cursor-pointer"
              title="Click to view @degen_ape coin"
            >
              @degen_ape:
            </span>{" "}
            just lost half my portfolio on{" "}
            <span
              onClick={() => {
                const target = coins.find((c) => c.symbol === "MEW");
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-300 font-black cursor-pointer hover:text-white bg-orange-500/15 px-1.5 py-0.5 border border-orange-500/30 rounded-md font-mono"
            >
              MEW
            </span>{" "}
            coinflipped on arcade coin dev is a fat liar
          </div>

          <div className="text-zinc-400">
            <span
              onClick={() => {
                const target = coins.find((c) => c.id === "omega");
                if (target) onTradeCoin(target.id);
              }}
              className="text-rose-400 font-bold hover:underline cursor-pointer"
              title="Click to view @alpha_caller coin"
            >
              @alpha_caller:
            </span>{" "}
            <span
              onClick={() => {
                const target = coins.find((c) => c.symbol === "OMGA");
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-300 font-black cursor-pointer hover:text-white bg-orange-500/15 px-1.5 py-0.5 border border-orange-500/30 rounded-md font-mono"
            >
              OMGA
            </span>{" "}
            has closed! RIP to the buyers dev took 100 Sol liquidity lmao
          </div>

          <div className="text-zinc-400">
            <span className="text-cyan-400 font-bold">@paper_hands:</span> sold
            my{" "}
            <span
              onClick={() => {
                const target = coins.find((c) => c.symbol === "ATI");
                if (target) onTradeCoin(target.id);
              }}
              className="text-orange-300 font-black cursor-pointer hover:text-white bg-orange-500/15 px-1.5 py-0.5 border border-orange-500/30 rounded-md font-mono"
            >
              ATI
            </span>{" "}
            early, im crying now im so paperhanded i deserve to stay poor
          </div>

          <div className="text-zinc-400">
            <span
              onClick={() => {
                const target = coins.find((c) => c.id === "memex250");
                if (target) onTradeCoin(target.id);
              }}
              className="text-teal-400 font-bold hover:underline cursor-pointer"
              title="Click to view @diamond_dev"
            >
              @diamond_dev:
            </span>{" "}
            Launching a coin in 5 minutes darlings, prepare your liquidity bags!
          </div>
        </div>
      </div>

      <div className="text-center mt-2">
        <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
          Everything is made by zeke
        </p>
      </div>
    </div>
  );
}
