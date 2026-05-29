import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Layers,
  ArrowUpRight,
  Sparkles,
  Percent,
  Compass,
  Zap,
  CheckCircle,
  Clock
} from 'lucide-react';
import { MemeCoin, UserStats, PortfolioHolding } from '../types';

interface CoinDetailsTabProps {
  coin: MemeCoin | null;
  userStats: UserStats;
  holdings: PortfolioHolding[];
  onTradeAction: (coinId: string, amountCoins: number, type: 'BUY' | 'SELL') => void;
  onBackToList?: () => void;
}

// Default / Reference mock data when no dynamic token is selected
const DEFAULT_PRESET_COIN: MemeCoin = {
  id: 'roadman_revival_default',
  name: 'RoadmanRevival',
  symbol: 'ROADREV',
  creator: '🏛️ PDH (@pdh)',
  description: 'The definitive meme asset backing the PDH roadman lifestyle simulation.',
  avatarEmoji: '🏟️',
  avatarBg: 'bg-indigo-950/85 text-indigo-400 border-indigo-500/20',
  price: 5.73,
  marketCap: 5730,
  supply: 1000,
  volume24h: 31250,
  change24h: 0.03,
  history: [5.68, 5.70, 5.69, 5.71, 5.70, 5.72, 5.73]
};

// Top Holders simulation list matching visual requirements
const TOP_HOLDERS_SIMULATED = [
  { rank: 1, name: '🏛️ PDH', handle: '@pdh', weight: '50.1%', balance: '$2,870.73', emoji: '🏛️', bg: 'bg-amber-950 text-amber-400' },
  { rank: 2, name: 'Zeus Degen', handle: '@zeus_deg', weight: '15.4%', balance: '$882.42', emoji: '⚡', bg: 'bg-orange-950 text-orange-400' },
  { rank: 3, name: 'Chad Capital', handle: '@chadcap', weight: '10.2%', balance: '$584.46', emoji: '💪', bg: 'bg-emerald-950 text-emerald-400' },
  { rank: 4, name: 'Roadman Admin', handle: '@road_adm', weight: '8.5%', balance: '$487.05', emoji: '🕶️', bg: 'bg-rose-950 text-rose-400' },
];

