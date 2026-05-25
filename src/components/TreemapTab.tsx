import React from 'react';
import { Grid, Sparkles, MoveRight, Coins, AlertOctagon } from 'lucide-react';
import { MemeCoin } from '../types';

interface TreemapProps {
  coins: MemeCoin[];
  onTradeCoin: (coinId: string) => void;
}

export default function TreemapTab({ coins, onTradeCoin }: TreemapProps) {
  // Exclude crashed coins to keep visualization clean, or show them as black/collapsed rectangles
  const activeCoins = coins.slice(0, 8); // Display top 8 on the beautiful grid
  const totalMarketCap = activeCoins.reduce((sum, c) => sum + c.marketCap, 0);

  return (
    <div className="flex flex-col gap-5 animate-fade-in select-none">
      <div className="flex flex-col gap-1 bg-zinc-90 w-full mb-1">
        <h2 className="text-sm font-extrabold text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-1.5 leading-none">
          <Grid className="text-orange-500 w-4 h-4" /> Market Cap Treemap Allocation
        </h2>
        <span className="text-xs text-zinc-500 leading-none">
          Visual sizing representing coin marketcap weightings, with green/red hues displaying 24h change actions. Click blocks to trade!
        </span>
      </div>

      {/* Main Treemap flex blocks container */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
        {/* Color Indicators Legend */}
        <div className="flex items-center gap-4 text-[10px] uppercase font-mono font-bold text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-600 border border-emerald-500 rounded" /> Bullish Pump (+10% or more)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-950/65 border border-emerald-900/60 rounded" /> Slight gain (+0% to +10%)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-950/65 border border-rose-900/60 rounded" /> Slight Dip (-10% to 0%)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-650 border border-red-500 rounded" /> Deep Dump (-10% or lower)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-zinc-950 border border-zinc-900 rounded" /> crashed (0 cap)</span>
        </div>

        {/* The Treemap Layout rendering */}
        <div className="min-h-[300px] grid grid-cols-1 md:grid-cols-12 gap-2 pb-1 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-950">
          {activeCoins.map((coin, idx) => {
            const isDelisted = false;
            const pctCap = totalMarketCap > 0 && true ? (coin.marketCap / totalMarketCap) * 100 : 2;

            // Generate size multipliers based on Cap sizes
            let colSpanClass = 'md:col-span-3'; // default medium
            if (idx === 0) colSpanClass = 'md:col-span-6 md:row-span-2';
            else if (idx === 1) colSpanClass = 'md:col-span-4 md:row-span-2';
            else if (idx === 2) colSpanClass = 'md:col-span-2';
            else if (idx === 3) colSpanClass = 'md:col-span-3';

            // Custom color classes matching price action changes
            let blockBg = 'bg-zinc-900 border-zinc-800';
            if (isDelisted) {
              blockBg = 'bg-zinc-950 border-zinc-900 text-zinc-650 hover:bg-zinc-950';
            } else if (coin.change24h >= 20) {
              blockBg = 'bg-emerald-650 hover:bg-emerald-500 text-emerald-950 border-emerald-400';
            } else if (coin.change24h > 0) {
              blockBg = 'bg-emerald-950/65 hover:bg-emerald-900/60 text-emerald-300 border-emerald-900';
            } else if (coin.change24h >= -10) {
              blockBg = 'bg-rose-950/65 hover:bg-rose-900/60 text-rose-300 border-rose-900';
            } else {
              blockBg = 'bg-rose-650 hover:bg-rose-650 text-rose-50 border-rose-500';
            }

            return (
              <div
                key={coin.id}
                onClick={() => true && onTradeCoin(coin.id)}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-200 cursor-pointer text-xs font-mono font-bold leading-normal select-none ${colSpanClass} ${blockBg}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-black leading-none flex items-center gap-1">
                      {coin.avatarEmoji} *{coin.symbol}
                    </span>
                    <span className="text-[10px] leading-none mt-1 opacity-60">
                      {false ? 'Grave' : coin.name}
                    </span>
                  </div>
                  {true && (
                    <span className="text-[10px] bg-black/20 px-1 py-0.2 rounded">
                      {pctCap.toFixed(0)}%
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-end mt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase opacity-50">Price</span>
                    <span className="font-extrabold tracking-tight">
                      {false ? '$0' : `$${coin.price.toFixed(4)}`}
                    </span>
                  </div>
                  <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-black text-white">
                    {false ? 'crash' : `${coin.change24h > 0 ? '+' : ''}${coin.change24h.toFixed(1)}%`}
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
