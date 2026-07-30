import React, { useState } from "react";
import { PredictionMarket } from "../types";
import { Coins, CheckCircle, XCircle, Users, Activity, Plus, Ban, ShieldAlert, TrendingUp, Loader2 } from "lucide-react";

export default function PolymarketTab({
  markets,
  onPlaceBet,
  onCreateMarket,
  onResolveMarket,
  isAdmin = false,
}: {
  markets: PredictionMarket[];
  onPlaceBet: (id: string, side: "YES" | "NO", amount: number) => void;
  onCreateMarket: (market: any) => void;
  onResolveMarket?: (id: string, outcome: "YES" | "NO" | "CANCEL") => Promise<void>;
  isAdmin?: boolean;
}) {
  const [betAmounts, setBetAmounts] = useState<{ [marketId: string]: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [newMarket, setNewMarket] = useState({
    question: "",
    description: "",
    endTime: "",
  });

  const activeMarkets = markets.filter((m) => !m.resolved);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateMarket({
      id: "m" + Math.random().toString(36).substring(7),
      question: newMarket.question,
      description: newMarket.description,
      yesPool: 0,
      noPool: 0,
      yesPercentage: 50,
      resolved: false,
      resolvedOutcome: null,
      endTime: newMarket.endTime || "TBD",
      category: "general",
    });
    setShowCreateModal(false);
    setNewMarket({ question: "", description: "", endTime: "" });
  };

  const handleResolve = async (marketId: string, outcome: "YES" | "NO" | "CANCEL") => {
    if (!onResolveMarket) return;
    const label = outcome === "CANCEL" ? "CANCEL & REFUND ALL" : `RESOLVE ${outcome}`;
    if (!window.confirm(`Are you sure you want to ${label}? This will distribute payouts and close the market.`)) return;
    setResolvingId(marketId);
    try {
      await onResolveMarket(marketId, outcome);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full animate-fade-in relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-rose-500 flex items-center gap-2">
            <Activity className="w-6 h-6" /> Polymarket Lobby
          </h2>
          <p className="text-zinc-400 text-sm max-w-xl">
            Forecast real outcomes based on community questions. Admins resolve the markets upon reaching their target dates. Your active bets will sync automatically.
          </p>
          {isAdmin && (
            <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-amber-950/40 border border-amber-900/50 rounded-lg w-fit">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 text-xs font-black uppercase tracking-widest">Admin Mode — Resolve Controls Active</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 self-start md:self-auto border border-zinc-700 transition"
        >
          <Plus className="w-4 h-4" /> Propose Market
        </button>
      </div>

      {/* Active Markets */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-black text-white px-1">Active Markets</h3>
        {activeMarkets.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-2xl text-center text-zinc-500 font-mono">
            No active markets right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMarkets.map((market) => {
              const totalPool = (market.yesPool || 0) + (market.noPool || 0);
              const isResolving = resolvingId === market.id;

              return (
                <div key={market.id} className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col gap-4 shadow-xl relative transition ${isAdmin ? "border-amber-900/40 hover:border-amber-800/60" : "border-zinc-800"}`}>
                  {/* Question */}
                  <div>
                    <h4 className="text-white font-extrabold leading-tight tracking-tight mb-2">
                      {market.question}
                    </h4>
                    <p className="text-xs text-zinc-400 font-medium">
                      {market.description}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mt-2">
                      Ends: {market.endTime}
                    </p>
                  </div>

                  {/* Pool Stats */}
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-emerald-400" />
                        YES: ${(market.yesPool || 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-rose-400" />
                        NO: ${(market.noPool || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-rose-950 rounded overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${market.yesPercentage || 50}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-xs font-black mt-1">
                      <span className="text-emerald-400">{market.yesPercentage}% YES</span>
                      <span className="text-zinc-600 text-[10px]">Total: ${totalPool.toLocaleString()}</span>
                      <span className="text-rose-400">{100 - (market.yesPercentage || 50)}% NO</span>
                    </div>
                  </div>

                  {/* Bet / Position Section */}
                  <div className="border-t border-zinc-800 pt-4 mt-2">
                    {market.userBetSide ? (
                      <div className="text-center bg-zinc-950 rounded-lg p-3 border border-zinc-800/60">
                        <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1.5">Your Position</div>
                        <div className="font-extrabold text-white">
                          <span className={market.userBetSide === "YES" ? "text-emerald-400" : "text-rose-400"}>
                            {market.userBetSide}
                          </span>
                          {" "} — ${market.userBetAmount.toLocaleString()}
                        </div>
                        {totalPool > 0 && (
                          <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                            Est. payout if correct: ${(
                              (market.userBetAmount / (market.userBetSide === "YES" ? (market.yesPool || 1) : (market.noPool || 1))) * totalPool
                            ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Bet amount..."
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white w-full focus:border-rose-500 outline-none"
                            value={betAmounts[market.id] || ""}
                            onChange={(e) => setBetAmounts({ ...betAmounts, [market.id]: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (Number(betAmounts[market.id]) > 0) {
                                onPlaceBet(market.id, "YES", Number(betAmounts[market.id]));
                              }
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 font-bold py-2.5 rounded-lg text-xs transition"
                          >
                            Buy YES
                          </button>
                          <button
                            onClick={() => {
                              if (Number(betAmounts[market.id]) > 0) {
                                onPlaceBet(market.id, "NO", Number(betAmounts[market.id]));
                              }
                            }}
                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-rose-50 font-bold py-2.5 rounded-lg text-xs transition"
                          >
                            Buy NO
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Admin Resolve Controls */}
                  {isAdmin && onResolveMarket && (
                    <div className="border-t border-amber-900/40 pt-4 flex flex-col gap-2">
                      <div className="text-[9px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <ShieldAlert className="w-3 h-3" /> Admin — Resolve Market
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={isResolving}
                          onClick={() => handleResolve(market.id, "YES")}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-900 text-emerald-400 font-extrabold uppercase rounded-lg text-[10px] tracking-widest transition disabled:opacity-50"
                        >
                          <CheckCircle className="w-3 h-3" /> Resolve YES
                        </button>
                        <button
                          disabled={isResolving}
                          onClick={() => handleResolve(market.id, "NO")}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-900 text-rose-400 font-extrabold uppercase rounded-lg text-[10px] tracking-widest transition disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" /> Resolve NO
                        </button>
                      </div>
                      <button
                        disabled={isResolving}
                        onClick={() => handleResolve(market.id, "CANCEL")}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold uppercase rounded-lg text-[9px] tracking-widest transition disabled:opacity-50"
                      >
                        <Ban className="w-3 h-3" /> Cancel / Refund All
                      </button>
                    </div>
                  )}

                  {/* Resolving overlay */}
                  {isResolving && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-col gap-2 z-10 pointer-events-none">
                      <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                      <span className="text-rose-400 font-mono text-[10px] uppercase font-black tracking-widest animate-pulse">Executing Payouts...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Market Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl">
            <h3 className="text-xl font-black text-rose-400 border-b border-zinc-800 pb-3">Propose Market</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Question (Yes/No)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Will users hit 100K today?"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-rose-500"
                  value={newMarket.question}
                  onChange={e => setNewMarket({...newMarket, question: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Information</label>
                <input
                  type="text"
                  required
                  placeholder="Additional context / rules for resolving..."
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-rose-500"
                  value={newMarket.description}
                  onChange={e => setNewMarket({...newMarket, description: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Resolution Date</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Friday 5PM EST"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-rose-500"
                  value={newMarket.endTime}
                  onChange={e => setNewMarket({...newMarket, endTime: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-lg"
                >
                  Propose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
