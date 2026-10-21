import React, { useState } from "react";
import { toast } from "sonner";
import { formatErrorMessage } from "../utils/formatError";
import {
  ShoppingBag,
  Sparkles,
  Award,
  Package,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react";
import { UserStats } from "../types";
import { useAppContext } from "../context/AppContext";
import { apiShopBuy } from "../api/gameClient";

interface ShopProps {
  userStats: UserStats;
  onUpdateStats: (updater: (stats: UserStats) => void) => void;
  onAddNotification: (
    title: string,
    msg: string,
    type: "info" | "achievement" | "trade" | "crash",
  ) => void;
}

interface ReelItem {
  id: string;
  label: string;
  subLabel: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

const RARITY_STYLES: Record<
  ReelItem["rarity"],
  { border: string; bg: string; badge: string; text: string; label: string }
> = {
  common: {
    border: "border-zinc-600/60",
    bg: "from-zinc-800/90 to-zinc-950/90",
    badge: "bg-zinc-700/60 text-zinc-200 border-zinc-500/40",
    text: "text-zinc-200",
    label: "COMMON DROP",
  },
  rare: {
    border: "border-cyan-500/60",
    bg: "from-cyan-950/80 to-zinc-950/90",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
    text: "text-cyan-300",
    label: "RARE DROP",
  },
  epic: {
    border: "border-purple-500/70",
    bg: "from-purple-950/85 to-zinc-950/90",
    badge: "bg-purple-500/20 text-purple-300 border-purple-400/40",
    text: "text-purple-300",
    label: "EPIC DROP",
  },
  legendary: {
    border: "border-amber-400/80",
    bg: "from-amber-950/85 via-rose-950/70 to-zinc-950/90",
    badge: "bg-amber-500/25 text-amber-300 border-amber-400/50",
    text: "text-amber-300",
    label: "MYTHIC JACKPOT",
  },
};

export default function ShopTab({
  userStats,
  onUpdateStats,
  onAddNotification,
}: ShopProps) {
  const { setCash, setGems } = useAppContext();

  const [unboxingCrate, setUnboxingCrate] = useState<string | null>(null);
  const [unboxModalState, setUnboxModalState] = useState<{
    crateId: string;
    crateName: string;
    crateEmoji: string;
    costGems: number;
    phase: "rolling" | "revealed";
    reelItems: ReelItem[];
    reelTranslate: boolean;
    reward: {
      cash: number;
      gems: number;
      rarity: ReelItem["rarity"];
    } | null;
  } | null>(null);

  // Cosmetic skin list: Name colors that can be unlocked
  const colorsList = [
    {
      id: "green_candle",
      name: "Green Candle",
      colorClass: "text-emerald-400 font-extrabold",
      costGems: 50,
    },
    {
      id: "blue_chip",
      name: "Blue Chip",
      colorClass: "text-blue-400 font-medium",
      costGems: 50,
    },
    {
      id: "orange_peel",
      name: "Orange Peel",
      colorClass: "text-orange-400 font-black",
      costGems: 100,
    },
    {
      id: "purple_haze",
      name: "Purple Haze",
      colorClass: "text-purple-400 font-bold",
      costGems: 100,
    },
    {
      id: "red_alert",
      name: "Red Alert",
      colorClass: "text-rose-500 font-black tracking-wide",
      costGems: 150,
    },
    {
      id: "gold_rush",
      name: "Gold Rush",
      colorClass: "text-yellow-400 font-black text-glow animate-pulse",
      costGems: 250,
    },
    {
      id: "degen_fire",
      name: "Degen Fire",
      colorClass:
        "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 font-black text-glow",
      costGems: 400,
    },
    {
      id: "auraful",
      name: "Auraful Mystic",
      colorClass:
        "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-rose-400 font-black text-glow",
      costGems: 600,
    },
    {
      id: "black_swan",
      name: "Black Swan Sovereign",
      colorClass:
        "text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-rose-400 to-zinc-200 font-black tracking-wider drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse",
      costGems: 1000,
    },
  ];

  // Crates definition
  const cratesList = [
    {
      id: "small",
      name: "Small Crate",
      costGems: 150,
      emoji: "📦",
      minCash: 5000,
      maxCash: 15000,
      minGems: 5,
      maxGems: 25,
      description:
        "Gives basic simulator cash ($5K to $15K) and bonus gem drops.",
    },
    {
      id: "fatass",
      name: "Fatass Crate",
      costGems: 400,
      emoji: "🧳",
      minCash: 20000,
      maxCash: 60000,
      minGems: 20,
      maxGems: 80,
      description: "Gives major simulator cash ($20K to $60K) and rare gem stashes.",
    },
    {
      id: "motion",
      name: "Motion Crate",
      costGems: 1000,
      emoji: "💎",
      minCash: 100000,
      maxCash: 250000,
      minGems: 50,
      maxGems: 200,
      description:
        "Unleashes massive payouts ($100K to $250K) and high-tier gem bundles.",
    },
    {
      id: "auraful",
      name: "Auraful Crate",
      costGems: 2500,
      emoji: "🔮",
      minCash: 300000,
      maxCash: 1000000,
      minGems: 150,
      maxGems: 600,
      description:
        "The absolute jackpot! Payouts up to $1.0M cash and legendary gem vaults.",
    },
  ];

  const getRarityForRoll = (
    cashVal: number,
    minCash: number,
    maxCash: number,
  ): ReelItem["rarity"] => {
    const ratio = (cashVal - minCash) / Math.max(1, maxCash - minCash);
    if (ratio >= 0.82) return "legendary";
    if (ratio >= 0.58) return "epic";
    if (ratio >= 0.3) return "rare";
    return "common";
  };

  const buildLootReel = (
    crate: (typeof cratesList)[0],
    winningCash: number,
    winningGems: number,
    winningRarity: ReelItem["rarity"],
  ): ReelItem[] => {
    const items: ReelItem[] = [];
    const emojis = ["💵", "💰", "💎", "👑", "🔥", "🚀", "🎁"];
    const WINNING_INDEX = 24;

    for (let i = 0; i < 32; i++) {
      if (i === WINNING_INDEX) {
        items.push({
          id: `win_${i}`,
          label: `+$${winningCash.toLocaleString()}`,
          subLabel: `+${winningGems} 💎 Gems`,
          emoji: winningRarity === "legendary" ? "👑" : winningRarity === "epic" ? "💎" : "💰",
          rarity: winningRarity,
        });
      } else {
        const randCash = Math.floor(
          crate.minCash + Math.random() * (crate.maxCash - crate.minCash),
        );
        const randGems = Math.floor(
          crate.minGems + Math.random() * (crate.maxGems - crate.minGems),
        );
        const r = getRarityForRoll(randCash, crate.minCash, crate.maxCash);
        items.push({
          id: `slot_${i}`,
          label: `+$${randCash.toLocaleString()}`,
          subLabel: `+${randGems} 💎`,
          emoji: emojis[i % emojis.length],
          rarity: r,
        });
      }
    }
    return items;
  };

  const buyColor = async (
    id: string,
    name: string,
    colorClass: string,
    cost: number,
  ) => {
    if (userStats.gems < cost) {
      toast.error(
        "Insufficient gems! Play games, trade, or collect daily rewards to get additional gems.",
      );
      return;
    }

    try {
      const res = await apiShopBuy("color", { colorClass, costGems: cost, cost });
      if (res.userStats) {
        if (setGems && res.userStats.gems !== undefined) {
          setGems(Number(res.userStats.gems));
        }
        onUpdateStats((stats) => {
          stats.gems = res.userStats.gems;
          stats.nameColor = res.userStats.nameColor;
        });
      }

      onAddNotification(
        "Skin Unlocked",
        `Equipped custom ${name} username color style!`,
        "info",
      );
      toast.success(
        `✨ Equipped "${name}" username styling!`,
      );
    } catch (err: any) {
      toast.error(formatErrorMessage(err, "Failed to purchase color cosmetic."));
    }
  };

  const openCrate = async (crateId: string) => {
    const crate = cratesList.find((c) => c.id === crateId);
    if (!crate || unboxingCrate !== null) return;

    if (userStats.gems < crate.costGems) {
      toast.error(`Insufficient Gems! You need 💎 ${crate.costGems} Gems to unbox ${crate.name}.`);
      return;
    }

    setUnboxingCrate(crate.id);

    // Open modal immediately with placeholder rolling cards while awaiting authoritative server roll
    const previewItems = buildLootReel(
      crate,
      Math.floor((crate.minCash + crate.maxCash) / 2),
      Math.floor((crate.minGems + crate.maxGems) / 2),
      "rare",
    );

    setUnboxModalState({
      crateId: crate.id,
      crateName: crate.name,
      crateEmoji: crate.emoji,
      costGems: crate.costGems,
      phase: "rolling",
      reelItems: previewItems,
      reelTranslate: false,
      reward: null,
    });

    try {
      const res = await apiShopBuy("crate", {
        crateId: crate.id,
        costGems: crate.costGems,
        cost: crate.costGems,
      });

      const gemsWon = Number(res.bonusGems ?? res.gemReward ?? 0);
      const cashWon = Number(res.cashReward ?? crate.minCash);
      const winRarity = getRarityForRoll(cashWon, crate.minCash, crate.maxCash);
      const finalReel = buildLootReel(crate, cashWon, gemsWon, winRarity);

      // Trigger smooth CSS horizontal roulette scroll to the winning card (index 24)
      setUnboxModalState((prev) =>
        prev
          ? {
              ...prev,
              reelItems: finalReel,
              reelTranslate: false,
              reward: { cash: cashWon, gems: gemsWon, rarity: winRarity },
            }
          : null,
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUnboxModalState((prev) =>
            prev ? { ...prev, reelTranslate: true } : null,
          );
        });
      });

      setTimeout(() => {
        if (res.userStats) {
          if (setCash && res.userStats.cash !== undefined) setCash(Number(res.userStats.cash));
          if (setGems && res.userStats.gems !== undefined) setGems(Number(res.userStats.gems));
          onUpdateStats((stats) => {
            stats.cash = res.userStats.cash;
            stats.gems = res.userStats.gems;
          });
        }

        setUnboxModalState((prev) =>
          prev ? { ...prev, phase: "revealed" } : null,
        );
        setUnboxingCrate(null);

        onAddNotification(
          "Loot Box Opened",
          `Unboxed ${crate.name}! Gained +$${cashWon.toLocaleString()} and +${gemsWon} 💎!`,
          "achievement",
        );
      }, 2100);
    } catch (err: any) {
      setUnboxingCrate(null);
      setUnboxModalState(null);
      toast.error(formatErrorMessage(err, "Failed to open crate."));
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-full overflow-hidden">
      {unboxModalState && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="glass-modal border border-white/15 rounded-3xl max-w-xl w-full p-6 md:p-8 flex flex-col items-center gap-6 relative overflow-hidden font-mono shadow-2xl">
            {unboxModalState.phase === "revealed" && (
              <button
                onClick={() => setUnboxModalState(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="flex flex-col items-center text-center gap-1.5">
              <div
                className={`w-16 h-16 rounded-2xl glass-card border border-rose-500/40 flex items-center justify-center text-4xl shadow-xl ${
                  unboxModalState.phase === "rolling" ? "animate-bounce" : ""
                }`}
              >
                {unboxModalState.phase === "rolling"
                  ? unboxModalState.crateEmoji
                  : "🎁"}
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest mt-1">
                {unboxModalState.phase === "rolling"
                  ? `Unboxing ${unboxModalState.crateName}...`
                  : `${unboxModalState.crateName} Unlocked!`}
              </h3>
              <p className="text-xs text-zinc-400">
                {unboxModalState.phase === "rolling"
                  ? "Spinning the authoritative loot reel..."
                  : "Rewards have been credited directly to your account!"}
              </p>
            </div>

            {/* Horizontal CS:GO / Casino Style Roulette Reel */}
            <div className="w-full relative overflow-hidden rounded-2xl bg-zinc-950/95 border-2 border-white/10 py-5 shadow-inner">
              {/* Center Gold/Rose Pointer Needle */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-rose-500 z-20 shadow-[0_0_15px_rgba(244,63,94,1)] pointer-events-none">
                <div className="w-3 h-3 bg-rose-500 rotate-45 -translate-x-1 -translate-y-1.5" />
              </div>
              {/* Side Vignette Gradients */}
              <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />

              <div
                className="flex items-center gap-3 px-4"
                style={{
                  transform: unboxModalState.reelTranslate
                    ? "translateX(calc(50% - (24 * 132px) - 66px))"
                    : "translateX(0px)",
                  transition: unboxModalState.reelTranslate
                    ? "transform 1.95s cubic-bezier(0.12, 0.85, 0.2, 1)"
                    : "none",
                }}
              >
                {unboxModalState.reelItems.map((item, idx) => {
                  const style = RARITY_STYLES[item.rarity];
                  const isWinningSlot =
                    idx === 24 && unboxModalState.phase === "revealed";
                  return (
                    <div
                      key={item.id}
                      className={`w-[120px] h-[112px] shrink-0 rounded-2xl border bg-gradient-to-b ${style.bg} ${style.border} p-2.5 flex flex-col items-center justify-between text-center transition-transform ${
                        isWinningSlot
                          ? "scale-105 ring-2 ring-emerald-400 shadow-lg shadow-emerald-950/60"
                          : ""
                      }`}
                    >
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${style.badge}`}
                      >
                        {item.rarity}
                      </span>
                      <span className="text-2xl leading-none my-0.5">
                        {item.emoji}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[11px] font-black text-emerald-400">
                          {item.label}
                        </span>
                        <span className="text-[9px] font-bold text-cyan-300">
                          {item.subLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grand Reward Breakdown on Reveal */}
            {unboxModalState.phase === "revealed" && unboxModalState.reward && (
              <div className="w-full flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-center">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                      RARITY_STYLES[unboxModalState.reward.rarity].badge
                    }`}
                  >
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    {RARITY_STYLES[unboxModalState.reward.rarity].label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="glass-card border border-emerald-500/30 bg-emerald-950/20 rounded-2xl p-4 flex flex-col items-center text-center gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">
                      Simulator Cash Won
                    </span>
                    <span className="text-xl md:text-2xl font-black text-emerald-400">
                      +${unboxModalState.reward.cash.toLocaleString()}
                    </span>
                  </div>
                  <div className="glass-card border border-cyan-500/30 bg-cyan-950/20 rounded-2xl p-4 flex flex-col items-center text-center gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">
                      Bonus Gems Won
                    </span>
                    <span className="text-xl md:text-2xl font-black text-cyan-400">
                      💎 +{unboxModalState.reward.gems}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-1">
                  <button
                    onClick={() => openCrate(unboxModalState.crateId)}
                    disabled={userStats.gems < unboxModalState.costGems}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-white/10 hover:bg-white/15 disabled:opacity-40 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer"
                  >
                    Unbox Again (💎 {unboxModalState.costGems})
                  </button>
                  <button
                    onClick={() => setUnboxModalState(null)}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-white/20 shadow-lg cursor-pointer"
                  >
                    Collect Rewards
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 w-full">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-extrabold text-zinc-300 font-mono tracking-widest uppercase flex items-center gap-2 leading-none">
            <ShoppingBag className="text-rose-500 w-4 h-4" /> Degen cosmetics
            &amp; shop crates
          </h2>
          <span className="text-xs text-zinc-400 leading-none">
            Purchase customized username colors or unbox animated mystery crates
            using Gems!
          </span>
        </div>

        <div className="flex items-center gap-2 glass-panel px-4 py-2 border border-white/10 rounded-2xl font-mono text-sm self-start shadow-xl">
          <span className="text-zinc-400">My Balance:</span>
          <span className="font-extrabold text-cyan-400 flex items-center gap-1">
            💎 {userStats.gems.toLocaleString()} Gems
          </span>
        </div>
      </div>

      {/* Grid: Boxes and cosmetics inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loot crates chest shop */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <Package className="w-4 h-4 text-rose-500" /> Unlock Loot Crates
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cratesList.map((box) => {
              const isSpinningThis = unboxingCrate === box.id;

              return (
                <div
                  key={box.id}
                  className="glass-panel border border-white/10 p-5 rounded-3xl flex flex-col justify-between hover:border-white/20 transition-all duration-200 select-none shadow-xl group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      <span className="font-extrabold font-mono text-zinc-100 text-sm leading-tight">
                        {box.name}
                      </span>
                      <p className="text-[11px] text-zinc-400 font-mono italic leading-normal mt-0.5">
                        {box.description}
                      </p>
                    </div>
                    <div
                      className={`w-12 h-12 glass-card border border-white/10 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-lg ${
                        isSpinningThis ? "animate-bounce brightness-110" : ""
                      }`}
                    >
                      {box.emoji}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between font-mono">
                    <span className="text-xs font-black text-cyan-400 flex items-center gap-1">
                      💎 {box.costGems} Gems
                    </span>
                    <button
                      onClick={() => openCrate(box.id)}
                      disabled={unboxingCrate !== null}
                      className="bg-gradient-to-r from-rose-600 to-red-600 text-white hover:brightness-110 active:scale-98 font-black py-1.5 px-4 rounded-xl text-[10px] uppercase tracking-wider transition-all disabled:opacity-40 shadow-lg shadow-rose-950/20 border border-white/15 cursor-pointer"
                    >
                      {isSpinningThis ? "Unboxing..." : "Unbox"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom equipped color text classes */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <Award className="w-4 h-4 text-rose-500" /> Unlock User Name
            Colors
          </h3>

          <div className="glass-panel border border-white/10 rounded-3xl p-4 flex flex-col gap-2.5 shadow-xl">
            {colorsList.map((skin) => {
              const isEquipped = userStats.nameColor === skin.colorClass;

              return (
                <div
                  key={skin.id}
                  className="glass-card p-3 rounded-2xl border border-white/10 flex items-center justify-between gap-4 font-mono text-xs select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 font-bold">@</span>
                    <span className={`font-bold ${skin.colorClass}`}>
                      {skin.name} Styling
                    </span>
                  </div>

                  {isEquipped ? (
                    <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30 uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Equipped
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        buyColor(
                          skin.id,
                          skin.name,
                          skin.colorClass,
                          skin.costGems,
                        )
                      }
                      className="glass-pill hover:bg-white/15 border border-white/10 text-cyan-400 hover:text-cyan-300 font-black px-3.5 py-1.5 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>💎 {skin.costGems} • Buy</span>
                      <ChevronRight className="w-3 h-3 text-cyan-400" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
