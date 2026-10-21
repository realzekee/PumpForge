import React, { useState, useEffect } from "react";
import { Query } from "appwrite";
import { databases } from "../appwrite";
import { toast } from "sonner";
import { CheckCircle, XCircle, Ban, Activity, Clock } from "lucide-react";
import { SkeletonLoader } from "./SkeletonLoader";
import { formatToDeviceTimezone } from "../utils/timezone";
import { apiAdminResolveMarket, apiGetPolymarkets, apiAdminGrantBalance } from "../api/gameClient";
import { formatErrorMessage } from "../utils/formatError";
import { useAppContext } from "../context/AppContext";
import { playSound } from "../utils/sound";

export default function PolymarketAdminTab({
  markets: propMarkets,
  setMarkets: setPropMarkets,
  onUpdateStats,
}: {
  markets?: any[];
  setMarkets?: React.Dispatch<React.SetStateAction<any[]>>;
  onUpdateStats?: (updater: (stats: any) => void) => void;
} = {}) {
  const { userStats, setUserStats, setCash, userId } = useAppContext();
  const [markets, setMarkets] = useState<any[]>(() => {
    if (Array.isArray(propMarkets) && propMarkets.length > 0) {
      return propMarkets.filter((m: any) => m.status !== "closed" && !m.resolved);
    }
    try {
      const cached = localStorage.getItem("pumpforge_polymarkets");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((m: any) => m.status !== "closed" && !m.resolved);
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (Array.isArray(propMarkets) && propMarkets.length > 0) {
      setMarkets(propMarkets.filter((m: any) => m.status !== "closed" && !m.resolved));
    }
  }, [propMarkets]);

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      let list: any[] = [];
      let fetched = false;
      try {
        const apiRes = await apiGetPolymarkets();
        if (apiRes && Array.isArray(apiRes.polymarkets) && apiRes.polymarkets.length > 0) {
          list = apiRes.polymarkets.filter((m: any) => m.status !== "closed" && !m.resolved);
          fetched = true;
        }
      } catch (_err) {}

      if (!fetched) {
        try {
          const res = await databases.listDocuments("pumpforge", "polymarkets", [
            Query.notEqual("status", "closed"),
            Query.limit(100),
          ]);
          if (res?.documents && res.documents.length > 0) {
            list = res.documents.filter((m: any) => m.status !== "closed" && !m.resolved);
            fetched = true;
          }
        } catch (_dbErr) {}
      }

      if (fetched) {
        setMarkets(list);
      } else if (Array.isArray(propMarkets) && propMarkets.length > 0) {
        setMarkets(propMarkets.filter((m: any) => m.status !== "closed" && !m.resolved));
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const executePayouts = async (market: any, winningChoice: "YES" | "NO" | "CANCEL") => {
    const marketId = market.$id || market.id;
    try {
      setResolving(marketId);
      playSound("click");

      const poolYes = Number(market.poolYes ?? market.yesPool ?? 0);
      const poolNo = Number(market.poolNo ?? market.noPool ?? 0);
      const totalPool = poolYes + poolNo;

      // Check local userBets for this market
      let userBet: { side: "YES" | "NO"; amount: number } | undefined;
      try {
        const rawBets = localStorage.getItem("pumpforge_user_bets");
        if (rawBets) {
          const parsedBets = JSON.parse(rawBets);
          if (parsedBets && parsedBets[marketId]) {
            userBet = parsedBets[marketId];
          }
        }
      } catch {}
      if (!userBet && market.userBetSide && market.userBetAmount > 0) {
        userBet = { side: market.userBetSide, amount: Number(market.userBetAmount) };
      }

      // Check if already paid out locally
      let paidMarkets: Record<string, boolean> = {};
      try {
        const rawPaid = localStorage.getItem("pumpforge_paid_markets");
        if (rawPaid) paidMarkets = JSON.parse(rawPaid) || {};
      } catch {}

      let localPayout = 0;
      if (userBet && userBet.amount > 0 && !paidMarkets[marketId]) {
        if (winningChoice === "CANCEL") {
          localPayout = Number(userBet.amount);
        } else if (userBet.side === winningChoice) {
          const winningPool = winningChoice === "YES" ? poolYes : poolNo;
          if (winningPool > 0 && totalPool > 0) {
            const shareRatio = userBet.amount / winningPool;
            localPayout = Math.max(userBet.amount * 2, Math.floor(shareRatio * totalPool));
          } else {
            localPayout = userBet.amount * 2;
          }
        }
      }

      let res: any = null;
      try {
        res = await apiAdminResolveMarket(marketId, winningChoice, {
          userBet,
          poolYes,
          poolNo,
        });
      } catch (srvErr) {
        console.warn("Server market resolve fallback:", srvErr);
      }

      const finalUserPayout = Math.max(localPayout, Number(res?.callerPayout || 0));
      const totalPaidDisplay = Math.max(finalUserPayout, Number(res?.totalPaidOut || 0));
      const winnersCountDisplay = Math.max(finalUserPayout > 0 ? 1 : 0, Number(res?.winnersCount || 0));

      if (finalUserPayout > 0 && !paidMarkets[marketId]) {
        paidMarkets[marketId] = true;
        try {
          localStorage.setItem("pumpforge_paid_markets", JSON.stringify(paidMarkets));
        } catch {}

        const currentCash = Number(userStats?.cash ?? 5000);
        const nextCash =
          res?.userStats?.cash !== undefined && Number(res.userStats.cash) >= currentCash + finalUserPayout
            ? Number(res.userStats.cash)
            : Number((currentCash + finalUserPayout).toFixed(2));

        setCash(nextCash);
        setUserStats((prev: any) => {
          const updated = {
            ...prev,
            cash: nextCash,
            totalProfit: Number(((Number(prev?.totalProfit) || 0) + (winningChoice === "CANCEL" ? 0 : finalUserPayout - (userBet?.amount || 0))).toFixed(2)),
          };
          try {
            localStorage.setItem("pf_stats_updated_at", String(Date.now()));
            localStorage.setItem("cached_appwrite_stats", JSON.stringify(updated));
          } catch {}
          return updated;
        });

        if (onUpdateStats) {
          onUpdateStats((s) => {
            s.cash = nextCash;
          });
        }

        const uid = userId || "admin_realzekeee";
        apiAdminGrantBalance(uid, "set", "cash", nextCash).catch(() => {});
        playSound("win");
      } else {
        playSound("trade");
      }

      const resolvedIso = new Date().toISOString();
      setMarkets((prev) => prev.filter((m) => (m.$id || m.id) !== marketId));

      const updateMarketList = (list: any[]) =>
        list.map((m) =>
          (m.$id || m.id) === marketId
            ? {
                ...m,
                status: "closed",
                resolved: true,
                winningOutcome: winningChoice,
                resolvedOutcome: winningChoice === "CANCEL" ? null : winningChoice,
                resolvedAt: resolvedIso,
              }
            : m
        );

      if (setPropMarkets) {
        setPropMarkets((prev) => {
          const updated = updateMarketList(prev);
          try {
            localStorage.setItem("pumpforge_polymarkets", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } else {
        try {
          const cached = localStorage.getItem("pumpforge_polymarkets");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              localStorage.setItem("pumpforge_polymarkets", JSON.stringify(updateMarketList(parsed)));
            }
          }
        } catch {}
      }

      if (finalUserPayout > 0) {
        toast.success(
          `Resolved ${winningChoice}! You won +$${finalUserPayout.toLocaleString()} (Total paid: $${totalPaidDisplay.toLocaleString()})`
        );
      } else {
        toast.success(
          `Market resolved (${winningChoice}). Paid $${totalPaidDisplay.toLocaleString()} across ${winnersCountDisplay} wager(s).`
        );
      }
    } catch (error: any) {
      toast.error(formatErrorMessage(error, "Failed to resolve market."));
    } finally {
      setResolving(null);
    }
  };

  if (loading && markets.length === 0) return <SkeletonLoader type="dashboard" />;

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-5xl mx-auto w-full">
      <div className="bg-[#141417] border border-white/[0.07] p-5 sm:p-6 rounded-2xl">
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" /> Resolve Prediction Markets
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Select the winning outcome to close the market and immediately credit payouts to winning positions.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {markets.length === 0 ? (
          <div className="bg-[#141417] border border-white/[0.07] p-8 rounded-2xl text-center text-zinc-500 text-xs">
            No active markets pending resolution.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {markets.map((market) => {
              const mId = market.$id || market.id;
              const [qTitle, qDesc] = (market.question || "").split(" --- ");
              const qDescription = qDesc || market.description || "";
              const targetDate = market.endDate || market.endDateIso || market.endTime;
              const poolYes = Number(market.poolYes ?? market.yesPool ?? 0);
              const poolNo = Number(market.poolNo ?? market.noPool ?? 0);
              return (
                <div
                  key={mId}
                  className="bg-[#141417] border border-white/[0.07] p-5 rounded-2xl flex flex-col gap-4 relative"
                >
                  <div>
                    <div className="font-bold text-base text-white leading-snug">
                      {qTitle || market.question}
                    </div>
                    {qDescription && (
                      <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {qDescription}
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>Ends: {formatToDeviceTimezone(targetDate, { includeTime: true, includeTz: false })}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#0e0e11] p-3 rounded-xl border border-white/[0.05]">
                    <div className="flex flex-col">
                      <span className="text-emerald-400 text-[11px] font-medium">YES Pool</span>
                      <span className="text-white font-bold font-mono">
                        ${poolYes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-rose-400 text-[11px] font-medium">NO Pool</span>
                      <span className="text-white font-bold font-mono">
                        ${poolNo.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      disabled={resolving === mId}
                      onClick={() => executePayouts(market, "YES")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold rounded-xl text-xs transition-colors disabled:opacity-50 border border-emerald-500/30 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Resolve YES
                    </button>
                    <button
                      disabled={resolving === mId}
                      onClick={() => executePayouts(market, "NO")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold rounded-xl text-xs transition-colors disabled:opacity-50 border border-rose-500/30 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Resolve NO
                    </button>
                  </div>

                  <button
                    disabled={resolving === mId}
                    onClick={() => executePayouts(market, "CANCEL")}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-zinc-400 hover:text-zinc-200 font-medium rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" /> Refund All
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
