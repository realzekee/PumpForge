import React from 'react';
import { Trophy, Award, Sparkles, Sliders, ExternalLink, ShieldCheck, Crown, ShieldAlert } from 'lucide-react';
import { UserStats, SimulatedPlayer } from '../types';

interface LeaderboardProps {
  userStats: UserStats;
  simulatedPlayers?: SimulatedPlayer[];
}

export default function LeaderboardTab({ userStats, simulatedPlayers = [] }: LeaderboardProps) {
  // Combine user stats with simulated users from state
  const rawLeaderboardList = [
    {
      name: userStats.username,
      handle: userStats.handle,
      profit: userStats.totalProfit + (userStats.cash - 5000), // estimated net profit
      prestige: userStats.prestigeLevel,
      nameColor: userStats.nameColor,
      isUser: true,
      title: userStats.title,
      isSuspended: false,
      isAdmin: userStats.title.toLowerCase() === 'owner' || userStats.title.toLowerCase() === 'admin'
    },
    ...simulatedPlayers
      .filter((u) => u.handle !== userStats.handle)
      .map((u) => {
      const isZeke = u.handle === '@zeke';
      const isStonks = u.handle === '@stonks';
      
      let finalNameColor = u.nameColor || 'text-zinc-300';
      if (isZeke && !u.nameColor) {
        finalNameColor = 'text-orange-400 font-extrabold text-glow';
      }

      return {
        name: u.name,
        handle: u.handle,
        profit: u.profit,
        prestige: u.prestige,
        nameColor: finalNameColor,
        isUser: false,
        title: u.isAdmin ? 'Admin' : u.title || (u.prestige >= 5 ? 'Whale Dev' : u.prestige >= 2 ? 'Giga Trader' : 'Degen'),
        isSuspended: u.isSuspended,
        isAdmin: u.isAdmin
      };
    })
  ].sort((a, b) => b.profit - a.profit);

  // Deduplicate by handle
  const seenHandles = new Set<string>();
  const leaderboardList = rawLeaderboardList.filter((player) => {
    if (!player.handle) return false;
    if (seenHandles.has(player.handle)) {
      return false;
    }
    seenHandles.add(player.handle);
    return true;
  });

  return (
    <div className="flex flex-col gap-5 animate-fade-in select-none">
      <div className="flex flex-col gap-1.5 bg-zinc-90 w-full">
        <h2 className="text-sm font-extrabold text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-1.5 leading-none">
          <Trophy className="text-orange-500 w-4 h-4" /> Top delisters Leaderboard (24h)
        </h2>
        <span className="text-xs text-zinc-500 leading-none">
          Live dynamic sandbox rankings of elite players in the arena. Banned or suspended accounts lose operational permissions.
        </span>
      </div>

      {/* Leaderboard Table rows */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl font-mono">
        <div className="bg-zinc-950/80 p-4 border-b border-zinc-850 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
          <span>Rank & Player</span>
          <span className="text-right">Net simulated Profit (USD)</span>
        </div>

        <div className="flex flex-col divide-y divide-zinc-900">
          {leaderboardList.map((player, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;

            return (
              <div
                key={player.handle}
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  player.isSuspended 
                    ? 'bg-rose-950/5 opacity-55 border-l-4 border-red-500/40 pr-3 pl-3' 
                    : player.isUser
                      ? 'bg-orange-950/20 border-l-4 border-orange-500 pr-3 pl-3'
                      : 'hover:bg-zinc-950/25'
                }`}
              >
                {/* Left col: Rank & User */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 border uppercase font-mono ${
                      player.isSuspended
                        ? 'bg-red-950 border-red-900 text-red-500'
                        : rank === 1
                        ? 'bg-yellow-500 border-yellow-400 text-yellow-950 shadow-md shadow-yellow-950/20'
                        : rank === 2
                        ? 'bg-zinc-300 border-zinc-100 text-zinc-900 shadow-md'
                        : rank === 3
                        ? 'bg-amber-700 border-amber-600 text-white shadow-md'
                        : 'bg-zinc-950 border-zinc-900 text-zinc-400'
                    }`}
                  >
                    {player.isSuspended ? '🚫' : isTop3 ? '🏆' : rank}
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center text-lg shrink-0">
                      {player.isSuspended ? '💀' : player.handle === '@zeke' ? '🧙' : player.isUser ? '💸' : '🐒'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs truncate font-extrabold ${player.isSuspended ? 'text-zinc-500 line-through' : player.nameColor}`}>
                          {player.name}
                        </span>
                        
                        {player.isUser && (
                          <span className="text-[9px] bg-orange-950 border border-orange-900/60 text-orange-400 px-1 py-0.2 rounded font-mono font-bold uppercase leading-none scale-95">
                            You
                          </span>
                        )}

                        {player.isAdmin && (
                          <span className="text-[9px] bg-indigo-950 border border-indigo-900/40 text-indigo-400 px-1.5 py-0.2 rounded font-mono font-bold uppercase leading-none scale-95 flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" /> ADMIN
                          </span>
                        )}

                        {player.title.toLowerCase() === 'owner' && (
                          <span className="text-[9px] bg-red-950 border border-red-900/40 text-red-400 px-1.5 py-0.2 rounded font-mono font-bold uppercase leading-none scale-95 flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> OWNER
                          </span>
                        )}

                        {player.isSuspended && (
                          <span className="text-[9px] bg-red-500/15 border border-red-500/30 text-red-400 px-1 py-0.5 rounded font-mono font-bold uppercase leading-none scale-95">
                            SUSPENDED
                          </span>
                        )}

                        {player.prestige > 0 && !player.isSuspended && (
                          <span className="text-[10px] text-orange-400 font-bold bg-orange-950/40 px-1 border border-orange-900/40 rounded leading-none scale-95 flex items-center gap-0.5">
                            ⭐{player.prestige}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5 leading-none">
                        <span>{player.handle}</span>
                        <span>•</span>
                        <span className={`px-1 border rounded font-bold uppercase text-[9px] ${
                          player.isSuspended 
                            ? 'text-red-500 bg-red-950/20 border-red-950' 
                            : 'text-orange-505 bg-orange-950/10 border-orange-900/20'
                        }`}>
                          {player.isSuspended ? 'SUSPENDED PLAYER' : player.title}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right col: Net Profit */}
                <div className="text-right shrink-0">
                  <span className={`font-black font-mono text-[13px] ${
                    player.isSuspended 
                      ? 'text-red-500 line-through opacity-70' 
                      : player.profit >= 0 
                        ? 'text-emerald-400' 
                        : 'text-rose-450'
                  }`}>
                    {player.isSuspended ? '$0.00' : `$${player.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
