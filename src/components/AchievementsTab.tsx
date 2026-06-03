import React, { useState, useEffect } from "react";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Gift,
  HelpCircle,
  Flame,
  Star,
} from "lucide-react";
import { Achievement, UserStats } from "../types";
import { databases } from "../appwrite";
import { Query } from "appwrite";

interface AchievementsProps {
  achievements: Achievement[];
  userStats: UserStats;
  currentUser?: any;
  onClaimAchievement: (id: string) => void;
  onClaimAll: () => void;
}

export default function AchievementsTab({
  achievements,
  userStats,
  currentUser,
  onClaimAchievement,
  onClaimAll,
}: AchievementsProps) {
  const [localAchs, setLocalAchs] = useState<Achievement[]>(achievements);

  // Sync with prop changes just in case, but avoid overriding claimed manually
  useEffect(() => {
    setLocalAchs((prev) => 
       achievements.map(a => {
         const existing = prev.find(p => p.id === a.id);
         return { ...a, claimed: existing?.claimed || a.claimed };
       })
    );
  }, [achievements]);

  useEffect(() => {
    let active = true;
    const fetchAchs = async () => {
      const uid = currentUser?.$id || currentUser?.uid || userStats.uid;
      if (!uid) return;
      try {
        const res = await databases.listDocuments("pumpforge", "achievements", [
          Query.equal("userId", uid)
        ]);
        
        if (active) {
          setLocalAchs((prev) => prev.map(a => {
            const dbRef = res.documents.find(doc => doc.achievementId === a.id);
            if (dbRef) {
              return { ...a, claimed: dbRef.claimed, current: Math.max(a.current, dbRef.current || 0) };
            }
            return a;
          }));
        }
      } catch (err) {
        console.error("Failed to fetch achievements for tab", err);
      }
    };
    fetchAchs();
    return () => { active = false; };
  }, [currentUser, userStats.uid, achievements]);

  const handleClaim = (id: string) => {
    onClaimAchievement(id);
    setLocalAchs((prev) => prev.map(a => a.id === id ? { ...a, claimed: true } : a));
  };

  const handleClaimAll = () => {
    onClaimAll();
    setLocalAchs((prev) => prev.map(a => (a.current >= a.target && !a.claimed) ? { ...a, claimed: true } : a));
  };

  const claimedCount = localAchs.filter((a) => a.claimed).length;
  const claimableCount = localAchs.filter(
    (a) => a.current >= a.target && !a.claimed,
  ).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in select-none">
      {/* Interactive header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-90 w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-extrabold text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-1.5 leading-none">
            <Award className="text-orange-500 w-4 h-4" /> Lifetime Milestones &
            Achievements
          </h2>
          <span className="text-xs text-zinc-500 leading-none">
            Climb ranks and prove your meme trading expertise. Claim rewards to
            stack simulator cash and gems!
          </span>
        </div>

        {claimableCount > 0 ? (
          <button
            onClick={handleClaimAll}
            className="bg-emerald-655 hover:bg-emerald-500 active:scale-98 transition-all font-black text-white font-mono text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow border border-emerald-500 shrink-0 self-start"
          >
            <Gift className="w-4 h-4 animate-bounce" /> Claim All (
            {claimableCount})
          </button>
        ) : (
          <span className="text-[11px] font-mono font-bold text-zinc-600 bg-zinc-950/40 px-3 py-2 border border-zinc-900 rounded-lg shrink-0">
            No unclaimed rewards available
          </span>
        )}
      </div>

      {/* Progress display */}
      <div className="bg-zinc-900 border border-zinc-805 p-5 rounded-2xl select-none font-mono flex flex-col gap-3">
        <div className="flex justify-between items-center text-xs text-zinc-400 font-bold">
          <span>Global Achievements Progress</span>
          <span className="text-orange-400 font-extrabold text-sm">
            {claimedCount} / {achievements.length} claimed
          </span>
        </div>
        <div className="w-full bg-zinc-950 h-3.5 rounded-full overflow-hidden border border-zinc-900/60 p-0.5">
          <div
            className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-300 shadow shadow-orange-950"
            style={{ width: `${(claimedCount / achievements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Grid of milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(localAchs || []).map((item) => {
          const isComplete = item.current >= item.target;
          const pct = Math.min((item.current / item.target) * 100, 100);

          return (
            <div
              key={item.id}
              className={`border rounded-2xl p-4.5 flex items-center justify-between gap-4 transition-all ${
                item.claimed
                  ? "border-zinc-950 bg-zinc-950/20 opacity-60"
                  : isComplete
                    ? "bg-emerald-950/5/10 border-emerald-900"
                    : "border-zinc-955 bg-black/50 opacity-40 saturate-50"
              }`}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border ${
                      item.claimed
                        ? "bg-zinc-950 border-zinc-900 text-zinc-600"
                        : isComplete
                          ? "bg-emerald-950 border-emerald-900 text-emerald-400"
                          : "bg-zinc-900 border-zinc-800 text-orange-400"
                    }`}
                  >
                    {item.claimed ? "📁" : isComplete ? "✅" : "🎯"}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-extrabold text-white text-xs leading-tight truncate">
                      {item.title}
                    </span>
                    <span className="text-[10.5px] text-zinc-500 italic truncate mt-0.5">
                      {item.description}
                    </span>
                  </div>
                </div>

                {/* Progress metrics */}
                <div className="flex flex-col gap-1 font-mono text-[10px] mt-1 select-none">
                  <div className="flex justify-between text-zinc-400">
                    <span>
                      Progress: {item.current.toLocaleString()} /{" "}
                      {item.target.toLocaleString()}
                    </span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-zinc-400 h-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Rewards Claim area */}
              <div className="shrink-0 flex flex-col items-center gap-1.5 font-mono select-none">
                <div className="text-[9px] text-zinc-500 text-center flex flex-col">
                  <span className="text-emerald-400 font-bold">
                    +${item.cashReward.toLocaleString()}
                  </span>
                  <span className="text-cyan-400 font-bold">
                    💎 +{item.gemReward}
                  </span>
                </div>

                {item.claimed ? (
                  <span className="text-[9px] bg-zinc-950 text-zinc-650 px-2.5 py-1.5 border border-zinc-950 rounded-lg uppercase tracking-wider font-extrabold select-none">
                    Claimed
                  </span>
                ) : isComplete ? (
                  <button
                    onClick={() => handleClaim(item.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-1.5 px-3.5 rounded-xl text-[10px] uppercase tracking-wider transition-colors animate-pulse border border-emerald-500 text-glow"
                  >
                    Claim Reward
                  </button>
                ) : (
                  <span className="text-[9px] bg-zinc-950/60 text-zinc-550 border border-zinc-900/40 px-2 py-1 rounded select-none uppercase tracking-widest font-black opacity-40">
                    Locked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
