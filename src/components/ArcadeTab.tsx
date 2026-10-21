import React, { useState, useEffect, useRef } from "react";
import {
  Gamepad2,
  Sparkles,
  Shield,
  Skull,
  Lock,
  AlertTriangle,
  X,
} from "lucide-react";
import { UserStats } from "../types";
import { useAppContext } from "../context/AppContext";
import { apiArcadeWager, apiCoinflip } from "../api/gameClient";
import { toast } from "sonner";
import { formatErrorMessage } from "../utils/formatError";

interface ArcadeTabProps {
  userStats: UserStats;
  onUpdateStats: (updater: (stats: UserStats) => void) => void;
  onAddNotification: (
    title: string,
    msg: string,
    type: "info" | "achievement" | "trade" | "crash",
  ) => void;
}

type MenuGameType = "coinflip" | "slots" | "mines" | "dice" | "tower";

export default function ArcadeTab({
  userStats,
  onUpdateStats,
  onAddNotification,
}: ArcadeTabProps) {
  const { setCash } = useAppContext();
  const [selectedGame, setSelectedGame] = useState<MenuGameType>("coinflip");
  const isSubmittingRef = useRef(false);

  const [localNotice, setLocalNotice] = useState<{
    title: string;
    message: string;
    isError?: boolean;
  } | null>(null);
  const [showTowerResultModal, setShowTowerResultModal] = useState<{
    success: boolean;
    title: string;
    message: string;
    payout?: number;
    multiplier?: number;
  } | null>(null);

  const applyServerUserStats = (srvStats: any) => {
    if (!srvStats) return;
    if (srvStats.cash !== undefined && setCash) {
      setCash(Number(srvStats.cash));
    }
    onUpdateStats((stats) => {
      if (srvStats.cash !== undefined) stats.cash = Number(srvStats.cash);
      if (srvStats.totalProfit !== undefined) stats.totalProfit = Number(srvStats.totalProfit);
      if (srvStats.gems !== undefined) stats.gems = Number(srvStats.gems);
    });
  };

  const triggerLocalNotice = (
    title: string,
    message: any,
    isError = false,
  ) => {
    const cleanMessage = formatErrorMessage(
      message,
      isError ? "Failed to complete arcade transaction. Please try again." : "",
    );
    setLocalNotice({ title, message: cleanMessage, isError });
    setTimeout(() => {
      setLocalNotice((current) => {
        if (current?.title === title && current?.message === cleanMessage) {
          return null;
        }
        return current;
      });
    }, 3500);
  };

  const formatCash = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(2)}K`;
    }
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Coinflip States
  const [coinBetInput, setCoinBetInput] = useState("100");
  const coinBet = Math.max(0, Number(coinBetInput) || 0);
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");
  const [coinIsFlapping, setCoinIsFlapping] = useState(false);
  const [coinOutcome, setCoinOutcome] = useState<"heads" | "tails" | null>("heads");
  const [coinResultMsg, setCoinResultMsg] = useState("");

  // Rapidly flip coinFace during animation only
  useEffect(() => {
    let int: NodeJS.Timeout;
    if (coinIsFlapping) {
      int = setInterval(() => {
        setCoinOutcome((prev) => (prev === "heads" ? "tails" : "heads"));
      }, 110);
    }
    return () => clearInterval(int);
  }, [coinIsFlapping]);

  // Slots States
  const [slotBetInput, setSlotBetInput] = useState("100");
  const slotBet = Math.max(0, Number(slotBetInput) || 0);
  const [slotIsSpinning, setSlotIsSpinning] = useState(false);
  const [slotReels, setSlotReels] = useState(["🍒", "🍒", "🍒"]);
  const [slotResultMsg, setSlotResultMsg] = useState("");

  // Mines States
  const [minesBetInput, setMinesBetInput] = useState("100");
  const minesBet = Math.max(0, Number(minesBetInput) || 0);
  const [minesCount, setMinesCount] = useState(3);
  const [minesActive, setMinesActive] = useState(false);
  const [minesSessionToken, setMinesSessionToken] = useState<string | null>(null);
  const [minesGrid, setMinesGrid] = useState<
    ("hidden" | "gem" | "mine" | "revealed-gem")[]
  >(Array(25).fill("hidden"));
  const [minesMultiplier, setMinesMultiplier] = useState(1);
  const [minesSafeSelections, setMinesSafeSelections] = useState(0);

  // Dice States (1-6 choice with exact 3D face alignment!)
  const [diceBetInput, setDiceBetInput] = useState("10");
  const diceBet = Math.max(0, Number(diceBetInput) || 0);
  const [diceSelectedNum, setDiceSelectedNum] = useState<number>(1);
  const [dicePickedOnRoll, setDicePickedOnRoll] = useState<number>(1);
  const [diceBetOnRoll, setDiceBetOnRoll] = useState<number>(10);
  const [diceIsRollingState, setDiceIsRollingState] = useState<boolean>(false);
  const [diceRotX, setDiceRotX] = useState<number>(0);
  const [diceRotY, setDiceRotY] = useState<number>(0);
  const [diceResultVal, setDiceResultVal] = useState<number | null>(null);
  const [diceResultMsg, setDiceResultMsg] = useState("");

  // Tower States
  const [towerBetInput, setTowerBetInput] = useState("10");
  const towerBet = Math.max(0, Number(towerBetInput) || 0);
  const [towerDifficulty, setTowerDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("easy");
  const [towerActive, setTowerActive] = useState(false);
  const [towerSessionToken, setTowerSessionToken] = useState<string | null>(null);
  const [towerLevel, setTowerLevel] = useState(0); // 0 to 10
  const [towerGrid, setTowerGrid] = useState<number[][]>([]); // 1 = safe, 0 = skull
  const [towerUserHistory, setTowerUserHistory] = useState<number[]>([]);
  const [towerReveal, setTowerReveal] = useState(false);

  const slotEmojis = ["🍒", "🍋", "🍇", "💎", "🔔", "7️⃣"];

  // Helper to safely set percentage bet without exceeding cash
  const getPercentageBet = (pct: number, minBet = 1): string => {
    const avail = Math.max(0, Number(userStats.cash) || 0);
    if (avail <= 0) return String(minBet);
    const raw = pct >= 1 ? Math.floor(avail) : Math.floor(avail * pct);
    const clamped = Math.min(1000000, Math.max(minBet, Math.min(Math.floor(avail), raw)));
    return String(clamped > 0 ? clamped : Math.min(avail, minBet));
  };

  // --- Game Executions ---

  // 1. Coinflip
  const playCoinflip = async () => {
    if (coinIsFlapping || isSubmittingRef.current) return;
    const betAmount = Number(coinBetInput);
    if (typeof betAmount !== "number" || isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }

    if (Number(userStats.cash) < betAmount) {
      triggerLocalNotice(
        "Insufficient Funds",
        `You only have $${Number(userStats.cash).toLocaleString("en-US", { minimumFractionDigits: 2 })} available.`,
        true,
      );
      return;
    }

    isSubmittingRef.current = true;
    setCoinIsFlapping(true);
    setCoinOutcome(null);
    setCoinResultMsg("");

    try {
      const res = await apiCoinflip(betAmount, coinSide);

      setTimeout(() => {
        setCoinOutcome(res.outcome);
        setCoinIsFlapping(false);
        isSubmittingRef.current = false;

        applyServerUserStats(res.userStats);

        if (res.won) {
          setCoinResultMsg(
            `🎉 YOU WON! Landed on ${res.outcome.toUpperCase()} — Paid $${res.payout.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`,
          );
          onAddNotification(
            "Winner Coinflip",
            `Won $${res.payout.toLocaleString("en-US")} on ${coinSide.toUpperCase()}!`,
            "info",
          );
        } else {
          setCoinResultMsg(
            `❌ Landed on ${res.outcome.toUpperCase()} (You picked ${coinSide.toUpperCase()}) • Lost $${betAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          );
        }
      }, 900);
    } catch (err: any) {
      setCoinIsFlapping(false);
      isSubmittingRef.current = false;
      triggerLocalNotice("Coinflip Error", formatErrorMessage(err, "Failed to place coinflip bet."), true);
    }
  };

  // 2. Slots
  const playSlots = async () => {
    if (slotIsSpinning || isSubmittingRef.current) return;
    const betAmount = Number(slotBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    if (userStats.cash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "You do not have enough cash to spin the Slots reels!", true);
      return;
    }

    isSubmittingRef.current = true;
    setSlotIsSpinning(true);
    setSlotResultMsg("");

    try {
      const res = await apiArcadeWager("slots", "play", { bet: betAmount });

      let spinCounter = 0;
      const interval = setInterval(() => {
        setSlotReels([
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        ]);
        spinCounter++;
        if (spinCounter >= 7) {
          clearInterval(interval);
          setSlotReels(res.reels);
          setSlotIsSpinning(false);
          isSubmittingRef.current = false;

          applyServerUserStats(res.userStats);

          if (res.matchCount === 1) {
            setSlotResultMsg(
              `🎰 TRIPLE MATCH JACKPOT! Three ${res.reels[0]}! Payout: $${res.payout.toLocaleString()}`,
            );
            onAddNotification(
              "JACKPOT SLOT",
              `Hit triple ${res.reels[0]} for $${res.payout} return!`,
              "info",
            );
          } else if (res.matchCount === 2) {
            setSlotResultMsg(
              `✨ Double Match! Two matching symbols. Payout: $${res.payout.toLocaleString()}`,
            );
          } else {
            setSlotResultMsg(
              `❌ No match (${res.reels.join(" ")}) • Lost $${betAmount.toLocaleString()}`,
            );
          }
        }
      }, 95);
    } catch (err: any) {
      setSlotIsSpinning(false);
      isSubmittingRef.current = false;
      triggerLocalNotice("Slots Error", formatErrorMessage(err, "Failed to spin slots."), true);
    }
  };

  // 3. Mines (Server-Side Secrets + Signed Session Token)
  const startMinesGame = async () => {
    if (minesActive || isSubmittingRef.current) return;
    const betAmount = Number(minesBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    if (userStats.cash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "You do not have enough cash to place a Mines bet!", true);
      return;
    }

    isSubmittingRef.current = true;
    try {
      const res = await apiArcadeWager("mines", "start", {
        bet: betAmount,
        minesCount,
      });

      applyServerUserStats(res.userStats);
      setMinesSessionToken(res.sessionToken || null);
      setMinesGrid(Array(25).fill("hidden"));
      setMinesActive(true);
      setMinesSafeSelections(0);
      setMinesMultiplier(1);
    } catch (err: any) {
      triggerLocalNotice("Mines Error", formatErrorMessage(err, "Could not start Mines game."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleMinesCellClick = async (cellIdx: number) => {
    if (!minesActive || minesGrid[cellIdx] !== "hidden" || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    try {
      const res = await apiArcadeWager("mines", "step", {
        cellIndex: cellIdx,
        sessionToken: minesSessionToken,
      });
      if (res.sessionToken) {
        setMinesSessionToken(res.sessionToken);
      }
      const nextGrid = [...minesGrid];

      if (res.hitMine) {
        nextGrid[cellIdx] = "mine";
        if (res.secretMinesMap && Array.isArray(res.secretMinesMap)) {
          res.secretMinesMap.forEach((mine: boolean, idx: number) => {
            if (mine) nextGrid[idx] = "mine";
          });
        }
        setMinesGrid(nextGrid);
        setMinesActive(false);
        setMinesSessionToken(null);
        applyServerUserStats(res.userStats);
        triggerLocalNotice("KABOOM! Mine Hit!", "You hit a mine! Bet lost.", true);
      } else {
        nextGrid[cellIdx] = "revealed-gem";
        setMinesSafeSelections(res.safeSelections);
        setMinesGrid(nextGrid);
        setMinesMultiplier(res.multiplier);

        if (res.clearedAll) {
          applyServerUserStats(res.userStats);
          if (res.secretMinesMap) {
            const revealed = nextGrid.map((_, idx) =>
              res.secretMinesMap[idx] ? "mine" : "revealed-gem",
            );
            setMinesGrid(revealed);
          }
          setMinesActive(false);
          setMinesSessionToken(null);
          triggerLocalNotice(
            "Mines Cleared!",
            `Cleared all safe tiles! Cashed out $${res.winnings.toLocaleString()} at ${res.multiplier}x!`,
          );
        }
      }
    } catch (err: any) {
      triggerLocalNotice("Mines Error", formatErrorMessage(err, "Failed tile step."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const minesCashout = async () => {
    if (!minesActive || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    try {
      const actionType = minesSafeSelections === 0 ? "abort" : "cashout";
      const res = await apiArcadeWager("mines", actionType, {
        sessionToken: minesSessionToken,
        bet: minesBet,
      });
      applyServerUserStats(res.userStats);

      if (actionType === "abort") {
        setMinesGrid(Array(25).fill("hidden"));
        setMinesActive(false);
        setMinesSessionToken(null);
        triggerLocalNotice("Bet Refunded", `Refunded $${(res.refunded || minesBet).toLocaleString()} to your balance.`);
      } else {
        const nextGrid = minesGrid.map((cell, idx) => {
          if (res.secretMinesMap && res.secretMinesMap[idx]) return "mine";
          return cell === "revealed-gem" ? "revealed-gem" : "gem";
        });
        setMinesGrid(nextGrid);
        setMinesActive(false);
        setMinesSessionToken(null);
        triggerLocalNotice(
          "Mines Cashout!",
          `Cashed out $${res.winnings.toLocaleString()} at ${res.multiplier}x multiplier!`,
        );
      }
    } catch (err: any) {
      triggerLocalNotice("Mines Error", formatErrorMessage(err, "Could not cash out."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // 4. Dice Betting (Exact 3D Face Alignment — Zero Drift!)
  const getFaceRotation = (face: number) => {
    switch (face) {
      case 1:
        return { x: 0, y: 0 };
      case 2:
        return { x: -90, y: 0 };
      case 3:
        return { x: 0, y: -90 };
      case 4:
        return { x: 0, y: 90 };
      case 5:
        return { x: 90, y: 0 };
      case 6:
        return { x: 0, y: 180 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const renderDiceFace = (val: number) => {
    const dots: { [key: number]: number[] } = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };

    const activeDots = dots[val] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-2 w-16 h-16 p-1 bg-transparent select-none">
        {Array(9)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              {activeDots.includes(i) && (
                <div
                  className={`rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${
                    val === 1 ? "w-4 h-4 bg-rose-600" : "w-3 h-3 bg-zinc-950"
                  }`}
                />
              )}
            </div>
          ))}
      </div>
    );
  };

  const playDiceRoll = async () => {
    if (diceIsRollingState || isSubmittingRef.current) return;
    const betAmount = Number(diceBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    if (userStats.cash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "You need additional cash to execute the Dice Roll!", true);
      return;
    }

    const chosenNumber = diceSelectedNum;
    isSubmittingRef.current = true;
    setDiceIsRollingState(true);
    setDiceResultVal(null);
    setDiceResultMsg("");
    setDicePickedOnRoll(chosenNumber);
    setDiceBetOnRoll(betAmount);

    try {
      const res = await apiArcadeWager("dice", "play", {
        bet: betAmount,
        selectedNum: chosenNumber,
      });

      const landedFace = Number(res.landedFace);
      const baseRot = getFaceRotation(landedFace);

      // Snap current rotation to an exact multiple of 360 BEFORE adding spins + baseRot
      // so previous rolls' 90/-90/180 offsets NEVER accumulate and misalign the 3D cube!
      const cleanSpinsX = (Math.floor(diceRotX / 360) + 3 + Math.floor(Math.random() * 2)) * 360;
      const cleanSpinsY = (Math.floor(diceRotY / 360) + 3 + Math.floor(Math.random() * 2)) * 360;
      const nextRotX = cleanSpinsX + baseRot.x;
      const nextRotY = cleanSpinsY + baseRot.y;

      setDiceRotX(nextRotX);
      setDiceRotY(nextRotY);

      setTimeout(() => {
        setDiceIsRollingState(false);
        isSubmittingRef.current = false;
        setDiceResultVal(landedFace);

        applyServerUserStats(res.userStats);

        if (res.won) {
          const netWin = res.payout - betAmount;
          setDiceResultMsg(
            `Rolled ${landedFace} (You picked ${chosenNumber}) • Won +$${netWin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`,
          );
          onAddNotification(
            "Winner Dice Roll",
            `Hit ${landedFace} on Dice Roll for 3x ($${res.payout.toLocaleString()})!`,
            "info",
          );
        } else {
          setDiceResultMsg(
            `Rolled ${landedFace} (You picked ${chosenNumber}) • Lost $${betAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          );
        }
      }, 1080);
    } catch (err: any) {
      setDiceIsRollingState(false);
      isSubmittingRef.current = false;
      triggerLocalNotice("Dice Error", formatErrorMessage(err, "Failed dice roll."), true);
    }
  };

  // 5. Tower Climb (Server-Authoritative Grid + Signed Session Token)
  const startTowerGame = async () => {
    if (towerActive || isSubmittingRef.current) return;
    const betAmount = Number(towerBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    if (userStats.cash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "Not enough cash to start Tower Climb!", true);
      return;
    }

    isSubmittingRef.current = true;
    try {
      const res = await apiArcadeWager("tower", "start", {
        bet: betAmount,
        difficulty: towerDifficulty,
      });

      applyServerUserStats(res.userStats);
      setTowerSessionToken(res.sessionToken || null);
      setTowerUserHistory([]);
      setTowerLevel(0);
      setTowerReveal(false);
      setTowerActive(true);
    } catch (err: any) {
      triggerLocalNotice("Tower Error", formatErrorMessage(err, "Could not start Tower climb."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleTowerStep = async (colIndex: number) => {
    if (!towerActive || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    try {
      const res = await apiArcadeWager("tower", "step", {
        colIndex,
        sessionToken: towerSessionToken,
      });
      if (res.sessionToken) {
        setTowerSessionToken(res.sessionToken);
      }
      const nextHistory = [...towerUserHistory, colIndex];
      setTowerUserHistory(nextHistory);

      if (res.hitSkull) {
        setTowerActive(false);
        setTowerSessionToken(null);
        setTowerReveal(true);
        if (res.secretGrid) {
          setTowerGrid(res.secretGrid);
        }
        applyServerUserStats(res.userStats);
        setShowTowerResultModal({
          success: false,
          title: "TOWER OVER!",
          message: "💀 You hit a trap block. Your climb bet has been lost.",
        });
      } else {
        setTowerLevel(res.level);

        if (res.clearedTop) {
          applyServerUserStats(res.userStats);
          if (res.secretGrid) setTowerGrid(res.secretGrid);
          setTowerActive(false);
          setTowerSessionToken(null);
          setTowerReveal(true);
          setShowTowerResultModal({
            success: true,
            title: "CONGRATULATIONS!",
            message: "🗼 GRAND CLEAR! You conquered floor 10 and cashed out!",
            payout: res.winnings,
            multiplier: res.multiplier,
          });
        }
      }
    } catch (err: any) {
      triggerLocalNotice("Tower Error", formatErrorMessage(err, "Tower step error."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const getTowerMultiplier = (
    level: number,
    diff: "easy" | "medium" | "hard" = towerDifficulty,
  ) => {
    if (level === 0) return 1.0;
    const idx = level - 1;
    if (diff === "easy") {
      const arr = [1.05, 1.15, 1.3, 2.85, 3.7, 4.8, 6.25, 8.1, 10.5, 13.5];
      return arr[Math.min(idx, arr.length - 1)];
    } else if (diff === "medium") {
      const arr = [1.15, 1.4, 1.8, 8.0, 13.2, 21.8, 36.0, 59.5, 98.0, 162.0];
      return arr[Math.min(idx, arr.length - 1)];
    } else {
      const arr = [
        1.3, 2.0, 4.0, 63.22, 178.29, 502.77, 1417.82, 3998.24, 11275.05,
        31795.63,
      ];
      return arr[Math.min(idx, arr.length - 1)];
    }
  };

  const towerCashout = async () => {
    if (!towerActive || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    try {
      const res = await apiArcadeWager("tower", "cashout", {
        sessionToken: towerSessionToken,
      });
      applyServerUserStats(res.userStats);

      setTowerActive(false);
      setTowerSessionToken(null);
      setTowerReveal(true);
      if (res.secretGrid) setTowerGrid(res.secretGrid);

      setShowTowerResultModal({
        success: true,
        title: "TOWER CLAIMED!",
        message: `🗼 Cashed out successfully for $${res.winnings.toLocaleString()} (${res.multiplier}x)!`,
        payout: res.winnings,
        multiplier: res.multiplier,
      });
    } catch (err: any) {
      triggerLocalNotice("Tower Error", formatErrorMessage(err, "Cashout failed."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const abortTowerBet = async () => {
    if (!towerActive || towerLevel > 0 || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const res = await apiArcadeWager("tower", "abort", {
        sessionToken: towerSessionToken,
        bet: towerBet,
      });
      applyServerUserStats(res.userStats);
      setTowerActive(false);
      setTowerSessionToken(null);
      setTowerReveal(false);
      triggerLocalNotice("Bet Refunded", `Refunded $${(res.refunded || towerBet).toLocaleString()} to your balance.`);
    } catch (err: any) {
      setTowerActive(false);
      setTowerSessionToken(null);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in w-full max-w-full overflow-hidden">
      {/* Universal in-game localNotice toast notifications */}
      {localNotice && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md glass-panel border ${
            localNotice.isError ? "border-rose-500/60" : "border-emerald-500/60"
          } p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 z-50 animate-fade-in`}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">
              {localNotice.isError ? "⚠️" : "🎉"}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">
                {localNotice.title}
              </span>
              <span className="text-[10px] text-zinc-300 mt-0.5">
                {localNotice.message}
              </span>
            </div>
          </div>
          <button
            onClick={() => setLocalNotice(null)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sleek Custom Dark-Themed Tower Result Overlay Modal */}
      {showTowerResultModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="glass-modal p-6 rounded-3xl max-w-sm w-full relative font-mono text-center shadow-2xl animate-fade-in">
            <button
              onClick={() => setShowTowerResultModal(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border shadow-lg ${
                showTowerResultModal.success
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-300"
              }`}
            >
              {showTowerResultModal.success ? "🏆" : "💀"}
            </div>
            <h3
              className={`text-base font-extrabold uppercase tracking-widest mb-2 ${
                showTowerResultModal.success
                  ? "text-emerald-400"
                  : "text-rose-400 font-bold"
              }`}
            >
              {showTowerResultModal.title}
            </h3>
            <p className="text-xs text-zinc-300 mb-5 leading-relaxed font-semibold">
              {showTowerResultModal.message}
            </p>

            {showTowerResultModal.success &&
              showTowerResultModal.payout !== undefined && (
                <div className="glass-card p-3.5 rounded-2xl border border-white/10 w-full mb-5 flex flex-col gap-1 text-center select-none font-mono">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest">
                    Winnings Received
                  </span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    +${showTowerResultModal.payout.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-bold">
                    Multiplier: {showTowerResultModal.multiplier?.toFixed(2)}x
                  </span>
                </div>
              )}

            <button
              onClick={() => setShowTowerResultModal(null)}
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all select-none border font-mono cursor-pointer ${
                showTowerResultModal.success
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-white/20 active:scale-98 text-white shadow-xl"
                  : "glass-pill border border-white/15 hover:bg-white/10 text-zinc-200"
              }`}
            >
              {showTowerResultModal.success ? "Collect Profits" : "Try Again"}
            </button>
          </div>
        </div>
      )}

      {/* Side selection column */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-extrabold text-zinc-300 font-mono tracking-widest uppercase flex items-center gap-2 mb-1.5 leading-none">
          <Gamepad2 className="text-rose-500 w-4 h-4" /> Arcade Selection
        </h2>
        {(["coinflip", "slots", "mines", "dice", "tower"] as const).map(
          (game) => (
            <button
              key={game}
              onClick={() => setSelectedGame(game)}
              className={`px-4 py-3 rounded-2xl border font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-between text-left transition-all select-none cursor-pointer ${
                selectedGame === game
                  ? "bg-rose-500/20 text-white border-rose-500/50 shadow-lg shadow-rose-950/20"
                  : "glass-card text-zinc-400 border-white/10 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <span>{game} simulator</span>
              <span className="text-[10px] glass-pill px-1.5 py-0.5 border border-white/10 rounded-md select-none uppercase font-black text-zinc-300">
                {game === "coinflip"
                  ? "1.9x"
                  : game === "slots"
                    ? "Jackpot"
                    : game === "dice"
                      ? "3.0x"
                      : "Multi"}
              </span>
            </button>
          ),
        )}
      </div>

      {/* Main Game Screen panel */}
      <div className="lg:col-span-3 glass-panel border border-white/10 p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative min-h-[440px]">
        {/* Game Title Headers */}
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-extrabold text-white text-sm capitalize font-mono tracking-wider flex items-center gap-1.5 leading-none">
              <Sparkles className="w-4 h-4 text-rose-400" /> {selectedGame}
            </h3>
            <span className="text-xs text-zinc-400 font-medium leading-none mt-1">
              {selectedGame === "coinflip" &&
                "50/50 double-or-nothing simulator."}
              {selectedGame === "slots" &&
                "Classic spin matching to pull grand simulated jackpot."}
              {selectedGame === "mines" &&
                "Evade hidden direct delist mines to stack mults."}
              {selectedGame === "dice" &&
                "Choose a number (1-6) and roll the dice to win 3x your bet!"}
              {selectedGame === "tower" &&
                "Step columns without skull surprises to rise payout."}
            </span>
          </div>

          <div className="flex items-center gap-1.5 glass-card p-2 px-3 border border-white/10 rounded-2xl font-mono text-xs select-none shadow-sm">
            <span className="text-zinc-400">Balance:</span>
            <span className="font-extrabold text-emerald-400">
              $
              {userStats.cash.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Dynamic Game Workspace view */}
        <div className="flex-1 flex flex-col justify-center items-center py-4 glass-card p-4 border border-white/10 rounded-2xl">
          {selectedGame === "coinflip" && (
            <div className="flex flex-col items-center gap-5 w-full max-w-xs font-mono">
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 gap-1 w-full text-center text-xs font-bold uppercase select-none">
                <button
                  onClick={() => setCoinSide("heads")}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    coinSide === "heads"
                      ? "bg-orange-600 text-white shadow"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  💂 Heads
                </button>
                <button
                  onClick={() => setCoinSide("tails")}
                  className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    coinSide === "tails"
                      ? "bg-orange-600 text-white shadow"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  🛡️ Tails
                </button>
              </div>

              {/* Graphical Flipping Coin */}
              <div className="h-28 flex items-center justify-center relative perspective-1000">
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400 flex items-center justify-center border-4 border-amber-950 shadow-lg shadow-orange-950/20 text-3xl font-black text-white select-none ${
                    coinIsFlapping ? "animate-spin-fast" : "animate-pulse-subtle"
                  }`}
                >
                  {coinOutcome === "heads"
                    ? "💂"
                    : coinOutcome === "tails"
                      ? "🛡️"
                      : "🪙"}
                </div>
              </div>

              {coinResultMsg && (
                <div className="text-center font-bold text-xs bg-zinc-900/60 p-2.5 border border-zinc-800 rounded-xl w-full">
                  {coinResultMsg}
                </div>
              )}

              {/* Coinflip controls */}
              <div className="flex flex-col gap-2.5 w-full font-mono">
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    placeholder="Bet amount..."
                    value={coinBetInput}
                    onChange={(e) => setCoinBetInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase select-none">
                    USD
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold px-1">
                  <span>Max bet: 1,000,000</span>
                </div>

                {/* Percentage Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-bold text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setCoinBetInput(getPercentageBet(0.25, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinBetInput(getPercentageBet(0.5, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinBetInput(getPercentageBet(0.75, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinBetInput(getPercentageBet(1, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    Max
                  </button>
                </div>

                <button
                  onClick={playCoinflip}
                  disabled={coinIsFlapping}
                  className="w-full bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 disabled:opacity-50 cursor-pointer active:scale-98 transition-all text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-lg border border-orange-500 mt-1"
                >
                  {coinIsFlapping ? "Flipping..." : "Flip Coin"}
                </button>
              </div>
            </div>
          )}

          {selectedGame === "slots" && (
            <div className="flex flex-col items-center gap-5 w-full max-w-xs font-mono">
              {/* Reels Display box */}
              <div className="flex gap-3 justify-center items-center py-6 px-10 bg-zinc-950 border-4 border-zinc-900 rounded-2xl shadow-inner relative overflow-hidden select-none">
                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-zinc-900" />
                <div className="absolute top-0 bottom-0 right-1/3 w-px bg-zinc-900" />
                {slotReels.map((emoji, idx) => (
                  <span
                    key={idx}
                    className={`text-4xl transition-transform ${slotIsSpinning ? "scale-105 brightness-110" : "scale-100"}`}
                  >
                    {emoji}
                  </span>
                ))}
              </div>

              {slotResultMsg && (
                <div className="text-center font-bold text-xs bg-zinc-900/60 p-2.5 border border-zinc-800 rounded-xl w-full select-none">
                  {slotResultMsg}
                </div>
              )}

              {/* Slots controls */}
              <div className="flex flex-col gap-2.5 w-full font-mono font-medium">
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    placeholder="Bet amount..."
                    value={slotBetInput}
                    onChange={(e) => setSlotBetInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase select-none">
                    USD
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold px-1">
                  <span>Max bet: 1,000,000</span>
                </div>

                {/* Percentage Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-bold text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setSlotBetInput(getPercentageBet(0.25, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotBetInput(getPercentageBet(0.5, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotBetInput(getPercentageBet(0.75, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotBetInput(getPercentageBet(1, 10))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    Max
                  </button>
                </div>

                <button
                  onClick={playSlots}
                  disabled={slotIsSpinning}
                  className="w-full bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 disabled:opacity-50 cursor-pointer active:scale-98 transition-all text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-lg border border-orange-500 mt-1"
                >
                  {slotIsSpinning ? "Spinning..." : "Spin Slots"}
                </button>
              </div>
            </div>
          )}

          {selectedGame === "mines" && (
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-md items-center justify-between font-mono">
              {/* Mines 5x5 grid */}
              <div className="grid grid-cols-5 gap-1.5 w-full aspect-square bg-zinc-950/80 p-3 rounded-2xl border border-zinc-900 relative">
                {minesGrid.map((state, idx) => (
                  <button
                    key={idx}
                    disabled={!minesActive}
                    onClick={() => handleMinesCellClick(idx)}
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-lg font-bold border transition-all ${
                      state === "hidden"
                        ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 cursor-pointer hover:border-zinc-700"
                        : state === "mine"
                          ? "bg-red-950 border-red-500 text-red-400"
                          : state === "revealed-gem"
                            ? "bg-emerald-950 border-emerald-500 text-emerald-400 scale-95"
                            : "bg-zinc-950 border-zinc-900 text-zinc-600 font-medium"
                    }`}
                  >
                    {state === "mine"
                      ? "💣"
                      : state === "revealed-gem"
                        ? "💎"
                        : state === "gem"
                          ? "💎"
                          : ""}
                  </button>
                ))}
              </div>

              {/* Side config information column */}
              <div className="flex flex-col gap-3 w-full md:w-44 shrink-0 justify-between self-stretch">
                <div className="flex flex-col gap-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-900 select-none">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Mines:</span>
                    <span className="font-extrabold text-orange-400">
                      {minesCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Safe cleared:</span>
                    <span className="font-extrabold text-zinc-300">
                      {minesSafeSelections}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500 border-t border-zinc-900/40 mt-1 pt-1">
                    <span>Multiplier:</span>
                    <span className="font-extrabold text-emerald-400">
                      {minesMultiplier}x
                    </span>
                  </div>
                </div>

                {minesActive ? (
                  <button
                    onClick={() => minesCashout()}
                    className={`w-full py-2.5 rounded-xl font-bold font-mono text-xs shadow-md uppercase tracking-wider cursor-pointer ${
                      minesSafeSelections === 0
                        ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                  >
                    {minesSafeSelections === 0
                      ? `Cancel & Refund $${minesBet.toLocaleString()}`
                      : `Cashout $${Math.floor(minesBet * minesMultiplier).toLocaleString()}`}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Bet box */}
                    <div className="flex flex-col gap-1 font-mono">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono">
                        Bet Amount
                      </span>
                      <div className="relative font-mono">
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          value={minesBetInput}
                          onChange={(e) => setMinesBetInput(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-xs font-bold focus:outline-none font-mono text-white"
                        />
                      </div>
                      <span className="text-[9px] text-zinc-500 font-semibold px-1">
                        Max bet: 1,000,000
                      </span>
                      {/* Percentage Shortcuts */}
                      <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] font-bold text-zinc-400">
                        <button
                          type="button"
                          onClick={() => setMinesBetInput(getPercentageBet(0.25, 10))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinesBetInput(getPercentageBet(0.5, 10))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinesBetInput(getPercentageBet(0.75, 10))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          75%
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinesBetInput(getPercentageBet(1, 10))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                    {/* Select mines count */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        Mines Count
                      </span>
                      <select
                        value={minesCount}
                        onChange={(e) => setMinesCount(Number(e.target.value))}
                        className="bg-zinc-950 border border-zinc-800 px-2 py-1.5 rounded-lg text-xs font-bold focus:outline-none text-white"
                      >
                        {[1, 2, 3, 5, 8, 12, 18, 24].map((cnt) => (
                          <option key={cnt} value={cnt}>
                            {cnt} Mines
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={startMinesGame}
                      className="w-full bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 cursor-pointer py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider border border-orange-500 mt-2 hover:brightness-110 active:scale-98 transition-all"
                    >
                      Start Mines
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedGame === "dice" && (
            <div className="flex flex-col items-center gap-6 w-full max-w-sm font-mono select-none">
              {/* Centered Balance Indicator */}
              <div className="flex flex-col items-center gap-0.5 select-none text-center">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none">
                  Balance
                </span>
                <span className="text-2xl font-black text-white leading-none tracking-tight">
                  $
                  {userStats.cash.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Graphical 3D Flipping Dice Cube */}
              <div className="h-44 flex items-center justify-center relative w-full select-none">
                <div className="dice-scene">
                  <div className="dice-cube-wrapper">
                    <div
                      className="dice-cube"
                      style={{
                        transform: `rotateX(${diceRotX}deg) rotateY(${diceRotY}deg)`,
                      }}
                    >
                      <div className="dice-face dice-face-1">
                        {renderDiceFace(1)}
                      </div>
                      <div className="dice-face dice-face-6">
                        {renderDiceFace(6)}
                      </div>
                      <div className="dice-face dice-face-3">
                        {renderDiceFace(3)}
                      </div>
                      <div className="dice-face dice-face-4">
                        {renderDiceFace(4)}
                      </div>
                      <div className="dice-face dice-face-2">
                        {renderDiceFace(2)}
                      </div>
                      <div className="dice-face dice-face-5">
                        {renderDiceFace(5)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner outcome display overlay */}
                {diceResultVal !== null && !diceIsRollingState && (
                  <div className="absolute inset-x-0 bottom-[-14px] flex justify-center animate-fade-in px-2">
                    <div
                      className={`px-5 py-2 rounded-xl flex flex-col items-center shadow-2xl border text-center font-bold tracking-mono text-[11px] max-w-[95%] sm:min-w-[230px] backdrop-blur-md ${
                        diceResultVal === dicePickedOnRoll
                          ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-300"
                          : "bg-rose-950/95 border-rose-500/50 text-rose-300"
                      }`}
                    >
                      <span
                        className={`text-[12px] font-black tracking-widest leading-normal ${
                          diceResultVal === dicePickedOnRoll
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {diceResultVal === dicePickedOnRoll
                          ? `🎉 WIN — ROLLED ${diceResultVal}`
                          : `❌ LOSS — ROLLED ${diceResultVal}`}
                      </span>
                      <span className="opacity-95 font-mono text-[10px] mt-0.5">
                        {diceResultVal === dicePickedOnRoll
                          ? `Picked ${dicePickedOnRoll} • Won +$${(diceBetOnRoll * 2).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : `You picked ${dicePickedOnRoll} • Lost $${diceBetOnRoll.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Choose Predict Number Buttons (1-6) */}
              <div className="flex flex-col gap-1.5 w-full mt-2">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest font-mono text-center mb-0.5">
                  Choose Number
                </span>
                <div className="grid grid-cols-6 gap-2 w-full">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={diceIsRollingState}
                      onClick={() => {
                        setDiceSelectedNum(num);
                        setDiceResultVal(null);
                      }}
                      className={`h-11 rounded-xl text-sm font-black font-mono transition-all border flex items-center justify-center select-none ${
                        diceSelectedNum === num
                          ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow shadow-rose-950/50 scale-102 font-extrabold"
                          : "bg-zinc-950 text-zinc-400 border-zinc-900/60 hover:text-zinc-300 hover:border-zinc-800 cursor-pointer disabled:opacity-50"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-2.5 w-full font-mono">
                <div className="relative font-mono">
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest font-mono block mb-1">
                    Bet Amount
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    placeholder="Bet amount..."
                    value={diceBetInput}
                    disabled={diceIsRollingState}
                    onChange={(e) => setDiceBetInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono disabled:opacity-50"
                  />
                  <span className="absolute right-3.5 bottom-3 text-[10px] text-zinc-500 font-bold uppercase select-none">
                    USD
                  </span>
                </div>

                <div className="flex justify-between items-center text-[9px] text-zinc-500 font-semibold px-1 tracking-wider leading-none">
                  <span>Max bet: 1,000,000</span>
                </div>

                {/* Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-bold text-zinc-400">
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBetInput(getPercentageBet(0.25, 1))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBetInput(getPercentageBet(0.5, 1))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBetInput(getPercentageBet(0.75, 1))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBetInput(getPercentageBet(1, 1))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    Max
                  </button>
                </div>

                <button
                  type="button"
                  onClick={playDiceRoll}
                  disabled={diceIsRollingState}
                  className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-950 disabled:border-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed py-3.5 rounded-xl font-black text-xs uppercase text-white tracking-widest shadow-xl border border-rose-500 mt-2 font-mono transition-all cursor-pointer"
                >
                  {diceIsRollingState ? "Rolling..." : "Roll"}
                </button>
              </div>
            </div>
          )}

          {selectedGame === "tower" && (
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center font-mono select-none">
              <div className="text-center w-full max-w-sm mb-2">
                <h3 className="text-sm font-bold text-zinc-300">Tower</h3>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Climb the tower by picking safe tiles. Cash out before hitting
                  a bomb!
                </p>
              </div>

              {/* Vertical ascending levels layout: bottom to top */}
              <div className="flex flex-col-reverse gap-1.5 bg-zinc-950 p-2.5 rounded-2xl border border-zinc-900 items-stretch font-mono w-full">
                {Array(10)
                  .fill(0)
                  .map((_, idx) => {
                    const lvlIdx = 9 - idx;
                    const isCurrent = lvlIdx === towerLevel;
                    const isPassed = lvlIdx < towerLevel;
                    const userChosenCol = towerUserHistory[lvlIdx];
                    const displayNum = lvlIdx + 1;
                    const multVal = getTowerMultiplier(displayNum);

                    let colsCount = 3;
                    if (towerDifficulty === "medium") {
                      colsCount = 2;
                    }

                    return (
                      <div
                        key={lvlIdx}
                        className={`flex items-center gap-3 py-1 px-2.5 rounded-xl transition-all border ${
                          isCurrent
                            ? "bg-rose-950/10 border-rose-500/60 shadow-md shadow-rose-950/20"
                            : isPassed
                              ? "bg-transparent border-transparent opacity-90"
                              : "bg-transparent border-transparent opacity-25"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 w-[76px] shrink-0 font-mono font-black select-none text-[10px]">
                          <div className="w-3 text-center">
                            {isCurrent && (
                              <span className="text-red-500 animate-pulse text-xs leading-none">
                                ▶
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-500 w-3 text-right leading-none">
                            {displayNum}
                          </span>
                          <span
                            className={`w-12 text-right leading-none ${isCurrent ? "text-red-400 font-extrabold" : isPassed ? "text-emerald-400 font-extrabold" : "text-zinc-400"}`}
                          >
                            {multVal.toFixed(2)}x
                          </span>
                        </div>

                        <div
                          className="grid gap-1.5 flex-1"
                          style={{
                            gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))`,
                          }}
                        >
                          {Array(colsCount)
                            .fill(0)
                            .map((_, colIdx) => {
                              const isChosen = userChosenCol === colIdx;
                              const isCellSafe =
                                towerGrid[lvlIdx]?.[colIdx] === 1;

                              let cellStyle = "bg-zinc-900/45 border-zinc-900";
                              let iconContent = null;

                              if (towerActive) {
                                if (isCurrent) {
                                  cellStyle =
                                    "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white cursor-pointer active:scale-95";
                                } else if (isPassed) {
                                  if (isChosen) {
                                    cellStyle =
                                      "bg-emerald-950/40 border-emerald-500/80 text-emerald-400 shadow-inner shadow-emerald-950/30";
                                    iconContent = (
                                      <Shield className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />
                                    );
                                  } else {
                                    cellStyle =
                                      "bg-zinc-950/70 border-zinc-950/60 text-zinc-800";
                                  }
                                } else {
                                  cellStyle =
                                    "bg-zinc-950/40 border-zinc-950/10 text-zinc-800 opacity-60";
                                }
                              } else if (towerReveal) {
                                if (isCellSafe) {
                                  if (isPassed && isChosen) {
                                    cellStyle =
                                      "bg-emerald-950/55 border-emerald-500 text-emerald-400 font-black";
                                    iconContent = (
                                      <Shield className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />
                                    );
                                  } else {
                                    cellStyle =
                                      "bg-zinc-900/50 border-zinc-800 text-zinc-600";
                                    iconContent = (
                                      <Lock className="w-3 h-3 text-zinc-700 font-bold" />
                                    );
                                  }
                                } else {
                                  if (isChosen) {
                                    cellStyle =
                                      "bg-red-900 border-red-500 text-white animate-pulse shadow-md";
                                    iconContent = (
                                      <Skull className="w-3.5 h-3.5 text-white" />
                                    );
                                  } else {
                                    cellStyle =
                                      "bg-red-950/20 border-red-900/30 text-red-700/80";
                                    iconContent = (
                                      <Skull className="w-3 h-3 text-red-900/60" />
                                    );
                                  }
                                }
                              } else {
                                cellStyle =
                                  "bg-zinc-900/20 border-zinc-800/30 text-zinc-700/40";
                                if ((lvlIdx + colIdx) % 3 === 0) {
                                  iconContent = (
                                    <Lock className="w-2.5 h-2.5 text-zinc-800" />
                                  );
                                }
                              }

                              return (
                                <button
                                  key={colIdx}
                                  disabled={!towerActive || !isCurrent}
                                  onClick={() => handleTowerStep(colIdx)}
                                  className={`h-9 rounded-lg flex items-center justify-center font-black transition-all border select-none ${cellStyle}`}
                                >
                                  {iconContent}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Tower betting controls */}
              <div className="flex flex-col gap-4 w-full max-w-sm mt-3">
                <div className="flex flex-col items-center justify-center py-1 select-none font-sans">
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none font-mono">
                    Balance
                  </span>
                  <span className="text-2xl font-black text-white mt-1.5 leading-none font-mono">
                    {formatCash(userStats.cash)}
                  </span>
                </div>

                {/* Difficulty tab selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider font-mono">
                    Difficulty
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
                    {(["easy", "medium", "hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        disabled={towerActive}
                        onClick={() => {
                          setTowerDifficulty(diff);
                          setTowerReveal(false);
                          setTowerLevel(0);
                        }}
                        className={`py-2 rounded-lg text-xs font-black capitalize transition-all font-mono select-none ${
                          towerDifficulty === diff
                            ? "bg-rose-600 text-white shadow-md"
                            : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 cursor-pointer disabled:opacity-40"
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9.5px] text-zinc-500 font-black px-1 font-mono leading-none">
                    {towerDifficulty === "easy" && "2 safe / 3 tiles per floor"}
                    {towerDifficulty === "medium" &&
                      "1 safe / 2 tiles per floor"}
                    {towerDifficulty === "hard" && "1 safe / 3 tiles per floor"}
                  </span>
                </div>

                {/* Bet controls */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider font-mono">
                    Bet Amount
                  </span>
                  <div className="relative font-mono font-bold">
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={towerBetInput}
                      disabled={towerActive}
                      onChange={(e) => setTowerBetInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-bold leading-none focus:outline-none focus:border-zinc-700 font-mono text-zinc-200 disabled:opacity-60 rounded-lg"
                    />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-semibold px-1 font-mono leading-none">
                    Max bet: 1,000,000
                  </span>

                  {/* Percentage Shortcuts */}
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold text-zinc-400 mt-0.5">
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBetInput(getPercentageBet(0.25, 1))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBetInput(getPercentageBet(0.5, 1))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBetInput(getPercentageBet(0.75, 1))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      75%
                    </button>
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBetInput(getPercentageBet(1, 1))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Play/Control Action Button */}
                <div className="mt-1">
                  {towerActive ? (
                    towerLevel === 0 ? (
                      <button
                        onClick={abortTowerBet}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 hover:text-white py-3 rounded-xl text-zinc-300 font-extrabold text-[12px] uppercase tracking-wider border border-zinc-800 transition-all active:scale-98 font-mono shadow-md cursor-pointer"
                      >
                        Cancel &amp; Refund Bet (${towerBet.toLocaleString()})
                      </button>
                    ) : (
                      <button
                        onClick={() => towerCashout()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-white font-extrabold text-[12px] uppercase tracking-wider transition-all active:scale-98 font-mono shadow-md flex flex-col items-center justify-center h-12 leading-tight cursor-pointer"
                      >
                        <span>Cash Out</span>
                        <span className="text-[9.5px] text-emerald-100 font-bold mt-0.5">
                          $
                          {Math.floor(
                            towerBet * getTowerMultiplier(towerLevel),
                          ).toLocaleString()}
                        </span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={startTowerGame}
                      className="w-full bg-rose-600 hover:bg-rose-500 py-3 rounded-xl text-white font-black text-[12px] uppercase tracking-widest transition-all active:scale-98 font-mono shadow-md cursor-pointer"
                    >
                      Start Game
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick game assistance alerts */}
        <div className="mt-4 flex items-start gap-2 text-zinc-500 font-mono text-[10px] select-none leading-relaxed border-t border-zinc-800/30 pt-3">
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
          <span>
            Simulated casino algorithm. All bets are strictly simulated
            currency. Prestige counts total profits as progression metrics. Keep
            trading meme coins to maintain cash reserves.
          </span>
        </div>
      </div>
    </div>
  );
}
