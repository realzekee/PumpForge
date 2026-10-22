import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Users,
  Activity,
  Layers,
  Zap,
  MessageSquare,
  Send,
  Trash2,
  Flag,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { MemeCoin, UserStats, PortfolioHolding } from "../types";
import {
  apiGetCoinCandles,
  apiGetComments,
  apiPostComment,
  apiDeleteComment,
  apiReportComment,
} from "../api/gameClient";
import { formatErrorMessage } from "../utils/formatError";
import { UserHoverCard } from "./UserHoverCard";
import { playSound } from "../utils/sound";

interface CoinDetailsTabProps {
  coin: MemeCoin | null;
  userStats: UserStats;
  currentUser?: any;
  holdings: PortfolioHolding[];
  onTradeAction: (
    coinId: string,
    amountCoins: number,
    type: "BUY" | "SELL",
    referencePrice?: number,
  ) => Promise<any> | void;
  onBackToList?: () => void;
}

const DEFAULT_PRESET_COIN: MemeCoin = {
  id: "roadman_revival_default",
  name: "RoadmanRevival",
  symbol: "ROADREV",
  creator: "@system",
  description: "Community meme asset.",
  avatarEmoji: "🏟️",
  avatarBg: "bg-orange-950/60 text-orange-400 border-orange-500/30",
  price: 5.73,
  marketCap: 573000,
  supply: 100000,
  volume24h: 31250,
  change24h: 4.2,
  history: [5.42, 5.48, 5.51, 5.49, 5.55, 5.62, 5.68, 5.7, 5.69, 5.71, 5.73],
};

