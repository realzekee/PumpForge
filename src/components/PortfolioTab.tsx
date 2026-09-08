import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Wallet,
  Send,
  Award,
  Coins,
  HelpCircle,
  History,
  X,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { SkeletonLoader } from "./SkeletonLoader";
import { UserStats, PortfolioHolding, MemeCoin } from "../types";

interface PortfolioProps {
  userStats: UserStats;
  holdings: PortfolioHolding[];
  coins: MemeCoin[];
  onUpdateStats: (updater: (stats: UserStats) => void) => void;
  onAddNotification: (
    title: string,
    msg: string,
    type: "info" | "achievement" | "trade" | "crash",
  ) => void;
  onUpdateHoldings?: (updater: (holdings: PortfolioHolding[]) => void) => void;
  onSendMoney?: (
    handle: string,
    amount: number,
    type: string,
  ) => Promise<{ success: boolean; message: string }>;
  registeredUsers?: (UserStats & { uid: string })[];
}

export default function PortfolioTab({
  userStats,
  holdings,
  coins,
  onUpdateStats,
  onAddNotification,
  onUpdateHoldings,
  onSendMoney,
  registeredUsers = [],
}: PortfolioProps) {
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendHandle, setSendHandle] = useState("");
  const [sendType, setSendType] = useState("cash"); // 'cash' or a coin ID
  const [sendAmount, setSendAmount] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!userStats || Object.keys(userStats).length === 0) {
    return <SkeletonLoader type="portfolio" />;
  }

  useEffect(() => {
    // Simulator loading pattern to match the video
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Calculate current holdings value (exclude list of inactive)
  const holdingsValue = (holdings || []).reduce((sum, h) => {
    const coin = (coins || []).find((c) => c && c.id === h.coinId);
    if (coin) {
      return sum + (Number(h.amount) || 0) * (Number(coin.price) || 0);
    }
    return sum;
  }, 0);

  const totalPortfolioValue = (Number(userStats?.cash) || 0) + holdingsValue;

  // Selected asset available balance
  const getSelectedAvailable = () => {
    if (sendType === "cash") {
      return Number(userStats?.cash) || 0;
    }
    if (sendType === "gems") {
      return Number(userStats?.gems) || 0;
    }
    const match = (holdings || []).find((h) => h && h.coinId === sendType);
    return match ? (Number(match.amount) || 0) : 0;
  };

  const handleMaxClick = () => {
    const val = getSelectedAvailable();
    setSendAmount(val.toFixed(2));
  };

  const handleSendCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(sendAmount);
    if (!sendHandle.trim() || isNaN(numericAmount) || numericAmount <= 0)
      return;

    const available = getSelectedAvailable();
    if (available < numericAmount) {
      alert("Insufficient assets in your reserves!");
      return;
    }

    if (onSendMoney) {
      const result = await onSendMoney(sendHandle, numericAmount, sendType);
      if (!result.success) {
        alert(result.message);
        return;
      }
    } else {
      // local only fallback if not provided
      if (sendType === "cash") {
        onUpdateStats((stats) => {
          stats.cash -= numericAmount;
        });
      } else if (sendType === "gems") {
        onUpdateStats((stats) => {
          stats.gems -= numericAmount;
        });
      } else {
        if (onUpdateHoldings) {
          onUpdateHoldings((prev) => {
            return prev
              .map((h) => {
                if (h.coinId === sendType) {
                  return {
                    ...h,
                    amount: Math.max(0, h.amount - numericAmount),
                  };
                }
                return h;
              })
              .filter((h) => h.amount > 0);
          });
        }
      }
    }

    if (sendType === "cash") {
      onAddNotification(
        "Funds Sent",
        `Sent $${numericAmount.toLocaleString()} cash to @${sendHandle.replace("@", "")}`,
        "info",
      );
      setSuccessMsg(
        `💸 Sent $${numericAmount.toLocaleString("en-US")} cash to @${sendHandle.replace("@", "")}!`,
      );
    } else if (sendType === "gems") {
      onAddNotification(
        "Gems Sent",
        `Sent 💎 ${numericAmount.toLocaleString()} gems to @${sendHandle.replace("@", "")}`,
        "achievement",
      );
      setSuccessMsg(
        `💎 Sent ${numericAmount.toLocaleString("en-US")} gems to @${sendHandle.replace("@", "")}!`,
      );
    } else {
      const coin = (coins || []).find((c) => c && c.id === sendType);
      const symbol = coin ? coin.symbol : sendType.toUpperCase();

      onAddNotification(
        "Coins Transferred",
        `Sent ${numericAmount.toLocaleString()} *${symbol} to @${sendHandle.replace("@", "")}`,
        "info",
      );
      setSuccessMsg(
        `🪙 Sent ${numericAmount.toLocaleString()} *${symbol} to @${sendHandle.replace("@", "")}!`,
      );
    }

    // Reset fields
    setSendHandle("");
    setSendAmount("");
    setTimeout(() => {
      setSuccessMsg("");
      setShowSendModal(false);
    }, 2800);
  };

  if (loading) {
    return (
      <div
        className="flex-1 flex flex-col gap-6 select-none font-mono"
        id="portfolio-skeleton"
      >
        <div className="flex flex-col gap-1.5">
          <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-zinc-850 rounded animate-pulse mt-0.5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-zinc-900/30 border border-zinc-900/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-48 bg-zinc-900/10 border border-zinc-900/40 rounded-2xl animate-pulse mt-3" />
      </div>
    );
  }

  return (
    <div
      className="flex-col flex gap-6 animate-fade-in text-zinc-100 font-mono"
      id="portfolio-tab-view"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-rose-500 animate-pulse" />{" "}
            Portfolio
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your investments and transactions
          </p>
        </div>
        {/* Send Money button - styled pink/red to highlight action like video */}
        <button
          onClick={() => {
            setSuccessMsg("");
            setShowSendModal(true);
          }}
          className="bg-rose-600 hover:bg-rose-500 text-white font-black hover:brightness-110 px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/20 active:scale-98 transition-all shrink-0 cursor-pointer self-start sm:self-auto uppercase tracking-wide border border-rose-500"
        >
          <Send className="w-3.5 h-3.5" /> Send Money
        </button>
      </div>

      {/* Overview Balance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
        {/* Total portfolio net worth card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-2xl relative overflow-hidden group">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
              Total Portfolio Valuation
            </span>
            <span className="text-2xl font-black text-white mt-2 tracking-tight">
              $
              {totalPortfolioValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              Includes coin assets valued dynamically
            </span>
          </div>
          <div className="w-12 h-12 glass-card border border-white/10 rounded-2xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-rose-400" />
          </div>
        </div>

        {/* Liquid portion card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-2xl relative overflow-hidden group">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
              Cash Balance
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-2 tracking-tight">
              $
              {(Number(userStats?.cash) || 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              Liquid cash reserve
            </span>
          </div>
          <div className="w-12 h-12 glass-card border border-white/10 rounded-2xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* Assets holdings card */}
        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-2xl relative overflow-hidden group">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
              Coin Holdings Valuation
            </span>
            <span className="text-2xl font-black text-cyan-400 mt-2 tracking-tight">
              $
              {(holdingsValue || 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              {(holdings || []).length} active positions
            </span>
          </div>
          <div className="w-12 h-12 glass-card border border-white/10 rounded-2xl flex items-center justify-center">
            <Coins className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Asset table listings */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1 leading-none mt-2">
          <History className="w-4 h-4 text-rose-500 animate-pulse" /> Active
          Holdings Breakdown
        </h3>

        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden font-mono text-xs shadow-2xl">
          {(holdings || []).length === 0 ? (
            <div className="text-center py-12 px-4 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-card border border-white/10 flex items-center justify-center text-xl select-none">
                📁
              </div>
              <span className="text-xs text-zinc-300 font-extrabold">
                No coin holdings
              </span>
              <p className="text-[10px] text-zinc-400 max-w-xs leading-normal">
                You haven't invested in any coins yet. Start by buying existing
                coins on the Marketplace dashboard.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop view table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.04] border-b border-white/10 text-[9px] text-zinc-400 uppercase tracking-widest font-black leading-none">
                    <tr>
                      <th className="px-5 py-4">Meme Asset</th>
                      <th className="px-5 py-4 text-right">Balance quantity</th>
                      <th className="px-5 py-4 text-right">Avg cost basis</th>
                      <th className="px-5 py-4 text-right">Current Price</th>
                      <th className="px-5 py-4 text-right">Net Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-semibold text-zinc-300">
                    {(holdings || []).map((h) => {
                      const coin = (coins || []).find((c) => c && c.id === h.coinId);
                      if (!coin) return null;

                      const amount = Number(h.amount) || 0;
                      const avgBuyPrice = Number(h.avgBuyPrice) || Number(coin.price) || 0;
                      const totalCost = amount * avgBuyPrice;
                      const currentVal = amount * (Number(coin.price) || 0);
                      const valueDiff = currentVal - totalCost;

                      return (
                        <tr
                          key={h.coinId}
                          className="hover:bg-white/[0.04] transition-colors"
                        >
                          <td className="px-5 py-3.5 flex items-center gap-2.5">
                            <span className="text-lg">{coin.avatarEmoji || "🪙"}</span>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-white text-[13px] leading-tight">
                                {coin.name || "Coin"}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-bold mt-0.5 uppercase mb-1">
                                *{coin.symbol || "TOKEN"}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-extrabold text-zinc-200">
                            {amount.toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-zinc-400 text-xs">
                            ${avgBuyPrice.toFixed(4)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-zinc-300 text-xs">
                            ${(Number(coin.price) || 0).toFixed(4)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono">
                            <div className="flex flex-col items-end">
                              <span className="font-extrabold text-teal-400">
                                $
                                {currentVal.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              <span
                                className={`text-[10px] font-bold ${valueDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                              >
                                {valueDiff >= 0 ? "+" : ""}$
                                {valueDiff.toFixed(2)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View lists */}
              <div className="block sm:hidden divide-y divide-white/10">
                {(holdings || []).map((h) => {
                  const coin = (coins || []).find((c) => c && c.id === h.coinId);
                  if (!coin) return null;

                  const amount = Number(h.amount) || 0;
                  const avgBuyPrice = Number(h.avgBuyPrice) || Number(coin.price) || 0;
                  const totalCost = amount * avgBuyPrice;
                  const currentVal = amount * (Number(coin.price) || 0);
                  const valueDiff = currentVal - totalCost;

                  return (
                    <div
                      key={h.coinId}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-lg shrink-0">
                          {coin.avatarEmoji || "🪙"}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-extrabold text-white text-[12px] leading-tight truncate">
                            {coin.name || "Coin"}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-bold mt-0.5 uppercase">
                            *{coin.symbol || "TOKEN"}
                          </span>
                          <div className="text-[9.5px] text-zinc-400 mt-1 leading-none font-medium">
                            Qty:{" "}
                            <span className="font-extrabold text-zinc-200">
                              {amount.toLocaleString("en-US", {
                                maximumFractionDigits: 1,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end text-right shrink-0 font-mono">
                        <div className="text-[9px] text-zinc-400">
                          Avg:{" "}
                          <span className="font-extrabold">
                            ${avgBuyPrice.toFixed(4)}
                          </span>
                        </div>
                        <div className="text-[12px] font-extrabold text-teal-400 mt-0.5">
                          $
                          {currentVal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`text-[9.5px] font-bold ${valueDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                          >
                            {valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pop-up Transfer Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-modal p-6 rounded-3xl max-w-sm w-full relative select-none animate-slide-up shadow-2xl">
            <button
              onClick={() => {
                setShowSendModal(false);
                setSuccessMsg("");
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-widest mb-1 select-none flex items-center gap-1.5 text-zinc-100">
              <Send className="w-4 h-4 text-rose-500 animate-pulse" /> Send
            </h3>
            <p className="text-xs text-zinc-400 italic font-mono font-medium leading-normal mb-4">
              Send cash or coins to another user
            </p>

            {successMsg ? (
              <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold p-4 rounded-2xl text-center flex items-center justify-center gap-2 text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span>{successMsg}</span>
              </div>
            ) : (
              <form
                onSubmit={handleSendCash}
                className="flex flex-col gap-3.5 font-mono text-xs"
              >
                {/* Recipient */}
                <div className="flex flex-col gap-1.5 flex-1 w-full">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                    Recipient
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter username (without @)"
                    value={sendHandle}
                    onChange={(e) => setSendHandle(e.target.value)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs focus:outline-none font-bold transition-all border ${
                      sendHandle.trim() === ""
                        ? "glass-input text-white focus:border-rose-500"
                        : registeredUsers.some(
                              (u) =>
                                u.handle.toLowerCase() ===
                                `@${sendHandle.replace("@", "").toLowerCase()}`,
                            )
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 focus:border-emerald-500"
                          : "bg-rose-500/15 border-rose-500/40 text-rose-300 focus:border-rose-500"
                    }`}
                  />
                  {sendHandle.trim() !== "" &&
                    !registeredUsers.some(
                      (u) =>
                        u.handle.toLowerCase() ===
                        `@${sendHandle.replace("@", "").toLowerCase()}`,
                    ) && (
                      <span className="text-[9px] text-rose-400 font-bold whitespace-nowrap">
                        Error: Target user does not exist in network.
                      </span>
                    )}
                </div>

                {/* Type Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                    Type
                  </label>
                  <select
                    className="glass-input px-3.5 py-2.5 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-rose-500 select-none cursor-pointer font-bold"
                    value={sendType}
                    onChange={(e) => {
                      setSendType(e.target.value);
                      setSendAmount("");
                    }}
                  >
                    <option value="cash" className="bg-zinc-950 text-white">Cash ($)</option>
                    <option value="gems" className="bg-zinc-950 text-white">Gems (💎)</option>
                    {(holdings || []).map((h) => {
                      const coin = (coins || []).find((c) => c.id === h.coinId);
                      return coin ? (
                        <option key={h.coinId} value={h.coinId} className="bg-zinc-950 text-white">
                          {coin.avatarEmoji} {coin.name} (*{coin.symbol})
                        </option>
                      ) : null;
                    })}
                  </select>
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                      Amount ({sendType === "cash" ? "$" : "Quantity"})
                    </label>
                    <button
                      type="button"
                      onClick={handleMaxClick}
                      className="text-[9px] glass-pill hover:bg-white/[0.12] border border-white/10 font-black tracking-widest uppercase px-2.5 py-1 rounded-lg text-rose-400 transition-colors cursor-pointer"
                    >
                      Max
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0.0001"
                      step="any"
                      placeholder="0.00"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-bold pr-14"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold uppercase tracking-widest text-[9px]">
                      {sendType === "cash"
                        ? "USD"
                        : (coins || []).find((c) => c && c.id === sendType)?.symbol ||
                          "TOKEN"}
                    </div>
                  </div>
                  {/* Dynamic Help details */}
                  <div className="flex flex-col gap-0.5 mt-0.5 text-[9px] text-zinc-400 font-medium">
                    <div className="flex justify-between items-center">
                      <span>Available:</span>
                      <span className="font-extrabold text-zinc-300">
                        {sendType === "cash"
                          ? `$${getSelectedAvailable().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${getSelectedAvailable().toLocaleString("en-US")} coin/token`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Minimum:</span>
                      <span className="font-extrabold text-zinc-300">
                        {sendType === "cash"
                          ? "$10.00 per transfer"
                          : "1.00 coin/token"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirm Actions */}
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black py-3 rounded-2xl shadow-xl border border-white/20 flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer transition-all active:scale-98 text-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendModal(false);
                      setSuccessMsg("");
                    }}
                    className="w-full glass-pill hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