export default function CoinDetailsTab({
  coin,
  userStats,
  holdings,
  onTradeAction,
  onBackToList
}: CoinDetailsTabProps) {
  // Use selected coin or fallback to reference preview
  const activeCoin = coin || DEFAULT_PRESET_COIN;

  // Interactivity and chart duration presets
  const [timeframe, setTimeframe] = useState('1m');
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);
  
  // Slide trade input execution panel
  const [activeTradeMode, setActiveTradeMode] = useState<'NONE' | 'BUY' | 'SELL'>('NONE');
  const [tradeAmountCoins, setTradeAmountCoins] = useState('');
  const [tradePercentage, setTradePercentage] = useState<number | null>(null);
  const [executingState, setExecutingState] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // User holdings query
  const userAssetHolding = useMemo(() => {
    const found = holdings.find((h) => h.coinId === activeCoin.id);
    return found ? found.amount : 0;
  }, [holdings, activeCoin.id]);

  // Handle transaction execute
  const handleExecuteTrade = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const numericAmt = parseFloat(tradeAmountCoins);
    if (isNaN(numericAmt) || numericAmt <= 0) {
      setFeedback({ type: 'error', msg: 'Please provide a valid token amount count.' });
      return;
    }

    if (activeTradeMode === 'BUY') {
      const totalCost = numericAmt * activeCoin.price;
      if (userStats.cash < totalCost) {
        setFeedback({ 
          type: 'error', 
          msg: `Insufficient cash reserve! You need $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} but only have $${userStats.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}.` 
        });
        return;
      }
    } else if (activeTradeMode === 'SELL') {
      if (userAssetHolding < numericAmt) {
        setFeedback({ 
          type: 'error', 
          msg: `Insufficient token balance! You own ${userAssetHolding.toFixed(2)} *${activeCoin.symbol} but attempted to sell ${numericAmt.toFixed(2)}.` 
        });
        return;
      }
    }

    setExecutingState(true);
    setTimeout(() => {
      try {
        onTradeAction(activeCoin.id, numericAmt, activeTradeMode as 'BUY' | 'SELL');
        setFeedback({ 
          type: 'success', 
          msg: `Successfully ${activeTradeMode === 'BUY' ? 'purchased' : 'sold'} ${numericAmt.toLocaleString()} *${activeCoin.symbol} tokens!` 
        });
        setTradeAmountCoins('');
        setTradePercentage(null);
        setTimeout(() => {
          setActiveTradeMode('NONE');
          setFeedback(null);
        }, 1800);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Transaction could not be verified by simulations.' });
      } finally {
        setExecutingState(false);
      }
    }, 800);
  };

  const setPercentOfMax = (percent: number) => {
    setTradePercentage(percent);
    if (activeTradeMode === 'BUY') {
      const cashBudget = userStats.cash * (percent / 100);
      const coinsToBuy = cashBudget / activeCoin.price;
      setTradeAmountCoins(coinsToBuy.toFixed(2));
    } else {
      const balanceToSell = userAssetHolding * (percent / 100);
      setTradeAmountCoins(balanceToSell.toFixed(2));
    }
  };

  // Generate interactive mock candlestick candles dataset based on tick prices
  const candlesData = useMemo(() => {
    const ticks = activeCoin.history && activeCoin.history.length > 5 
      ? activeCoin.history 
      : [5.68, 5.72, 5.69, 5.71, 5.70, 5.74, 5.73, 5.75, 5.72, 5.76];

    return ticks.map((tick, index) => {
      const prev = ticks[index - 1] || tick;
      const open = prev;
      const close = tick;
      const isUp = close >= open;
      
      const wiggle = activeCoin.price * 0.005;
      const high = Math.max(open, close) + (isUp ? wiggle : wiggle * 0.4);
      const low = Math.min(open, close) - (!isUp ? wiggle : wiggle * 0.4);
      const volume = Math.round(15000 + (tick * 2000) * (index + 1) % 40000);

      return {
        id: index,
        time: `${index + 1}m ago`,
        open,
        high,
        low,
        close,
        volume,
        isUp,
      };
    });
  }, [activeCoin]);

  return (
    <div className="w-full text-zinc-300 font-mono flex flex-col gap-6" id="coin-details-view-container">
      {/* Header section with Navigation controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900/50 pb-5">
        <div className="flex items-center gap-3">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors duration-200 cursor-pointer"
              title="Return to marketplace list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex flex-col">
            <h2 className="text-xs font-extrabold text-zinc-500 uppercase tracking-widest leading-none mb-1">
              PRO TRADING DESK
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400">Viewing asset profiles in simulation realm.</span>
            </div>
          </div>
        </div>

        {/* Live account stats indicator */}
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-900/80 rounded-2xl p-3 px-4 shadow-inner">
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-zinc-500 uppercase">Cash Reserve Balance</span>
            <span className="text-sm font-black text-emerald-450 font-mono tracking-tight">
              ${userStats.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-1.5 h-8 bg-zinc-800 rounded-full mx-1"></div>
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-zinc-500 uppercase">Owned *{activeCoin.symbol}</span>
            <span className="text-sm font-black text-white font-mono">
              {userAssetHolding.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Side (Header Details, Chart Core) & Right Side (Execution Dashboard, Pool Stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: 7 Column Grid containing Aesthetics + Candlestick Module */}
        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">

          {/* 1. Visual & Header Aesthetics Module */}
          <div className="bg-gradient-to-br from-zinc-90 w-full bg-zinc-900/60 border border-zinc-850 p-6 rounded-3xl relative overflow-hidden shadow-xl" id="token-head-metadata-card">
            
            {/* Pulsing Grid Glow BG */}
            <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
              
              {/* Asset Identity Avatar Flag */}
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl shadow-lg border-zinc-700/60 bg-zinc-950`}>
                  {activeCoin.avatarEmoji || '🌟'}
                </div>
                <div className="flex flex-col">
                  {/* Row showing live Badge & Ticker */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-white text-lg tracking-tight leading-none">
                      {activeCoin.name}
                    </span>
                    <span className="text-xs bg-zinc-950 text-zinc-400 font-bold border border-zinc-800 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">
                      *{activeCoin.symbol}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-extrabold flex items-center gap-1 uppercase tracking-widest animate-pulse">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                      LIVE
                    </span>
                  </div>

                  {/* Creator citation */}
                  <span className="text-[11px] text-zinc-500">
                    Created by <strong className="text-zinc-300 hover:text-orange-400 transition-colors">{activeCoin.creator || "🏛️ PDH (@pdh)"}</strong>
                  </span>
                </div>
              </div>

              {/* Action pricing blocks */}
              <div className="flex flex-col sm:items-end">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">INDEX DEGEN PRICE</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-3xl font-black text-white tracking-widest font-mono">
                    ${activeCoin.price >= 1000 ? `${(activeCoin.price / 1000).toFixed(2)}K` : activeCoin.price.toFixed(4)}
                  </span>
                  
                  {/* Colored Percentage momentum badge */}
                  <span className={`px-2 py-1 rounded-xl text-xs font-black flex items-center gap-0.5 border select-none ${
                    activeCoin.change24h >= 0
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                      : 'bg-rose-955/60 border-rose-500/40 text-rose-450'
                  }`}>
                    {activeCoin.change24h >= 0 ? '▲' : '▼'}{' '}
                    {Math.abs(activeCoin.change24h).toFixed(2)}%
                  </span>
                </div>
                <span className="text-[10px] text-zinc-550 mt-1">Updated sub-seconds via simulation nodes</span>
              </div>
            </div>
          </div>

          {/* 2. Interactive Candlestick Chart Module */}
          <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-3xl flex flex-col gap-4 relative" id="charts-module-candlestick">
            
            {/* Header info for Chart */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-md shadow-rose-950"></div>
                <span className="text-xs font-black text-white tracking-wider uppercase font-mono">
                  Price Chart ({timeframe})
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold hidden md:inline">
                  | REAL-TIME SIMULATION FEED
                </span>
              </div>

              {/* Custom Interval Dropdown Selector */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-zinc-505 uppercase">Interval:</span>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 font-bold p-1 px-2.5 rounded-lg focus:outline-none focus:border-rose-500 cursor-pointer text-center"
                >
                  <option value="1m">1 minute (preset)</option>
                  <option value="5m">5 minutes</option>
                  <option value="15m">15 minutes</option>
                  <option value="1h">1 hour</option>
                </select>
              </div>
            </div>

            {/* Interactive Candlestick Diagram Frame */}
            <div className="relative h-64 bg-zinc-950/80 rounded-2xl border border-zinc-900 overflow-hidden flex flex-col justify-end p-4">
              
              {/* Vertical Grid Lines Background overlay */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-6 px-1 z-0">
                <div className="border-b border-zinc-900 w-full flex justify-between text-[8px] text-zinc-650">
                  <span>$6.00</span>
                  <div className="border-l border-zinc-900/40 h-full"></div>
                </div>
                <div className="border-b border-zinc-900 w-full flex justify-between text-[8px] text-zinc-650">
                  <span>$5.80</span>
                  <div className="border-l border-zinc-900/40 h-full"></div>
                </div>
                <div className="border-b border-zinc-900 w-full flex justify-between text-[8px] text-zinc-650">
                  <span>$5.60</span>
                  <div className="border-l border-zinc-900/40 h-full"></div>
                </div>
                <div className="border-b border-zinc-900 w-full flex justify-between text-[8px] text-zinc-650">
                  <span>$5.40</span>
                  <div className="border-l border-zinc-900/40 h-full"></div>
                </div>
                <div className="w-full flex justify-between text-[8px] text-zinc-655 font-bold font-mono">
                  <span>$5.20</span>
                  <div className="border-l border-zinc-900/40 h-full"></div>
                </div>
              </div>

              {/* Candle layout block */}
              <div className="relative z-10 w-full h-44 flex items-end justify-between px-2 gap-1.5 md:gap-3">
                {candlesData.map((candle, idx) => {
                  const maxHigh = 6.00;
                  const minLow = 5.20;
                  const range = maxHigh - minLow;

                  const bottomPercent = ((Math.min(candle.open, candle.close) - minLow) / range) * 100;
                  const topPercent = ((Math.max(candle.open, candle.close) - minLow) / range) * 100;
                  const bodyHeight = Math.max(topPercent - bottomPercent, 3);

                  const wickBottomPercent = ((candle.low - minLow) / range) * 100;
                  const wickTopPercent = ((candle.high - minLow) / range) * 100;
                  const wickHeight = Math.max(wickTopPercent - wickBottomPercent, 5);

                  const isHovered = hoveredCandle === idx;

                  return (
                    <div
                      key={candle.id}
                      className="flex-1 flex flex-col justify-end items-center relative h-full cursor-pointer group"
                      onMouseEnter={() => setHoveredCandle(idx)}
                      onMouseLeave={() => setHoveredCandle(null)}
                    >
                      {/* High-Low Wick Segment Line (Vertical wick) */}
                      <div
                        className={`absolute w-[1.5px] transition-colors duration-200 z-0 ${
                          candle.isUp 
                            ? isHovered ? 'bg-emerald-400' : 'bg-emerald-600/60'
                            : isHovered ? 'bg-rose-400' : 'bg-rose-600/60'
                        }`}
                        style={{
                          bottom: `${wickBottomPercent}%`,
                          height: `${wickHeight}%`
                        }}
                      />

                      {/* Candlestick Box Segment (Body thickness) */}
                      <div
                        className={`w-full rounded-sm relative z-10 transition-all duration-200 border ${
                          candle.isUp
                            ? isHovered 
                              ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-x-105' 
                              : 'bg-emerald-600/85 border-emerald-500/70'
                            : isHovered
                              ? 'bg-rose-500 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.7)] scale-x-105' 
                              : 'bg-rose-600/85 border-rose-500/70'
                        }`}
                        style={{
                          bottom: `${bottomPercent}%`,
                          height: `${bodyHeight}%`
                        }}
                      />

                      {/* Volume Column Block (at the direct base) */}
                      <div
                        className={`w-full select-none opacity-45 group-hover:opacity-75 transition-opacity duration-200 rounded-t-[1px] ${
                          candle.isUp ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                        style={{
                          height: `${(candle.volume / 60000) * 45}px`
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Interactive candle metadata hover readout */}
              <div className="h-7 w-full border-t border-zinc-900/60 mt-3 pt-2 flex items-center justify-between text-[9px] text-zinc-500 select-none">
                {hoveredCandle !== null ? (
                  <div className="flex items-center gap-3 w-full justify-between animate-fade-in font-mono text-zinc-300">
                    <span className="font-extrabold text-white bg-zinc-900 px-1.5 py-0.5 rounded leading-none text-[8px] uppercase">
                      CANDLE {hoveredCandle + 1} ({candlesData[hoveredCandle].time})
                    </span>
                    <div className="flex gap-3">
                      <span>OPEN: <strong className="text-zinc-200">${candlesData[hoveredCandle].open.toFixed(3)}</strong></span>
                      <span>HIGH: <strong className="text-emerald-400">${candlesData[hoveredCandle].high.toFixed(3)}</strong></span>
                      <span>LOW: <strong className="text-rose-400">${candlesData[hoveredCandle].low.toFixed(3)}</strong></span>
                      <span>CLOSE: <strong className="text-zinc-200">${candlesData[hoveredCandle].close.toFixed(3)}</strong></span>
                      <span>VOL: <strong className="text-zinc-400">{candlesData[hoveredCandle].volume.toLocaleString()}</strong></span>
                    </div>
                  </div>
                ) : (
                  <span className="text-zinc-550 italic mx-auto">Hover over wicks to load interactive tick indexes</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 5 Column Grid for Transaction Execution & Liquidity / Holder structures */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6">
          
          {/* 3. Transaction Execution Panel */}
          <div className="bg-zinc-900 border-2 border-zinc-805 p-6 rounded-3xl flex flex-col gap-4 shadow-xl select-none" id="buy-sell-trade-dashboard">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              TRANSACTION EXECUTION
            </h3>

            {/* If no trade mode selected, show stacked buttons */}
            {activeTradeMode === 'NONE' ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setActiveTradeMode('BUY');
                    setFeedback(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 hover:scale-101 active:scale-98 text-white py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-red-950/40 border border-red-500 cursor-pointer flex items-center justify-center gap-2 text-glow"
                  id="massive-buy-btn"
                >
                  ⚡ Buy ${activeCoin.symbol}
                </button>
                <button
                  onClick={() => {
                    setActiveTradeMode('SELL');
                    setFeedback(null);
                  }}
                  className="w-full bg-zinc-950 hover:bg-zinc-850 hover:scale-101 active:scale-98 text-zinc-300 hover:text-white py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-zinc-800 hover:border-zinc-700 cursor-pointer flex items-center justify-center gap-2"
                  id="massive-sell-btn"
                >
                  ⚡ Sell ${activeCoin.symbol}
                </button>
                <p className="text-[9px] text-zinc-500 text-center leading-normal mt-1">
                  100% simulation risk. Operations are mapped directly to Appwrite databases nodes securely.
                </p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-950/90 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3.5"
              >
                {/* Form header toggle row */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-1">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${
                    activeTradeMode === 'BUY' ? 'text-red-500' : 'text-zinc-300'
                  }`}>
                    EXECUTE {activeTradeMode} FOR *{activeCoin.symbol}
                  </span>
                  <button
                    onClick={() => {
                      setActiveTradeMode('NONE');
                      setFeedback(null);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-200 font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleExecuteTrade} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-black">
                      <span>Enter Amount *{activeCoin.symbol}</span>
                      <span className="text-[9px] text-zinc-400">
                        Avg. Estimate: ${(parseFloat(tradeAmountCoins || '0') * activeCoin.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        disabled={executingState}
                        placeholder="0.00"
                        value={tradeAmountCoins}
                        onChange={(e) => setTradeAmountCoins(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 placeholder-zinc-700 font-bold"
                      />
                      <span className="absolute right-4 top-3.5 text-xs text-zinc-550 font-extrabold uppercase select-none">
                        {activeCoin.symbol}
                      </span>
                    </div>
                  </div>

                  {/* Percentage shortcuts */}
                  <div className="grid grid-cols-4 gap-1.5 font-bold">
                    {[10, 25, 50, 100].map((perc) => (
                      <button
                        key={perc}
                        type="button"
                        onClick={() => setPercentOfMax(perc)}
                        className={`text-[10px] p-2 rounded-lg border text-center transition-all ${
                          tradePercentage === perc
                            ? 'bg-rose-600/25 border-rose-500 text-rose-450'
                            : 'bg-zinc-900 hover:bg-zinc-855 border-zinc-850 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {perc}%
                      </button>
                    ))}
                  </div>

                  {/* Submit state indicators */}
                  {feedback && (
                    <div className={`p-3 rounded-xl text-[10px] border leading-normal ${
                      feedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-450'
                        : 'bg-rose-955/50 border-rose-500/40 text-rose-450'
                    }`}>
                      {feedback.type === 'success' ? '✨ ' : '⚠️ '} {feedback.msg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={executingState}
                    className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                      activeTradeMode === 'BUY'
                        ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
                        : 'bg-zinc-900 hover:bg-zinc-855 border-zinc-800 text-zinc-100'
                    }`}
                  >
                    {executingState ? (
                      <span className="animate-pulse">Broadcasting execution...</span>
                    ) : (
                      <span>Complete {activeTradeMode}</span>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </div>

          {/* 4. Liquidity Pool Composition Card */}
          <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-3xl flex flex-col gap-4 shadow-xl" id="pool-composition-stats">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              POOL COMPOSITION
            </h3>
            
            <div className="flex flex-col gap-3 font-mono">
              
              {/* Token vs Base currency breakdown */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
                
                {/* Visual meter alignment */}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-black leading-none mb-1">
                  <span>Simulated Weights</span>
                  <span className="text-indigo-455">1.2x Pool Lever</span>
                </div>

                <div className="w-full h-2.5 bg-zinc-900 rounded-full flex overflow-hidden border border-zinc-950">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: '49.9%' }}></div>
                  <div className="h-full bg-gradient-to-r from-red-650 to-orange-500" style={{ width: '50.1%' }}></div>
                </div>

                {/* Token vs Base balances layout */}
                <div className="flex justify-between items-center text-xs border-t border-zinc-900/60 pt-2 pb-0.5">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500">ROADREV Tokens</span>
                    <strong className="text-zinc-250 font-black mt-0.5">5,730.00K</strong>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] text-zinc-505">Base Currency</span>
                    <strong className="text-indigo-400 font-extrabold mt-0.5">$32,830.00</strong>
                  </div>
                </div>
              </div>

              {/* Pool stats matrix */}
              <div className="p-3 bg-zinc-950/25 border border-zinc-900/50 rounded-xl flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-zinc-500">Total Liquidity:</span>
                  <span className="text-white font-extrabold">$2,860,040 USD</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-zinc-500">Calculated Index:</span>
                  <span className="text-emerald-400 font-black">1.135 degen_index</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-zinc-500">LP Status:</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-amber-950 text-amber-400 border border-amber-900/40">Locked (Permanent)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Top Holders profile rows */}
          <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-3xl flex flex-col gap-4 shadow-xl" id="token-top-holders-panel">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              TOP HOLDERS (PDH SCALE)
            </h3>

            <div className="flex flex-col gap-2.5">
              {TOP_HOLDERS_SIMULATED.map((holder) => (
                <div
                  key={holder.rank}
                  className="bg-zinc-950/50 border border-zinc-900 p-3 rounded-2xl flex items-center justify-between gap-3 hover:bg-zinc-950 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Unique Profile Avatar */}
                    <div className={`w-8 h-8 rounded-lg ${holder.bg} flex items-center justify-center text-xs font-black border border-white/5 shadow`}>
                      {holder.emoji}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white leading-none mb-1">
                        {holder.name}
                      </span>
                      <span className="text-[9px] text-zinc-500 leading-none">
                        {holder.handle}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-teal-400">
                      {holder.weight}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      {holder.balance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 4. Bottom Stats Matrix Grid (4 Bordered metrics modules at layout base) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2" id="bottom-stats-matrix-layout-grid">
        
        {/* Metric 1: Market Cap */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-3xl flex flex-col gap-1 shadow-md hover:border-zinc-700/65 transition-colors">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black leading-none mb-1">
            MARKET CAP VALUATION
          </span>
          <strong className="text-lg font-black text-white">
            ${(activeCoin.marketCap >= 1000 ? (activeCoin.marketCap / 1000).toFixed(2) + 'K' : activeCoin.marketCap.toFixed(0))}
          </strong>
          <span className="text-[10px] text-zinc-505 flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" /> Fully diluted stats
          </span>
        </div>

        {/* Metric 2: 24h Volume */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-3xl flex flex-col gap-1 shadow-md hover:border-zinc-700/65 transition-colors">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black leading-none mb-1">
            24H TRADING VOLUME
          </span>
          <strong className="text-lg font-black text-white">
            ${activeCoin.volume24h >= 1000 ? `${(activeCoin.volume24h / 1000).toFixed(1)}K` : activeCoin.volume24h.toFixed(0)}
          </strong>
          <span className="text-[10px] text-zinc-505 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" /> Volume over last 24h
          </span>
        </div>

        {/* Metric 3: Circulating Supply */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-3xl flex flex-col gap-1 shadow-md hover:border-zinc-700/65 transition-colors">
          <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase tracking-widest font-black leading-none mb-1">
            <span>CIRCULATING SUPPLY</span>
            <span className="text-[8px] text-zinc-400">HARD CAP</span>
          </div>
          <strong className="text-lg font-black text-zinc-200">
            {activeCoin.supply.toLocaleString()} TON
          </strong>
          <div className="w-full bg-zinc-950 h-1 rounded overflow-hidden mt-0.5">
            <div className="h-full bg-indigo-500" style={{ width: '73%' }}></div>
          </div>
          <span className="text-[9px] text-zinc-500 block">730K circulating / 1.0M max Cap</span>
        </div>

        {/* Metric 4: 24h Change trajectory ticker with colored icon */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-3xl flex flex-col gap-1 shadow-md hover:border-zinc-700/65 transition-colors">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black leading-none mb-1">
            24H TRAJECTORY TICKER
          </span>
          <div className="flex items-center gap-2">
            <strong className={`text-lg font-black ${
              activeCoin.change24h >= 0 ? 'text-emerald-400 animate-pulse' : 'text-rose-400'
            }`}>
              {activeCoin.change24h >= 0 ? '+' : ''}{activeCoin.change24h.toFixed(2)}%
            </strong>
            <span className={`p-1 rounded-full text-[8.5px] scale-90 ${
              activeCoin.change24h >= 0 ? 'bg-emerald-950 text-emerald-450' : 'bg-rose-955 text-rose-455'
            }`}>
              {activeCoin.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </span>
          </div>
          <span className="text-[10px] text-zinc-505 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-450 animate-spin" /> High-frequency index ticks
          </span>
        </div>

      </div>

    </div>
  );
}
