import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  PlusCircle,
  HelpCircle,
  AlertOctagon,
  Zap,
  ArrowRight,
} from "lucide-react";
import { apiCreateCoin } from "../api/gameClient";
import { formatErrorMessage } from "../utils/formatError";

interface CreateCoinProps {
  setCoins: React.Dispatch<React.SetStateAction<any[]>>;
  coins: any[];
}

export default function CreateCoinTab({ setCoins, coins }: CreateCoinProps) {
  const navigate = useNavigate();
  const { userStats, currentUser, cash, setCash, setUserStats } = useAppContext();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🚀");
  const [initialBuyUsd, setInitialBuyUsd] = useState<string>("0");
  const [launchedCoin, setLaunchedCoin] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const emojiList = [
    "🚀",
    "💂",
    "💼",
    "😈",
    "🛹",
    "🗿",
    "📖",
    "🐱",
    "🐶",
    "🐸",
    "👽",
    "🍔",
    "🍕",
    "🍑",
    "🍦",
    "🍿",
    "🔥",
    "👑",
    "💸",
    "🧠",
  ];

  const initialBuyNum = Math.max(0, Number(initialBuyUsd) || 0);
  const totalLaunchCost = 1100 + initialBuyNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isLaunching) return;

    const activeUser =
      currentUser ||
      (() => {
        try {
          const cached = localStorage.getItem("cached_appwrite_user");
          return cached ? JSON.parse(cached) : null;
        } catch {
          return null;
        }
      })();

    const activeStats =
      userStats ||
      (() => {
        try {
          const cached = localStorage.getItem("cached_appwrite_stats");
          return cached ? JSON.parse(cached) : null;
        } catch {
          return null;
        }
      })();

    if (!activeUser && !localStorage.getItem("pf_custom_token")) {
      setErrorMsg("User not signed in");
      return;
    }

    if (!name.trim()) {
      setErrorMsg("Please enter a catchy coin name!");
      return;
    }
    if (!symbol.trim() || symbol.trim().length < 2) {
      setErrorMsg("Please choose a 2-6 letter ticker symbol (e.g. DOGE).");
      return;
    }
    if (!desc.trim() || desc.trim().length < 5) {
      setErrorMsg(
        "Please write a short pitch description (at least 5 characters) to attract other traders!",
      );
      return;
    }

    const userHandle = activeStats?.handle || "@player";
    const userCash = Number(activeStats?.cash ?? cash ?? 5000);

    const userOwnCoins = (coins || []).filter(
      (c) =>
        c.creator?.toLowerCase() === userHandle.toLowerCase() ||
        (activeUser?.$id && c.creatorId === activeUser.$id),
    );
    if (userOwnCoins.length >= 10) {
      setErrorMsg(
        `❌ 10-COIN LIMIT: You already have 10 active coins. Delete one before launching another!`,
      );
      return;
    }

    if (userCash < totalLaunchCost) {
      setErrorMsg(
        `Insufficient funds. Total launch requires $${totalLaunchCost.toLocaleString("en-US", { minimumFractionDigits: 2 })} ($1,100 base launch + $${initialBuyNum.toLocaleString("en-US", { minimumFractionDigits: 2 })} initial Fair Launch buy).`,
      );
      return;
    }

    setIsLaunching(true);
    try {
      const res = await apiCreateCoin({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: desc.trim(),
        avatarEmoji: selectedEmoji,
        initialBuyUsd: initialBuyNum,
      });

      const createdCoin = res?.coin;
      if (createdCoin) {
        try {
          const rawOwned = localStorage.getItem("pf_my_created_coins");
          const ownedList: string[] = rawOwned ? JSON.parse(rawOwned) : [];
          if (!ownedList.includes(createdCoin.id)) ownedList.push(createdCoin.id);
          if (createdCoin.symbol && !ownedList.includes(createdCoin.symbol)) {
            ownedList.push(createdCoin.symbol);
          }
          localStorage.setItem("pf_my_created_coins", JSON.stringify(ownedList));
        } catch {}

        setCoins((prev) => {
          const next = [createdCoin, ...prev.filter((c) => c.id !== createdCoin.id)];
          try {
            localStorage.setItem("pumpforge_cached_coins", JSON.stringify(next));
          } catch {}
          return next;
        });
        setLaunchedCoin(createdCoin);
      }

      if (res?.userStats && res.userStats.cash !== undefined) {
        setCash(Number(res.userStats.cash));
        if (setUserStats) {
          setUserStats((prev: any) => ({ ...(prev || {}), ...res.userStats }));
        }
      }

      if (res?.holding) {
        window.dispatchEvent(
          new CustomEvent("pf_holding_created", { detail: res.holding }),
        );
      }
      window.dispatchEvent(new CustomEvent("pf_coins_updated"));

      setName("");
      setSymbol("");
      setDesc("");
      setInitialBuyUsd("0");
      setSelectedEmoji("🚀");
    } catch (err: any) {
      console.error("Launch coin failed:", err);
      setErrorMsg(
        formatErrorMessage(
          err,
          "An unexpected error occurred during database launch.",
        ),
      );
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in select-none">
      {/* Creation form */}
      <div className="lg:col-span-3 glass-panel border border-white/10 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <h3 className="font-extrabold text-white text-sm uppercase font-mono tracking-wider flex items-center gap-2">
            <PlusCircle className="text-rose-500 w-4.5 h-4.5" /> Launch custom
            meme coin
          </h3>
        </div>

        {launchedCoin ? (
          <div className="py-10 flex flex-col items-center justify-center text-center gap-4 animate-fade-in font-mono">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-3xl flex items-center justify-center text-3xl shadow-xl">
              {launchedCoin.avatarEmoji || "🚀"}
            </div>
            <h4 className="font-extrabold text-white text-base uppercase tracking-wide">
              *{launchedCoin.symbol} Launched Successfully!
            </h4>
            <p className="text-xs text-zinc-300 max-w-sm font-medium leading-relaxed">
              Your token <strong className="text-white">{launchedCoin.name}</strong> is now live in Fair Launch! As the creator, you have immediate full trading access.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-2">
              <button
                type="button"
                onClick={() => navigate(`/coin/${launchedCoin.id}`)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 px-4 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg border border-white/20 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Trade *{launchedCoin.symbol} Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLaunchedCoin(null)}
                className="py-3 px-4 glass-pill hover:bg-white/10 text-zinc-300 hover:text-white rounded-2xl text-xs font-bold uppercase cursor-pointer"
              >
                Launch Another
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 font-mono text-xs"
          >
            {/* Emoji Symbol Icon picker */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                Select Coin Avatar Symbol
              </label>
              <div className="flex flex-wrap gap-2 glass-card p-3.5 rounded-2xl border border-white/10">
                {emojiList.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform cursor-pointer ${
                      selectedEmoji === emoji
                        ? "bg-rose-600 border border-white/30 scale-110 text-white shadow-lg shadow-rose-900/30"
                        : "glass-card border border-white/10 hover:bg-white/[0.08]"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                  Coin Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cat Revival"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                  Symbol TICKER
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. MEW"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.slice(0, 6))}
                  className="glass-input rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-bold uppercase"
                />
              </div>
            </div>

            {/* Desc fields */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                Description / Pitch
              </label>
              <textarea
                placeholder="pitch your coin to attract traders..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="glass-input rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-bold resize-none"
              />
            </div>

            {/* Optional Creator Fair Launch Initial Buy */}
            <div className="flex flex-col gap-2 glass-card p-3.5 rounded-2xl border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-black flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Creator Fair Launch Buy (Optional)
                </label>
                <span className="text-[10px] text-zinc-400 font-bold">
                  0% Fee on Launch Buy
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={initialBuyUsd}
                  onChange={(e) => setInitialBuyUsd(e.target.value)}
                  className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">
                  USD
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[10px] font-bold">
                {[0, 100, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setInitialBuyUsd(String(amt))}
                    className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                      Number(initialBuyUsd) === amt
                        ? "bg-emerald-600/30 border-emerald-500 text-emerald-300 font-extrabold"
                        : "bg-black/40 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {amt === 0 ? "None" : `$${amt}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Breakdown */}
            <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col gap-2 font-mono text-[11px] leading-relaxed select-none">
              <div className="flex justify-between">
                <span className="text-zinc-400">Listing fee:</span>
                <span className="text-zinc-200 font-bold">$100.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">
                  Initial TVL Liquidity injection:
                </span>
                <span className="text-emerald-400 font-bold">$1,000.00</span>
              </div>
              {initialBuyNum > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-300">
                    Creator Fair Launch Token Buy:
                  </span>
                  <span className="text-emerald-400 font-bold">
                    +${initialBuyNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="h-px bg-white/10 my-0.5" />
              <div className="flex justify-between font-bold">
                <span className="text-zinc-300 font-extrabold uppercase text-[10px]">
                  Total launching cost:
                </span>
                <span className="text-rose-400 font-extrabold text-sm">
                  ${totalLaunchCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/40 p-3.5 rounded-2xl flex items-center gap-2.5 text-rose-300 font-bold mb-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="text-[11px] leading-tight break-words">
                  {errorMsg}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLaunching}
              className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-rose-900/20 border border-white/20 active:scale-98 cursor-pointer"
            >
              {isLaunching ? "Launching Coin..." : "Confirm & Launch Token"}
            </button>
          </form>
        )}
      </div>

      {/* Guide explanations column */}
      <div className="lg:col-span-2 flex flex-col gap-4 font-mono select-none">
        <h3 className="text-sm font-extrabold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-rose-500" /> Creator Game Loop
        </h3>

        <div className="glass-panel border border-white/10 p-5 rounded-3xl flex flex-col gap-4 text-xs font-semibold select-none leading-relaxed text-zinc-400 shadow-xl">
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-xl glass-card flex items-center justify-center font-extrabold text-rose-400 border border-white/10 shrink-0 mt-0.5 shadow-sm">
              1
            </div>
            <p>
              Inject{" "}
              <strong className="text-zinc-200">
                $1,100 base simulated cash
              </strong>{" "}
              to initiate listing, and optionally include a{" "}
              <strong className="text-emerald-400">Creator Fair Launch Buy</strong>{" "}
              to immediately hold tokens in your new pool.
            </p>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-xl glass-card flex items-center justify-center font-extrabold text-rose-400 border border-white/10 shrink-0 mt-0.5 shadow-sm">
              2
            </div>
            <p>
              As the token creator, you can buy and sell your coin immediately
              inside the{" "}
              <strong className="text-zinc-200">60-second Fair Launch</strong>{" "}
              window with zero lockouts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
