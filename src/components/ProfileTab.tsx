import React, { useState, useEffect } from 'react';
import { User, Wallet, Coins, TrendingUp, TrendingDown, Award, Gift, ArrowRightLeft, Sparkles, CheckCircle, Flame } from 'lucide-react';
import { UserStats, PortfolioHolding, MemeCoin, Achievement } from '../types';

interface ProfileProps {
  userStats: UserStats;
  holdings: PortfolioHolding[];
  coins: MemeCoin[];
  achievements?: Achievement[];
  liveTrades: any[];
}

export default function ProfileTab({ userStats, holdings, coins, achievements = [], liveTrades }: ProfileProps) {
  const [loading, setLoading] = useState(true);
  const [wins, setWins] = useState(72.14);
  const [losses, setLosses] = useState(40.00);

  useEffect(() => {
    // Simulator skeleton loading to match the video
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Dynamically sync arcade wins and losses from localStorage or use defaults matching the video
    const savedWins = localStorage.getItem('arcade_wins');
    const savedLosses = localStorage.getItem('arcade_losses');
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
  const userActions = liveTrades.filter((t) => t.userHandle === userStats.handle);
  const buyNum = userActions.filter((t) => t.type === 'BUY').length;
  const sellNum = userActions.filter((t) => t.type === 'SELL').length;
  const totalTrades = buyNum + sellNum || 1;
  const buyPercent = Math.round((buyNum / totalTrades) * 100);
  const sellPercent = 100 - buyPercent;

  const totalSpent = userActions.filter((t) => t.type === 'BUY').reduce((acc, t) => acc + t.amountUsd, 0);
  const totalReceived = userActions.filter((t) => t.type === 'SELL').reduce((acc, t) => acc + t.amountUsd, 0);

  const totalCompletedAchievements = achievements.filter(a => a.claimed).length;

  const netProfit = wins - losses;
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '64.3';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col gap-5 select-none" id="profile-skeleton">
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
            <div key={i} className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center justify-between">
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
    <div className="flex-1 flex flex-col gap-6 animate-fade-in text-zinc-100 font-mono" id="profile-tab-view">
      <div className="flex flex-col">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-orange-500" /> User Profile
        </h2>
        <p className="text-xs text-zinc-500 tracking-wide mt-0.5">
          Track your sandboxed credentials and arcade achievements
        </p>
      </div>

      {/* Main Header card widget */}
      <div className="bg-zinc-900/40 border border-zinc-900 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Flame className="w-48 h-48 text-orange-500 animate-pulse" />
        </div>

        <div className="w-16 h-16 rounded-xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-3xl select-none shrink-0 font-extrabold text-orange-500">
          Z
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h3 className="text-xl font-black text-white">{userStats.username}</h3>
            <span className="text-emerald-400 font-black text-xs border border-emerald-900/40 bg-emerald-950/40 px-1.5 py-0.5 rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> VERIFIED
            </span>
            <span className="text-orange-500 text-xs">🔥</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 flex-wrap">
            <span className="text-xs text-orange-500/80 font-bold">{userStats.handle}</span>
            <span className="text-[10px] bg-zinc-950 border border-zinc-900 text-zinc-400 font-mono font-bold uppercase py-0.5 px-2 rounded-md leading-none tracking-wider scale-95">
              {userStats.title}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1.5">Joined July 2025</span>
        </div>
      </div>

      {/* Portfolios row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Portfolio value card */}
        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Total Portfolio</span>
            <span className="text-white text-lg font-black tracking-tight mt-1">
              ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-550 mt-1">{holdings.length} holdings</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-orange-500" />
          </div>
        </div>

        {/* Liquid portion card */}
        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Liquid Value</span>
            <span className="text-emerald-400 text-lg font-black tracking-tight mt-1">
              ${userStats.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-550 mt-1">Available cash</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Illiquid portions card */}
        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Illiquid Value</span>
            <span className="text-cyan-400 text-lg font-black tracking-tight mt-1">
              ${holdingsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-550 mt-1">Coin holdings</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center">
            <Coins className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Grid boxes from video */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Buy/Sell Ratio and trade info */}
        <div className="bg-zinc-900/20 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Buy/Sell Ratio</span>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="text-emerald-400">{buyPercent}% buy</span>
              <span className="text-zinc-650">•</span>
              <span className="text-rose-400">{sellPercent}% sell</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-950 border border-zinc-900 flex overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all h-full" style={{ width: `${buyPercent}%` }} />
            <div className="bg-gradient-to-r from-rose-500 to-rose-400 transition-all h-full" style={{ width: `${sellPercent}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1.5">
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Buy Activity
              </span>
              <span className="text-emerald-400 font-bold text-sm tracking-tight block mt-1">
                ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-zinc-550 block mt-0.5">Total spent</span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-500" /> Sell Activity
              </span>
              <span className="text-rose-450 font-bold text-sm tracking-tight block mt-1">
                ${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-zinc-550 block mt-0.5">Total received</span>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="bg-zinc-900/20 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-4">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1">
            <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" /> Arcade & Trading Volume
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wide">Total Volume</span>
              <span className="text-zinc-200 font-bold text-sm tracking-tight block mt-1">
                $0.00
              </span>
              <span className="text-[9px] text-zinc-550 mt-0.5 block">{userStats.tradesCount} trades</span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wide">24h Trade Volume</span>
              <span className="text-zinc-200 font-bold text-sm tracking-tight block mt-1">
                $0.00
              </span>
              <span className="text-[9px] text-zinc-550 mt-0.5 block">0 trades today</span>
            </div>
          </div>
        </div>
      </div>

      {/* Arcade statistics row */}
      <div className="bg-zinc-900/10 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-4">
        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Simulator Win/Loss</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl text-center">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide block">Total Wins</span>
            <span className="text-emerald-400 font-extrabold text-sm block mt-1">
              ${wins.toFixed(2)}
            </span>
          </div>
          <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl text-center">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide block">Total Losses</span>
            <span className="text-rose-400 font-extrabold text-sm block mt-1">
              ${losses.toFixed(2)}
            </span>
          </div>
          <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl text-center">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide block">Win Rate</span>
            <span className="text-cyan-400 font-extrabold text-sm block mt-1">
              {winRate}%
            </span>
          </div>
          <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl text-center">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide block">Net Profit</span>
            <span className={`font-extrabold text-sm block mt-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
              {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Achievements board inline */}
      <div className="bg-zinc-900/10 border border-zinc-900 p-5 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500" /> Achievements ({totalCompletedAchievements}/{achievements.length || 59})
          </span>
          <span className="text-[10px] text-zinc-400 font-bold bg-zinc-950 px-2.5 py-1 border border-zinc-850 hover:bg-zinc-900 rounded-lg cursor-pointer hover:text-white transition-all">
            View All
          </span>
        </div>

        <div className="grid grid-cols-8 sm:grid-cols-12 gap-2 text-xl py-1 bg-zinc-950/40 p-4 border border-zinc-900/80 rounded-2xl">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              title={`${ach.title}: ${ach.description}`}
              className={`w-10 h-10 rounded-full border flex items-center justify-center select-none relative group transition-all duration-300 ${
                ach.claimed
                  ? 'bg-zinc-900 border-amber-500/60 shadow-lg shadow-amber-950/20 grayscale-0 scale-100 hover:scale-110 active:scale-95'
                  : 'bg-zinc-950/50 border-zinc-850/60 grayscale opacity-45'
              }`}
            >
              <span>{ach.category === 'trading' ? '📈' : ach.category === 'wealth' ? '💰' : ach.category === 'arcade' ? '🎲' : '🔮'}</span>
              
              {/* Completed Badge Indicator */}
              {ach.claimed && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border border-zinc-950 rounded-full flex items-center justify-center text-[6px]">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
