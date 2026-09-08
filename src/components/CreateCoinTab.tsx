import React, { useState } from "react";
import { useAppContext } from "../context/AppContext";
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
import { ID, Permission, Role } from "appwrite";

interface CreateCoinProps {
  setCoins: React.Dispatch<React.SetStateAction<any[]>>;
  coins: any[];
}

export default function CreateCoinTab({ setCoins, coins }: CreateCoinProps) {
  const { userStats, currentUser, cash, setCash, userId } = useAppContext();
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
        creatorId: currentUser?.$id || currentUser?.uid || "unknown",
        creatorName: currentUser?.name || userStats.username || "Unknown",
        creator: userStats.handle || "@system",
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: desc.trim(),
        price: dbPrice,
        marketCap: dbMarketCap,
      };

      await databases.createDocument("pumpforge", "coins", newCoinId, payload, [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any())
      ]);

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
      const nowString = new Date().toISOString();
      const newMeme = {
        id: newCoinId,
        createdAt: nowString,
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
      setCash(newCash);
      if (userId) {
        databases.updateDocument("pumpforge", "users", userId, {
          cash: newCash,
          coins: (userStats.coinsCreatedCount || 0) + 1,
        });
      }

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
      <div className="lg:col-span-3 glass-panel border border-white/10 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <h3 className="font-extrabold text-white text-sm uppercase font-mono tracking-wider flex items-center gap-2">
            <PlusCircle className="text-rose-500 w-4.5 h-4.5" /> Launch custom
            meme coin
          </h3>
        </div>

        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-3 animate-scale-up font-mono">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-3xl flex items-center justify-center text-3xl shadow-xl">
              🚀
            </div>
            <h4 className="font-extrabold text-white text-sm uppercase tracking-wide mt-2">
              Coin Launched Successfully!
            </h4>
            <p className="text-xs text-zinc-300 max-w-sm font-medium leading-relaxed">
              Your coin has been listed on the main Market! Watch dynamic droll
              users in the Shill Room discuss and trade your coin.
            </p>
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
                  maxLength={4}
                  placeholder="e.g. MEW"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.slice(0, 4))}
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

            {/* Launch Breakdown */}
            <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col gap-2 font-mono text-[11px] leading-relaxed select-none">
              <div className="flex justify-between">
                <span className="text-zinc-400">Listing fee:</span>
                <span className="text-zinc-200 font-bold">$100.00</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-zinc-400">
                  Initial TVL Liquidity injection:
                </span>
                <span className="text-emerald-400 font-bold">
                  $1,000.00
                </span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between font-bold mt-1">
                <span className="text-zinc-300 font-extrabold uppercase text-[10px]">
                  Total launching cost:
                </span>
                <span className="text-rose-400 font-extrabold text-sm">$1,100.00</span>
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
                $1,100 total simulated cash
              </strong>{" "}
              to initiate listing. This creates your token and sets up its
              liquid buying pool.
            </p>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-xl glass-card flex items-center justify-center font-extrabold text-rose-400 border border-white/10 shrink-0 mt-0.5 shadow-sm">
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
