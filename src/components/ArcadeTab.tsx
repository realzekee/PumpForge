import React, { useState } from 'react';
import {
  Gamepad2,
  DollarSign,
  Bomb,
  Dice5,
  Coins,
  ChevronUp,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Gem,
  AlertTriangle,
  Flame,
  Shield,
  Skull,
  Lock,
  Play,
  X
} from 'lucide-react';
import { UserStats } from '../types';

interface ArcadeTabProps {
  userStats: UserStats;
  onUpdateStats: (updater: (stats: UserStats) => void) => void;
  onAddNotification: (title: string, msg: string, type: 'info' | 'achievement' | 'trade' | 'crash') => void;
}

type MenuGameType = 'coinflip' | 'slots' | 'mines' | 'dice' | 'tower';

export default function ArcadeTab({ userStats, onUpdateStats, onAddNotification }: ArcadeTabProps) {
  const [selectedGame, setSelectedGame] = useState<MenuGameType>('coinflip');
  const [localNotice, setLocalNotice] = useState<{ title: string; message: string; isError?: boolean } | null>(null);
  const [showTowerResultModal, setShowTowerResultModal] = useState<{
    success: boolean;
    title: string;
    message: string;
    payout?: number;
    multiplier?: number;
  } | null>(null);

  const triggerLocalNotice = (title: string, message: string, isError = false) => {
    setLocalNotice({ title, message, isError });
    setTimeout(() => {
      setLocalNotice(current => {
        if (current?.title === title && current?.message === message) {
          return null;
        }
        return current;
      });
    }, 4500);
  };

  const formatCash = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(2)}K`;
    }
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Coinflip States
  const [coinBet, setCoinBet] = useState(100);
  const [coinSide, setCoinSide] = useState<'heads' | 'tails'>('heads');
  const [coinIsFlapping, setCoinIsFlapping] = useState(false);
  const [coinOutcome, setCoinOutcome] = useState<'heads' | 'tails' | null>(null);
  const [coinResultMsg, setCoinResultMsg] = useState('');

  // Slots States
  const [slotBet, setSlotBet] = useState(100);
  const [slotIsSpinning, setSlotIsSpinning] = useState(false);
  const [slotReels, setSlotReels] = useState(['🍒', '🍒', '🍒']);
  const [slotResultMsg, setSlotResultMsg] = useState('');

  // Mines States
  const [minesBet, setMinesBet] = useState(100);
  const [minesCount, setMinesCount] = useState(3);
  const [minesActive, setMinesActive] = useState(false);
  const [minesGrid, setMinesGrid] = useState<('hidden' | 'gem' | 'mine' | 'revealed-gem')[]>(Array(25).fill('hidden'));
  const [minesSecretMap, setMinesSecretMap] = useState<boolean[]>(Array(25).fill(false)); // true if mine
  const [minesMultiplier, setMinesMultiplier] = useState(1);
  const [minesSafeSelections, setMinesSafeSelections] = useState(0);

  // Dice States (1-6 choice with amazing 3D animation rollout!)
  const [diceBet, setDiceBet] = useState(10);
  const [diceSelectedNum, setDiceSelectedNum] = useState<number>(1);
  const [diceIsRollingState, setDiceIsRollingState] = useState<boolean>(false);
  const [diceRotX, setDiceRotX] = useState<number>(0);
  const [diceRotY, setDiceRotY] = useState<number>(0);
  const [diceResultVal, setDiceResultVal] = useState<number | null>(null);
  const [diceResultMsg, setDiceResultMsg] = useState('');

  // Tower States
  const [towerBet, setTowerBet] = useState(10);
  const [towerDifficulty, setTowerDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [towerActive, setTowerActive] = useState(false);
  const [towerLevel, setTowerLevel] = useState(0); // 0 to 10
  const [towerGrid, setTowerGrid] = useState<number[][]>([]); // Grid of level selections: 1 = safe, 0 = skull
  const [towerUserHistory, setTowerUserHistory] = useState<number[]>([]); // User chosen column indices
  const [towerReveal, setTowerReveal] = useState(false);

  const slotEmojis = ['🍒', '🍋', '🍇', '💎', '🔔', '7️⃣'];

  // Multipliers map for Mines
  const getMinesMultiplier = (mines: number, safeCount: number) => {
    if (safeCount === 0) return 1;
    // Simple math multiplier formula used in online casinos with 15% house edge
    let mult = 1;
    for (let i = 0; i < safeCount; i++) {
       mult *= (25 - i) / (25 - mines - i);
    }
    let baseMult = mult * 0.85;

    // Reduce multiplier for 1st, 2nd, and 3rd selections to prevent easy "win once and cash out" economy inflation
    if (safeCount === 1) {
      baseMult = Math.min(baseMult, 1.05);
    } else if (safeCount === 2) {
      baseMult = Math.min(baseMult, 1.15);
    } else if (safeCount === 3) {
      baseMult = Math.min(baseMult, 1.30);
    }

    return Number(baseMult.toFixed(2));
  };

  // --- Game Executions ---

  // 1. Coinflip
  const playCoinflip = () => {
    if (userStats.cash < coinBet) {
      triggerLocalNotice('Insufficient Funds', 'You do not have enough cash to place this Coinflip bet!', true);
      return;
    }

    setCoinIsFlapping(true);
    setCoinOutcome(null);
    setCoinResultMsg('');

    onUpdateStats((stats) => {
      stats.cash -= coinBet;
    });

    setTimeout(() => {
      const isHeads = userStats.isCasinoRigged ? (coinSide === 'heads') : (Math.random() < 0.5);
      const resultSide = isHeads ? 'heads' : 'tails';
      const userWon = resultSide === coinSide;

      setCoinOutcome(resultSide);
      setCoinIsFlapping(false);

      if (userWon) {
        const reward = Math.floor(coinBet * 1.90);
        onUpdateStats((stats) => {
          stats.cash += reward;
          stats.totalProfit += (reward - coinBet);
        });
        setCoinResultMsg(`🎉 YOU WON! Received $${reward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`);
        onAddNotification('Winner Coinflip', `Won $${reward.toLocaleString('en-US')} on ${coinSide.toUpperCase()}!`, 'achievement');
      } else {
        setCoinResultMsg(`😓 Unfortunate, it land on ${resultSide.toUpperCase()}. You lost your bet.`);
      }
    }, 1200);
  };

  // 2. Slots
  const playSlots = () => {
    if (userStats.cash < slotBet) {
      triggerLocalNotice('Insufficient Funds', 'You do not have enough cash to spin the Slots reels!', true);
      return;
    }

    setSlotIsSpinning(true);
    setSlotResultMsg('');

    onUpdateStats((stats) => {
      stats.cash -= slotBet;
    });

    let spinCounter = 0;
    const interval = setInterval(() => {
      setSlotReels([
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)]
      ]);
      spinCounter++;
      if (spinCounter >= 8) {
        clearInterval(interval);
        finalizeSlots();
      }
    }, 100);
  };

  const finalizeSlots = () => {
    const finalReels = [
      slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
      slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
      slotEmojis[Math.floor(Math.random() * slotEmojis.length)]
    ];

    setSlotReels(finalReels);
    setSlotIsSpinning(false);

    const matchCount = new Set(finalReels).size;

    if (matchCount === 1) {
      // 3 of same
      let multiplier = 3;
      if (finalReels[0] === '7️⃣') multiplier = 6;
      else if (finalReels[0] === '💎') multiplier = 4;

      const payout = slotBet * multiplier;
      onUpdateStats((stats) => {
        stats.cash += payout;
        stats.totalProfit += (payout - slotBet);
      });
      setSlotResultMsg(`🎰 TRIPLE MATCH jackpot! You got three ${finalReels[0]}! Payout: $${payout.toLocaleString()}`);
      onAddNotification('JACKPOT SLOT', `Hit triple ${finalReels[0]} for $${payout} return!`, 'achievement');
    } else if (matchCount === 2) {
      // 2 of same (reduction to 0.95x to ensure consistent house edge while rewarding small wins)
      const payout = Math.floor(slotBet * 0.95);
      onUpdateStats((stats) => {
        stats.cash += payout;
        stats.totalProfit += (payout - slotBet);
      });
      setSlotResultMsg(`✨ Double Match! Two of the same emojis matched. Payout: $${payout.toLocaleString()}`);
    } else {
      setSlotResultMsg('❌ No matches this spin. Try again, the jackpot is close!');
    }
  };

  // 3. Mines
  const startMinesGame = () => {
    if (userStats.cash < minesBet) {
      triggerLocalNotice('Insufficient Funds', 'You do not have enough cash to place a Mines bet!', true);
      return;
    }

    onUpdateStats((stats) => {
      stats.cash -= minesBet;
    });

    // Populate random mines secret mapping
    const map = Array(25).fill(false);
    let count = 0;
    while (count < minesCount) {
      const idx = Math.floor(Math.random() * 25);
      if (!map[idx]) {
        map[idx] = true;
        count++;
      }
    }

    setMinesSecretMap(map);
    setMinesGrid(Array(25).fill('hidden'));
    setMinesActive(true);
    setMinesSafeSelections(0);
    setMinesMultiplier(1);
  };

  const handleMinesCellClick = (cellIdx: number) => {
    if (!minesActive || minesGrid[cellIdx] !== 'hidden') return;

    const isMine = minesSecretMap[cellIdx];
    const nextGrid = [...minesGrid];

    if (isMine) {
      // Exploded! Reveal all mines and stop game
      nextGrid[cellIdx] = 'mine';
      minesSecretMap.forEach((mine, idx) => {
        if (mine) nextGrid[idx] = 'mine';
      });
      setMinesGrid(nextGrid);
      setMinesActive(false);
      triggerLocalNotice('KABOOM! Mine Hit!', 'You clicked on a direct crash mine! Bet lost.', true);
    } else {
      // Safe selection
      nextGrid[cellIdx] = 'revealed-gem';
      const nextSafeCount = minesSafeSelections + 1;
      setMinesSafeSelections(nextSafeCount);
      setMinesGrid(nextGrid);

      const nextMult = getMinesMultiplier(minesCount, nextSafeCount);
      setMinesMultiplier(nextMult);

      if (nextSafeCount === 25 - minesCount) {
        // Safe cleared completely! Auto Cashout
        minesCashout(nextMult);
      }
    }
  };

  const minesCashout = (overrideMult?: number) => {
    if (!minesActive) return;

    const currentMult = overrideMult || minesMultiplier;
    const winnings = Math.floor(minesBet * currentMult);

    onUpdateStats((stats) => {
      stats.cash += winnings;
      stats.totalProfit += (winnings - minesBet);
    });

    // Reveal secret board as helpful feedback
    const nextGrid = minesGrid.map((cell, idx) => {
      if (minesSecretMap[idx]) return 'mine';
      return cell === 'revealed-gem' ? 'revealed-gem' : 'gem';
    });
    setMinesGrid(nextGrid);
    setMinesActive(false);

    triggerLocalNotice('Mines Cashout!', `You successfully cashed out $${winnings.toLocaleString()} at ${currentMult}x multiplier!`);
  };

  // 4. Dice Betting (1-6 choice with amazing 3D animation rollout!)
  const getFaceRotation = (face: number) => {
    switch (face) {
      case 1: return { x: 0, y: 0 };
      case 2: return { x: -90, y: 0 };
      case 3: return { x: 0, y: -90 };
      case 4: return { x: 0, y: 90 };
      case 5: return { x: 90, y: 0 };
      case 6: return { x: 0, y: 180 };
      default: return { x: 0, y: 0 };
    }
  };

  const renderDiceFace = (val: number) => {
    const dots: { [key: number]: number[] } = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    const activeDots = dots[val] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-2 w-16 h-16 p-1 bg-transparent select-none">
        {Array(9).fill(0).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activeDots.includes(i) && (
              <div className={`w-3 h-3 rounded-full bg-zinc-950 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${val === 1 ? 'w-4 h-4 bg-zinc-950' : ''}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const playDiceRoll = () => {
    if (userStats.cash < diceBet) {
      triggerLocalNotice('Insufficient Funds', 'You need additional cash to execute the Dice Roll!', true);
      return;
    }
    if (diceIsRollingState) return;

    setDiceIsRollingState(true);
    setDiceResultVal(null);
    setDiceResultMsg('');

    onUpdateStats((stats) => {
      stats.cash -= diceBet;
    });

    const landedFace = Math.floor(Math.random() * 6) + 1;

    // Calculate rotation: spin dynamically!
    const baseRot = getFaceRotation(landedFace);
    const spinsX = (Math.floor(Math.random() * 2) + 3) * 360; // 1080 or 1440
    const spinsY = (Math.floor(Math.random() * 2) + 3) * 360;
    
    // Accumulate so it rotates in one fluid forward direction
    const nextRotX = diceRotX + spinsX + baseRot.x;
    const nextRotY = diceRotY + spinsY + baseRot.y;

    setDiceRotX(nextRotX);
    setDiceRotY(nextRotY);

    setTimeout(() => {
      setDiceIsRollingState(false);
      setDiceResultVal(landedFace);

      const won = landedFace === diceSelectedNum;
      if (won) {
        const payout = Math.floor(diceBet * 3);
        onUpdateStats((stats) => {
          stats.cash += payout;
          stats.totalProfit += (payout - diceBet);
        });
        setDiceResultMsg(`Won $${(payout - diceBet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on ${landedFace}`);
        onAddNotification('Winner Dice Roll', `Hit ${landedFace} on Dice Roll for 3x!`, 'achievement');
      } else {
        setDiceResultMsg(`Lost $${diceBet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on ${landedFace}`);
      }
    }, 1200);
  };

  // 5. Tower Climb
  const startTowerGame = () => {
    if (userStats.cash < towerBet) {
      triggerLocalNotice('Insufficient Funds', 'Not enough cash to start Tower Climb!', true);
      return;
    }

    onUpdateStats((stats) => {
      stats.cash -= towerBet;
    });

    let colsCount = 3;
    let safeCount = 2;
    if (towerDifficulty === 'medium') {
      colsCount = 2;
      safeCount = 1;
    } else if (towerDifficulty === 'hard') {
      colsCount = 3;
      safeCount = 1;
    }

    const nextGrid: number[][] = [];
    for (let l = 0; l < 10; l++) {
      const arr = Array(colsCount).fill(0); // initialize all with 0 (mine)
      const safeIndices: number[] = [];
      while (safeIndices.length < safeCount) {
        const randIdx = Math.floor(Math.random() * colsCount);
        if (!safeIndices.includes(randIdx)) {
          safeIndices.push(randIdx);
          arr[randIdx] = 1; // Safe block
        }
      }
      nextGrid.push(arr);
    }

    setTowerGrid(nextGrid);
    setTowerUserHistory([]);
    setTowerLevel(0);
    setTowerReveal(false);
    setTowerActive(true);
  };

  const handleTowerStep = (colIndex: number) => {
    if (!towerActive) return;

    const rowAnswers = towerGrid[towerLevel];
    const choiceValue = rowAnswers[colIndex];

    const nextHistory = [...towerUserHistory, colIndex];
    setTowerUserHistory(nextHistory);

    if (choiceValue === 0) {
      // Boom skull
      setTowerActive(false);
      setTowerReveal(true);
      setShowTowerResultModal({
        success: false,
        title: 'TOWER OVER!',
        message: '💀 You hit a trap block. Your climb bet has been lost.'
      });
      triggerLocalNotice('TOWER OVER!', '💀 You hit a trap block. Your climb bet has been lost.', true);
    } else {
      // Safe step upward!
      const nextLvl = towerLevel + 1;
      setTowerLevel(nextLvl);

      if (nextLvl === 10) {
        // Grand tower cleared completely
        towerCashout(nextLvl);
      }
    }
  };

  const getTowerMultiplier = (level: number, diff: 'easy' | 'medium' | 'hard' = towerDifficulty) => {
    if (level === 0) return 1.00;
    const idx = level - 1;
    if (diff === 'easy') {
      const arr = [1.05, 1.15, 1.30, 2.85, 3.70, 4.80, 6.25, 8.10, 10.50, 13.50];
      return arr[Math.min(idx, arr.length - 1)];
    } else if (diff === 'medium') {
      const arr = [1.15, 1.40, 1.80, 8.00, 13.20, 21.80, 36.00, 59.50, 98.00, 162.00];
      return arr[Math.min(idx, arr.length - 1)];
    } else {
      const arr = [1.30, 2.00, 4.00, 63.22, 178.29, 502.77, 1417.82, 3998.24, 11275.05, 31795.63];
      return arr[Math.min(idx, arr.length - 1)];
    }
  };

  const towerCashout = (overrideLvl?: number) => {
    if (!towerActive) return;

    const lvl = overrideLvl !== undefined ? overrideLvl : towerLevel;
    const mult = getTowerMultiplier(lvl);
    const payout = Math.floor(towerBet * mult);

    onUpdateStats((stats) => {
      stats.cash += payout;
      stats.totalProfit += (payout - towerBet);
    });

    setTowerActive(false);
    setTowerReveal(true);
    setShowTowerResultModal({
      success: true,
      title: lvl === 10 ? 'CONGRATULATIONS!' : 'TOWER CLAIMED!',
      message: lvl === 10 
        ? '🗼 GRAND CLEAR! You conquered the tower and cashed out floor 10 successfully!' 
        : `🗼 Cashed out floor ${lvl} successfully!`,
      payout,
      multiplier: mult
    });
    triggerLocalNotice('Tower Claim Complete!', `🗼 Cashed out floor ${lvl} successfully for a return of $${payout.toLocaleString()} (${mult}x)!`);
  };

  const abortTowerBet = () => {
    if (!towerActive || towerLevel > 0) return;
    onUpdateStats((stats) => {
      stats.cash += towerBet;
    });
    setTowerActive(false);
    setTowerReveal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in select-none">
      {/* Universal in-game localNotice toast notifications */}
      {localNotice && (
        <div className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md bg-zinc-950 border-2 ${
          localNotice.isError ? 'border-rose-500/80' : 'border-emerald-500/80'
        } p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-50 animate-fade-in`}>
          <div className="flex items-start gap-2.5">
            <span className="text-xl leading-none">{localNotice.isError ? '⚠️' : '🎉'}</span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">{localNotice.title}</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">{localNotice.message}</span>
            </div>
          </div>
          <button
            onClick={() => setLocalNotice(null)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sleek Custom Dark-Themed Tower Result Overlay Modal */}
      {showTowerResultModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-3xl max-w-sm w-full relative font-mono text-center shadow-2xl animate-fade-in">
            <button
              onClick={() => setShowTowerResultModal(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border shadow-lg ${
              showTowerResultModal.success 
                ? 'bg-emerald-950 border-emerald-500/30 text-emerald-450' 
                : 'bg-rose-950 border-rose-500/30 text-rose-450'
            }`}>
              {showTowerResultModal.success ? '🏆' : '💀'}
            </div>
            <h3 className={`text-base font-extrabold uppercase tracking-widest mb-2 ${
              showTowerResultModal.success ? 'text-emerald-400' : 'text-rose-400 font-bold'
            }`}>
              {showTowerResultModal.title}
            </h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed font-semibold">
              {showTowerResultModal.message}
            </p>

            {showTowerResultModal.success && showTowerResultModal.payout !== undefined && (
              <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-900/60 w-full mb-5 flex flex-col gap-1 text-center select-none font-mono">
                <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Winnings Received</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  +${showTowerResultModal.payout.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-500 font-bold">
                  Multiplier: {showTowerResultModal.multiplier?.toFixed(2)}x
                </span>
              </div>
            )}

            <button
              onClick={() => setShowTowerResultModal(null)}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all select-none border font-mono ${
                showTowerResultModal.success 
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 hover:brightness-110 active:scale-98 text-white' 
                  : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-805 text-zinc-350'
              }`}
            >
              {showTowerResultModal.success ? 'Collect Profits' : 'Try Again'}
            </button>
          </div>
        </div>
      )}

      {/* Side selection column */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-extrabold text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-1.5 mb-1.5 leading-none">
          <Gamepad2 className="text-orange-500 w-4 h-4" /> Arcade Selection
        </h2>
        {(['coinflip', 'slots', 'mines', 'dice', 'tower'] as const).map((game) => (
          <button
            key={game}
            onClick={() => setSelectedGame(game)}
            className={`px-4 py-3 rounded-xl border font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-between text-left transition-colors select-none ${
              selectedGame === game
                ? 'bg-zinc-900 text-white border-orange-500/80 shadow-md text-glow'
                : 'bg-zinc-950 text-zinc-500 border-zinc-900/60 hover:text-zinc-300 hover:border-zinc-800'
            }`}
          >
            <span>{game} simulator</span>
            <span className="text-[10px] bg-zinc-950 px-1 border border-zinc-900 rounded select-none uppercase font-black text-zinc-650 opacity-60">
              {game === 'coinflip' ? '1.9x' : game === 'slots' ? 'Jackpot' : 'Multi'}
            </span>
          </button>
        ))}
      </div>

      {/* Main Game Screen panel */}
      <div className="lg:col-span-3 bg-zinc-900 border border-zinc-850 p-6 rounded-2xl flex flex-col justify-between shadow-2xl relative min-h-[440px]">
        {/* Game Title Headers */}
        <div className="flex items-center justify-between mb-4 border-b border-zinc-850/80 pb-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-extrabold text-white text-sm capitalize font-mono tracking-wider flex items-center gap-1.5 leading-none">
              <Sparkles className="w-4 h-4 text-orange-400" /> {selectedGame}
            </h3>
            <span className="text-xs text-zinc-500 font-medium leading-none">
              {selectedGame === 'coinflip' && '50/50 double-or-nothing simulator.'}
              {selectedGame === 'slots' && 'Classic spin matching to pull grand simulated jackpot.'}
              {selectedGame === 'mines' && 'Evade hidden direct delist mines to stack mults.'}
              {selectedGame === 'dice' && 'Choose a number and roll the dice to win 3x your bet!'}
              {selectedGame === 'tower' && 'Step columns without skull surprises to rise payout.'}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-2 border border-zinc-900/50 rounded-xl font-mono text-xs select-none shadow">
            <span className="text-zinc-500">Balance:</span>
            <span className="font-extrabold text-emerald-400">
              ${userStats.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Dynamic Game Workspace view */}
        <div className="flex-1 flex flex-col justify-center items-center py-4 bg-zinc-950/40 p-4 border border-zinc-900/50 rounded-2xl">
          {/* 1. COINFLIP DISPLAY */}
          {selectedGame === 'coinflip' && (
            <div className="flex flex-col items-center gap-5 w-full max-w-xs font-mono">
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 gap-1 w-full text-center text-xs font-bold uppercase select-none">
                <button
                  onClick={() => setCoinSide('heads')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${
                    coinSide === 'heads' ? 'bg-orange-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  💂 Heads
                </button>
                <button
                  onClick={() => setCoinSide('tails')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${
                    coinSide === 'tails' ? 'bg-orange-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  🛡️ Tails
                </button>
              </div>

              {/* Graphical Flipping Coin */}
              <div className="h-28 flex items-center justify-center relative perspective-1000">
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400 flex items-center justify-center border-4 border-amber-950 shadow-lg shadow-orange-950/20 text-3xl font-black text-white select-none transition-transform duration-100 ${
                    coinIsFlapping ? 'animate-spin-fast' : ''
                  }`}
                >
                  {coinOutcome === 'heads' ? '💂' : coinOutcome === 'tails' ? '🛡️' : '🪙'}
                </div>
              </div>

              {coinResultMsg && (
                <div className="text-center font-bold text-xs bg-zinc-900/60 p-2.5 border border-zinc-850 rounded-xl w-full">
                  {coinResultMsg}
                </div>
              )}

              {/* Coinflip controls */}
              <div className="flex flex-col gap-2.5 w-full font-mono">
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="1000000"
                    placeholder="Bet amount..."
                    value={coinBet}
                    onChange={(e) => setCoinBet(Math.min(1000000, Math.max(0, Number(e.target.value))))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase select-none">USD</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold px-1">
                  <span>Max bet: 1,000,000</span>
                </div>
                
                {/* Percentage Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-bold text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setCoinBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.25))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.50))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.75))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    Max
                  </button>
                </div>

                <button
                  onClick={playCoinflip}
                  disabled={coinIsFlapping}
                  className="w-full bg-orange-655 hover:bg-orange-500 active:scale-98 transition-all text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-lg border border-orange-500 mt-1"
                >
                  Flip Coin
                </button>
              </div>
            </div>
          )}

          {/* 2. SLOTS DISPLAY */}
          {selectedGame === 'slots' && (
            <div className="flex flex-col items-center gap-5 w-full max-w-xs font-mono">
              {/* Reels Display box */}
              <div className="flex gap-3 justify-center items-center py-6 px-10 bg-zinc-950 border-4 border-zinc-900 rounded-2xl shadow-inner relative overflow-hidden select-none">
                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-zinc-900" />
                <div className="absolute top-0 bottom-0 right-1/3 w-px bg-zinc-900" />
                {slotReels.map((emoji, idx) => (
                  <span
                    key={idx}
                    className={`text-4xl transition-all ${slotIsSpinning ? 'animate-flicker brightness-110 scale-102 font-bold' : 'scale-100'}`}
                  >
                    {emoji}
                  </span>
                ))}
              </div>

              {slotResultMsg && (
                <div className="text-center font-bold text-xs bg-zinc-900/60 p-2.5 border border-zinc-850 rounded-xl w-full select-none">
                  {slotResultMsg}
                </div>
              )}

              {/* Slots controls */}
              <div className="flex flex-col gap-2.5 w-full font-mono font-medium">
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="1000000"
                    placeholder="Bet amount..."
                    value={slotBet}
                    onChange={(e) => setSlotBet(Math.min(1000000, Math.max(0, Number(e.target.value))))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase select-none">USD</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold px-1">
                  <span>Max bet: 1,000,000</span>
                </div>
                
                {/* Percentage Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-bold text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setSlotBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.25))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.50))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.75))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                  >
                    Max
                  </button>
                </div>

                <button
                  onClick={playSlots}
                  disabled={slotIsSpinning}
                  className="w-full bg-orange-655 hover:bg-orange-500 active:scale-98 transition-all text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl shadow-lg border border-orange-500 mt-1"
                >
                  Spin Slots
                </button>
              </div>
            </div>
          )}

          {/* 3. MINES DISPLAY */}
          {selectedGame === 'mines' && (
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-md items-center justify-between font-mono">
              {/* Mines 5x5 grid */}
              <div className="grid grid-cols-5 gap-1.5 w-full aspect-square bg-zinc-950/80 p-3 rounded-2xl border border-zinc-900 relative">
                {minesGrid.map((state, idx) => (
                  <button
                    key={idx}
                    disabled={!minesActive}
                    onClick={() => handleMinesCellClick(idx)}
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-lg font-bold border transition-all ${
                      state === 'hidden'
                        ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 cursor-pointer hover:border-zinc-700'
                        : state === 'mine'
                        ? 'bg-red-950 border-red-500 text-red-400 text-glow animate-shake'
                        : state === 'revealed-gem'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-400 text-glow scale-96'
                        : 'bg-zinc-950 border-zinc-900 text-zinc-600 font-medium' // cleared gem
                    }`}
                  >
                    {state === 'mine' ? '💣' : state === 'revealed-gem' ? '💎' : state === 'gem' ? '💎' : ''}
                  </button>
                ))}
              </div>

              {/* Side config information column */}
              <div className="flex flex-col gap-3 w-full md:w-44 shrink-0 justify-between self-stretch">
                <div className="flex flex-col gap-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-900 select-none">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Mines:</span>
                    <span className="font-extrabold text-orange-400">{minesCount}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Safe cleared:</span>
                    <span className="font-extrabold text-zinc-350">{minesSafeSelections}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500 border-t border-zinc-900/40 mt-1 pt-1">
                    <span>Multiplier:</span>
                    <span className="font-extrabold text-emerald-400">{minesMultiplier}x</span>
                  </div>
                </div>

                {minesActive ? (
                  <button
                    onClick={() => minesCashout()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold font-mono text-xs shadow-md uppercase tracking-wider text-glow"
                  >
                    Cashout ${Math.floor(minesBet * minesMultiplier).toLocaleString()}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Bet box */}
                    <div className="flex flex-col gap-1 font-mono">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono">Bet Amount</span>
                      <div className="relative font-mono">
                        <input
                          type="number"
                          min="10"
                          max="1000000"
                          value={minesBet}
                          onChange={(e) => setMinesBet(Math.min(1000000, Math.max(0, Number(e.target.value))))}
                          className="w-full bg-zinc-950 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-bold focus:outline-none font-mono"
                        />
                      </div>
                      <span className="text-[9px] text-zinc-500 font-semibold px-1">Max bet: 1,000,000</span>
                      {/* Percentage Shortcuts */}
                      <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] font-bold text-zinc-400">
                        <button
                          type="button"
                          onClick={() => setMinesBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.25))))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinesBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.50))))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinesBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.75))))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          75%
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinesBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash))))}
                          className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                    {/* Select mines count */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Mines Count</span>
                      <select
                        value={minesCount}
                        onChange={(e) => setMinesCount(Number(e.target.value))}
                        className="bg-zinc-950 border border-zinc-850 px-2 py-1.5 rounded-lg text-xs font-bold focus:outline-none"
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
                      className="w-full bg-orange-655 hover:bg-orange-500 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider border border-orange-500 mt-2 hover:brightness-110 active:scale-98 transition-all"
                    >
                      Start Mines
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. DICE ROLL DISPLAY (1-6 choice with amazing 3D animation rollout!) */}
          {selectedGame === 'dice' && (
            <div className="flex flex-col items-center gap-6 w-full max-w-sm font-mono select-none">
              
              {/* Centered Balance Indicator */}
              <div className="flex flex-col items-center gap-0.5 select-none text-center">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none">Balance</span>
                <span className="text-2xl font-black text-white leading-none tracking-tight">
                  ${userStats.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Graphical 3D Flipping Dice Cube */}
              <div className="h-44 flex items-center justify-center relative w-full select-none">
                <div className="dice-scene">
                  <div className="dice-cube-wrapper">
                    <div
                      className="dice-cube"
                      style={{
                        transform: `rotateX(${diceRotX}deg) rotateY(${diceRotY}deg)`
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

                {/* Banner outcome display overlay */}
                {diceResultVal !== null && !diceIsRollingState && (
                  <div className="absolute inset-x-0 bottom-[-14px] flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className={`px-5 py-2 rounded-xl flex flex-col items-center shadow-2xl border text-center font-bold tracking-mono text-[11px] min-w-[210px] backdrop-blur-md ${
                      diceResultVal === diceSelectedNum
                        ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
                    }`}>
                      <span className={`text-[12px] font-black tracking-widest leading-normal ${
                        diceResultVal === diceSelectedNum ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {diceResultVal === diceSelectedNum ? '🎉 WIN' : '❌ LOSS'}
                      </span>
                      <span className="opacity-90 font-mono text-[10px] mt-0.5">
                        {diceResultVal === diceSelectedNum
                          ? `Won $` + (diceBet * 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` on ${diceResultVal}`
                          : `Lost $` + diceBet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` on ${diceResultVal}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Choose Predict Number Buttons (1-6) */}
              <div className="flex flex-col gap-1.5 w-full mt-2">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest font-mono text-center mb-0.5">Choose Number</span>
                <div className="grid grid-cols-6 gap-2 w-full">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={diceIsRollingState}
                      onClick={() => {
                        setDiceSelectedNum(num);
                        // Clear past outcomes to make gameplay crisp
                        setDiceResultVal(null);
                      }}
                      className={`h-11 rounded-xl text-sm font-black font-mono transition-all border flex items-center justify-center select-none ${
                        diceSelectedNum === num
                          ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow shadow-rose-950/50 scale-102 font-extrabold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-900/60 hover:text-zinc-300 hover:border-zinc-850 cursor-pointer disabled:opacity-50'
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
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest font-mono block mb-1">Bet Amount</span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    placeholder="Bet amount..."
                    value={diceBet}
                    disabled={diceIsRollingState}
                    onChange={(e) => setDiceBet(Math.min(1000000, Math.max(1, Number(e.target.value))))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono disabled:opacity-50"
                  />
                  <span className="absolute right-3.5 bottom-3 text-[10px] text-zinc-500 font-bold uppercase select-none">USD</span>
                </div>
                
                <div className="flex justify-between items-center text-[9px] text-zinc-650 font-semibold px-1 tracking-wider leading-none">
                  <span>Max bet: 1,000,000</span>
                </div>
                
                {/* Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 w-full text-xs font-bold text-zinc-400">
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.25))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.50))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash * 0.75))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    disabled={diceIsRollingState}
                    onClick={() => setDiceBet(Math.max(10, Math.min(1000000, Math.floor(userStats.cash))))}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1.5 rounded-lg text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-50 text-[11px]"
                  >
                    Max
                  </button>
                </div>

                <button
                  type="button"
                  onClick={playDiceRoll}
                  disabled={diceIsRollingState}
                  className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-950 disabled:border-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed py-3.5 rounded-xl font-black text-xs uppercase text-white tracking-widest shadow-xl border border-rose-500 mt-2 font-mono transition-all"
                >
                  {diceIsRollingState ? 'Rolling...' : 'Roll'}
                </button>
              </div>
            </div>
          )}

          {/* 5. TOWER COLUMN STEP CLIMBER */}
          {selectedGame === 'tower' && (
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center font-mono select-none">
              <div className="text-center w-full max-w-sm mb-2">
                <h3 className="text-sm font-bold text-zinc-300">Tower</h3>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Climb the tower by picking safe tiles. Cash out before hitting a bomb!
                </p>
              </div>

              {/* Vertical ascending levels layout: bottom to top! */}
              <div className="flex flex-col-reverse gap-1.5 bg-zinc-950 p-2.5 rounded-2xl border border-zinc-900 items-stretch font-mono w-full">
                {Array(10).fill(0).map((_, idx) => {
                  const lvlIdx = 9 - idx; // floor 10 is at the top (lvlIdx = 9), floor 1 is at the bottom (lvlIdx = 0)
                  const isCurrent = lvlIdx === towerLevel;
                  const isPassed = lvlIdx < towerLevel;
                  const userChosenCol = towerUserHistory[lvlIdx];
                  const displayNum = lvlIdx + 1;
                  const multVal = getTowerMultiplier(displayNum);
                  
                  let colsCount = 3;
                  if (towerDifficulty === 'medium') {
                    colsCount = 2;
                  }

                  return (
                    <div
                      key={lvlIdx}
                      className={`flex items-center gap-3 py-1 px-2.5 rounded-xl transition-all border ${
                        isCurrent
                          ? 'bg-rose-950/10 border-rose-500/60 shadow-md shadow-rose-950/20'
                          : isPassed
                          ? 'bg-transparent border-transparent opacity-90'
                          : 'bg-transparent border-transparent opacity-25'
                      }`}
                    >
                      {/* Left prefix: Arrow indicator (only on current level) + Floor Number + Multiplier */}
                      <div className="flex items-center gap-1.5 w-[76px] shrink-0 font-mono font-black select-none text-[10px]">
                        <div className="w-3 text-center">
                          {isCurrent && <span className="text-red-500 animate-pulse text-xs leading-none">▶</span>}
                        </div>
                        <span className="text-zinc-500 w-3 text-right leading-none">{displayNum}</span>
                        <span className={`w-12 text-right leading-none ${isCurrent ? 'text-red-400 font-extrabold' : isPassed ? 'text-emerald-400 font-extrabold' : 'text-zinc-400'}`}>
                          {multVal.toFixed(2)}x
                        </span>
                      </div>

                      {/* Grid columns */}
                      <div className="grid gap-1.5 flex-1" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}>
                        {Array(colsCount).fill(0).map((_, colIdx) => {
                          const isChosen = userChosenCol === colIdx;
                          const isCellSafe = towerGrid[lvlIdx]?.[colIdx] === 1;

                          // Figure out styling & content
                          let cellStyle = "bg-zinc-900/45 border-zinc-900";
                          let iconContent = null;

                          if (towerActive) {
                            if (isCurrent) {
                              cellStyle = "bg-zinc-900 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-650 hover:text-white cursor-pointer active:scale-95";
                            } else if (isPassed) {
                              if (isChosen) {
                                cellStyle = "bg-emerald-950/40 border-emerald-500/80 text-emerald-400 shadow-inner shadow-emerald-950/30";
                                iconContent = <Shield className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />;
                              } else {
                                cellStyle = "bg-zinc-950/70 border-zinc-950/60 text-zinc-800";
                              }
                            } else {
                              cellStyle = "bg-zinc-950/40 border-zinc-950/10 text-zinc-800 opacity-60";
                            }
                          } else if (towerReveal) {
                            if (isCellSafe) {
                              if (isPassed && isChosen) {
                                cellStyle = "bg-emerald-950/55 border-emerald-500 text-emerald-400 font-black";
                                iconContent = <Shield className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />;
                              } else {
                                cellStyle = "bg-zinc-900/50 border-zinc-850 text-zinc-600";
                                iconContent = <Lock className="w-3 h-3 text-zinc-700 font-bold" />;
                              }
                            } else {
                              if (isChosen) {
                                cellStyle = "bg-red-900 border-red-500 text-white animate-pulse shadow-md";
                                iconContent = <Skull className="w-3.5 h-3.5 text-white" />;
                              } else {
                                cellStyle = "bg-red-950/20 border-red-900/30 text-red-700/80";
                                iconContent = <Skull className="w-3 h-3 text-red-900/60" />;
                              }
                            }
                          } else {
                            cellStyle = "bg-zinc-900/20 border-zinc-850/30 text-zinc-700/40";
                            if ((lvlIdx + colIdx) % 3 === 0) {
                              iconContent = <Lock className="w-2.5 h-2.5 text-zinc-805" />;
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
                {/* Balance display */}
                <div className="flex flex-col items-center justify-center py-1 select-none font-sans">
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none font-mono">Balance</span>
                  <span className="text-2xl font-black text-white mt-1.5 leading-none font-mono">
                    {formatCash(userStats.cash)}
                  </span>
                </div>

                {/* Difficulty tab selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider font-mono">Difficulty</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
                    {(['easy', 'medium', 'hard'] as const).map((diff) => (
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
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-955/40'
                            : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 cursor-pointer disabled:opacity-40'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9.5px] text-zinc-500 font-black px-1 font-mono leading-none">
                    {towerDifficulty === 'easy' && '2 safe / 3 tiles per floor'}
                    {towerDifficulty === 'medium' && '1 safe / 2 tiles per floor'}
                    {towerDifficulty === 'hard' && '1 safe / 3 tiles per floor'}
                  </span>
                </div>

                {/* Bet controls */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider font-mono">Bet Amount</span>
                  <div className="relative font-mono font-bold">
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={towerBet}
                      disabled={towerActive}
                      onChange={(e) => setTowerBet(Math.min(1000000, Math.max(1, Number(e.target.value))))}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-xs font-bold leading-none focus:outline-none focus:border-zinc-700 font-mono text-zinc-200 disabled:opacity-60"
                    />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-semibold px-1 font-mono leading-none">Max bet: 1,000,000</span>
                  
                  {/* Percentage Shortcuts */}
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold text-zinc-400 mt-0.5">
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBet(Math.max(1, Math.min(1000000, Math.floor(userStats.cash * 0.25))))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBet(Math.max(1, Math.min(1000000, Math.floor(userStats.cash * 0.50))))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBet(Math.max(1, Math.min(1000000, Math.floor(userStats.cash * 0.75))))}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 py-1 rounded text-center transition-colors cursor-pointer text-zinc-300 hover:text-white disabled:opacity-40"
                    >
                      75%
                    </button>
                    <button
                      type="button"
                      disabled={towerActive}
                      onClick={() => setTowerBet(Math.max(1, Math.min(1000000, Math.floor(userStats.cash))))}
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
                        className="w-full bg-zinc-900 hover:bg-zinc-850 hover:text-white py-3 rounded-xl text-zinc-300 font-extrabold text-[12px] uppercase tracking-wider border border-zinc-800 transition-all active:scale-98 font-mono shadow-md"
                      >
                        Abort Bet
                      </button>
                    ) : (
                      <button
                        onClick={() => towerCashout()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-white font-extrabold text-[12px] uppercase tracking-wider transition-all active:scale-98 font-mono shadow-md flex flex-col items-center justify-center h-12 leading-tight"
                      >
                        <span>Cash Out</span>
                        <span className="text-[9.5px] text-emerald-100 font-bold mt-0.5">
                          ${Math.floor(towerBet * getTowerMultiplier(towerLevel)).toLocaleString()}
                        </span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={startTowerGame}
                      className="w-full bg-rose-600 hover:bg-rose-500 py-3 rounded-xl text-white font-black text-[12px] uppercase tracking-widest transition-all active:scale-98 font-mono shadow-md"
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
        <div className="mt-4 flex items-start gap-2 text-zinc-500 font-mono text-[10px] select-none leading-relaxed border-t border-zinc-850/30 pt-3">
          <AlertTriangle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
          <span>Simulated casino algorithm. All bets are strictly simulated currency. Prestige counts total profits as progression metrics. Keep trading meme coins to maintain cash reserves.</span>
        </div>
      </div>
    </div>
  );
}