export default function CoinDetailsTab({
  coin,
  userStats,
  currentUser,
  holdings,
  onTradeAction,
  onBackToList,
}: CoinDetailsTabProps) {
  const activeCoin = coin || DEFAULT_PRESET_COIN;
  const currentPrice = Math.max(0.000001, Number(activeCoin?.price) || 0.01);
  const totalSupply = Math.max(1000, Number(activeCoin?.supply) || 1000000);
  const computedMarketCap =
    Number(activeCoin?.marketCap) > 0
      ? Number(activeCoin.marketCap)
      : Math.floor(totalSupply * currentPrice);
  const computedLiquidity =
    Number(activeCoin?.totalLiquidity) > 0
      ? Number(activeCoin.totalLiquidity)
      : Math.max(1000, Math.floor(computedMarketCap * 0.35));

  const [timeframe, setTimeframe] = useState("1m");
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);

  const [activeTradeMode, setActiveTradeMode] = useState<"BUY" | "SELL">("BUY");
  const [buyInputMode, setBuyInputMode] = useState<"USD" | "TOKENS">("USD");
  const [tradeInput, setTradeInput] = useState("");
  const [tradePercentage, setTradePercentage] = useState<number | null>(null);
  const [executingState, setExecutingState] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const [launchTimer, setLaunchTimer] = useState<number>(0);
  const isCreator = useMemo(() => {
    if (!activeCoin) return false;
    const uid =
      currentUser?.$id ||
      currentUser?.uid ||
      currentUser?.userId ||
      (userStats as any)?.uid;
    if (uid && activeCoin.creatorId && String(uid) === String(activeCoin.creatorId))
      return true;
    const cleanCreator = String(activeCoin.creator || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();
    const cleanCreatorName = String((activeCoin as any).creatorName || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();
    const cleanHandle = String(userStats?.handle || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();
    const cleanUser = String(userStats?.username || currentUser?.name || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();
    if (cleanCreator && (cleanCreator === cleanHandle || cleanCreator === cleanUser))
      return true;
    if (
      cleanCreatorName &&
      (cleanCreatorName === cleanHandle || cleanCreatorName === cleanUser)
    )
      return true;
    return false;
  }, [activeCoin, currentUser, userStats]);

  const [remoteHolders, setRemoteHolders] = useState<any[]>([]);

  // User holdings query (matches across id, $id, coinId, symbol, and slug)
  const userAssetHolding = useMemo(() => {
    if (!activeCoin) return 0;
    const targetIds = new Set(
      [
        activeCoin.id,
        (activeCoin as any).$id,
        (activeCoin as any).coinId,
        activeCoin.symbol,
        (activeCoin as any).slug,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase()),
    );
    const matching = (holdings || []).filter(
      (h) =>
        targetIds.has(String(h.coinId || "").toLowerCase()) ||
        Boolean(
          (h as any).coinSymbol &&
            targetIds.has(String((h as any).coinSymbol).toLowerCase()),
        ),
    );
    return matching.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  }, [holdings, activeCoin]);

  useEffect(() => {
    let active = true;
    const fetchTopHolders = async () => {
      try {
        if (!activeCoin?.id) return;
        const { apiGetHoldings } = await import("../api/gameClient");
        const apiRes = await apiGetHoldings({ coinId: activeCoin.id });
        if (active && apiRes && Array.isArray(apiRes.holdings)) {
          setRemoteHolders(apiRes.holdings);
        }
      } catch {}
    };
    fetchTopHolders();
    return () => {
      active = false;
    };
  }, [activeCoin?.id, userAssetHolding]);

  // Combine live user holding + remote holders so Top Holders is always accurate immediately after buying
  const topHolders = useMemo(() => {
    const map = new Map<
      string,
      { name: string; handle: string; tokens: number }
    >();

    const myHandle = userStats?.handle || "@zeke";
    const myName = userStats?.username || "Zeke";
    if (userAssetHolding > 0.0001) {
      map.set(myHandle.toLowerCase(), {
        name: myName,
        handle: myHandle,
        tokens: userAssetHolding,
      });
    }

    for (const d of remoteHolders) {
      const amt = Number(d.tokenAmount ?? d.amount ?? 0);
      if (amt <= 0.0001) continue;
      const isMe =
        d.userId === "admin_realzekeee" ||
        d.userId === currentUser?.$id ||
        d.userId === currentUser?.uid;
      const hStr = isMe
        ? myHandle
        : d.userHandle || `@${String(d.userId || "holder").slice(0, 8)}`;
      const nStr = isMe
        ? myName
        : d.userName || `Trader ${String(d.userId || "").slice(0, 4)}`;
      const key = hStr.toLowerCase();
      if (!map.has(key) || map.get(key)!.tokens < amt) {
        map.set(key, { name: nStr, handle: hStr, tokens: amt });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5)
      .map((item, idx) => {
        const pct = Math.min(100, (item.tokens / totalSupply) * 100);
        return {
          rank: idx + 1,
          name: item.name,
          handle: item.handle,
          tokensFormatted: item.tokens.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          }),
          weight: `${pct < 0.1 && pct > 0 ? "<0.1" : pct.toFixed(1)}%`,
          balance:
            "$" +
            (item.tokens * currentPrice).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
        };
      });
  }, [userAssetHolding, remoteHolders, userStats, currentUser, totalSupply, currentPrice]);

  useEffect(() => {
    if (!activeCoin?.createdAt) return;
    const interval = setInterval(() => {
      const createdTime = new Date(activeCoin.createdAt!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - createdTime) / 1000);
      const remaining = 300 - elapsed;
      if (remaining > 0) {
        setLaunchTimer(remaining);
      } else {
        setLaunchTimer(0);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCoin?.createdAt]);

  // Compute effective token amount and USD value from current input
  const parsedInput = Math.max(0, parseFloat(tradeInput) || 0);
  const effectiveTokens =
    activeTradeMode === "BUY" && buyInputMode === "USD"
      ? parsedInput / currentPrice
      : parsedInput;
  const effectiveUsd =
    activeTradeMode === "BUY" && buyInputMode === "USD"
      ? parsedInput
      : parsedInput * currentPrice;

  const setPercentOfMax = (percent: number) => {
    playSound("click");
    setTradePercentage(percent);
    setFeedback(null);

    if (activeTradeMode === "BUY") {
      // Account for 0.5% fee so 100% never exceeds cash balance
      const cashBudget = (Number(userStats.cash || 0) * (percent / 100)) / 1.0055;
      if (buyInputMode === "USD") {
        const cleanUsd = Math.floor(cashBudget * 100) / 100;
        setTradeInput(cleanUsd > 0 ? String(cleanUsd) : "0");
      } else {
        const rawCoins = cashBudget / currentPrice;
        const floored = Math.floor(rawCoins * 100) / 100;
        setTradeInput(floored > 0 ? floored.toFixed(2) : rawCoins.toFixed(4));
      }
    } else {
      if (percent === 100) {
        const flooredAll = Math.floor(userAssetHolding * 10000) / 10000;
        setTradeInput(flooredAll > 0 ? String(flooredAll) : "0");
      } else {
        const balanceToSell =
          Math.floor(userAssetHolding * (percent / 100) * 10000) / 10000;
        setTradeInput(balanceToSell > 0 ? String(balanceToSell) : "0");
      }
    }
  };

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    let tokensToTrade = effectiveTokens;
    if (isNaN(tokensToTrade) || tokensToTrade <= 0) {
      setFeedback({
        type: "error",
        msg: "Enter a valid amount above 0.",
      });
      return;
    }

    if (activeTradeMode === "BUY") {
      const totalCost = tokensToTrade * currentPrice;
      const availableCash = Number(userStats.cash) || 0;
      if (totalCost > availableCash * 1.006) {
        setFeedback({
          type: "error",
          msg: `Insufficient cash balance! Required: $${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Available: $${availableCash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
        return;
      }
      // Clamp slightly if within 0.6% fee tolerance
      if (totalCost > availableCash) {
        tokensToTrade = (availableCash / 1.0055) / currentPrice;
      }
    } else {
      if (userAssetHolding <= 0) {
        setFeedback({
          type: "error",
          msg: `You do not own any *${activeCoin.symbol} tokens to sell.`,
        });
        return;
      }
      if (
        tokensToTrade > userAssetHolding &&
        tokensToTrade <= userAssetHolding * 1.01 + 0.05
      ) {
        tokensToTrade = userAssetHolding;
      } else if (userAssetHolding + 0.0001 < tokensToTrade) {
        setFeedback({
          type: "error",
          msg: `Insufficient tokens! You own ${userAssetHolding.toLocaleString(undefined, { maximumFractionDigits: 4 })} *${activeCoin.symbol}.`,
        });
        return;
      }
    }

    setExecutingState(true);
    try {
      await onTradeAction(
        activeCoin.id,
        tokensToTrade,
        activeTradeMode,
        currentPrice,
      );
      setFeedback({
        type: "success",
        msg: `${activeTradeMode === "BUY" ? "Bought" : "Sold"} ${tokensToTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })} *${activeCoin.symbol} ($${(tokensToTrade * currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
      });
      setTradeInput("");
      setTradePercentage(null);
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({
        type: "error",
        msg: formatErrorMessage(err, "Transaction could not be completed."),
      });
    } finally {
      setExecutingState(false);
    }
  };

  const [serverCandles, setServerCandles] = useState<any[]>([]);
  const [coinTrades, setCoinTrades] = useState<any[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchCandles = async () => {
    if (!activeCoin?.id) return;
    try {
      const interval =
        timeframe === "5m" ? 5 : timeframe === "15m" ? 15 : timeframe === "1h" ? 60 : 1;
      const res = await apiGetCoinCandles(activeCoin.id, interval);
      if (res.candles && res.candles.length > 0) {
        setServerCandles(res.candles);
      }
    } catch {}
  };

  const fetchCoinTrades = async () => {
    if (!activeCoin?.id) return;
    try {
      setTradesLoading(true);
      const { apiGetTrades } = await import("../api/gameClient");
      const apiRes = await apiGetTrades({ coinId: activeCoin.id, limit: 20 });
      if (apiRes && Array.isArray(apiRes.trades)) {
        setCoinTrades(apiRes.trades);
      }
    } catch {
    } finally {
      setTradesLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!activeCoin?.id) return;
    try {
      const res = await apiGetComments(activeCoin.id);
      setComments(res.comments || []);
    } catch {}
  };

  useEffect(() => {
    fetchCandles();
    fetchCoinTrades();
    fetchComments();
    const onTradesUpdated = () => {
      fetchCoinTrades();
      fetchCandles();
    };
    window.addEventListener("pf_trades_updated", onTradesUpdated);
    return () => {
      window.removeEventListener("pf_trades_updated", onTradesUpdated);
    };
  }, [activeCoin?.id, timeframe]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Please sign in with Google to post comments.");
      return;
    }
    const clean = commentText.trim();
    if (!clean) return;
    setSubmittingComment(true);
    try {
      const res = await apiPostComment(activeCoin.id, clean);
      if (res.success && res.comment) {
        setComments((prev) => [res.comment, ...prev]);
        setCommentText("");
        toast.success("Comment posted!");
      }
    } catch (err: any) {
      toast.error(formatErrorMessage(err, "Failed to post comment."));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiDeleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted.");
    } catch (err: any) {
      toast.error(formatErrorMessage(err, "Could not delete comment."));
    }
  };

  const handleReportComment = async (commentId: string) => {
    try {
      await apiReportComment(commentId);
      toast.success("Comment reported.");
    } catch (err: any) {
      toast.error(formatErrorMessage(err, "Could not report comment."));
    }
  };

  // Always build at least 18 well-proportioned OHLCV candles so the chart never renders a single flat 100%-wide cross
  const candlesData = useMemo(() => {
    const rawHist =
      Array.isArray(activeCoin?.history) && activeCoin.history.length > 0
        ? activeCoin.history.map((n) => Number(n) || currentPrice)
        : [currentPrice];

    // Seed deterministic 18-step price walk ending at currentPrice if fewer than 12 points exist
    const ticks: number[] = [...rawHist];
    const seedFactors = [
      0.94, 0.955, 0.948, 0.962, 0.958, 0.971, 0.965, 0.978, 0.984, 0.979,
      0.988, 0.992, 0.987, 0.995, 0.991, 0.997, 0.999, 1.0,
    ];
    while (ticks.length < 18) {
      const idx = 18 - ticks.length - 1;
      const factor = seedFactors[Math.max(0, idx)] || 0.98;
      ticks.unshift(Number((ticks[0] * factor).toFixed(6)));
    }
    ticks[ticks.length - 1] = currentPrice;

    return ticks.slice(-18).map((tick, index, arr) => {
      const prev = index > 0 ? arr[index - 1] : tick * 0.994;
      const open = prev;
      const close = tick;
      const isUp = close >= open;
      const spread = Math.max(Math.abs(close - open), currentPrice * 0.004);
      const high = Math.max(open, close) + spread * 0.65;
      const low = Math.max(0.000001, Math.min(open, close) - spread * 0.55);
      const volume = Math.round(12000 + (((index + 3) * 7919) % 38000));

      return {
        id: index,
        time: `${18 - index}m ago`,
        open,
        high,
        low,
        close,
        volume,
        isUp,
      };
    });
  }, [activeCoin?.history, currentPrice, serverCandles]);

  const { chartMax, chartMin, chartRange } = useMemo(() => {
    const allPrices = candlesData.flatMap((c) => [c.open, c.close, c.high, c.low]);
    const max = Math.max(...allPrices);
    const min = Math.min(...allPrices);
    const pad = (max - min) * 0.12 || max * 0.04 || 0.001;
    const chartMax = max + pad;
    const chartMin = Math.max(0, min - pad);
    const chartRange = Math.max(0.000001, chartMax - chartMin);
    return { chartMax, chartMin, chartRange };
  }, [candlesData]);

  const formatPriceLabel = (p: number) => {
    if (p >= 1000) return `$${(p / 1000).toFixed(2)}K`;
    if (p >= 10) return `$${p.toFixed(2)}`;
    if (p >= 1) return `$${p.toFixed(3)}`;
    return `$${p.toFixed(4)}`;
  };

  return (
    <div
      className="w-full text-zinc-200 flex flex-col gap-5 animate-fade-in"
      id="coin-details-view-container"
    >
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141417] border border-white/[0.07] p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          {onBackToList && (
            <button
              onClick={() => {
                playSound("click");
                onBackToList();
              }}
              className="p-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Back to Market"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div
            className={`w-11 h-11 rounded-xl border border-white/15 flex items-center justify-center text-2xl shrink-0 ${activeCoin.avatarBg}`}
          >
            {activeCoin.avatarEmoji || "🪙"}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-white text-base sm:text-lg leading-tight">
                {activeCoin.name}
              </h1>
              <span className="text-xs bg-orange-500/15 text-orange-400 font-mono font-bold border border-orange-500/30 px-2 py-0.5 rounded-lg">
                *{activeCoin.symbol}
              </span>
            </div>
            <span className="text-xs text-zinc-400 mt-0.5">
              Created by{" "}
              <UserHoverCard userIdOrHandle={activeCoin.creatorId || activeCoin.creator}>
                <strong className="text-zinc-200 hover:text-orange-400 cursor-pointer">
                  {activeCoin.creatorName || activeCoin.creator}
                </strong>
              </UserHoverCard>
            </span>
          </div>
        </div>

        {/* Live Cash & Owned Token Summary */}
        <div className="flex items-center justify-between sm:justify-end gap-4 bg-[#0e0e11] border border-white/[0.06] rounded-xl px-4 py-2.5 font-mono text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">Cash Available</span>
            <span className="text-sm font-bold text-emerald-400">
              $
              {Number(userStats.cash || 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="w-px h-7 bg-white/[0.08]" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-zinc-500 uppercase">
              Owned *{activeCoin.symbol}
            </span>
            <span className="text-sm font-bold text-orange-400">
              {userAssetHolding.toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-[11px] text-zinc-400">
                ($
                {(userAssetHolding * currentPrice).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                )
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart on Left (8 cols), Trade Execution & Pool Info on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
          {/* Price + Candlestick Chart Card */}
          <div className="bg-[#141417] border border-white/[0.07] p-4 sm:p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-bold text-white font-mono">
                  $
                  {currentPrice >= 1000
                    ? `${(currentPrice / 1000).toFixed(2)}K`
                    : currentPrice >= 1
                    ? currentPrice.toFixed(2)
                    : currentPrice.toFixed(4)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono font-semibold border ${
                    (activeCoin?.change24h || 0) >= 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}
                >
                  {(activeCoin?.change24h || 0) >= 0 ? "+" : ""}
                  {Number(activeCoin?.change24h || 0).toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-1 bg-[#0e0e11] p-1 rounded-xl border border-white/[0.06]">
                {["1m", "5m", "15m", "1h"].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => {
                      playSound("click");
                      setTimeframe(tf);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      timeframe === tf
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Candlestick Plot Box (No Overlapping Labels) */}
            <div className="relative h-60 bg-[#0e0e11] rounded-xl border border-white/[0.05] p-3 flex flex-col justify-between overflow-hidden">
              {/* Horizontal Price Grid Lines */}
              <div className="absolute inset-x-3 top-3 bottom-3 flex flex-col justify-between pointer-events-none z-0">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio, i) => (
                  <div
                    key={i}
                    className="border-b border-white/[0.04] w-full flex justify-between items-center"
                  >
                    <span className="text-[10px] font-mono text-zinc-500 bg-[#0e0e11]/80 pr-1.5 -mt-3">
                      {formatPriceLabel(chartMin + chartRange * ratio)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Candlesticks Row */}
              <div className="relative z-10 w-full h-full flex items-end justify-between pl-14 pr-2 py-2 gap-1.5 sm:gap-2">
                {candlesData.map((candle, idx) => {
                  const bottomPercent = Math.min(
                    92,
                    Math.max(
                      4,
                      ((Math.min(candle.open, candle.close) - chartMin) /
                        chartRange) *
                        100,
                    ),
                  );
                  const topPercent = Math.min(
                    96,
                    Math.max(
                      bottomPercent + 3,
                      ((Math.max(candle.open, candle.close) - chartMin) /
                        chartRange) *
                        100,
                    ),
                  );
                  const bodyHeight = Math.max(topPercent - bottomPercent, 5);

                  const wickBottomPercent = Math.min(
                    92,
                    Math.max(2, ((candle.low - chartMin) / chartRange) * 100),
                  );
                  const wickTopPercent = Math.min(
                    98,
                    Math.max(
                      wickBottomPercent + 6,
                      ((candle.high - chartMin) / chartRange) * 100,
                    ),
                  );
                  const wickHeight = Math.max(
                    wickTopPercent - wickBottomPercent,
                    8,
                  );

                  const isHovered = hoveredCandle === idx;

                  return (
                    <div
                      key={candle.id}
                      className="flex-1 max-w-[16px] flex flex-col justify-end items-center relative h-full cursor-pointer"
                      onMouseEnter={() => setHoveredCandle(idx)}
                      onMouseLeave={() => setHoveredCandle(null)}
                      onClick={() => setHoveredCandle(idx)}
                    >
                      {/* High-Low Wick */}
                      <div
                        className={`absolute w-[1.5px] z-0 ${
                          candle.isUp ? "bg-emerald-400/70" : "bg-rose-400/70"
                        }`}
                        style={{
                          bottom: `${wickBottomPercent}%`,
                          height: `${wickHeight}%`,
                        }}
                      />

                      {/* Candle Body */}
                      <div
                        className={`w-full rounded-[2px] relative z-10 transition-transform ${
                          candle.isUp
                            ? isHovered
                              ? "bg-emerald-400 scale-x-110"
                              : "bg-emerald-500"
                            : isHovered
                              ? "bg-rose-400 scale-x-110"
                              : "bg-rose-500"
                        }`}
                        style={{
                          bottom: `${bottomPercent}%`,
                          height: `${bodyHeight}%`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dedicated Non-Overlapping Candle Readout Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 px-1">
              {hoveredCandle !== null && candlesData[hoveredCandle] ? (
                <>
                  <span className="text-orange-400 font-bold">
                    {candlesData[hoveredCandle].time}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <span>
                      O: <strong className="text-white">${candlesData[hoveredCandle].open.toFixed(4)}</strong>
                    </span>
                    <span>
                      H: <strong className="text-emerald-400">${candlesData[hoveredCandle].high.toFixed(4)}</strong>
                    </span>
                    <span>
                      L: <strong className="text-rose-400">${candlesData[hoveredCandle].low.toFixed(4)}</strong>
                    </span>
                    <span>
                      C: <strong className="text-white">${candlesData[hoveredCandle].close.toFixed(4)}</strong>
                    </span>
                  </div>
                </>
              ) : (
                <span>Tap or hover any candle to inspect OHLCV values</span>
              )}
            </div>
          </div>

          {/* Live Coin Trades Feed (Mobile-Friendly Cards/Rows) */}
          <div className="bg-[#141417] border border-white/[0.07] p-4 sm:p-5 rounded-2xl flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold text-white">Recent Trades</h3>
                <span className="text-[11px] bg-orange-500/15 border border-orange-500/30 text-orange-300 px-2 py-0.5 rounded-lg font-mono">
                  {coinTrades.length}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                *{activeCoin.symbol}
              </span>
            </div>

            {tradesLoading && coinTrades.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading trades...
              </div>
            ) : coinTrades.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                No trades recorded for *{activeCoin.symbol} yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                {coinTrades.map((t, idx) => {
                  const tokenQty = Number(
                    t.amountCoins ?? t.amountTokens ?? t.amount ?? 0,
                  );
                  const unitPrice = Number(
                    t.pricePerCoin ?? t.price ?? currentPrice,
                  );
                  const totalVal = Number(
                    t.totalCash ?? t.total ?? t.amountUsd ?? tokenQty * unitPrice,
                  );
                  const isBuy = t.type === "BUY";
                  const traderLabel = (
                    t.userHandle ||
                    t.userName ||
                    (t.userId === "admin_realzekeee" ? "zeke" : t.userId) ||
                    "trader"
                  )
                    .replace(/^@/, "")
                    .slice(0, 14);

                  return (
                    <div
                      key={t.$id || t.id || `ct-${idx}`}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#0e0e11] border border-white/[0.05] text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            isBuy
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {t.type}
                        </span>
                        <span className="text-zinc-200 font-semibold truncate">
                          @{traderLabel}
                        </span>
                        <span className="text-zinc-500 truncate hidden sm:inline">
                          {tokenQty.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          *{activeCoin.symbol}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`font-bold ${
                            isBuy ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          $
                          {totalVal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {t.timestamp
                            ? new Date(t.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Now"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Instant Buy/Sell Panel + Real Pool Stats + Top Holders */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          {/* Instant Trade Execution Card */}
          <div
            className="bg-[#141417] border border-white/[0.08] p-5 rounded-2xl flex flex-col gap-4 select-none"
            id="buy-sell-trade-dashboard"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span>Trade *{activeCoin.symbol}</span>
              </h3>
              {launchTimer > 0 && (
                <span className="text-[10px] bg-orange-500/15 text-orange-300 px-2 py-0.5 rounded-lg border border-orange-500/30 font-mono">
                  Fair Launch {isCreator ? "(Owner)" : "0% Fee"}
                </span>
              )}
            </div>

            {/* Buy / Sell Mode Tabs */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#0e0e11] p-1 rounded-xl border border-white/[0.06] text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setActiveTradeMode("BUY");
                  setTradeInput("");
                  setTradePercentage(null);
                  setFeedback(null);
                }}
                className={`py-2.5 rounded-lg transition-all cursor-pointer ${
                  activeTradeMode === "BUY"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Buy *{activeCoin.symbol}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setActiveTradeMode("SELL");
                  setTradeInput("");
                  setTradePercentage(null);
                  setFeedback(null);
                }}
                className={`py-2.5 rounded-lg transition-all cursor-pointer ${
                  activeTradeMode === "SELL"
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Sell *{activeCoin.symbol}
              </button>
            </div>

            <form onSubmit={handleExecuteTrade} className="flex flex-col gap-3">
              {/* Input Unit Toggle on BUY (USD vs Tokens) */}
              {activeTradeMode === "BUY" && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Amount in:</span>
                  <div className="flex items-center gap-1 bg-[#0e0e11] p-0.5 rounded-lg border border-white/[0.06] font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setBuyInputMode("USD");
                        setTradeInput("");
                        setTradePercentage(null);
                      }}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        buyInputMode === "USD"
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBuyInputMode("TOKENS");
                        setTradeInput("");
                        setTradePercentage(null);
                      }}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        buyInputMode === "TOKENS"
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      *{activeCoin.symbol}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    disabled={executingState}
                    placeholder={
                      activeTradeMode === "BUY" && buyInputMode === "USD"
                        ? "Enter USD amount (e.g. 1000)..."
                        : `Enter *${activeCoin.symbol} tokens...`
                    }
                    value={tradeInput}
                    onChange={(e) => {
                      setTradeInput(e.target.value);
                      setTradePercentage(null);
                      setFeedback(null);
                    }}
                    className="bg-[#0e0e11] border border-white/[0.08] rounded-xl w-full px-3.5 py-3 text-sm text-white focus:outline-none focus:border-orange-500/60 placeholder-zinc-500 font-bold font-mono"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono font-bold uppercase select-none">
                    {activeTradeMode === "BUY" && buyInputMode === "USD"
                      ? "USD"
                      : activeCoin.symbol}
                  </span>
                </div>

                {/* Live Conversion Preview */}
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
                  {activeTradeMode === "BUY" && buyInputMode === "USD" ? (
                    <>
                      <span>You receive:</span>
                      <span className="text-orange-300 font-bold">
                        ~
                        {effectiveTokens.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        *{activeCoin.symbol}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Estimated Value:</span>
                      <span className="text-orange-300 font-bold">
                        $
                        {effectiveUsd.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick USD Presets when buying in USD */}
              {activeTradeMode === "BUY" && buyInputMode === "USD" && (
                <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                  {[100, 500, 1000, 5000].map((usdVal) => (
                    <button
                      key={usdVal}
                      type="button"
                      onClick={() => {
                        playSound("click");
                        setTradeInput(String(usdVal));
                        setTradePercentage(null);
                        setFeedback(null);
                      }}
                      className="py-1.5 rounded-lg bg-[#0e0e11] hover:bg-white/[0.06] border border-white/[0.06] text-zinc-300 hover:text-white transition cursor-pointer"
                    >
                      ${usdVal >= 1000 ? `${usdVal / 1000}K` : usdVal}
                    </button>
                  ))}
                </div>
              )}

              {/* Percentage Shortcuts */}
              <div className="grid grid-cols-4 gap-1.5 font-mono text-xs font-semibold">
                {[10, 25, 50, 100].map((perc) => (
                  <button
                    key={perc}
                    type="button"
                    onClick={() => setPercentOfMax(perc)}
                    className={`py-2 rounded-xl border text-center transition-all cursor-pointer ${
                      tradePercentage === perc
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-300 font-bold"
                        : "bg-[#0e0e11] border-white/[0.06] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {perc}%
                  </button>
                ))}
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs border leading-relaxed ${
                    feedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {feedback.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={executingState}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] shadow-lg ${
                  activeTradeMode === "BUY"
                    ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-500 text-zinc-950"
                    : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white"
                }`}
              >
                {executingState
                  ? "Executing..."
                  : activeTradeMode === "BUY"
                  ? `Buy *${activeCoin.symbol}`
                  : `Sell *${activeCoin.symbol}`}
              </button>
            </form>
          </div>

          {/* Accurate Dynamic Pool Metrics (Replaces Hardcoded ROADREV) */}
          <div
            className="bg-[#141417] border border-white/[0.07] p-5 rounded-2xl flex flex-col gap-3.5"
            id="pool-composition-stats"
          >
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" />
              <span>*{activeCoin.symbol} Pool Metrics</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              <div className="bg-[#0e0e11] border border-white/[0.05] p-3 rounded-xl flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500">Market Cap</span>
                <span className="text-white font-bold">
                  ${computedMarketCap.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#0e0e11] border border-white/[0.05] p-3 rounded-xl flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500">Liquidity Pool</span>
                <span className="text-orange-400 font-bold">
                  ${computedLiquidity.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#0e0e11] border border-white/[0.05] p-3 rounded-xl flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500">
                  *{activeCoin.symbol} Supply
                </span>
                <span className="text-zinc-200 font-bold">
                  {totalSupply.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#0e0e11] border border-white/[0.05] p-3 rounded-xl flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500">24h Volume</span>
                <span className="text-emerald-400 font-bold">
                  ${Number(activeCoin?.volume24h || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Top Holders (Always includes your live position) */}
          <div
            className="bg-[#141417] border border-white/[0.07] p-5 rounded-2xl flex flex-col gap-3.5"
            id="token-top-holders-panel"
          >
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" />
              <span>Top Holders</span>
            </h3>

            <div className="flex flex-col gap-2">
              {topHolders.length > 0 ? (
                topHolders.map((holder) => (
                  <div
                    key={holder.rank + "-" + holder.handle}
                    className="bg-[#0e0e11] border border-white/[0.05] p-3 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                        #{holder.rank}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate">
                          {holder.name}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono truncate">
                          {holder.handle} • {holder.tokensFormatted} *{activeCoin.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col text-right font-mono shrink-0">
                      <span className="text-xs font-bold text-orange-400">
                        {holder.balance}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {holder.weight}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-zinc-500 text-xs py-3">
                  No holders yet. Buy *{activeCoin.symbol} to claim #1!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Community Discussion */}
      <div className="bg-[#141417] border border-white/[0.07] p-5 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white">
              Community Discussion
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {comments.length} comments
          </span>
        </div>

        <form onSubmit={handlePostComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={500}
            placeholder={
              currentUser
                ? `Share your thoughts on *${activeCoin.symbol}...`
                : "Sign in with Google to comment"
            }
            disabled={!currentUser || submittingComment}
            className="flex-1 bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!currentUser || submittingComment || !commentText.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </form>

        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto custom-scrollbar">
          {comments.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-500">
              No comments yet.
            </div>
          ) : (
            comments.map((c) => {
              const isOwn =
                currentUser &&
                (currentUser.$id === c.userId || currentUser.uid === c.userId);
              const isAdmin =
                currentUser?.email === "realzekeee@gmail.com" ||
                userStats?.title?.toLowerCase().includes("owner");
              return (
                <div
                  key={c.id}
                  className="bg-[#0e0e11] border border-white/[0.05] p-3 rounded-xl flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {c.username}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {c.handle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isOwn || isAdmin) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleReportComment(c.id)}
                        className="text-zinc-500 hover:text-amber-400 transition-colors cursor-pointer"
                        title="Report comment"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed break-words">
                    {c.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
