import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  X,
  Plus,
  Minus,
  Briefcase,
  AlertTriangle,
  Zap,
  Percent,
  TrendingUp as ChartIcon,
  ShieldAlert,
} from "lucide-react";
import { MemeCoin, UserStats, PortfolioHolding } from "../types";
import CoinDetailsTab from "./CoinDetailsTab";

interface MarketTabProps {
  coins: MemeCoin[];
  userStats: UserStats;
  currentUser?: any;
  holdings: PortfolioHolding[];
  onTradeAction: (
    coinId: string,
    amountCoins: number,
    type: "BUY" | "SELL",
  ) => void;
  onDeleteOwnCoin: (coinId: string) => void;
  initialCoinId?: string | null;
}

export default function MarketTab({
  coins,
  userStats,
  currentUser,
  holdings,
  onTradeAction,
  onDeleteOwnCoin,
  initialCoinId,
}: MarketTabProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<MemeCoin | null>(null);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [tradeAmount, setTradeAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "marketCap" | "price" | "change24h" | "volume24h"
  >("marketCap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [tradePercentage, setTradePercentage] = useState<number | null>(null);

  // Sync selected coin from parent initialCoinId
  React.useEffect(() => {
    if (initialCoinId) {
      const match = coins.find((c) => c.id === initialCoinId);
      if (match) {
        setSelectedCoin(match);
      }
    }
  }, [initialCoinId, coins]);

  // Search & Filters
  const filteredCoins = coins
    .filter(
      (coin) =>
        coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "desc" ? valB - valA : valA - valB;
      }
      return 0;
    });

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getUserHolding = (coinId: string): number => {
    const holds = holdings.find((h) => h.coinId === coinId);
    return holds ? holds.amount : 0;
  };

  const handlePercentageClick = (percentage: number) => {
    if (!selectedCoin) return;
    setTradePercentage(percentage);

    if (tradeType === "BUY") {
      const maxCashToSpend = userStats.cash;
      const budget = maxCashToSpend * (percentage / 100);
      const coinCount = budget / selectedCoin.price;
      setTradeAmount(coinCount.toFixed(2));
    } else {
      const holds = getUserHolding(selectedCoin.id);
      const coinCount = holds * (percentage / 100);
      setTradeAmount(coinCount.toFixed(2));
    }
  };

  const handleExecuteTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(tradeAmount);
    if (!selectedCoin || isNaN(numericAmount) || numericAmount <= 0) return;

    onTradeAction(selectedCoin.id, numericAmount, tradeType);

    // Reset fields & modal
    setTradeAmount("");
    setTradePercentage(null);
    setSelectedCoin(null);
  };

  // SVG Chart drawer helper
  const drawSVGChartPath = (history: number[]) => {
    const validHistory = Array.isArray(history)
      ? history.map((n) => Number(n)).filter((n) => !isNaN(n) && isFinite(n))
      : [];
    if (validHistory.length <= 1) return "M 10 55 L 290 55";
    const maxVal = Math.max(...validHistory);
    const minVal = Math.min(...validHistory);
    const range = maxVal - minVal || (maxVal > 0 ? maxVal * 0.1 : 1);
    const width = 300;
    const height = 110;
    const padding = 10;

    const points = validHistory.map((val, idx) => {
      const denom = validHistory.length > 1 ? validHistory.length - 1 : 1;
      const x = padding + (idx / denom) * (width - padding * 2);
      const y =
        height - padding - ((val - minVal) / range) * (height - padding * 2);
      return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
    });

    return `M ${points.join(" L ")}`;
  };

  if (selectedCoin) {
    return (
      <CoinDetailsTab
        coin={selectedCoin}
        userStats={userStats}
        currentUser={currentUser}
        holdings={holdings}
        onTradeAction={onTradeAction}
        onBackToList={() => setSelectedCoin(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Search and stats bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search coin name or symbol (e.g. ATI)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-xs text-white focus:outline-none focus:border-rose-500/80 transition-all font-mono"
          />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase font-bold text-zinc-400 overflow-x-auto shrink-0 py-1">
          <span>Sort:</span>
          {(["marketCap", "price", "change24h", "volume24h"] as const).map(
            (field) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 transition-all capitalize cursor-pointer ${
                  sortBy === field
                    ? "bg-white/[0.12] text-rose-400 border-rose-500/50 font-extrabold shadow-sm"
                    : "glass-pill text-zinc-400 hover:text-white hover:bg-white/[0.08] border-white/10"
                }`}
              >
                {field === "marketCap"
                  ? "Market Cap"
                  : field === "change24h"
                    ? "24h Change"
                    : field === "volume24h"
                      ? "Volume"
                      : field}
                {sortBy === field && (
                  <ArrowUpDown
                    className={`w-3 h-3 ${sortOrder === "asc" ? "rotate-180" : ""}`}
                  />
                )}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Coins Market Table or List */}
      <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden select-none shadow-2xl">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left font-mono">
            <thead className="bg-white/[0.03] border-b border-white/[0.08] text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold">
              <tr>
                <th className="px-5 py-4">Meme Coin Details</th>
                <th className="px-5 py-4 text-right">Price</th>
                <th className="px-5 py-4 text-right">24h Change</th>
                <th className="px-5 py-4 text-right">Market Cap</th>
                <th className="px-5 py-4 text-right">Simulated Vol</th>
                <th className="px-5 py-4 text-right">Portfolio Holdings</th>
                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-white/[0.06] font-semibold text-zinc-300">
              {filteredCoins.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-zinc-400 text-xs font-mono"
                  >
                    No simulated meme coins found. Launch one!
                  </td>
                </tr>
              ) : (
                filteredCoins.map((coin) => {
                  const holds = getUserHolding(coin.id);
                  const isCreator = coin.creator === userStats.handle;

                  return (
                    <tr
                      key={coin.id}
                      className="hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Name Col */}
                      <td className="px-5 py-3.5 flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center text-xl shadow-inner ${coin.avatarBg}`}
                        >
                          {coin.avatarEmoji}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-white text-[13px] tracking-tight leading-none truncate overflow-ellipsis">
                              {coin.name}
                            </span>
                            {coin.isUserCreated && (
                              <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider scale-95 leading-none">
                                User
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1 leading-none">
                            <span className="font-bold text-zinc-300">
                              *{coin.symbol}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[100px]">
                              {coin.creatorName || coin.creator}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Price Col */}
                      <td className="px-5 py-3.5 text-right font-bold text-[13px]">
                        <span className="text-zinc-200">
                          $
                          {(Number(coin.price) || 0) >= 1000
                            ? `${((Number(coin.price) || 0) / 1000).toFixed(2)}K`
                            : (Number(coin.price) || 0) >= 1
                            ? (Number(coin.price) || 0).toFixed(2)
                            : (Number(coin.price) || 0) >= 0.01
                            ? (Number(coin.price) || 0).toFixed(4)
                            : (Number(coin.price) || 0).toFixed(6)}
                        </span>
                      </td>

                      {/* Change Col */}
                      <td className="px-5 py-3.5 text-right">
                        {(Number(coin.change24h) || 0) >= 0 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 inline-flex ml-auto text-[11px]">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />{" "}
                            +{(Number(coin.change24h) || 0).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 inline-flex ml-auto text-[11px]">
                            <TrendingDown className="w-3 h-3 text-rose-400" />{" "}
                            {(Number(coin.change24h) || 0).toFixed(1)}%
                          </span>
                        )}
                      </td>

                      {/* Marketcap Col */}
                      <td className="px-5 py-3.5 text-right font-medium text-zinc-300">
                        $
                        {(Number(coin.marketCap) || 0) >= 1000
                          ? `${((Number(coin.marketCap) || 0) / 1000).toFixed(1)}K`
                          : (Number(coin.marketCap) || 0).toFixed(0)}
                      </td>

                      {/* Volume Col */}
                      <td className="px-5 py-3.5 text-right text-zinc-400 font-medium">
                        $
                        {(Number(coin.volume24h) || 0) >= 1000
                          ? `${((Number(coin.volume24h) || 0) / 1000).toFixed(1)}K`
                          : (Number(coin.volume24h) || 0).toFixed(0)}
                      </td>

                      {/* Holdings Col */}
                      <td className="px-5 py-3.5 text-right">
                        {holds > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="font-extrabold text-teal-400">
                              {holds.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              Value: ${(holds * (Number(coin.price) || 0)).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono">
                          {isCreator ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => navigate(`/coin/${coin.id}`)}
                                className="font-black py-1.5 px-3 rounded-xl text-[10px] select-none tracking-widest uppercase transition-all glass-pill hover:bg-white/[0.12] text-zinc-200 hover:text-white border-white/10 hover:border-orange-500 cursor-pointer"
                              >
                                Trade
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteOwnCoin(coin.id);
                                }}
                                className="glass-pill hover:bg-rose-950/40 text-rose-300 hover:text-white font-black px-2.5 py-1.5 rounded-xl text-[10px] flex items-center gap-0.5 shadow-md uppercase tracking-widest border border-rose-500/30 cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`/coin/${coin.id}`)}
                              className="font-black py-1.5 px-3.5 rounded-xl text-[10px] select-none tracking-widest uppercase transition-all glass-pill hover:bg-white/[0.12] text-zinc-200 hover:text-white border-white/10 hover:border-rose-500 cursor-pointer"
                            >
                              Trade
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="block md:hidden divide-y divide-white/[0.06] font-mono">
          {filteredCoins.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-xs font-mono">
              No simulated meme coins found. Launch one!
            </div>
          ) : (
            filteredCoins.map((coin) => {
              const holds = getUserHolding(coin.id);
              const isCreator = coin.creator === userStats.handle;

              return (
                <div
                  key={coin.id}
                  className="p-3.5 flex items-center justify-between gap-2.5 hover:bg-white/[0.04] transition-colors"
                >
                  {/* Left: Avatar & info stacked */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl border border-white/20 flex items-center justify-center text-lg shrink-0 shadow-inner ${coin.avatarBg}`}
                    >
                      {coin.avatarEmoji}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-extrabold text-white text-[12.5px] tracking-tight truncate leading-none">
                          {coin.name}
                        </span>
                        {coin.isUserCreated && (
                          <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1 py-0.2 rounded font-mono font-bold uppercase tracking-wider scale-90 leading-none">
                            User
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-zinc-400 mt-1 leading-none">
                        <span className="font-bold text-zinc-300">
                          *{coin.symbol}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[70px]">
                          {coin.creatorName || coin.creator}
                        </span>
                      </div>
                      {holds > 0 && (
                        <div className="text-[9.5px] text-teal-400 mt-1 font-bold leading-none">
                          Holds:{" "}
                          {holds.toLocaleString("en-US", {
                            maximumFractionDigits: 1,
                          })}{" "}
                          ($
                          {(holds * (Number(coin.price) || 0)).toLocaleString("en-US", {
                            maximumFractionDigits: 1,
                          })}
                          )
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Price + Change */}
                  <div className="flex flex-col items-end text-right shrink-0">
                    <span className="text-zinc-200 text-[11.5px] font-bold">
                      $
                      {(Number(coin.price) || 0) >= 1000
                        ? `${((Number(coin.price) || 0) / 1000).toFixed(2)}K`
                        : (Number(coin.price) || 0) >= 1
                        ? (Number(coin.price) || 0).toFixed(2)
                        : (Number(coin.price) || 0) >= 0.01
                        ? (Number(coin.price) || 0).toFixed(4)
                        : (Number(coin.price) || 0).toFixed(6)}
                    </span>

                    <div className="mt-1">
                      {(Number(coin.change24h) || 0) >= 0 ? (
                        <span className="text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9.5px] flex items-center gap-0.5 inline-flex leading-none">
                          +{(Number(coin.change24h) || 0).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded text-[9.5px] flex items-center gap-0.5 inline-flex leading-none">
                          {(Number(coin.change24h) || 0).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Button */}
                  <div className="shrink-0 pl-1 font-mono">
                    {isCreator ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => navigate(`/coin/${coin.id}`)}
                          className="font-black py-1.5 px-2.5 rounded-xl text-[9px] select-none tracking-widest uppercase transition-all leading-none glass-pill hover:bg-white/[0.12] text-zinc-200 hover:text-white border-white/10 cursor-pointer"
                        >
                          Trade
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOwnCoin(coin.id);
                          }}
                          className="glass-pill hover:bg-rose-950/40 text-rose-300 hover:text-white font-black px-2 py-1.5 rounded-xl text-[9px] flex items-center gap-0.5 shadow-md uppercase tracking-widest leading-none border border-rose-500/30 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/coin/${coin.id}`)}
                        className="font-black py-1.5 px-3 rounded-xl text-[10px] select-none tracking-widest uppercase transition-all leading-none glass-pill hover:bg-white/[0.12] text-zinc-200 hover:text-white border-white/10 cursor-pointer"
                      >
                        Trade
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Trade Modal containing interactive chart and sliders! */}
      {selectedCoin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl relative animate-slide-up select-none border border-white/15">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 bg-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl border border-white/20 flex items-center justify-center text-2xl shadow-inner ${selectedCoin.avatarBg}`}
                >
                  {selectedCoin.avatarEmoji}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-[15px] leading-tight">
                    Trade {selectedCoin.name}
                  </h3>
                  <span className="text-xs font-mono text-zinc-400">
                    *{selectedCoin.symbol} • Created by {selectedCoin.creator}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCoin(null);
                  setTradeAmount("");
                  setTradePercentage(null);
                }}
                className="p-1 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inner scrollable content */}
            <div className="p-5 overflow-y-auto max-h-[80vh] flex flex-col gap-4">
              {/* Simulated Price Chart */}
              <div className="glass-card p-4 rounded-2xl flex flex-col gap-1 select-none border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-widest font-bold flex items-center gap-1.5">
                    <ChartIcon className="w-3.5 h-3.5 text-zinc-400" /> Price
                    Chart History
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    ${selectedCoin.price.toFixed(4)}
                  </span>
                </div>
                {/* SVG Live Render Chart */}
                <div className="h-28 mt-2 flex items-center justify-center relative">
                  <svg className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient
                        id="chartGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#f97316"
                          stopOpacity="0.25"
                        />
                        <stop
                          offset="100%"
                          stopColor="#f97316"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d={drawSVGChartPath(selectedCoin.history)}
                      fill="none"
                      stroke={
                        selectedCoin.change24h >= 0 ? "#10b981" : "#f43f5e"
                      }
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Trade Type Selection */}
              <div className="grid grid-cols-2 bg-white/[0.04] border border-white/10 p-1 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => {
                    setTradeType("BUY");
                    setTradeAmount("");
                    setTradePercentage(null);
                  }}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                    tradeType === "BUY"
                      ? "bg-emerald-600 text-white shadow-lg border border-white/20"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Buy {selectedCoin.symbol}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeType("SELL");
                    setTradeAmount("");
                    setTradePercentage(null);
                  }}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                    tradeType === "SELL"
                      ? "bg-rose-600 text-white shadow-lg border border-white/20"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Sell {selectedCoin.symbol}
                </button>
              </div>

              {/* Balances summary */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="glass-card p-3 rounded-xl flex flex-col border border-white/10">
                  <span className="text-[9px] text-zinc-400 uppercase">
                    Cash Reserve
                  </span>
                  <span className="font-extrabold text-white mt-0.5">
                    $
                    {userStats.cash.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="glass-card p-3 rounded-xl flex flex-col border border-white/10">
                  <span className="text-[9px] text-zinc-400 uppercase">
                    Holdings Amount
                  </span>
                  <span className="font-extrabold text-zinc-200 mt-0.5">
                    {getUserHolding(selectedCoin.id).toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleExecuteTrade}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1 font-mono">
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                    Amount (*{selectedCoin.symbol})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={tradeAmount}
                      onChange={(e) => {
                        setTradeAmount(e.target.value);
                        setTradePercentage(null);
                      }}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-rose-500 font-mono tracking-wide"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold uppercase tracking-wider">
                      {selectedCoin.symbol}
                    </div>
                  </div>
                </div>

                {/* Shorthand percentage buttons */}
                <div className="grid grid-cols-4 gap-2 font-mono text-xs font-bold uppercase">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => handlePercentageClick(percent)}
                      className={`py-2 rounded-xl border text-[11px] transition-all cursor-pointer ${
                        tradePercentage === percent
                          ? "bg-white/[0.15] text-rose-400 border-rose-500/50 font-extrabold shadow-sm"
                          : "glass-pill border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                {/* Estimate total Cost / Return */}
                {tradeAmount && Number(tradeAmount) > 0 ? (
                  <div className="glass-card p-3 rounded-xl border border-white/10 font-mono text-xs flex flex-col gap-1 select-none">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Estimate Price</span>
                      <span className="text-zinc-200 font-extrabold">
                        ${selectedCoin.price.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1 mt-1 font-bold">
                      <span className="text-zinc-300">
                        {tradeType === "BUY"
                          ? "Estimated cost"
                          : "Estimated returns"}
                      </span>
                      <span
                        className={
                          tradeType === "BUY"
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }
                      >
                        ${(Number(tradeAmount) * selectedCoin.price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Submit button */}
                <button
                  type="submit"
                  className={`w-full py-3.5 rounded-xl font-bold text-xs select-none uppercase tracking-widest text-white shadow-xl transition-all border border-white/20 cursor-pointer active:scale-98 ${
                    tradeType === "BUY"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/20"
                      : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-red-950/20"
                  }`}
                >
                  Confirm {tradeType === "BUY" ? "Purchase" : "Sale"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
