import React, { useState, useEffect } from "react";
import {
  User,
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  Gift,
  ArrowRightLeft,
  Sparkles,
  CheckCircle,
  Flame,
  Crown,
  Palette,
  Check,
} from "lucide-react";
import { UserStats, PortfolioHolding, MemeCoin } from "../types";
import { useAppContext } from "../context/AppContext";

interface ProfileProps {
  userStats: UserStats;
  holdings: PortfolioHolding[];
  coins: MemeCoin[];
  liveTrades: any[];
  onUpdateStats?: (updater: (stats: UserStats) => void) => void;
}

export default function ProfileTab({
  userStats,
  holdings,
  coins,
  liveTrades,
  onUpdateStats,
}: ProfileProps) {
  const { adminSettings } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [wins, setWins] = useState(72.14);
  const [losses, setLosses] = useState(40.0);

  const availableCosmetics = [
    { id: "default", name: "Default White", colorClass: "text-white font-bold" },
    { id: "green_candle", name: "Green Candle", colorClass: "text-emerald-400 font-extrabold" },
    { id: "blue_chip", name: "Blue Chip", colorClass: "text-blue-400 font-medium" },
    { id: "orange_peel", name: "Orange Peel", colorClass: "text-orange-400 font-black" },
    { id: "purple_haze", name: "Purple Haze", colorClass: "text-purple-400 font-bold" },
    { id: "red_alert", name: "Red Alert", colorClass: "text-rose-500 font-black tracking-wide" },
    { id: "gold_rush", name: "Gold Rush", colorClass: "text-yellow-400 font-black text-glow animate-pulse" },
    { id: "degen_fire", name: "Degen Fire", colorClass: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 font-black text-glow" },
    { id: "auraful", name: "Auraful Mystic", colorClass: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-rose-400 font-black text-glow" },
    { id: "black_swan", name: "Black Swan Sovereign", colorClass: "text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-rose-400 to-zinc-200 font-black tracking-wider drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" },
  ];

  const unlockedList = userStats.unlockedColors || (adminSettings.rainbowCosmetics || userStats.rainbowCosmetics ? availableCosmetics.map(c => c.id) : ["default"]);
  const hasBlackSwan = !!userStats.blackSwanCosmetic || userStats.title?.includes("Black Swan") || unlockedList.includes("black_swan");

  useEffect(() => {
    // Simulator skeleton loading to match the video
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Dynamically sync arcade wins and losses from localStorage or use defaults matching the video
    const savedWins = localStorage.getItem("arcade_wins");
    const savedLosses = localStorage.getItem("arcade_losses");
    if (savedWins) setWins(Number(savedWins));
    if (savedLosses) setLosses(Number(savedLosses));
  }, []);

  // Compute portfolio valuation (exclude crashed)
  const holdingsValue = holdings.reduce((sum, h) => {
    const coin = coins.find((c) => c.id === h.coinId);
    if (coin && true) {
      return sum + h.amount * coin.price;
    }
    return sum;
  }, 0);

  const totalPortfolioValue = userStats.cash + holdingsValue;

  // Compute Buy/Sell ratio and values based on trade log
  const userActions = liveTrades.filter(
    (t) => t.userHandle === userStats.handle,
  );
  const buyNum = userActions.filter((t) => t.type === "BUY").length;
  const sellNum = userActions.filter((t) => t.type === "SELL").length;
  const totalTrades = buyNum + sellNum || 1;
  const buyPercent = Math.round((buyNum / totalTrades) * 100);
  const sellPercent = 100 - buyPercent;

  const totalSpent = userActions
    .filter((t) => t.type === "BUY")
    .reduce((acc, t) => acc + t.amountUsd, 0);
  const totalReceived = userActions
    .filter((t) => t.type === "SELL")
    .reduce((acc, t) => acc + t.amountUsd, 0);

  const netProfit = wins - losses;
  const winRate =
    wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "64.3";

  if (loading) {
    return (
      <div
        className="flex-1 flex flex-col gap-5 select-none"
        id="profile-skeleton"
      >
        {/* Profile Card Header Skeleton */}
        <div className="bg-zinc-900/30 border border-zinc-900 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse" />
          <div className="flex-1 flex flex-col gap-2 items-center md:items-start">
            <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-zinc-850 rounded animate-pulse" />
            <div className="h-3 w-40 bg-zinc-900 rounded animate-pulse mt-1" />
          </div>
        </div>

        {/* Portfolio Stats Row Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center justify-between"
            >
              <div className="flex flex-col gap-2">
                <div className="h-2 w-16 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-24 bg-zinc-850 rounded animate-pulse" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-zinc-850 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col gap-6 animate-fade-in text-zinc-100 font-mono"
      id="profile-tab-view"
    >
      <div className="flex flex-col">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-orange-500" /> User Profile
        </h2>
        <p className="text-xs text-zinc-500 tracking-wide mt-0.5">
          Track your sandboxed credentials, stats, and trading performance
        </p>
      </div>

      {/* Main Header card widget */}
      <div className={`glass-panel border p-6 rounded-3xl flex flex-col sm:flex-row items-center gap-5 shadow-2xl relative overflow-hidden group ${
        hasBlackSwan
          ? "border-rose-500/40 bg-gradient-to-r from-zinc-950 via-rose-950/20 to-purple-950/30 shadow-[0_0_30px_rgba(244,63,94,0.2)]"
          : "border-white/10"
      }`}>
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Flame className="w-48 h-48 text-orange-500 animate-pulse" />
        </div>

        <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-3xl select-none shrink-0 font-extrabold shadow-lg ${
          hasBlackSwan
            ? "bg-gradient-to-br from-zinc-900 to-rose-950 border-rose-500/60 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
            : "bg-orange-500/10 border-orange-500/30 text-orange-400"
        }`}>
          {userStats.username ? userStats.username.trim().charAt(0).toUpperCase() : "Z"}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h3 className={`text-xl font-black ${
              adminSettings.rainbowCosmetics || userStats.rainbowCosmetics
                ? "text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 via-cyan-400 to-pink-500 animate-pulse"
                : userStats.nameColor || "text-white"
            }`}>
              {userStats.username}
            </h3>
            <span className="text-emerald-400 font-black text-xs border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> VERIFIED
            </span>
            {hasBlackSwan && (
              <span className="text-xs bg-rose-500/20 border border-rose-500/50 text-rose-300 font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(244,63,94,0.4)] animate-pulse">
                <Crown className="w-3.5 h-3.5 text-rose-400" /> BLACK SWAN SOVEREIGN
              </span>
            )}
            {(adminSettings.rainbowCosmetics || userStats.rainbowCosmetics) && (
              <span className="text-xs bg-gradient-to-r from-rose-500/20 to-purple-500/20 border border-purple-500/40 text-purple-300 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> RAINBOW GLOW
              </span>
            )}
            <span className="text-orange-500 text-xs">🔥</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-orange-400 font-bold">
              {userStats.handle}
            </span>
            <span className="text-[10px] glass-pill border border-white/10 text-zinc-300 font-mono font-bold uppercase py-0.5 px-2.5 rounded-full leading-none tracking-wider">
              {userStats.title}
            </span>
            <span className="text-[10px] text-zinc-400">
              💎 {userStats.gems.toLocaleString()} Gems
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-2">
            Joined July 2025
          </span>
        </div>
      </div>

      {/* Portfolios row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Portfolio value card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-xl">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
              Total Portfolio
            </span>
            <span className="text-white text-lg font-black tracking-tight mt-1">
              $
              {totalPortfolioValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              {holdings.length} holdings
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl glass-card border border-white/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-orange-400" />
          </div>
        </div>

        {/* Liquid portion card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-xl">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
              Liquid Value
            </span>
            <span className="text-emerald-400 text-lg font-black tracking-tight mt-1">
              $
              {userStats.cash.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              Available cash
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl glass-card border border-white/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Illiquid portions card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-xl">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
              Illiquid Value
            </span>
            <span className="text-cyan-400 text-lg font-black tracking-tight mt-1">
              $
              {holdingsValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              Coin holdings
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl glass-card border border-white/10 flex items-center justify-center">
            <Coins className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Grid boxes from video */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Buy/Sell Ratio and trade info */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
              Buy/Sell Ratio
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="text-emerald-400">{buyPercent}% buy</span>
              <span className="text-zinc-500">•</span>
              <span className="text-rose-400">{sellPercent}% sell</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 border border-white/10 flex overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 transition-all h-full"
              style={{ width: `${buyPercent}%` }}
            />
            <div
              className="bg-gradient-to-r from-rose-500 to-red-400 transition-all h-full"
              style={{ width: `${sellPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1.5">
            <div className="glass-card border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
              <span className="text-[9px] text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Buy Activity
              </span>
              <span className="text-emerald-400 font-bold text-sm tracking-tight block mt-1">
                $
                {totalSpent.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-[9px] text-zinc-400 block mt-0.5">
                Total spent
              </span>
            </div>
            <div className="glass-card border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
              <span className="text-[9px] text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-500" /> Sell Activity
              </span>
              <span className="text-rose-400 font-bold text-sm tracking-tight block mt-1">
                $
                {totalReceived.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-[9px] text-zinc-400 block mt-0.5">
                Total received
              </span>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
          <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" /> Arcade &
            Trading Volume
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card border border-white/10 rounded-2xl p-3.5">
              <span className="text-[9px] text-zinc-400 uppercase tracking-wide">
                Total Volume
              </span>
              <span className="text-zinc-200 font-bold text-sm tracking-tight block mt-1">
                $0.00
              </span>
              <span className="text-[9px] text-zinc-400 mt-0.5 block">
                {userStats.tradesCount} trades
              </span>
            </div>
            <div className="glass-card border border-white/10 rounded-2xl p-3.5">
              <span className="text-[9px] text-zinc-400 uppercase tracking-wide">
                24h Trade Volume
              </span>
              <span className="text-zinc-200 font-bold text-sm tracking-tight block mt-1">
                $0.00
              </span>
              <span className="text-[9px] text-zinc-400 mt-0.5 block">
                0 trades today
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Arcade statistics row */}
      <div className="glass-panel border border-white/10 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
          Simulator Win/Loss
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="glass-card border border-white/10 p-3.5 rounded-2xl text-center">
            <span className="text-[9px] text-zinc-400 uppercase tracking-wide block">
              Total Wins
            </span>
            <span className="text-emerald-400 font-extrabold text-sm block mt-1">
              ${wins.toFixed(2)}
            </span>
          </div>
          <div className="glass-card border border-white/10 p-3.5 rounded-2xl text-center">
            <span className="text-[9px] text-zinc-400 uppercase tracking-wide block">
              Total Losses
            </span>
            <span className="text-rose-400 font-extrabold text-sm block mt-1">
              ${losses.toFixed(2)}
            </span>
          </div>
          <div className="glass-card border border-white/10 p-3.5 rounded-2xl text-center">
            <span className="text-[9px] text-zinc-400 uppercase tracking-wide block">
              Win Rate
            </span>
            <span className="text-cyan-400 font-extrabold text-sm block mt-1">
              {winRate}%
            </span>
          </div>
          <div className="glass-card border border-white/10 p-3.5 rounded-2xl text-center">
            <span className="text-[9px] text-zinc-400 uppercase tracking-wide block">
              Net Profit
            </span>
            <span
              className={`font-extrabold text-sm block mt-1 ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Cosmetics & Nameplate Styling Wardrobe */}
      <div className="glass-panel border border-white/10 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-wide">
            <Palette className="w-4 h-4" />
            <span>🎨 Cosmetics & Nameplate Skin Wardrobe</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {unlockedList.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {availableCosmetics.map((cosmetic) => {
            const isUnlocked = unlockedList.includes(cosmetic.id) || cosmetic.id === "default";
            const isEquipped = userStats.nameColor === cosmetic.colorClass || (!userStats.nameColor && cosmetic.id === "default");

            return (
              <div
                key={cosmetic.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  isEquipped
                    ? "bg-indigo-600/20 border-indigo-500 shadow-md ring-1 ring-indigo-500/50"
                    : isUnlocked
                      ? "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                      : "bg-zinc-950/30 border-zinc-900 opacity-60"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs ${cosmetic.colorClass} truncate`}>
                    {userStats.username || "Trader"}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {cosmetic.name}
                  </span>
                </div>

                {isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateStats) {
                        onUpdateStats((stats) => {
                          stats.nameColor = cosmetic.colorClass;
                          if (cosmetic.id === "black_swan") {
                            stats.blackSwanCosmetic = true;
                            stats.title = "🌌 Black Swan Sovereign";
                          }
                        });
                      }
                    }}
                    className={`px-3 py-1 text-[10px] font-black rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${
                      isEquipped
                        ? "bg-indigo-500 text-white border-indigo-400"
                        : "bg-zinc-850 hover:bg-zinc-750 text-zinc-300 border-zinc-700"
                    }`}
                  >
                    {isEquipped ? (
                      <>
                        <Check className="w-3 h-3" /> Equipped
                      </>
                    ) : (
                      "Equip"
                    )}
                  </button>
                ) : (
                  <span className="text-[9px] text-zinc-600 font-mono uppercase">
                    Locked
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
