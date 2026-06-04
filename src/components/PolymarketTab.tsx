import React, { useState } from "react";
import { PredictionMarket } from "../types";
import { Coins, CheckCircle, XCircle, Users, Activity, Plus } from "lucide-react";

export default function PolymarketTab({
  markets,
  onPlaceBet,
  onCreateMarket,
}: {
  markets: PredictionMarket[];
  onPlaceBet: (id: string, side: "YES" | "NO", amount: number) => void;
  onCreateMarket: (market: any) => void;
}) {
  const [betAmounts, setBetAmounts] = useState<{ [marketId: string]: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: "",
    description: "",
    endTime: "",
  });

  const activeMarkets = markets.filter((m) => !m.resolved);
  const resolvedMarkets = markets.filter((m) => m.resolved);

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
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 self-start md:self-auto border border-zinc-700 transition"
        >
          <Plus className="w-4 h-4" /> Propose Market
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-black text-white px-1">Active Markets</h3>
        {activeMarkets.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-2xl text-center text-zinc-500 font-mono">
            No active markets right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMarkets.map((market) => (
              <div key={market.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
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
                
                <div className="flex flex-col gap-1.5 mt-auto">
                  <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Users className="w-3 h-3 text-emerald-400"/> Pool YES: ${(market.yesPool || 0).toLocaleString()}</span>
                    <span>Pool NO: ${(market.noPool || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="w-full h-1.5 bg-rose-950 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${market.yesPercentage || 50}%` }} />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs font-black mt-1">
                    <span className="text-emerald-400">{market.yesPercentage}% YES</span>
                    <span className="text-rose-400">{100 - (market.yesPercentage || 50)}% NO</span>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 mt-2">
                  {market.userBetSide ? (
                    <div className="text-center bg-zinc-950 rounded-lg p-3 border border-zinc-800/60">
                      <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1.5">Your Position</div>
                      <div className="font-extrabold text-white">
                        <span className={market.userBetSide === "YES" ? "text-emerald-400" : "text-rose-400"}>
                           {market.userBetSide}
                        </span>
                        {" "} - ${market.userBetAmount.toLocaleString()}
                      </div>
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
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 font-bold py-2.5 rounded-lg text-xs"
                        >
                          Buy YES
                        </button>
                        <button
                          onClick={() => {
                            if (Number(betAmounts[market.id]) > 0) {
                              onPlaceBet(market.id, "NO", Number(betAmounts[market.id]));
                            }
                          }}
                          className="flex-1 bg-rose-600 hover:bg-rose-500 text-rose-50 font-bold py-2.5 rounded-lg text-xs"
                        >
                          Buy NO
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolvedMarkets.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <h3 className="text-lg font-black text-white px-1">Resolved Markets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resolvedMarkets.map((market) => (
              <div key={market.id} className="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-5 flex flex-col gap-4 opacity-75">
                <div>
                  <h4 className="text-white font-bold leading-tight line-clamp-2 mb-2">
                     {market.question}
                  </h4>
                  <div className="flex items-center gap-2 mt-4 font-black">
                     {market.resolvedOutcome === "YES" ? (
                       <div className="px-3 py-1.5 bg-emerald-950 border border-emerald-900 text-emerald-400 rounded flex items-center gap-2 text-xs">
                          <CheckCircle className="w-4 h-4"/> RESOLVED YES
                       </div>
                     ) : (
                       <div className="px-3 py-1.5 bg-rose-950 border border-rose-900 text-rose-400 rounded flex items-center gap-2 text-xs">
                          <XCircle className="w-4 h-4"/> RESOLVED NO
                       </div>
                     )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  placeholder="Additional context rules for resolving..."
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
