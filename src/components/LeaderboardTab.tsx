import React, { useState, useEffect } from "react";
import {
  Trophy,
  Award,
  Sparkles,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Crown,
  ShieldAlert,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";
import { UserStats, SimulatedPlayer } from "../types";
import { UserHoverCard } from "./UserHoverCard";
import { apiGetLeaderboard } from "../api/gameClient";

interface LeaderboardProps {
  userStats: UserStats;
  simulatedPlayers?: SimulatedPlayer[];
}

export default function LeaderboardTab({
  userStats,
  simulatedPlayers = [],
}: LeaderboardProps) {
  const [category, setCategory] = useState<"gains" | "prestige" | "trades" | "creations">("gains");
  const [serverLeaderboard, setServerLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async (cat: string) => {
    try {
      setLoading(true);
      const res = await apiGetLeaderboard(cat, 50);
      if (res.leaderboard && res.leaderboard.length > 0) {
        setServerLeaderboard(res.leaderboard);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(category);
    const timer = setInterval(() => fetchLeaderboard(category), 30000);
    return () => clearInterval(timer);
  }, [category]);

  // Combine user stats with simulated users as fallback or enhancement if server is empty
  const rawLeaderboardList = serverLeaderboard.length > 0
    ? serverLeaderboard.map((item) => ({
        name: item.name || item.username || item.handle || "Player",
        handle: item.handle || `@user${item.playerId || item.playerNumber || 1}`,
        profit: item.profit || item.totalProfit || 0,
        prestige: item.prestigeLevel || item.prestige || 0,
        tradesCount: item.tradesCount || 0,
        coinsCreatedCount: item.coinsCreatedCount || 0,
        playerNumber: item.playerId || item.playerNumber,
        nameColor: item.nameColor || "text-zinc-200",
        isUser: item.userId === userStats.uid || item.handle === userStats.handle,
        title: item.title || "Degen",
        isSuspended: item.isSuspended || false,
        isAdmin: item.isAdmin || false,
        badges: item.badges || [],
      }))
    : [
        {
          name: userStats.username,
          handle: userStats.handle,
          profit: userStats.totalProfit || 0,
          prestige: userStats.prestigeLevel,
          tradesCount: userStats.tradesCount || 1,
          coinsCreatedCount: userStats.coinsCreatedCount || 0,
          playerNumber: (userStats as any).playerNumber || 1,
          nameColor: userStats.nameColor,
          isUser: true,
          title: userStats.title,
          isSuspended: false,
          isAdmin:
            userStats.title.toLowerCase() === "owner" ||
            userStats.title.toLowerCase() === "admin",
          badges: [],
        },
        ...simulatedPlayers
          .filter((u) => u.handle !== userStats.handle)
          .map((u, i) => {
            const isZeke = u.handle === "@zeke";
            let finalNameColor = u.nameColor || "text-zinc-300";
            if (isZeke && !u.nameColor) {
              finalNameColor = "text-orange-400 font-extrabold text-glow";
            }

            return {
              name: u.name,
              handle: u.handle,
              profit: u.profit,
              prestige: u.prestige,
              tradesCount: 20 + i * 5,
              coinsCreatedCount: 1 + (i % 3),
              playerNumber: 2 + i,
              nameColor: finalNameColor,
              isUser: false,
              title: u.isAdmin
                ? "Admin"
                : u.title ||
                  (u.prestige >= 5
                    ? "Whale Dev"
                    : u.prestige >= 2
                      ? "Giga Trader"
                      : "Degen"),
              isSuspended: u.isSuspended,
              isAdmin: u.isAdmin,
              badges: [],
            };
          }),
      ].sort((a, b) => {
        if (category === "prestige") return b.prestige - a.prestige;
        if (category === "trades") return b.tradesCount - a.tradesCount;
        if (category === "creations") return b.coinsCreatedCount - a.coinsCreatedCount;
        return b.profit - a.profit;
      });

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-extrabold text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-1.5 leading-none">
            <Trophy className="text-orange-500 w-4 h-4" /> Official Hall of Fame Leaderboard
          </h2>
          <span className="text-xs text-zinc-500 leading-none">
            Server-verified competitive rankings. Banned or suspended accounts forfeit rank.
          </span>
        </div>

        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold p-1 bg-white/[0.04] border border-white/10 rounded-2xl shrink-0 overflow-x-auto">
          {[
            { id: "gains", label: "Top Gains", icon: TrendingUp },
            { id: "prestige", label: "Prestige Rank", icon: Crown },
            { id: "trades", label: "Most Active", icon: Activity },
            { id: "creations", label: "Top Creators", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = category === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 font-extrabold shadow-sm"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Table rows */}
      <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl font-mono">
        <div className="bg-white/[0.04] p-4 border-b border-white/10 flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
          <span>Rank & Player</span>
          <span className="text-right">
            {category === "prestige"
              ? "Prestige Level"
              : category === "trades"
              ? "Total Executed Trades"
              : category === "creations"
              ? "Coins Created"
              : "Net Realized Profit (USD)"}
          </span>
        </div>

        {loading && serverLeaderboard.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" /> Querying authenticated leaderboard rankings...
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {leaderboardList.map((player, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;

              return (
                <div
                  key={player.handle}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    player.isSuspended
                      ? "bg-rose-500/10 opacity-55 border-l-4 border-red-500/50 pr-3 pl-3"
                      : player.isUser
                        ? "bg-rose-500/15 border-l-4 border-rose-500 pr-3 pl-3"
                        : "hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Left col: Rank & User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border uppercase font-mono shadow-sm ${
                        player.isSuspended
                          ? "bg-red-500/20 border-red-500/40 text-red-400"
                          : rank === 1
                            ? "bg-amber-400 border-amber-300 text-amber-950 shadow-md shadow-amber-500/20"
                            : rank === 2
                              ? "bg-zinc-200 border-white text-zinc-900 shadow-md"
                              : rank === 3
                                ? "bg-amber-700 border-amber-600 text-white shadow-md"
                                : "glass-card border border-white/10 text-zinc-400"
                      }`}
                    >
                      {player.isSuspended ? "🚫" : isTop3 ? "🏆" : rank}
                    </div>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-2xl glass-card border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {player.isSuspended
                          ? "💀"
                          : player.handle === "@zeke"
                            ? "🧙"
                            : player.isUser
                              ? "💸"
                              : "🐒"}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <UserHoverCard userIdOrHandle={player.handle}>
                            <span
                              className={`text-xs truncate font-extrabold cursor-pointer hover:underline ${player.isSuspended ? "text-zinc-500 line-through" : player.nameColor}`}
                            >
                              {player.name}
                            </span>
                          </UserHoverCard>

                          {player.playerNumber && (
                            <span className="text-[9px] bg-white/[0.08] text-zinc-400 px-1.5 py-0.5 rounded font-mono font-bold">
                              #{player.playerNumber}
                            </span>
                          )}

                          {player.isUser && (
                            <span className="text-[9px] bg-rose-500/20 border border-rose-500/40 text-rose-300 px-1.5 py-0.5 rounded-full font-mono font-bold uppercase leading-none">
                              You
                            </span>
                          )}

                          {player.isAdmin && (
                            <span className="text-[9px] bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 px-1.5 py-0.5 rounded-full font-mono font-bold uppercase leading-none flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> ADMIN
                            </span>
                          )}

                          {player.title.toLowerCase() === "owner" && (
                            <span className="text-[9px] bg-rose-600/20 border border-rose-500/40 text-rose-300 px-1.5 py-0.5 rounded-full font-mono font-bold uppercase leading-none flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> OWNER
                            </span>
                          )}

                          {player.isSuspended && (
                            <span className="text-[9px] bg-red-500/20 border border-red-500/40 text-red-400 px-1.5 py-0.5 rounded-full font-mono font-bold uppercase leading-none">
                              SUSPENDED
                            </span>
                          )}

                          {player.prestige > 0 && !player.isSuspended && (
                            <span className="text-[10px] text-amber-400 font-bold glass-pill px-1.5 py-0.5 border border-amber-500/30 rounded-full leading-none flex items-center gap-0.5">
                              ⭐{player.prestige}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 leading-none">
                          <span>{player.handle}</span>
                          <span>•</span>
                          <span
                            className={`px-1.5 py-0.5 border rounded-md font-bold uppercase text-[9px] ${
                              player.isSuspended
                                ? "text-red-400 bg-red-500/10 border-red-500/20"
                                : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                            }`}
                          >
                            {player.isSuspended
                              ? "SUSPENDED PLAYER"
                              : player.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right col: Metric Value */}
                  <div className="text-right shrink-0">
                    <span
                      className={`font-black font-mono text-[13px] ${
                        player.isSuspended
                          ? "text-red-500 line-through opacity-70"
                          : category === "prestige"
                          ? "text-amber-400"
                          : category === "trades"
                          ? "text-cyan-400"
                          : category === "creations"
                          ? "text-purple-400"
                          : player.profit >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }`}
                    >
                      {player.isSuspended
                        ? "$0.00"
                        : category === "prestige"
                        ? `Prestige ${player.prestige}`
                        : category === "trades"
                        ? `${player.tradesCount.toLocaleString()} trades`
                        : category === "creations"
                        ? `${(player.coinsCreatedCount || 0).toLocaleString()} coins`
                        : `$${player.profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
