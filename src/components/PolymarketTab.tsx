import React, { useState, useMemo } from "react";
import { PredictionMarket } from "../types";
import { Coins, CheckCircle, XCircle, Users, Activity, Plus, TrendingUp, Clock, Globe } from "lucide-react";
import LiquidGlassDatePicker from "./LiquidGlassDatePicker";
import {
  formatToDeviceTimezone,
  getRelativeTimeCountdown,
  getDeviceTimezoneInfo,
} from "../utils/timezone";

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
  onPlaceBet: (id: string, side: "YES" | "NO", amount: number) => void;
  onCreateMarket: (market: any) => void;
}) {
  const [betAmounts, setBetAmounts] = useState<{ [marketId: string]: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const deviceTz = useMemo(() => getDeviceTimezoneInfo(), []);

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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const finalDate = newMarket.endTime || getDefaultDateIso();
    onCreateMarket({
      id: "m" + Math.random().toString(36).substring(7),
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
  };

  const handleBet = (marketId: string, side: "YES" | "NO") => {
    const raw = betAmounts[marketId];
    const amt = Number(raw);
    if (amt > 0) {
      onPlaceBet(marketId, side, amt);
      setBetAmounts((prev) => ({ ...prev, [marketId]: "" }));
    }
  };

  const setPresetAmount = (marketId: string, val: number) => {
    setBetAmounts((prev) => ({ ...prev, [marketId]: val.toString() }));
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full animate-fade-in relative">
      <div className="glass-panel border border-white/10 p-6 md:p-8 rounded-3xl relative overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="w-7 h-7 text-rose-500" /> Polymarket Lobby
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
              Wager on real community forecasts. All pools, bets, and market resolutions are stored permanently in Appwrite and sync across page reloads in real time.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-1">
              <Globe className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                All dates &amp; times automatically adjusted to your device's timezone:{" "}
                <strong className="text-white font-bold">{deviceTz.formattedName}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setNewMarket({ question: "", description: "", endTime: getDefaultDateIso() });
              setShowCreateModal(true);
            }}
            className="glass-button bg-rose-600/90 hover:bg-rose-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 self-start md:self-auto border border-rose-400/30 transition shadow-lg shadow-rose-950/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Propose Market
          </button>
        </div>
      </div>

      {/* Active Markets Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> Active Forecasts ({activeMarkets.length})
          </h3>
        </div>

        {activeMarkets.length === 0 ? (
          <div className="glass-card border border-white/10 p-12 rounded-3xl text-center text-zinc-500 font-mono flex flex-col items-center gap-3">
            <Activity className="w-8 h-8 opacity-40 text-zinc-600" />
            <span>No active prediction markets available right now.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMarkets.map((market) => {
              const countdown = getRelativeTimeCountdown(market.endDateIso || market.endTime);
              const formattedDate = formatToDeviceTimezone(market.endDateIso || market.endTime, {
                includeTime: true,
                includeTz: true,
              });

              return (
                <div
                  key={market.id}
                  className="glass-card border border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl hover:border-white/20 transition backdrop-blur-lg relative group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                        Active Prediction
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-zinc-300 font-mono flex items-center gap-1 text-right">
                          <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>Ends: {formattedDate}</span>
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            countdown.isUrgent
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : countdown.isExpired
                              ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {countdown.text}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-white font-extrabold text-base leading-snug tracking-tight mb-2">
                      {market.question}
                    </h4>
                    {market.description && (
                      <p className="text-xs text-zinc-400 font-medium line-clamp-2 leading-relaxed">
                        {market.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto pt-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Users className="w-3.5 h-3.5" /> Pool YES: ${(market.yesPool || 0).toLocaleString()}
                      </span>
                      <span className="text-rose-400">
                        Pool NO: ${(market.noPool || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Pool Progress Bar */}
                    <div className="w-full h-2 bg-rose-950/80 rounded-full overflow-hidden border border-white/5 flex">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(4, Math.min(96, market.yesPercentage || 50))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-black font-mono">
                      <span className="text-emerald-400">{market.yesPercentage}% YES</span>
                      <span className="text-rose-400">{100 - (market.yesPercentage || 50)}% NO</span>
                    </div>
                  </div>

                  {/* Bet Action or Existing Position */}
                  <div className="border-t border-white/10 pt-4 mt-1">
                    {market.userBetSide ? (
                      <div className="text-center bg-white/[0.04] rounded-2xl p-3.5 border border-white/10 backdrop-blur-md">
                        <div className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1 font-mono">
                          Your Active Position
                        </div>
                        <div className="font-black text-white text-sm">
                          <span
                            className={
                              market.userBetSide === "YES"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {market.userBetSide}
                          </span>{" "}
                          &bull; ${market.userBetAmount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          Locked &amp; synced with Appwrite
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Amount ($)..."
                            className="glass-input bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white w-full focus:border-rose-500 outline-none font-mono"
                            value={betAmounts[market.id] || ""}
                            onChange={(e) =>
                              setBetAmounts({ ...betAmounts, [market.id]: e.target.value })
                            }
                          />
                        </div>

                        {/* Quick Chips */}
                        <div className="flex gap-1.5">
                          {[25, 100, 500, 1000].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setPresetAmount(market.id, preset)}
                              className="flex-1 py-1 text-[10px] font-mono font-bold rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition"
                            >
                              +${preset}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleBet(market.id, "YES")}
                            className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs border border-emerald-400/30 transition shadow-md shadow-emerald-950/40 active:scale-95"
                          >
                            Buy YES
                          </button>
                          <button
                            onClick={() => handleBet(market.id, "NO")}
                            className="flex-1 bg-rose-600/90 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs border border-rose-400/30 transition shadow-md shadow-rose-950/40 active:scale-95"
                          >
                            Buy NO
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolved Markets */}
      {resolvedMarkets.length > 0 && (
        <div className="flex flex-col gap-4 mt-6">
          <h3 className="text-lg font-black text-white px-1 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-zinc-400" /> Resolved Predictions ({resolvedMarkets.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resolvedMarkets.map((market) => (
              <div
                key={market.id}
                className="glass-card border border-white/5 rounded-3xl p-6 flex flex-col gap-4 opacity-80 backdrop-blur-sm"
              >
                <div>
                  <h4 className="text-white font-bold leading-tight line-clamp-2 mb-2">
                    {market.question}
                  </h4>
                  {market.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2">{market.description}</p>
                  )}
                  <div className="text-[11px] text-zinc-500 font-mono mt-2">
                    Resolved Target: {formatToDeviceTimezone(market.endDateIso || market.endTime, { includeTime: true, includeTz: true })}
                  </div>
                  <div className="flex items-center gap-2 mt-3 font-black">
                    {market.resolvedOutcome === "YES" ? (
                      <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-2 text-xs font-mono">
                        <CheckCircle className="w-4 h-4" /> RESOLVED YES
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center gap-2 text-xs font-mono">
                        <XCircle className="w-4 h-4" /> RESOLVED NO
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Propose Market Modal with Liquid Glass Calendar UI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="glass-modal bg-zinc-950/95 border border-white/15 rounded-3xl w-full max-w-lg p-6 md:p-8 flex flex-col gap-5 shadow-2xl backdrop-blur-2xl my-8">
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-rose-400" /> Propose Prediction
              </h3>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider font-mono">
                  Question (Yes/No Forecast)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Will ETH break $4,000 this month?"
                  className="glass-input bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-rose-500"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider font-mono">
                  Context / Resolution Criteria
                </label>
                <input
                  type="text"
                  required
                  placeholder="Official resolution rules and data sources..."
                  className="glass-input bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-rose-500"
                  value={newMarket.description}
                  onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                />
              </div>

              {/* Liquid Glass Calendar & Time Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-300 font-bold uppercase tracking-wider font-mono flex items-center justify-between">
                  <span>Resolution Date &amp; Time</span>
                  <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Auto Device Clocks
                  </span>
                </label>
                
                <LiquidGlassDatePicker
                  value={newMarket.endTime}
                  onChange={(isoString) => setNewMarket({ ...newMarket, endTime: isoString })}
                />

                <p className="text-[11px] text-zinc-400 font-mono leading-relaxed mt-1">
                  Adjustable liquid glass calendar. All times adapt to the viewer’s local timezone automatically (US, Italy, Philippines, or any global region).
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl border border-rose-400/30 transition shadow-lg shadow-rose-950/50"
                >
                  Publish Market
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
