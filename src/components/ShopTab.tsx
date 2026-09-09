import React, { useState } from "react";
import {
  ShoppingBag,
  Gem,
  Sparkles,
  Award,
  Package,
  Gift,
  CheckCircle2,
  Lock,
  ChevronRight,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { UserStats, ShopItem } from "../types";

interface ShopProps {
  userStats: UserStats;
  onUpdateStats: (updater: (stats: UserStats) => void) => void;
  onAddNotification: (
    title: string,
    msg: string,
    type: "info" | "achievement" | "trade" | "crash",
  ) => void;
}

import { useAppContext } from "../context/AppContext";

export default function ShopTab({
  userStats,
  onUpdateStats,
  onAddNotification,
}: ShopProps) {
  const { adminSettings } = useAppContext();

  const [unboxingCrate, setUnboxingCrate] = useState<string | null>(null);
  const [unboxReward, setUnboxReward] = useState<{
    cash: number;
    gems: number;
    color?: string;
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
      description:
        "Gives basic simulator cash ($5K to $15K) and potential basic colors.",
    },
    {
      id: "fatass",
      name: "Fatass Crate",
      costGems: 400,
      emoji: "🧳",
      description: "Gives major simulator cash ($20K to $60K) and rare colors.",
    },
    {
      id: "motion",
      name: "Motion Crate",
      costGems: 1000,
      emoji: "💎",
      description:
        "Unleashes massive payouts ($100K to $250K) and premium neon cosmetics.",
    },
    {
      id: "auraful",
      name: "Auraful Crate",
      costGems: 2500,
      emoji: "🔮",
      description:
        "The absolute jackpot! Payouts up to $1.0M cash and legendary color auras.",
    },
  ];

  const buyColor = (
    id: string,
    name: string,
    colorClass: string,
    cost: number,
  ) => {
    if (userStats.gems < cost) {
      alert(
        "Insufficient gems! Play games, trade, or collect daily rewards to get additional gems.",
      );
      return;
    }

    onUpdateStats((stats) => {
      stats.gems -= cost;
      stats.nameColor = colorClass;
    });

    onAddNotification(
      "Skin Unlocked",
      `Equipped custom ${name} username color style!`,
      "info",
    );
    alert(
      `✨ COSMETIC PURCHASED! You bought and equipped "${name}". Check your name styling in the sidebar!`,
    );
  };

  const openCrate = (crateId: string, name: string, cost: number) => {
    if (userStats.gems < cost) {
      alert("Insufficient Gems to open this chest!");
      return;
    }

    setUnboxingCrate(crateId);
    setUnboxReward(null);

    // Subtract Gems
    onUpdateStats((stats) => {
      stats.gems -= cost;
    });

    // Simulate an animated chest opening spin click
    setTimeout(() => {
      let minCash = 5000;
      let maxCash = 15000;
      let bonusGems = 0;
      let unlockedColors: string[] = [];

      if (crateId === "small") {
        minCash = 5000;
        maxCash = 15000;
        bonusGems = Math.floor(Math.random() * 25) + 5;
      } else if (crateId === "fatass") {
        minCash = 20000;
        maxCash = 60000;
        bonusGems = Math.floor(Math.random() * 80) + 20;
      } else if (crateId === "motion") {
        minCash = 100000;
        maxCash = 250000;
        bonusGems = Math.floor(Math.random() * 200) + 50;
      } else if (crateId === "auraful") {
        minCash = 300000;
        maxCash = 1000000;
        bonusGems = Math.floor(Math.random() * 600) + 150;
      }

      let rawCashReward = Math.floor(
        Math.random() * (maxCash - minCash) + minCash,
      );

      const rigMode = adminSettings.arcadeRigMode || (adminSettings.isCasinoRigged ? "win" : "fair");

      if (rigMode === "win") {
        if (crateId === "small") {
          rawCashReward = 15000 * 3;
          bonusGems = 150;
        } else if (crateId === "fatass") {
          rawCashReward = 60000 * 3;
          bonusGems = 400;
        } else if (crateId === "motion") {
          rawCashReward = 250000 * 3;
          bonusGems = 1000;
        } else if (crateId === "auraful") {
          rawCashReward = 1000000 * 3;
          bonusGems = 2500;
        }
      } else if (rigMode === "lose") {
        rawCashReward = Math.floor(minCash * 0.4);
        bonusGems = 0;
      }

      onUpdateStats((stats) => {
        stats.cash += rawCashReward;
        stats.gems += bonusGems;
      });

      setUnboxReward({ cash: rawCashReward, gems: bonusGems });
      setUnboxingCrate(null);

      onAddNotification(
        "Loot Box Opened",
        `Unboxed ${name}! Gained $${rawCashReward.toLocaleString()} and 💎 ${bonusGems}!`,
        "achievement",
      );
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in select-none">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 w-full">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-extrabold text-zinc-300 font-mono tracking-widest uppercase flex items-center gap-2 leading-none">
            <ShoppingBag className="text-rose-500 w-4 h-4" /> Degen cosmetics
            & shop crates
          </h2>
          <span className="text-xs text-zinc-400 leading-none">
            Purchase customized username colors or claim surprise loot boxes
            using Gems!
          </span>
        </div>

        <div className="flex items-center gap-2 glass-panel px-4 py-2 border border-white/10 rounded-2xl font-mono text-sm self-start shadow-xl">
          <span className="text-zinc-400">My Balance:</span>
          <span className="font-extrabold text-cyan-400 flex items-center gap-1">
            💎 {userStats.gems} Gems
          </span>
        </div>
      </div>

      {/* Crate Unboxing display panel (if reward exists) */}
      {unboxReward && (
        <div className="glass-panel border border-rose-500/30 p-5 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 animate-scale-up shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center text-2xl shadow-lg">
              🎁
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-sm">
                Crate Open Accomplished!
              </span>
              <span className="text-xs text-zinc-300">
                Your cosmetic unboxing has rewarded you with direct cash:
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs text-right">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase">
                Cash Gain
              </span>
              <span className="font-black text-emerald-400 text-sm">
                +${unboxReward.cash.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400 uppercase">
                Bonus Gems
              </span>
              <span className="font-black text-cyan-400 text-sm">
                💎 +{unboxReward.gems}
              </span>
            </div>
            <button
              onClick={() => setUnboxReward(null)}
              className="glass-pill hover:bg-white/15 border border-white/15 py-1.5 px-3.5 rounded-xl text-white transition-colors shrink-0 font-bold text-xs cursor-pointer"
            >
              Great!
            </button>
          </div>
        </div>
      )}

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
                        isSpinningThis ? "animate-spin-slow brightness-110" : ""
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
                      onClick={() => openCrate(box.id, box.name, box.costGems)}
                      disabled={unboxingCrate !== null}
                      className="bg-gradient-to-r from-rose-600 to-red-600 text-white hover:brightness-110 active:scale-98 font-black py-1.5 px-4 rounded-xl text-[10px] uppercase tracking-wider transition-all disabled:opacity-40 shadow-lg shadow-rose-950/20 border border-white/15 cursor-pointer"
                    >
                      {isSpinningThis ? "Spinning..." : "Unbox"}
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
                      <span>Buy Style</span>
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
