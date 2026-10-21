import React, { useState } from "react";
import { Grid, Sparkles, TrendingUp, TrendingDown, Coins, Filter } from "lucide-react";
import { MemeCoin } from "../types";

interface TreemapProps {
  coins: MemeCoin[];
  onTradeCoin: (coinId: string) => void;
}

export default function TreemapTab({ coins = [], onTradeCoin }: TreemapProps) {
  const [filterMode, setFilterMode] = useState<"top8" | "top16" | "all">("top16");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort strictly by market cap descending
  const sortedCoins = [...(coins || [])].sort(
    (a, b) => (Number(b?.marketCap) || 0) - (Number(a?.marketCap) || 0)
  );

  const filteredCoins = sortedCoins
    .filter((coin) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        coin.name.toLowerCase().includes(q) ||
        coin.symbol.toLowerCase().includes(q)
      );
    })
    .slice(
      0,
      filterMode === "top8" ? 8 : filterMode === "top16" ? 16 : sortedCoins.length
    );

  const totalMarketCap = filteredCoins.reduce(
    (sum, c) => sum + (Number(c?.marketCap) || 0),
    0
  );

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in select-none">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-extrabold text-zinc-300 font-mono tracking-widest uppercase flex items-center gap-2 leading-none">
            <Grid className="text-rose-500 w-4 h-4" /> Market Cap Heatmap
          </h2>
          <span className="text-xs text-zinc-400 leading-none">
            Real-time market cap allocations and 24h price momentum. Sized by market share.
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search coin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input text-xs px-3 py-1.5 rounded-xl text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/50 w-36"
          />
          <div className="flex bg-zinc-900/80 p-0.5 rounded-xl border border-white/10 font-mono text-[11px]">
            <button
              onClick={() => setFilterMode("top8")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-bold ${
                filterMode === "top8" ? "bg-rose-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Top 8
            </button>
            <button
              onClick={() => setFilterMode("top16")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-bold ${
                filterMode === "top16" ? "bg-rose-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Top 16
            </button>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-bold ${
                filterMode === "all" ? "bg-rose-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Main Treemap flex blocks container */}
      <div className="glass-panel border border-white/10 p-5 rounded-3xl shadow-2xl flex flex-col gap-4">
        {/* Color Indicators Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase font-mono font-bold text-zinc-400 border-b border-white/5 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-400 rounded-sm" />
              Pump (+10%+)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-950 border border-emerald-800 rounded-sm" />
              Gain (0% to +10%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-950 border border-rose-800 rounded-sm" />
              Dip (-10% to 0%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-600 border border-rose-500 rounded-sm" />
              Dump (-10%-)
            </span>
          </div>

          <span className="text-zinc-400">
            Total Monitored Cap: <span className="text-white font-extrabold">{formatLargeNumber(totalMarketCap)}</span>
          </span>
        </div>

        {/* The Treemap Layout rendering */}
        <div className="min-h-[360px] grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-3 glass-card p-3 rounded-2xl border border-white/5">
          {filteredCoins.map((coin, idx) => {
            const safePrice = Number(coin?.price) || 0.000001;
            const safeChange = Number(coin?.change24h) || 0;
            const safeCap = Number(coin?.marketCap) || 1000;
            const pctCap = totalMarketCap > 0 ? (safeCap / totalMarketCap) * 100 : 5;

            // Generate size multipliers based on rank and relative market cap
            let colSpanClass = "col-span-1 md:col-span-2";
            if (idx === 0) colSpanClass = "col-span-2 sm:col-span-4 md:col-span-6 md:row-span-2";
            else if (idx === 1) colSpanClass = "col-span-2 sm:col-span-2 md:col-span-4 md:row-span-2";
            else if (idx === 2) colSpanClass = "col-span-2 sm:col-span-2 md:col-span-2";
            else if (idx === 3) colSpanClass = "col-span-2 sm:col-span-2 md:col-span-3";
            else if (idx === 4) colSpanClass = "col-span-2 sm:col-span-2 md:col-span-3";
            else if (pctCap > 15) colSpanClass = "col-span-2 sm:col-span-2 md:col-span-4";
            else if (pctCap > 8) colSpanClass = "col-span-2 sm:col-span-2 md:col-span-3";

            // Custom color classes matching price action changes
            let blockBg = "bg-zinc-900/80 border-zinc-800 text-zinc-300";
            if (safeChange >= 10) {
              blockBg = "bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-100 border-emerald-500/40";
            } else if (safeChange > 0) {
              blockBg = "bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border-emerald-800/30";
            } else if (safeChange >= -10) {
              blockBg = "bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 border-rose-800/30";
            } else {
              blockBg = "bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 border-rose-500/40";
            }

            return (
              <div
                key={coin.id}
                onClick={() => onTradeCoin(coin.id)}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-200 cursor-pointer text-xs font-mono font-bold leading-normal select-none shadow-sm hover:scale-[1.01] ${colSpanClass} ${blockBg}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-black leading-tight flex items-center gap-1.5 truncate">
                      <span>{coin.avatarEmoji || "🪙"}</span>
                      <span className="truncate">*{coin.symbol || "COIN"}</span>
                    </span>
                    <span className="text-[10px] leading-tight mt-0.5 opacity-70 truncate">
                      {coin.name || "Coin"}
                    </span>
                  </div>
                  <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded shrink-0 font-extrabold text-zinc-200">
                    {pctCap.toFixed(1)}%
                  </span>
                </div>

                <div className="flex justify-between items-end mt-3 pt-2 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[8.5px] uppercase opacity-60">
                      Cap: {formatLargeNumber(safeCap)}
                    </span>
                    <span className="font-extrabold text-[12px] tracking-tight text-white">
                      {formatPrice(safePrice)}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                      safeChange >= 0
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {safeChange > 0 ? "+" : ""}
                    {safeChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
