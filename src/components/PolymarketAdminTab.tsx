import React, { useState, useEffect, useMemo } from "react";
import { Query } from "appwrite";
import { databases } from "../appwrite";
import { toast } from "sonner";
import { CheckCircle, XCircle, Ban, Activity, Clock, Globe } from "lucide-react";
import { SkeletonLoader } from "./SkeletonLoader";
import { formatToDeviceTimezone, getDeviceTimezoneInfo } from "../utils/timezone";
import { apiAdminResolveMarket, apiGetPolymarkets } from "../api/gameClient";
import { formatErrorMessage } from "../utils/formatError";

export default function PolymarketAdminTab({
  markets: propMarkets,
  setMarkets: setPropMarkets,
}: {
  markets?: any[];
  setMarkets?: React.Dispatch<React.SetStateAction<any[]>>;
} = {}) {
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
  const deviceTz = useMemo(() => getDeviceTimezoneInfo(), []);

  useEffect(() => {
    if (Array.isArray(propMarkets) && propMarkets.length > 0 && markets.length === 0) {
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

  const executePayouts = async (marketId: string, winningChoice: string) => {
    try {
      setResolving(marketId);
      const choice = winningChoice as "YES" | "NO" | "CANCEL";
      const res = await apiAdminResolveMarket(marketId, choice);
      toast.success(
        `Market resolved (${choice}). Paid $${(res.totalPaidOut || 0).toLocaleString()} across ${res.winnersCount || 0} wagers.`
      );
      setMarkets((prev) => prev.filter((m) => (m.$id || m.id) !== marketId));
      if (setPropMarkets) {
        setPropMarkets((prev) =>
          prev.map((m) =>
            (m.$id || m.id) === marketId
              ? { ...m, status: "closed", resolved: true, resolvedOutcome: choice === "CANCEL" ? null : choice, resolvedAt: new Date().toISOString() }
              : m
          )
        );
      }
    } catch (error: any) {
      console.error("Failed to resolve market", error);
      toast.error(formatErrorMessage(error, "Failed to resolve market."));
    } finally {
      setResolving(null);
    }
  };

  const handleResolve = async (marketId: string, choice: string) => {
    setResolving(marketId);
    await executePayouts(marketId, choice);
  };

  if (loading && markets.length === 0) return <SkeletonLoader type="dashboard" />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto w-full p-4">
      <div className="glass-panel border border-white/10 p-6 md:p-8 rounded-3xl shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl md:text-2xl font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-5 h-5 md:w-6 md:h-6" /> Polymarket Admin
            </h2>
            <p className="text-xs md:text-sm text-zinc-400 font-mono max-w-xl leading-relaxed mt-1">
              Resolve active Polymarket predictions. Resolving will automatically distribute simulated payouts to wagerers and close the market in Appwrite.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-2">
              <Globe className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                Displaying in your device timezone: <strong className="text-white font-bold">{deviceTz.formattedName}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {markets.length === 0 ? (
          <div className="glass-card border border-white/10 p-8 rounded-3xl text-center text-zinc-500 font-mono text-xs uppercase shadow-sm">
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
                  className="glass-card border border-white/10 p-6 rounded-3xl flex flex-col gap-4 relative shadow-lg backdrop-blur-lg hover:border-white/20 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-extrabold text-base md:text-lg text-white leading-snug">
                        {qTitle || market.question}
                      </div>
                      {qDescription && (
                        <div className="text-xs text-zinc-400 font-normal mt-1 leading-relaxed">
                          {qDescription}
                        </div>
                      )}
                      <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5 mt-2.5">
                        <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Target: {formatToDeviceTimezone(targetDate, { includeTime: true, includeTz: true })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 font-mono uppercase font-bold bg-black/40 p-3 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-emerald-400 mb-0.5">Pool YES</span>
                      <span className="text-white text-sm">
                        ${poolYes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-rose-400 mb-0.5">Pool NO</span>
                      <span className="text-white text-sm">
                        ${poolNo.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <button
                      disabled={resolving === mId}
                      onClick={() => handleResolve(mId, "YES")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition-colors disabled:opacity-50 border border-emerald-400/30 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Resolve YES
                    </button>
                    <button
                      disabled={resolving === mId}
                      onClick={() => handleResolve(mId, "NO")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-extrabold uppercase rounded-xl text-[10px] tracking-widest transition-colors disabled:opacity-50 border border-rose-400/30 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Resolve NO
                    </button>
                  </div>

                  <button
                    disabled={resolving === mId}
                    onClick={() => handleResolve(mId, "CANCEL")}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 font-bold uppercase rounded-xl text-[9px] tracking-widest transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancel / Refund All
                  </button>

                  {resolving === mId && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-3xl flex items-center justify-center flex-col gap-2 shadow-inner border border-white/20 pointer-events-none z-10">
                      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent origin-center rounded-full animate-spin"></div>
                      <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase font-bold">
                        Resolving Payouts...
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
