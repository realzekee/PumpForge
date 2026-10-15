import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { apiGetPublicUserProfile } from "../api/gameClient";
import { Shield, Award, TrendingUp, ExternalLink, RefreshCw } from "lucide-react";

interface UserHoverCardProps {
  userIdOrHandle: string;
  children: React.ReactNode;
  className?: string;
}

export const UserHoverCard: React.FC<UserHoverCardProps> = ({
  userIdOrHandle,
  children,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanIdentifier = (userIdOrHandle || "").replace(/^@/, "").trim();

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setIsOpen(true);
      if (!profile && cleanIdentifier) {
        setLoading(true);
        try {
          const data = await apiGetPublicUserProfile(cleanIdentifier);
          setProfile(data);
        } catch {
          // ignore error
        } finally {
          setLoading(false);
        }
      }
    }, 250);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="cursor-pointer hover:underline decoration-rose-500/50">
        {children}
      </span>

      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-0 mb-2 w-72 p-4 bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 text-left font-sans"
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
              <span className="text-[11px] font-mono">Loading profile card...</span>
            </div>
          ) : profile ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-black text-rose-400">
                      #{profile.playerId}
                    </span>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {profile.username}
                    </h4>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {profile.handle}
                  </div>
                </div>
                {profile.tradingStats?.prestigeLevel > 0 && (
                  <span className="text-[10px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                    P{profile.tradingStats.prestigeLevel}
                  </span>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-zinc-500 text-[10px]">TOTAL PROFIT</div>
                  <div className={`font-bold ${profile.tradingStats?.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ${(profile.tradingStats?.totalProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-zinc-500 text-[10px]">TRADES</div>
                  <div className="font-bold text-zinc-200">
                    {profile.tradingStats?.tradesCount || 0}
                  </div>
                </div>
              </div>

              {/* Badges */}
              {profile.badges && profile.badges.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    Server Badges
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {profile.badges.map((b: string) => (
                      <span
                        key={b}
                        className="text-[9px] font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <Award className="w-2.5 h-2.5 text-rose-400" />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Created Coins Count */}
              {profile.createdCoins && profile.createdCoins.length > 0 && (
                <div className="text-[11px] font-mono text-zinc-400">
                  Created {profile.createdCoins.length} meme coin{profile.createdCoins.length > 1 ? "s" : ""}
                </div>
              )}

              {/* Link to Full Public Profile */}
              <div className="pt-1 border-t border-white/10">
                <Link
                  to={`/user/${profile.playerId || profile.handle?.replace(/^@/, "")}`}
                  className="flex items-center justify-between text-xs font-bold text-rose-400 hover:text-rose-300 transition"
                  onClick={() => setIsOpen(false)}
                >
                  <span>View Public Dossier</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-zinc-500 py-2 text-center">
              Player information unavailable.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
