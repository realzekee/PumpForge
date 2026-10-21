import React, { useState, useEffect, useRef } from "react";
import {
  Gamepad2,
  Shield,
  Skull,
  Lock,
  X,
  TrendingUp,
  TrendingDown,
  Crown,
  Diamond,
} from "lucide-react";
import { UserStats } from "../types";
import { useAppContext } from "../context/AppContext";
import { apiArcadeWager, apiCoinflip } from "../api/gameClient";
import { formatErrorMessage } from "../utils/formatError";
import { playSound } from "../utils/sound";

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

interface HighRollerFlip {
  id: string;
  handle: string;
  side: "heads" | "tails";
  bet: number;
  payout: number;
  won: boolean;
  timestamp: string;
}

const INITIAL_HIGH_ROLLER_FLIPS: HighRollerFlip[] = [
  {
    id: "hr_1",
    handle: "@whale",
    side: "heads",
    bet: 5000,
    payout: 10000,
    won: true,
    timestamp: "Just now",
  },
  {
    id: "hr_2",
    handle: "@stonks",
    side: "tails",
    bet: 2500,
    payout: 0,
    won: false,
    timestamp: "1m ago",
  },
  {
    id: "hr_3",
    handle: "@sol_expert",
    side: "heads",
    bet: 10000,
    payout: 20000,
    won: true,
    timestamp: "2m ago",
  },
  {
    id: "hr_4",
    handle: "@alpha",
    side: "tails",
    bet: 1500,
    payout: 3000,
    won: true,
    timestamp: "3m ago",
  },
  {
    id: "hr_5",
    handle: "@degen_ape",
    side: "heads",
    bet: 3200,
    payout: 0,
    won: false,
    timestamp: "5m ago",
  },
];

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

  const setExactBalance = (nextCash: number, nextProfit?: number, nextGems?: number) => {
    const cleanCash = Number(Math.max(0, nextCash).toFixed(2));
    if (setCash) setCash(cleanCash);
    onUpdateStats((stats) => {
      stats.cash = cleanCash;
      if (nextProfit !== undefined) stats.totalProfit = Number(nextProfit.toFixed(2));
      if (nextGems !== undefined) stats.gems = Math.floor(nextGems);
    });
  };

  const applyServerUserStats = (srvStats: any, fallbackCash?: number) => {
    const resolvedCash =
      srvStats?.cash !== undefined
        ? Number(srvStats.cash)
        : fallbackCash !== undefined
        ? fallbackCash
        : Number(userStats.cash);
    setExactBalance(
      resolvedCash,
      srvStats?.totalProfit !== undefined ? Number(srvStats.totalProfit) : undefined,
      srvStats?.gems !== undefined ? Number(srvStats.gems) : undefined,
    );
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
    }, 3000);
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
  const [coinOutcome, setCoinOutcome] = useState<"heads" | "tails">("heads");
  const [coinRotY, setCoinRotY] = useState<number>(0);
  const [coinResultBanner, setCoinResultBanner] = useState<{
    won: boolean;
    outcome: "heads" | "tails";
    payout: number;
    bet: number;
  } | null>(null);

  // Live High-Roller ($1K+) Coinflip Feed
  const [highRollerFlips, setHighRollerFlips] = useState<HighRollerFlip[]>(() => {
    try {
      const saved = localStorage.getItem("pf_highroller_flips_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((f: any) => Number(f.bet) >= 1000);
        }
      }
    } catch {}
    return INITIAL_HIGH_ROLLER_FLIPS;
  });

  // Gentle background high-roller activity (>= $1,000 only)
  useEffect(() => {
    const handles = ["@whale", "@stonks", "@sol_expert", "@alpha", "@moon_boy", "@diamond_dev"];
    const highBets = [1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 25000];
    const timer = setInterval(() => {
      const bet = highBets[Math.floor(Math.random() * highBets.length)];
      const won = Math.random() >= 0.5;
      const side: "heads" | "tails" = Math.random() >= 0.5 ? "heads" : "tails";
      const newEntry: HighRollerFlip = {
        id: "hr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
        handle: handles[Math.floor(Math.random() * handles.length)],
        side,
        bet,
        payout: won ? bet * 2 : 0,
        won,
        timestamp: "Just now",
      };
      setHighRollerFlips((prev) => {
        const next = [newEntry, ...prev.filter((f) => f.bet >= 1000)].slice(0, 12);
        try {
          localStorage.setItem("pf_highroller_flips_v1", JSON.stringify(next));
        } catch {}
        return next;
      });
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  // Slots States (3x3 Grid = 3 Visible Horizontal Lines)
  const [slotBetInput, setSlotBetInput] = useState("100");
  const slotBet = Math.max(0, Number(slotBetInput) || 0);
  const [slotIsSpinning, setSlotIsSpinning] = useState(false);
  const [slotGrid, setSlotGrid] = useState<string[][]>([
    ["🍒", "🍋", "🔔"],
    ["7️⃣", "7️⃣", "7️⃣"],
    ["💎", "🍒", "🍋"],
  ]);
  const [slotWinningLines, setSlotWinningLines] = useState<number[]>([]);
  const [slotResultMsg, setSlotResultMsg] = useState<{
    won: boolean;
    text: string;
  } | null>(null);

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

  // Dice States (1-6 choice with exact 3D face alignment)
  const [diceBetInput, setDiceBetInput] = useState("10");
  const diceBet = Math.max(0, Number(diceBetInput) || 0);
  const [diceSelectedNum, setDiceSelectedNum] = useState<number>(1);
  const [dicePickedOnRoll, setDicePickedOnRoll] = useState<number>(1);
  const [diceBetOnRoll, setDiceBetOnRoll] = useState<number>(10);
  const [diceIsRollingState, setDiceIsRollingState] = useState<boolean>(false);
  const [diceRotX, setDiceRotX] = useState<number>(0);
  const [diceRotY, setDiceRotY] = useState<number>(0);
  const [diceResultVal, setDiceResultVal] = useState<number | null>(null);

  // Tower States
  const [towerBetInput, setTowerBetInput] = useState("10");
  const towerBet = Math.max(0, Number(towerBetInput) || 0);
  const [towerDifficulty, setTowerDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("easy");
  const [towerActive, setTowerActive] = useState(false);
  const [towerSessionToken, setTowerSessionToken] = useState<string | null>(null);
  const [towerLevel, setTowerLevel] = useState(0);
  const [towerGrid, setTowerGrid] = useState<number[][]>([]);
  const [towerUserHistory, setTowerUserHistory] = useState<number[]>([]);
  const [towerReveal, setTowerReveal] = useState(false);

  const slotEmojis = ["🍒", "🍋", "🔔", "7️⃣", "💎"];

  const getPercentageBet = (pct: number, minBet = 1): string => {
    playSound("click");
    const avail = Math.max(0, Number(userStats.cash) || 0);
    if (avail <= 0) return String(minBet);
    const raw = pct >= 1 ? Math.floor(avail) : Math.floor(avail * pct);
    const clamped = Math.min(1000000, Math.max(minBet, Math.min(Math.floor(avail), raw)));
    return String(clamped > 0 ? clamped : Math.min(avail, minBet));
  };

  // --- 1. Coinflip (Fast 420ms Flip, Calm Aesthetic Medallion, Immediate Bet Deduction, Exact 2.00x Payout) ---
  const playCoinflip = async () => {
    if (coinIsFlapping || isSubmittingRef.current) return;
    const betAmount = Number(coinBetInput);
    if (typeof betAmount !== "number" || isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }

    const preBetCash = Number(userStats.cash) || 0;
    if (preBetCash < betAmount) {
      triggerLocalNotice(
        "Insufficient Funds",
        `You only have $${preBetCash.toLocaleString("en-US", { minimumFractionDigits: 2 })} available.`,
        true,
      );
      return;
    }

    isSubmittingRef.current = true;
    setCoinIsFlapping(true);
    setCoinResultBanner(null);

    // 1. Start API request first so headers carry preBetCash
    const reqPromise = apiCoinflip(betAmount, coinSide);

    // 2. IMMEDIATELY deduct the bet from the player's balance on click
    const postDeductCash = Number(Math.max(0, preBetCash - betAmount).toFixed(2));
    setExactBalance(postDeductCash);
    playSound("bet");
    playSound("flip");

    // Start immediate visual spin while waiting for quick resolution
    const startSpins = (Math.floor(coinRotY / 360) + 2) * 360;
    setCoinRotY(startSpins + (coinSide === "tails" ? 180 : 0));

    try {
      const [res] = await Promise.all([
        reqPromise,
        new Promise((resolve) => setTimeout(resolve, 420)),
      ]);

      const outcome: "heads" | "tails" = res.outcome === "tails" ? "tails" : "heads";
      const won = Boolean(res.won);
      // Enforce exact 2x payout on win
      const exactPayout = won ? Number((betAmount * 2).toFixed(2)) : 0;
      const finalCash = won
        ? Number((postDeductCash + exactPayout).toFixed(2))
        : postDeductCash;

      // Snap 3D coin rotation cleanly to exact outcome face (0 deg = heads, 180 deg = tails)
      const landedBase = (Math.floor(startSpins / 360) + 1) * 360;
      setCoinRotY(landedBase + (outcome === "tails" ? 180 : 0));
      setCoinOutcome(outcome);
      setCoinIsFlapping(false);
      isSubmittingRef.current = false;

      // Apply exact 2x payout balance
      setExactBalance(
        finalCash,
        res.userStats?.totalProfit !== undefined
          ? Number(res.userStats.totalProfit)
          : (Number(userStats.totalProfit) || 0) + (won ? betAmount : -betAmount),
      );

      setCoinResultBanner({
        won,
        outcome,
        payout: exactPayout,
        bet: betAmount,
      });

      if (won) {
        playSound("win");
      } else {
        playSound("lose");
      }

      // Record in Live High-Roller Flips feed if bet >= $1,000
      if (betAmount >= 1000) {
        const userEntry: HighRollerFlip = {
          id: "hr_user_" + Date.now(),
          handle: userStats.handle || "@zeke",
          side: coinSide,
          bet: betAmount,
          payout: exactPayout,
          won,
          timestamp: "Just now",
        };
        setHighRollerFlips((prev) => {
          const next = [userEntry, ...prev.filter((f) => f.bet >= 1000)].slice(0, 12);
          try {
            localStorage.setItem("pf_highroller_flips_v1", JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    } catch (err: any) {
      setCoinIsFlapping(false);
      isSubmittingRef.current = false;
      // Refund bet if network request failed
      setExactBalance(preBetCash);
      triggerLocalNotice("Coinflip Error", formatErrorMessage(err, "Failed to place coinflip bet."), true);
    }
  };

  // --- 2. Slots (3 Visible Horizontal Lines + Immediate Bet Deduction) ---
  const playSlots = async () => {
    if (slotIsSpinning || isSubmittingRef.current) return;
    const betAmount = Number(slotBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    const preBetCash = Number(userStats.cash) || 0;
    if (preBetCash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "You do not have enough cash to spin!", true);
      return;
    }

    isSubmittingRef.current = true;
    setSlotIsSpinning(true);
    setSlotWinningLines([]);
    setSlotResultMsg(null);

    // 1. Fire API call before mutating localStorage
    const reqPromise = apiArcadeWager("slots", "play", { bet: betAmount });

    // 2. Immediately deduct bet on click
    const postDeductCash = Number(Math.max(0, preBetCash - betAmount).toFixed(2));
    setExactBalance(postDeductCash);
    playSound("bet");

    let spinTicks = 0;
    const spinInterval = setInterval(() => {
      spinTicks++;
      if (spinTicks % 2 === 1) playSound("spin");
      setSlotGrid([
        [
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        ],
        [
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        ],
        [
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
          slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        ],
      ]);
    }, 80);

    try {
      const [res] = await Promise.all([
        reqPromise,
        new Promise((resolve) => setTimeout(resolve, 480)),
      ]);

      clearInterval(spinInterval);

      const finalGrid: string[][] =
        Array.isArray(res.grid) && res.grid.length === 3
          ? res.grid
          : [
              [
                slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
                slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
                slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
              ],
              Array.isArray(res.reels) && res.reels.length === 3 ? res.reels : ["🍒", "🍋", "🔔"],
              [
                slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
                slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
                slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
              ],
            ];

      setSlotGrid(finalGrid);
      const winLines: number[] = Array.isArray(res.winningLines)
        ? res.winningLines
        : res.payout > 0
        ? [1]
        : [];
      setSlotWinningLines(winLines);
      setSlotIsSpinning(false);
      isSubmittingRef.current = false;

      const payout = Number(res.payout || 0);
      const finalCash = Number((postDeductCash + payout).toFixed(2));
      applyServerUserStats(res.userStats, finalCash);

      if (payout > 0) {
        playSound("win");
        setSlotResultMsg({
          won: true,
          text:
            res.matchCount === 1
              ? `3-Line Match on Line ${winLines.map((l) => l + 1).join(", ")}! Won +$${payout.toLocaleString()}`
              : `Center Line Pair! Won +$${payout.toLocaleString()}`,
        });
      } else {
        playSound("lose");
        setSlotResultMsg({
          won: false,
          text: `No winning line • Lost $${betAmount.toLocaleString()}`,
        });
      }
    } catch (err: any) {
      clearInterval(spinInterval);
      setSlotIsSpinning(false);
      isSubmittingRef.current = false;
      setExactBalance(preBetCash);
      triggerLocalNotice("Slots Error", formatErrorMessage(err, "Failed to spin slots."), true);
    }
  };

  // --- 3. Mines (Immediate Bet Deduction + Crisp Gem/Mine Sounds) ---
  const startMinesGame = async () => {
    if (minesActive || isSubmittingRef.current) return;
    const betAmount = Number(minesBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    const preBetCash = Number(userStats.cash) || 0;
    if (preBetCash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "You do not have enough cash to start Mines!", true);
      return;
    }

    isSubmittingRef.current = true;
    const reqPromise = apiArcadeWager("mines", "start", {
      bet: betAmount,
      minesCount,
    });

    // Immediately deduct bet on click
    const postDeductCash = Number(Math.max(0, preBetCash - betAmount).toFixed(2));
    setExactBalance(postDeductCash);
    playSound("bet");

    try {
      const res = await reqPromise;
      applyServerUserStats(res.userStats, postDeductCash);
      setMinesSessionToken(res.sessionToken || null);
      setMinesGrid(Array(25).fill("hidden"));
      setMinesActive(true);
      setMinesSafeSelections(0);
      setMinesMultiplier(1);
    } catch (err: any) {
      setExactBalance(preBetCash);
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
        playSound("boom");
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
        triggerLocalNotice("Mine Hit", "You hit a mine! Bet lost.", true);
      } else {
        playSound("tile");
        nextGrid[cellIdx] = "revealed-gem";
        setMinesSafeSelections(res.safeSelections);
        setMinesGrid(nextGrid);
        setMinesMultiplier(res.multiplier);

        if (res.clearedAll) {
          playSound("win");
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
            `Cleared all safe tiles! Cashed out $${res.winnings.toLocaleString()} (${res.multiplier}x)!`,
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
        playSound("click");
        setMinesGrid(Array(25).fill("hidden"));
        setMinesActive(false);
        setMinesSessionToken(null);
        triggerLocalNotice("Bet Refunded", `Refunded $${(res.refunded || minesBet).toLocaleString()} to your balance.`);
      } else {
        playSound("win");
        const nextGrid = minesGrid.map((cell, idx) => {
          if (res.secretMinesMap && res.secretMinesMap[idx]) return "mine";
          return cell === "revealed-gem" ? "revealed-gem" : "gem";
        });
        setMinesGrid(nextGrid);
        setMinesActive(false);
        setMinesSessionToken(null);
        triggerLocalNotice(
          "Mines Cashout!",
          `Cashed out $${res.winnings.toLocaleString()} at ${res.multiplier}x!`,
        );
      }
    } catch (err: any) {
      triggerLocalNotice("Mines Error", formatErrorMessage(err, "Could not cash out."), true);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // --- 4. Dice Roll (Exact 3D Face Alignment + Immediate Bet Deduction) ---
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
                    val === 1 ? "w-4 h-4 bg-emerald-500" : "w-3 h-3 bg-zinc-900"
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
    const preBetCash = Number(userStats.cash) || 0;
    if (preBetCash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "You need additional cash to roll the dice!", true);
      return;
    }

    const chosenNumber = diceSelectedNum;
    isSubmittingRef.current = true;
    setDiceIsRollingState(true);
    setDiceResultVal(null);
    setDicePickedOnRoll(chosenNumber);
    setDiceBetOnRoll(betAmount);

    // 1. Fire API request before mutating localStorage
    const reqPromise = apiArcadeWager("dice", "play", {
      bet: betAmount,
      selectedNum: chosenNumber,
    });

    // 2. Immediately deduct bet on click
    const postDeductCash = Number(Math.max(0, preBetCash - betAmount).toFixed(2));
    setExactBalance(postDeductCash);
    playSound("bet");
    playSound("roll");

    try {
      const res = await reqPromise;

      const landedFace = Number(res.landedFace);
      const baseRot = getFaceRotation(landedFace);

      const cleanSpinsX = (Math.floor(diceRotX / 360) + 3) * 360;
      const cleanSpinsY = (Math.floor(diceRotY / 360) + 3) * 360;
      setDiceRotX(cleanSpinsX + baseRot.x);
      setDiceRotY(cleanSpinsY + baseRot.y);

      setTimeout(() => {
        setDiceIsRollingState(false);
        isSubmittingRef.current = false;
        setDiceResultVal(landedFace);

        const payout = Number(res.payout || 0);
        const finalCash = Number((postDeductCash + payout).toFixed(2));
        applyServerUserStats(res.userStats, finalCash);

        if (res.won) {
          playSound("win");
        } else {
          playSound("lose");
        }
      }, 750);
    } catch (err: any) {
      setDiceIsRollingState(false);
      isSubmittingRef.current = false;
      setExactBalance(preBetCash);
      triggerLocalNotice("Dice Error", formatErrorMessage(err, "Failed dice roll."), true);
    }
  };

  // --- 5. Tower Climb (Immediate Bet Deduction) ---
  const startTowerGame = async () => {
    if (towerActive || isSubmittingRef.current) return;
    const betAmount = Number(towerBetInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      triggerLocalNotice("Invalid Bet", "Please enter a valid positive bet amount.", true);
      return;
    }
    const preBetCash = Number(userStats.cash) || 0;
    if (preBetCash < betAmount) {
      triggerLocalNotice("Insufficient Funds", "Not enough cash to start Tower Climb!", true);
      return;
    }

    isSubmittingRef.current = true;
    const reqPromise = apiArcadeWager("tower", "start", {
      bet: betAmount,
      difficulty: towerDifficulty,
    });

    const postDeductCash = Number(Math.max(0, preBetCash - betAmount).toFixed(2));
    setExactBalance(postDeductCash);
    playSound("bet");

    try {
      const res = await reqPromise;
      applyServerUserStats(res.userStats, postDeductCash);
      setTowerSessionToken(res.sessionToken || null);
      setTowerUserHistory([]);
      setTowerLevel(0);
      setTowerReveal(false);
      setTowerActive(true);
    } catch (err: any) {
      setExactBalance(preBetCash);
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
        playSound("boom");
        setTowerActive(false);
        setTowerSessionToken(null);
        setTowerReveal(true);
        if (res.secretGrid) {
          setTowerGrid(res.secretGrid);
        }
        applyServerUserStats(res.userStats);
        setShowTowerResultModal({
          success: false,
          title: "Tower Over",
          message: "You hit a trap block. Your climb bet was lost.",
        });
      } else {
        playSound("tile");
        setTowerLevel(res.level);

        if (res.clearedTop) {
          playSound("win");
          applyServerUserStats(res.userStats);
          if (res.secretGrid) setTowerGrid(res.secretGrid);
          setTowerActive(false);
          setTowerSessionToken(null);
          setTowerReveal(true);
          setShowTowerResultModal({
            success: true,
            title: "Tower Cleared!",
            message: "You reached floor 10 and cashed out!",
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
      playSound("win");
      applyServerUserStats(res.userStats);

      setTowerActive(false);
      setTowerSessionToken(null);
      setTowerReveal(true);
      if (res.secretGrid) setTowerGrid(res.secretGrid);

      setShowTowerResultModal({
        success: true,
        title: "Cashed Out!",
        message: `Claimed $${res.winnings.toLocaleString()} (${res.multiplier}x)!`,
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
      playSound("click");
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

  const gameTabs: Array<{ id: MenuGameType; label: string; badge: string }> = [
    { id: "coinflip", label: "Coin Flip", badge: "2.0x" },
    { id: "slots", label: "Slots (3 Lines)", badge: "6.0x" },
    { id: "mines", label: "Mines", badge: "Multi" },
    { id: "dice", label: "Dice", badge: "3.0x" },
    { id: "tower", label: "Tower", badge: "Climb" },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fade-in w-full max-w-full overflow-hidden">
      {/* Subtle toast alert */}
      {localNotice && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-[#16171b] border ${
            localNotice.isError ? "border-rose-500/40" : "border-emerald-500/40"
          } p-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 z-50 animate-fade-in`}
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">
              {localNotice.title}
            </span>
            <span className="text-[11px] text-zinc-400 mt-0.5">
              {localNotice.message}
            </span>
          </div>
          <button
            onClick={() => setLocalNotice(null)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tower Result Modal */}
      {showTowerResultModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-[#141417] border border-white/[0.08] p-6 rounded-2xl max-w-sm w-full relative text-center shadow-2xl animate-fade-in">
            <button
              onClick={() => setShowTowerResultModal(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 border ${
                showTowerResultModal.success
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/15 border-rose-500/30 text-rose-300"
              }`}
            >
              {showTowerResultModal.success ? "🏆" : "💀"}
            </div>
            <h3
              className={`text-base font-bold mb-1.5 ${
                showTowerResultModal.success ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {showTowerResultModal.title}
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              {showTowerResultModal.message}
            </p>

            {showTowerResultModal.success &&
              showTowerResultModal.payout !== undefined && (
                <div className="bg-[#0e0e11] p-3 rounded-xl border border-white/[0.06] w-full mb-4 flex flex-col gap-0.5 text-center font-mono">
                  <span className="text-[10px] text-zinc-500 uppercase">
                    Payout
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    +${showTowerResultModal.payout.toLocaleString()}
                  </span>
                </div>
              )}

            <button
              onClick={() => setShowTowerResultModal(null)}
              className="w-full py-2.5 rounded-xl font-semibold text-xs bg-white/[0.08] hover:bg-white/[0.12] text-white transition cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Top Mobile-Friendly Game Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141417] border border-white/[0.07] p-3 sm:p-4 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          {gameTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playSound("click");
                setSelectedGame(tab.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                selectedGame === tab.id
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                {tab.badge}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 px-3 py-1.5 bg-[#0e0e11] border border-white/[0.06] rounded-xl text-xs font-mono shrink-0">
          <span className="text-zinc-400">Balance</span>
          <span className="font-bold text-emerald-400">
            $
            {userStats.cash.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="bg-[#141417] border border-white/[0.07] p-4 sm:p-6 rounded-2xl flex flex-col items-center justify-center min-h-[380px]">
        {selectedGame === "coinflip" && (
          <div className="flex flex-col items-center gap-6 w-full max-w-md">
            {/* Calm 3D Aesthetic Medallion Coin */}
            <div className="h-36 flex items-center justify-center relative perspective-1000 my-1">
              <div
                className="w-28 h-28 relative"
                style={{
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${coinRotY}deg)`,
                  transition: coinIsFlapping
                    ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "transform 280ms ease-out",
                }}
              >
                {/* HEADS FACE (0 deg) — Calm Sage-Emerald Matte Medallion */}
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-[#1d332c] via-[#152520] to-[#0f1a17] border-2 border-emerald-400/40 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_2px_rgba(52,211,153,0.25)] flex flex-col items-center justify-center select-none"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="w-20 h-20 rounded-full border border-emerald-400/20 flex flex-col items-center justify-center gap-1">
                    <Crown className="w-7 h-7 text-emerald-300 stroke-[1.75]" />
                    <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-200/90 uppercase">
                      Heads
                    </span>
                  </div>
                </div>

                {/* TAILS FACE (180 deg) — Calm Slate-Indigo Matte Medallion */}
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-[#202638] via-[#171c29] to-[#111520] border-2 border-indigo-400/40 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_2px_rgba(129,140,248,0.25)] flex flex-col items-center justify-center select-none"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div className="w-20 h-20 rounded-full border border-indigo-400/20 flex flex-col items-center justify-center gap-1">
                    <Diamond className="w-7 h-7 text-indigo-300 stroke-[1.75]" />
                    <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-200/90 uppercase">
                      Tails
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Result Pill */}
            {coinResultBanner && !coinIsFlapping && (
              <div
                className={`w-full px-4 py-2.5 rounded-xl border text-center text-xs font-medium flex items-center justify-center gap-2 animate-fade-in ${
                  coinResultBanner.won
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <span className="font-bold">
                  {coinResultBanner.won
                    ? `Won +$${coinResultBanner.payout.toLocaleString("en-US", { minimumFractionDigits: 2 })} (2.0x)`
                    : `Lost -$${coinResultBanner.bet.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </span>
                <span className="text-zinc-400">•</span>
                <span className="uppercase font-mono text-[11px]">
                  Landed {coinResultBanner.outcome}
                </span>
              </div>
            )}

            {/* Side Choice Buttons */}
            <div className="grid grid-cols-2 bg-[#0e0e11] p-1 rounded-xl border border-white/[0.06] gap-1.5 w-full text-xs font-semibold select-none">
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setCoinSide("heads");
                  if (!coinIsFlapping) {
                    const base = Math.floor(coinRotY / 360) * 360;
                    setCoinRotY(base);
                  }
                }}
                className={`py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  coinSide === "heads"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Heads (2x)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setCoinSide("tails");
                  if (!coinIsFlapping) {
                    const base = Math.floor(coinRotY / 360) * 360;
                    setCoinRotY(base + 180);
                  }
                }}
                className={`py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  coinSide === "tails"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/35"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                }`}
              >
                <Diamond className="w-3.5 h-3.5" />
                <span>Tails (2x)</span>
              </button>
            </div>

            {/* Coinflip Bet Input & Shortcuts */}
            <div className="flex flex-col gap-2.5 w-full">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  placeholder="Bet amount..."
                  value={coinBetInput}
                  onChange={(e) => setCoinBetInput(e.target.value)}
                  className="w-full bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 font-mono select-none">
                  USD
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-mono">
                {[
                  { label: "25%", pct: 0.25 },
                  { label: "50%", pct: 0.5 },
                  { label: "75%", pct: 0.75 },
                  { label: "Max", pct: 1 },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setCoinBetInput(getPercentageBet(b.pct, 10))}
                    className="bg-[#0e0e11] hover:bg-white/[0.06] border border-white/[0.06] py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300"
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <button
                onClick={playCoinflip}
                disabled={coinIsFlapping}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer active:scale-[0.99] transition-all text-zinc-950 font-bold text-xs uppercase tracking-wider py-3 rounded-xl mt-1"
              >
                {coinIsFlapping
                  ? "Flipping..."
                  : `Flip Coin (${coinBet > 0 ? `$${coinBet.toLocaleString()} → $${(coinBet * 2).toLocaleString()}` : "2.0x"})`}
              </button>
            </div>

            {/* LIVE HIGH-ROLLER FLIPS ($1K+ ONLY) BELOW COIN FLIP */}
            <div className="w-full border-t border-white/[0.07] pt-4 mt-1 flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Live Winnings &amp; Losses ($1K+ Only)
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Min $1,000
                </span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[210px] overflow-y-auto custom-scrollbar">
                {highRollerFlips
                  .filter((f) => f.bet >= 1000)
                  .slice(0, 8)
                  .map((flip) => (
                    <div
                      key={flip.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0e0e11] border border-white/[0.05] text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {flip.won ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${
                            flip.won
                              ? "border-emerald-500/35 text-emerald-400 bg-emerald-500/10"
                              : "border-rose-500/35 text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          {flip.won ? "WIN" : "LOSS"}
                        </span>
                        <span className="text-zinc-300 truncate">{flip.handle}</span>
                        <span className="text-zinc-500 text-[10px] uppercase">
                          ({flip.side})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-bold ${
                            flip.won ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {flip.won
                            ? `+$${flip.payout.toLocaleString()}`
                            : `-$${flip.bet.toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {selectedGame === "slots" && (
          <div className="flex flex-col items-center gap-5 w-full max-w-sm">
            {/* 3x3 Slot Machine Window (3 Lines) */}
            <div className="w-full bg-[#0e0e11] border border-white/[0.08] rounded-2xl p-3.5 flex flex-col gap-2 select-none">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono px-1">
                <span>3-Line Paytable</span>
                <span>7️⃣ 6x • 💎 4x • 3-Match 3x</span>
              </div>

              {slotGrid.map((row, rowIdx) => {
                const isWinningLine = !slotIsSpinning && slotWinningLines.includes(rowIdx);
                const lineLabel = rowIdx === 0 ? "L1" : rowIdx === 1 ? "L2" : "L3";
                return (
                  <div
                    key={rowIdx}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      isWinningLine
                        ? "bg-emerald-500/10 border-emerald-500/45 shadow-sm"
                        : rowIdx === 1
                        ? "bg-[#15161a] border-white/[0.08]"
                        : "bg-[#121316] border-white/[0.04] opacity-90"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isWinningLine
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "text-zinc-500 bg-white/[0.03]"
                      }`}
                    >
                      {lineLabel}
                    </span>

                    <div className="flex items-center justify-around flex-1 px-4">
                      {row.map((emoji, colIdx) => (
                        <span
                          key={colIdx}
                          className={`text-3xl sm:text-4xl transition-transform duration-150 ${
                            slotIsSpinning ? "scale-95 opacity-80" : "scale-100"
                          }`}
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>

                    <span
                      className={`text-[10px] font-mono ${
                        isWinningLine ? "text-emerald-400 font-bold" : "text-zinc-600"
                      }`}
                    >
                      {isWinningLine ? "WIN" : "•"}
                    </span>
                  </div>
                );
              })}
            </div>

            {slotResultMsg && (
              <div
                className={`text-center font-medium text-xs p-2.5 border rounded-xl w-full select-none ${
                  slotResultMsg.won
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {slotResultMsg.text}
              </div>
            )}

            {/* Slots controls */}
            <div className="flex flex-col gap-2.5 w-full">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  placeholder="Bet amount..."
                  value={slotBetInput}
                  onChange={(e) => setSlotBetInput(e.target.value)}
                  className="w-full bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 font-mono select-none">
                  USD
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-mono">
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setSlotBetInput(getPercentageBet(pct, 10))}
                    className="bg-[#0e0e11] hover:bg-white/[0.06] border border-white/[0.06] py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300"
                  >
                    {pct === 1 ? "Max" : `${pct * 100}%`}
                  </button>
                ))}
              </div>

              <button
                onClick={playSlots}
                disabled={slotIsSpinning}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer active:scale-[0.99] transition-all text-zinc-950 font-bold uppercase text-xs tracking-wider py-3 rounded-xl mt-1"
              >
                {slotIsSpinning ? "Spinning 3 Lines..." : "Spin 3 Lines"}
              </button>
            </div>
          </div>
        )}

        {selectedGame === "mines" && (
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg items-center justify-between">
            <div className="grid grid-cols-5 gap-1.5 w-full max-w-[300px] aspect-square bg-[#0e0e11] p-3 rounded-2xl border border-white/[0.07] relative">
              {minesGrid.map((state, idx) => (
                <button
                  key={idx}
                  disabled={!minesActive}
                  onClick={() => handleMinesCellClick(idx)}
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-lg font-bold border transition-all ${
                    state === "hidden"
                      ? "bg-[#18191e] border-white/[0.06] hover:bg-[#202229] cursor-pointer"
                      : state === "mine"
                        ? "bg-rose-950/60 border-rose-500/50 text-rose-400"
                        : state === "revealed-gem"
                          ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-400 scale-95"
                          : "bg-[#121317] border-white/[0.04] text-zinc-600"
                  }`}
                >
                  {state === "mine"
                    ? "💣"
                    : state === "revealed-gem" || state === "gem"
                      ? "💎"
                      : ""}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full md:w-48 shrink-0 justify-between self-stretch">
              <div className="flex flex-col gap-1.5 bg-[#0e0e11] p-3.5 rounded-xl border border-white/[0.06] select-none font-mono text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Mines</span>
                  <span className="font-bold text-white">{minesCount}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Safe Tiles</span>
                  <span className="font-bold text-white">{minesSafeSelections}</span>
                </div>
                <div className="flex justify-between text-zinc-400 border-t border-white/[0.06] mt-1 pt-1.5">
                  <span>Multiplier</span>
                  <span className="font-bold text-emerald-400">{minesMultiplier}x</span>
                </div>
              </div>

              {minesActive ? (
                <button
                  onClick={() => minesCashout()}
                  className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer ${
                    minesSafeSelections === 0
                      ? "bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200"
                      : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                  }`}
                >
                  {minesSafeSelections === 0
                    ? `Cancel ($${minesBet.toLocaleString()})`
                    : `Cashout $${Math.floor(minesBet * minesMultiplier).toLocaleString()}`}
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Bet Amount
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={minesBetInput}
                      onChange={(e) => setMinesBetInput(e.target.value)}
                      className="w-full bg-[#0e0e11] border border-white/[0.08] px-3 py-2 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500/50"
                    />
                    <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] font-mono">
                      {[0.25, 0.5, 0.75, 1].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setMinesBetInput(getPercentageBet(pct, 10))}
                          className="bg-[#0e0e11] hover:bg-white/[0.06] border border-white/[0.06] py-1 rounded text-zinc-300 cursor-pointer"
                        >
                          {pct === 1 ? "Max" : `${pct * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Mines
                    </span>
                    <select
                      value={minesCount}
                      onChange={(e) => setMinesCount(Number(e.target.value))}
                      className="bg-[#0e0e11] border border-white/[0.08] px-2.5 py-2 rounded-xl text-xs text-white focus:outline-none"
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
                    className="w-full bg-emerald-500 hover:bg-emerald-400 cursor-pointer py-2.5 rounded-xl text-zinc-950 font-bold text-xs uppercase tracking-wider mt-1 transition-all"
                  >
                    Start Mines
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedGame === "dice" && (
          <div className="flex flex-col items-center gap-5 w-full max-w-sm select-none">
            <div className="h-40 flex items-center justify-center relative w-full">
              <div className="dice-scene">
                <div className="dice-cube-wrapper">
                  <div
                    className="dice-cube"
                    style={{
                      transform: `rotateX(${diceRotX}deg) rotateY(${diceRotY}deg)`,
                    }}
                  >
                    <div className="dice-face dice-face-1">{renderDiceFace(1)}</div>
                    <div className="dice-face dice-face-6">{renderDiceFace(6)}</div>
                    <div className="dice-face dice-face-3">{renderDiceFace(3)}</div>
                    <div className="dice-face dice-face-4">{renderDiceFace(4)}</div>
                    <div className="dice-face dice-face-2">{renderDiceFace(2)}</div>
                    <div className="dice-face dice-face-5">{renderDiceFace(5)}</div>
                  </div>
                </div>
              </div>
            </div>

            {diceResultVal !== null && !diceIsRollingState && (
              <div
                className={`w-full px-4 py-2.5 rounded-xl border text-center text-xs font-medium ${
                  diceResultVal === dicePickedOnRoll
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {diceResultVal === dicePickedOnRoll
                  ? `Rolled ${diceResultVal} (Picked ${dicePickedOnRoll}) • Won +$${(diceBetOnRoll * 3).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : `Rolled ${diceResultVal} (Picked ${dicePickedOnRoll}) • Lost -$${diceBetOnRoll.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </div>
            )}

            <div className="flex flex-col gap-1.5 w-full">
              <span className="text-xs text-zinc-400 text-center">
                Pick Target Number (3.0x Payout)
              </span>
              <div className="grid grid-cols-6 gap-2 w-full">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => {
                      playSound("click");
                      setDiceSelectedNum(num);
                      setDiceResultVal(null);
                    }}
                    className={`h-10 rounded-xl text-sm font-bold font-mono transition-all border flex items-center justify-center ${
                      diceSelectedNum === num
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-[#0e0e11] text-zinc-400 border-white/[0.06] hover:text-zinc-200 cursor-pointer disabled:opacity-50"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  placeholder="Bet amount..."
                  value={diceBetInput}
                  disabled={diceIsRollingState}
                  onChange={(e) => setDiceBetInput(e.target.value)}
                  className="w-full bg-[#0e0e11] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono disabled:opacity-50"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 font-mono">
                  USD
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-mono">
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBetInput(getPercentageBet(pct, 1))}
                    className="bg-[#0e0e11] hover:bg-white/[0.06] border border-white/[0.06] py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 disabled:opacity-50"
                  >
                    {pct === 1 ? "Max" : `${pct * 100}%`}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={playDiceRoll}
                disabled={diceIsRollingState}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 py-3 rounded-xl font-bold text-xs uppercase text-zinc-950 tracking-wider mt-1 transition-all cursor-pointer"
              >
                {diceIsRollingState ? "Rolling..." : "Roll Dice"}
              </button>
            </div>
          </div>
        )}

        {selectedGame === "tower" && (
          <div className="flex flex-col gap-5 w-full max-w-md mx-auto items-center select-none">
            <div className="flex flex-col-reverse gap-1.5 bg-[#0e0e11] p-3 rounded-2xl border border-white/[0.07] items-stretch font-mono w-full">
              {Array(10)
                .fill(0)
                .map((_, idx) => {
                  const lvlIdx = 9 - idx;
                  const isCurrent = lvlIdx === towerLevel;
                  const isPassed = lvlIdx < towerLevel;
                  const userChosenCol = towerUserHistory[lvlIdx];
                  const displayNum = lvlIdx + 1;
                  const multVal = getTowerMultiplier(displayNum);
                  const colsCount = towerDifficulty === "medium" ? 2 : 3;

                  return (
                    <div
                      key={lvlIdx}
                      className={`flex items-center gap-3 py-1 px-2.5 rounded-xl transition-all border ${
                        isCurrent
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : isPassed
                            ? "border-transparent opacity-90"
                            : "border-transparent opacity-35"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 w-[72px] shrink-0 font-mono text-[11px]">
                        <span className="text-zinc-500 w-4 text-right">
                          {displayNum}
                        </span>
                        <span
                          className={`w-12 text-right font-bold ${
                            isCurrent || isPassed ? "text-emerald-400" : "text-zinc-400"
                          }`}
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
                            const isCellSafe = towerGrid[lvlIdx]?.[colIdx] === 1;

                            let cellStyle = "bg-[#18191e] border-white/[0.05]";
                            let iconContent = null;

                            if (towerActive) {
                              if (isCurrent) {
                                cellStyle =
                                  "bg-[#1e2028] border-white/[0.12] hover:bg-[#262933] cursor-pointer active:scale-95";
                              } else if (isPassed && isChosen) {
                                cellStyle =
                                  "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
                                iconContent = <Shield className="w-3.5 h-3.5 text-emerald-400" />;
                              }
                            } else if (towerReveal) {
                              if (isCellSafe) {
                                if (isPassed && isChosen) {
                                  cellStyle = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
                                  iconContent = <Shield className="w-3.5 h-3.5 text-emerald-400" />;
                                } else {
                                  iconContent = <Lock className="w-3 h-3 text-zinc-600" />;
                                }
                              } else {
                                cellStyle = isChosen
                                  ? "bg-rose-500/30 border-rose-500 text-rose-300"
                                  : "bg-rose-950/20 border-rose-900/30 text-rose-700";
                                iconContent = <Skull className="w-3.5 h-3.5" />;
                              }
                            }

                            return (
                              <button
                                key={colIdx}
                                disabled={!towerActive || !isCurrent}
                                onClick={() => handleTowerStep(colIdx)}
                                className={`h-8 rounded-lg flex items-center justify-center transition-all border ${cellStyle}`}
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

            <div className="flex flex-col gap-3 w-full max-w-sm">
              <div className="grid grid-cols-3 gap-1.5 bg-[#0e0e11] p-1 border border-white/[0.06] rounded-xl">
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    disabled={towerActive}
                    onClick={() => {
                      playSound("click");
                      setTowerDifficulty(diff);
                      setTowerReveal(false);
                      setTowerLevel(0);
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                      towerDifficulty === diff
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                        : "text-zinc-400 hover:text-zinc-200 cursor-pointer disabled:opacity-40"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {!towerActive ? (
                <>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    value={towerBetInput}
                    onChange={(e) => setTowerBetInput(e.target.value)}
                    className="w-full bg-[#0e0e11] border border-white/[0.08] px-3.5 py-2.5 text-sm font-mono text-white rounded-xl focus:outline-none focus:border-emerald-500/50"
                  />
                  <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTowerBetInput(getPercentageBet(pct, 1))}
                        className="bg-[#0e0e11] hover:bg-white/[0.06] border border-white/[0.06] py-1.5 rounded-lg text-zinc-300 cursor-pointer"
                      >
                        {pct === 1 ? "Max" : `${pct * 100}%`}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={startTowerGame}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Start Climb
                  </button>
                </>
              ) : towerLevel > 0 ? (
                <button
                  type="button"
                  onClick={towerCashout}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cash Out $
                  {Math.floor(
                    towerBet * getTowerMultiplier(towerLevel),
                  ).toLocaleString()}{" "}
                  ({getTowerMultiplier(towerLevel).toFixed(2)}x)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={abortTowerBet}
                  className="w-full bg-white/[0.08] hover:bg-white/[0.12] text-zinc-200 font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel &amp; Refund (${towerBet.toLocaleString()})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
