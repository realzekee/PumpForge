import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiGetPublicUserProfile } from "../api/gameClient";
import {
  Award,
  Calendar,
  Coins,
  TrendingUp,
  Activity,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  BarChart3,
  Layers,
} from "lucide-react";
import PumpForgeLoadingScreen from "./PumpForgeLoadingScreen";

export default function PublicProfileTab() {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiGetPublicUserProfile(identifier)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load player profile.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [identifier]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <PumpForgeLoadingScreen
          variant="inline"
          message="Querying Authoritative Player Registry..."
          subMessage={`Resolving player dossier #${identifier}`}
        />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 max-w-2xl mx-auto py-20 px-4 text-center font-mono animate-fade-in text-white space-y-4">
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl">
          <h2 className="text-lg font-bold text-red-400">Player Dossier Not Found</h2>
          <p className="text-xs text-zinc-400 mt-1">
            {error || "The requested player ID or handle does not exist in the public directory."}
          </p>
        </div>
        <button
          onClick={() => navigate("/leaderboard")}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer"
        >
          Return to Leaderboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in font-sans">
      {/* Top Breadcrumb / Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>VERIFIED AUTHORITATIVE DOSSIER</span>
        </div>
      </div>

      {/* Profile Header (NO PROFILE PICTURE / PFP PER REQUIREMENT 13) */}
      <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm md:text-base font-mono font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-xl shadow-inner">
                PLAYER #{profile.playerId}
              </span>

              {profile.tradingStats?.prestigeLevel > 0 && (
                <span className="text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-xl">
                  PRESTIGE {profile.tradingStats.prestigeLevel}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
              {profile.username}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400">
              <span className="text-zinc-300 font-bold">{profile.handle}</span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
          </div>

          {/* Quick Badges showcase */}
          {profile.badges && profile.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 md:justify-end max-w-sm">
              {profile.badges.map((badge: string) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold shadow-lg"
                >
                  <Award className="w-3.5 h-3.5 text-rose-400" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trading Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 space-y-1 shadow-lg">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            Total Realized PnL
          </div>
          <div className={`text-xl md:text-2xl font-mono font-black ${
            (profile.tradingStats?.totalProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400"
          }`}>
            ${(profile.tradingStats?.totalProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 space-y-1 shadow-lg">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            Completed Trades
          </div>
          <div className="text-xl md:text-2xl font-mono font-black text-white">
            {(profile.tradingStats?.tradesCount || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 space-y-1 shadow-lg">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            Coins Created
          </div>
          <div className="text-xl md:text-2xl font-mono font-black text-amber-400">
            {profile.tradingStats?.coinsCreatedCount || profile.createdCoins?.length || 0}
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 space-y-1 shadow-lg">
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            Prestige Tier
          </div>
          <div className="text-xl md:text-2xl font-mono font-black text-purple-400">
            Level {profile.tradingStats?.prestigeLevel || 0}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Created Coins & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Created Coins */}
        <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Created Meme Coins ({profile.createdCoins?.length || 0})
              </h3>
            </div>
          </div>

          {!profile.createdCoins || profile.createdCoins.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono">
              No coins minted by this player yet.
            </div>
          ) : (
            <div className="space-y-2">
              {profile.createdCoins.map((coin: any) => (
                <Link
                  key={coin.id}
                  to={`/coin/${coin.id}`}
                  className="p-3.5 rounded-2xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-white/5 hover:border-rose-500/30 transition flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{coin.avatarEmoji || "🪙"}</span>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-rose-400 transition font-mono">
                        {coin.name}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        ${coin.symbol}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-white">
                      ${Number(coin.price || 0).toFixed(6)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      MCap: ${(Number(coin.marketCap) || 0).toLocaleString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Public Trades */}
        <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Recent Public Order History
              </h3>
            </div>
          </div>

          {!profile.recentTrades || profile.recentTrades.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono">
              No recorded trades in current window.
            </div>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {profile.recentTrades.map((t: any) => {
                const isBuy = t.type === "BUY";
                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isBuy
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {t.type}
                      </span>
                      <div>
                        <div className="font-bold text-white">{t.coinName || t.coinSymbol}</div>
                        <div className="text-[10px] text-zinc-500">
                          {new Date(t.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-zinc-200">
                        ${Number(t.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {Number(t.amount || 0).toLocaleString()} coins @ ${Number(t.price || 0).toFixed(6)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
