import React, { useState } from "react";
import {
  PlusCircle,
  HelpCircle,
  AlertOctagon,
  Sparkles,
  Coins,
  DollarSign,
  Gift,
  CheckCircle,
} from "lucide-react";
import { UserStats } from "../types";
import { databases } from "../appwrite";
import { ID } from "appwrite";

interface CreateCoinProps {
  userStats: UserStats;
  currentUser: any;
  setCoins: React.Dispatch<React.SetStateAction<any[]>>;
  setUserStats: React.Dispatch<React.SetStateAction<UserStats>>;
  coins: any[];
}

export default function CreateCoinTab({
  userStats,
  currentUser,
  setCoins,
  setUserStats,
  coins,
}: CreateCoinProps) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🚀");
  const [success, setSuccess] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isLaunching) return;

    if (!currentUser) {
      setErrorMsg("User not signed in");
      return;
    }

    if (!name.trim()) {
      setErrorMsg("Please enter a catchy coin name!");
      return;
    }
    if (!symbol.trim()) {
      setErrorMsg("Please choose a 3-4 letter ticker symbol (e.g. DOGE).");
      return;
    }
    if (!desc.trim()) {
      setErrorMsg(
        "Please write a short pitch description to attract other traders!",
      );
      return;
    }

    const userOwnCoins = coins.filter((c) => c.creator === userStats.handle);
    if (userOwnCoins.length >= 10) {
      setErrorMsg(
        `❌ 10-COIN LIMIT: You already have 10 active coins. Delete one before launching another!`,
      );
      return;
    }

    if (userStats.cash < 1100) {
      setErrorMsg(
        "Insufficient funds. Launch costs require $1,100 ($100 list fee + $1,000 initial liquidity).",
      );
      return;
    }

    setIsLaunching(true);
    try {
      const dbPrice = parseFloat("0.005");
      const dbMarketCap = parseFloat("1000.0");
      const newCoinId = ID.unique();
      const payload = {
        coinId: newCoinId,
        creatorId: currentUser.uid || currentUser.$id,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: desc.trim(),
        price: dbPrice,
        marketCap: dbMarketCap,
      };

      await databases.createDocument("pumpforge", "coins", newCoinId, payload);

      const newCash = userStats.cash - 1100;

      await databases.updateDocument(
        "pumpforge",
        "users",
        currentUser.uid || currentUser.$id,
        {
          cash: newCash,
          coinsCreatedCount: userStats.coinsCreatedCount + 1,
        },
      );

      const listPrice = 0.005;
      const newMeme = {
        id: newCoinId,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        creator: userStats.handle,
        description: desc.trim(),
        avatarEmoji: selectedEmoji,
        avatarBg: "bg-emerald-950 text-emerald-300 border-emerald-500",
        price: listPrice,
        marketCap: 1000,
        supply: 200000,
        volume24h: 300,
        change24h: 0,
        history: [listPrice, listPrice, listPrice, listPrice],
        isUserCreated: true,
      };

      setCoins((prev) => [newMeme, ...prev]);
      setUserStats((prev) => ({
        ...prev,
        cash: newCash,
        coinsCreatedCount: prev.coinsCreatedCount + 1,
      }));

      setSuccess(true);
      setName("");
      setSymbol("");
      setDesc("");
      setSelectedEmoji("🚀");

      setTimeout(() => {
        setSuccess(false);
      }, 6000);
    } catch (err: any) {
      console.error("Launch coin failed:", err);
      setErrorMsg(
        err?.message || "An unexpected error occurred during database launch.",
      );
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in select-none">
      {/* Creation form */}
      <div className="lg:col-span-3 bg-zinc-900 border border-zinc-850 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-850">
          <h3 className="font-extrabold text-white text-sm uppercase font-mono tracking-wider flex items-center gap-1.5">
            <PlusCircle className="text-orange-500 w-4.5 h-4.5" /> Launch custom
            meme coin
          </h3>
          <span className="text-[10px] bg-emerald-950 font-bold font-mono text-emerald-400 px-2 py-1.5 rounded-xl border border-emerald-900">
            Dev privilege enabled
          </span>
        </div>

        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-3 animate-scale-up font-mono">
            <div className="w-14 h-14 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-full flex items-center justify-center text-3xl shadow-lg">
              🚀
            </div>
            <h4 className="font-extrabold text-white text-sm uppercase tracking-wide mt-2">
              Coin Launched Successfully!
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm font-medium leading-relaxed">
              Your logo has been listed on the main Market! Watch dynamic droll
              users in the Shill Room discuss and trade your coin.
            </p>
            <span className="text-[10.5px] text-orange-400 font-bold bg-orange-950/20 px-2 py-1 border border-orange-900/30 rounded mt-1">
              Dev feature active: Click delist on market to cashout!
            </span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 font-mono text-xs"
          >
            {/* Emoji Symbol Icon picker */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Select Coin Avatar Symbol
              </label>
              <div className="flex flex-wrap gap-2 bg-zinc-950 p-3.5 rounded-xl border border-zinc-950">
                {emojiList.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-transform ${
                      selectedEmoji === emoji
                        ? "bg-orange-600 border border-orange-500 scale-110 text-white shadow shadow-orange-950"
                        : "bg-zinc-900 border border-zinc-850 hover:bg-zinc-800"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                  Coin Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cat Revival"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                  Symbol TICKER
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. MEW"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.slice(0, 4))}
                  className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none uppercase"
                />
              </div>
            </div>

            {/* Desc fields */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Description / Pitch
              </label>
              <textarea
                placeholder="pitch your coin to attract droll traders fr..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            {/* Launch Breakdown */}
            <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-950 flex flex-col gap-2 font-mono text-[11px] leading-relaxed select-none">
              <div className="flex justify-between">
                <span className="text-zinc-500">Listing listing fee:</span>
                <span className="text-zinc-300">$100.00</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-zinc-500">
                  Initial TVL Liquidity injection:
                </span>
                <span className="text-zinc-305 text-emerald-400">
                  $1,000.00
                </span>
              </div>
              <div className="h-px bg-zinc-900" />
              <div className="flex justify-between font-bold mt-1">
                <span className="text-zinc-400 font-extrabold uppercase text-[10px]">
                  Total launching cost:
                </span>
                <span className="text-rose-400 font-extrabold">$1,100.00</span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2 text-red-400 font-bold mb-2">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] leading-tight break-words">
                  {errorMsg}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLaunching}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest transition-colors shadow-lg shadow-orange-950/15 border border-orange-500"
            >
              {isLaunching ? "Launching Coin..." : "Confirm & Launch Token"}
            </button>
          </form>
        )}
      </div>

      {/* Guide explanations column */}
      <div className="lg:col-span-2 flex flex-col gap-4 font-mono select-none">
        <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-orange-500" /> Creator Game Loop
        </h3>

        <div className="bg-zinc-900 border border-zinc-805 p-5 rounded-2xl flex flex-col gap-4 text-xs font-semibold select-none leading-relaxed text-zinc-400">
          <div className="flex gap-2.5 items-start">
            <div className="w-5 h-5 rounded bg-zinc-950 flex items-center justify-center font-extrabold text-orange-400 border border-zinc-850 shrink-0 mt-0.5">
              1
            </div>
            <p>
              Inject{" "}
              <strong className="text-zinc-200">
                $1,100 total simulated cash
              </strong>{" "}
              to initiate listing. This creates your token and sets up its
              liquid buying pool.
            </p>
          </div>

          <div className="flex gap-2.5 items-start">
            <div className="w-5 h-5 rounded bg-zinc-950 flex items-center justify-center font-extrabold text-orange-400 border border-zinc-850 shrink-0 mt-0.5">
              2
            </div>
            <p>
              Once listed, other droll traders inside the sandbox shill-room
              will automatically buy/sell your coin, fluctuating its marketcap
              value up or down!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
