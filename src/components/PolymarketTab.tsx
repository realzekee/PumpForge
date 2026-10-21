import React, { useState } from "react";
import { PredictionMarket } from "../types";
import { CheckCircle, XCircle, Activity, Plus, Clock } from "lucide-react";
import LiquidGlassDatePicker from "./LiquidGlassDatePicker";
import {
  formatToDeviceTimezone,
  getRelativeTimeCountdown,
} from "../utils/timezone";
import { playSound } from "../utils/sound";

const getDefaultDateIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
};

export default function PolymarketTab({
  markets,
  onPlaceBet,
  onCreateMarket,
}: {
  markets: PredictionMarket[];
  onPlaceBet: (id: string, side: "YES" | "NO", amount: number) => Promise<void> | void;
  onCreateMarket: (market: any) => Promise<void> | void;
}) {
  const [betAmounts, setBetAmounts] = useState<{ [marketId: string]: string }>({});
  const [submittingMarketId, setSubmittingMarketId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newMarket, setNewMarket] = useState({
    question: "",
    description: "",
    endTime: getDefaultDateIso(),
  });

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const activeMarkets = markets.filter((m) => !m.resolved);
  const resolvedMarkets = markets.filter((m) => {
    if (!m.resolved) return false;
    const resolvedTime = new Date(m.resolvedAt || m.endDateIso || m.endTime || 0).getTime();
    if (resolvedTime <= 0) return true;
    return now - resolvedTime <= THREE_DAYS_MS;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    playSound("click");
    try {
      const finalDate = newMarket.endTime || getDefaultDateIso();
      await onCreateMarket({
        id: "m_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        question: newMarket.question,
        description: newMarket.description,
        yesPool: 0,
        noPool: 0,
        yesPercentage: 50,
        resolved: false,
        resolvedOutcome: null,
        endTime: finalDate,
        endDateIso: finalDate,
        category: "general",
      });
      setShowCreateModal(false);
      setNewMarket({ question: "", description: "", endTime: getDefaultDateIso() });
    } finally {
      setIsCreating(false);
    }
  };

  const handleBet = async (marketId: string, side: "YES" | "NO") => {
    if (submittingMarketId) return;
    const raw = betAmounts[marketId];
    const amt = Number(raw);
    if (amt > 0) {
      setSubmittingMarketId(marketId);
      try {
        await onPlaceBet(marketId, side, amt);
        setBetAmounts((prev) => ({ ...prev, [marketId]: "" }));
      } finally {
        setSubmittingMarketId(null);
      }
    }
  };

  const setPresetAmount = (marketId: string, val: number) => {
    playSound("click");
    setBetAmounts((prev) => ({ ...prev, [marketId]: val.toString() }));
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-full overflow-hidden animate-fade-in">
      {/* Calm Header Bar */}
      <div className="bg-[#141417] border border-white/[0.07] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" /> Hopium &amp; Predictions
          </h2>
          <p className="text-zinc-400 text-xs mt-0.5">
            Predict market outcomes and earn proportional pool payouts when resolved.
          </p>
        </div>
        <button
          onClick={() => {
            playSound("click");
            setNewMarket({ question: "", description: "", endTime: getDefaultDateIso() });
            setShowCreateModal(true);
          }}
          className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Question
        </button>
      </div>

      {/* Active Markets Grid */}
      <div className="flex flex-col gap-3">
        {activeMarkets.length === 0 ? (
          <div className="bg-[#141417] border border-white/[0.07] p-10 rounded-2xl text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <Activity className="w-6 h-6 opacity-40 text-zinc-600" />
            <span>No active prediction markets right now.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMarkets.map((market) => {
              const targetEnd = market.endDateIso || market.endTime || (market as any).endDate;
              const countdown = getRelativeTimeCountdown(targetEnd);
              const yesPool = Number(market.yesPool ?? (market as any).poolYes ?? 0);
              const noPool = Number(market.noPool ?? (market as any).poolNo ?? 0);
              const totalPool = yesPool + noPool;
              const yesPct = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : (market.yesPercentage ?? 50);
              const [cleanTitle, splitDesc] = String(market.question || "").split(" --- ");
              const displayDesc = market.description || splitDesc || "";

              return (
                <div
                  key={market.id}
                  className="bg-[#141417] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/[0.12] transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span>{countdown.text}</span>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Pool: ${totalPool.toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-white font-bold text-sm sm:text-base leading-snug">
                      {cleanTitle || market.question}
                    </h4>
                    {displayDesc && (
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {displayDesc}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-emerald-400 font-semibold">
                        YES {yesPct}% (${yesPool.toLocaleString()})
                      </span>
                      <span className="text-rose-400 font-semibold">
                        NO {100 - yesPct}% (${noPool.toLocaleString()})
                      </span>
                    </div>

                    <div className="w-full h-2 bg-rose-500/20 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.max(4, Math.min(96, yesPct))}%` }}
                      />
                    </div>
                  </div>

                  {/* Bet Controls */}
                  <div className="border-t border-white/[0.06] pt-3.5 flex flex-col gap-2.5">
                    {market.userBetSide && (
                      <div className="flex items-center justify-between bg-[#0e0e11] rounded-xl px-3 py-2 border border-white/[0.05] text-xs">
                        <span className="text-zinc-400">Your Wager</span>
                        <span className="font-bold text-white font-mono">
                          <span
                            className={
                              market.userBetSide === "YES"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {market.userBetSide}
                          </span>{" "}
                          &bull; ${(market.userBetAmount || 0).toLocaleString()}
                        </span>
                      </div>
                    )}

                    <input
                      type="number"
                      min="1"
                      placeholder="Bet amount ($)"
                      className="bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white w-full focus:border-emerald-500/50 outline-none font-mono"
                      value={betAmounts[market.id] || ""}
                      onChange={(e) =>
                        setBetAmounts({ ...betAmounts, [market.id]: e.target.value })
                      }
                    />

                    <div className="grid grid-cols-4 gap-1.5">
                      {[25, 100, 500, 1000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPresetAmount(market.id, preset)}
                          className="py-1 text-[11px] font-mono rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.05] transition cursor-pointer"
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        disabled={submittingMarketId === market.id}
                        onClick={() => handleBet(market.id, "YES")}
                        className="bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-300 font-semibold py-2 rounded-xl text-xs border border-emerald-500/30 transition active:scale-[0.99] cursor-pointer"
                      >
                        {submittingMarketId === market.id ? "..." : "Bet YES"}
                      </button>
                      <button
                        disabled={submittingMarketId === market.id}
                        onClick={() => handleBet(market.id, "NO")}
                        className="bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 text-rose-300 font-semibold py-2 rounded-xl text-xs border border-rose-500/30 transition active:scale-[0.99] cursor-pointer"
                      >
                        {submittingMarketId === market.id ? "..." : "Bet NO"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolved Markets */}
      {resolvedMarkets.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <h3 className="text-sm font-semibold text-zinc-400 px-1 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-zinc-500" /> Resolved ({resolvedMarkets.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedMarkets.map((market) => {
              const [cleanTitle, splitDesc] = String(market.question || "").split(" --- ");
              const displayDesc = market.description || splitDesc || "";
              return (
                <div
                  key={market.id}
                  className="bg-[#141417]/70 border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <h4 className="text-zinc-200 font-semibold text-sm leading-snug mb-1">
                      {cleanTitle || market.question}
                    </h4>
                    {displayDesc && (
                      <p className="text-xs text-zinc-500 line-clamp-2">{displayDesc}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                    <span className="text-[11px] text-zinc-500">
                      {formatToDeviceTimezone(market.endDateIso || market.endTime, { includeTime: false, includeTz: false })}
                    </span>
                    {market.resolvedOutcome === "YES" ? (
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg flex items-center gap-1 text-xs font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> YES
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-lg flex items-center gap-1 text-xs font-semibold">
                        <XCircle className="w-3.5 h-3.5" /> NO
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propose Market Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-[#141417] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl my-8">
            <div className="border-b border-white/[0.07] pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" /> New Prediction Question
              </h3>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">
                  Question
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Will *ROAD hit $150K market cap this week?"
                  className="bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-emerald-500/50"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">
                  Resolution Details
                </label>
                <input
                  type="text"
                  required
                  placeholder="How this question will be resolved..."
                  className="bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-emerald-500/50"
                  value={newMarket.description}
                  onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">
                  End Date &amp; Time
                </label>
                <LiquidGlassDatePicker
                  value={newMarket.endTime}
                  onChange={(isoString) => setNewMarket({ ...newMarket, endTime: isoString })}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
