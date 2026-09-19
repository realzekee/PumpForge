import crypto from "crypto";
import {
  coinStore,
  getAuthoritativeUser,
  saveAuthoritativeUser,
  globalAdminSettings,
  getDatabases,
} from "./db";
import { withUserLock } from "./locks";
import {
  RateLimiter,
  tradeLimiter,
  arcadeLimiter,
  dailyRewardLimiter,
  bugReportLimiter,
} from "./rateLimit";
import { AuthenticatedUser } from "./types";
import { ID, Permission, Role, Query } from "appwrite";

/**
 * Generates a cryptographically secure random float in [0, 1)
 */
function secureRandomFloat(): number {
  return crypto.randomBytes(4).readUInt32LE(0) / 0xffffffff;
}

/**
 * Generates a cryptographically secure random integer in [min, max] inclusive
 */
function secureRandomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

// ----------------------------------------------------
// 1. DAILY REWARDS ENGINE
// ----------------------------------------------------
export async function processDailyReward(user: AuthenticatedUser) {
  if (user.isGuest) {
    throw new Error("Authentication required to claim daily rewards.");
  }

  const { allowed, retryAfterMs } = dailyRewardLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);

    const now = Date.now();
    const lastClaim = userState.lastDailyRewardClaim ? new Date(userState.lastDailyRewardClaim).getTime() : 0;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

    if (lastClaim && now - lastClaim < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastClaim);
      const remainingHours = (remainingMs / (60 * 60 * 1000)).toFixed(1);
      throw new Error(`Daily reward is on cooldown. Next claim available in ${remainingHours} hours.`);
    }

    // Streak calculation
    let newStreak = 1;
    if (lastClaim && now - lastClaim < 48 * 60 * 60 * 1000) {
      newStreak = (userState.dailyStreak || 1) + 1;
    }

    // Daily claim yields $1500 + 25% per prestige level + streak bonus
    const prestigeMult = 1 + (userState.prestigeLevel || 0) * 0.25;
    const streakBonusCash = Math.min((newStreak - 1) * 100, 1000);
    const rewardCash = Math.floor(1500 * prestigeMult + streakBonusCash);
    const rewardGems = 10 + Math.min(newStreak * 2, 50);

    const nextCash = userState.cash + rewardCash;
    const nextGems = userState.gems + rewardGems;

    const updated = await saveAuthoritativeUser(
      user.userId,
      {
        cash: nextCash,
        gems: nextGems,
        dailyStreak: newStreak,
        lastDailyRewardClaim: new Date(now).toISOString(),
      },
      user.jwt
    );

    return {
      success: true,
      rewardCash,
      rewardGems,
      newStreak,
      userStats: updated,
    };
  });
}

// ----------------------------------------------------
// 2. AUTHORITATIVE TRADING ENGINE
// ----------------------------------------------------
export async function processTrade(
  user: AuthenticatedUser,
  coinId: string,
  type: "BUY" | "SELL",
  amountCoins: number
) {
  // Validate trade parameters strictly
  if (!coinId || typeof coinId !== "string") {
    throw new Error("Invalid coin identifier.");
  }
  if (
    typeof amountCoins !== "number" ||
    isNaN(amountCoins) ||
    !isFinite(amountCoins) ||
    amountCoins <= 0 ||
    amountCoins > 1e12
  ) {
    throw new Error("Invalid trade volume specified.");
  }

  const { allowed, retryAfterMs } = tradeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Trading rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const coin = coinStore.getCoin(coinId);
    if (!coin) {
      throw new Error("Specified meme coin does not exist or has been delisted.");
    }

    const currentPrice = Number(coin.price);
    const supply = coin.supply || 1000000;
    const tradeValue = amountCoins * currentPrice;

    if (type === "BUY") {
      // 0.5% protocol fee
      const fee = tradeValue * 0.005;
      const totalCost = tradeValue + fee;

      if (userState.cash < totalCost) {
        throw new Error(
          `Insufficient cash. Required: $${totalCost.toFixed(2)}, Available: $${userState.cash.toFixed(2)}`
        );
      }

      // Automated Market Maker (AMM) price impact curve
      const impactRatio = Math.min(0.2, (amountCoins / supply) * 0.05);
      const newPrice = Number((currentPrice * (1 + impactRatio)).toFixed(6));
      const newLiquidity = Number(((coin.totalLiquidity || 1000) + tradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + tradeValue).toFixed(2));

      // Append price to history (keep last 30 points)
      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];

      const updatedCoin = coinStore.updateCoin(coinId, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        history: newHist,
      })!;

      // Update user cash
      const nextCash = userState.cash - totalCost;
      const nextTrades = (userState.tradesCount || 0) + 1;

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades,
        },
        user.jwt
      );

      // Record trade and holding in Appwrite if authenticated
      if (!user.isGuest) {
        try {
          const databases = getDatabases(user.jwt);

          // Update user holding
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query.equal("userId", user.userId),
            Query.equal("coinId", coinId),
          ]);

          if (holdingsRes.documents.length > 0) {
            const h = holdingsRes.documents[0];
            const prevAmt = Number(h.tokenAmount || 0);
            const prevAvg = Number(h.avgBuyPrice || currentPrice);
            const nextAmt = prevAmt + amountCoins;
            const nextAvg = (prevAmt * prevAvg + tradeValue) / nextAmt;

            await databases.updateDocument("pumpforge", "holdings", h.$id, {
              tokenAmount: nextAmt,
              avgBuyPrice: nextAvg,
            });
          } else {
            await databases.createDocument(
              "pumpforge",
              "holdings",
              ID.unique(),
              {
                userId: user.userId,
                coinId,
                tokenAmount: amountCoins,
                avgBuyPrice: currentPrice,
              },
              [Permission.read(Role.user(user.userId))]
            );
          }

          // Record trade log
          await databases.createDocument(
            "pumpforge",
            "trades",
            ID.unique(),
            {
              userId: user.userId,
              userName: user.name,
              coinId,
              coinSymbol: coin.symbol,
              type: "BUY",
              amount: amountCoins,
              price: currentPrice,
              totalValue: tradeValue,
              timestamp: new Date().toISOString(),
            },
            [Permission.read(Role.any())]
          );
        } catch (e) {
          console.warn("Non-fatal error logging trade to database:", e);
        }
      }

      return {
        success: true,
        type: "BUY",
        amountCoins,
        price: currentPrice,
        totalCost,
        userStats: updatedUser,
        coin: updatedCoin,
      };
    } else {
      // SELL Operation
      let userHoldingAmount = 0;
      let holdingAvgPrice = currentPrice;
      let holdingDocId = "";

      if (!user.isGuest) {
        try {
          const databases = getDatabases(user.jwt);
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query.equal("userId", user.userId),
            Query.equal("coinId", coinId),
          ]);

          if (holdingsRes.documents.length > 0) {
            const h = holdingsRes.documents[0];
            userHoldingAmount = Number(h.tokenAmount || 0);
            holdingAvgPrice = Number(h.avgBuyPrice || currentPrice);
            holdingDocId = h.$id;
          }
        } catch (e) {
          console.warn("Could not query holdings from database:", e);
        }
      }

      if (userHoldingAmount < amountCoins && !user.isGuest) {
        throw new Error(`Insufficient tokens owned. Owned: ${userHoldingAmount}, Requested: ${amountCoins}`);
      }

      const fee = tradeValue * 0.005;
      const netPayout = tradeValue - fee;

      // Price impact curve down
      const impactRatio = Math.min(0.2, (amountCoins / supply) * 0.05);
      const newPrice = Number(Math.max(0.000001, currentPrice * (1 - impactRatio)).toFixed(6));
      const newLiquidity = Number(Math.max(100, (coin.totalLiquidity || 1000) - tradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + tradeValue).toFixed(2));

      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];

      const updatedCoin = coinStore.updateCoin(coinId, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        history: newHist,
      })!;

      const profit = netPayout - amountCoins * holdingAvgPrice;
      const nextCash = userState.cash + netPayout;
      const nextTrades = (userState.tradesCount || 0) + 1;
      const nextProfit = (userState.totalProfit || 0) + profit;

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades,
          totalProfit: nextProfit,
        },
        user.jwt
      );

      // Update holding in Appwrite
      if (!user.isGuest && holdingDocId) {
        try {
          const databases = getDatabases(user.jwt);
          const nextRemaining = userHoldingAmount - amountCoins;
          if (nextRemaining <= 0.00001) {
            await databases.deleteDocument("pumpforge", "holdings", holdingDocId);
          } else {
            await databases.updateDocument("pumpforge", "holdings", holdingDocId, {
              tokenAmount: nextRemaining,
            });
          }

          // Record trade
          await databases.createDocument(
            "pumpforge",
            "trades",
            ID.unique(),
            {
              userId: user.userId,
              userName: user.name,
              coinId,
              coinSymbol: coin.symbol,
              type: "SELL",
              amount: amountCoins,
              price: currentPrice,
              totalValue: tradeValue,
              profit,
              timestamp: new Date().toISOString(),
            },
            [Permission.read(Role.any())]
          );
        } catch (e) {
          console.warn("Non-fatal error logging sell trade:", e);
        }
      }

      return {
        success: true,
        type: "SELL",
        amountCoins,
        price: currentPrice,
        netPayout,
        profit,
        userStats: updatedUser,
        coin: updatedCoin,
      };
    }
  });
}

// ----------------------------------------------------
// 3. AUTHORITATIVE ARCADE / GAMBLING RNG ENGINE
// ----------------------------------------------------

// Active Mines Sessions: Keyed by userId
interface MinesSession {
  bet: number;
  minesCount: number;
  secretMinesMap: boolean[]; // true = mine
  revealedGrid: ("hidden" | "gem" | "mine" | "revealed-gem")[];
  safeSelections: number;
  multiplier: number;
  active: boolean;
}
const activeMinesSessions = new Map<string, MinesSession>();

// Active Tower Sessions: Keyed by userId
interface TowerSession {
  bet: number;
  difficulty: "easy" | "medium" | "hard";
  currentLevel: number;
  secretGrid: number[][]; // 1 = safe, 0 = skull
  multiplier: number;
  active: boolean;
}
const activeTowerSessions = new Map<string, TowerSession>();

const slotEmojis = ["🍒", "🍋", "🔔", "7️⃣", "💎"];

export async function processArcadeWager(
  user: AuthenticatedUser,
  game: "coinflip" | "slots" | "dice" | "mines" | "tower",
  action: "play" | "start" | "step" | "cashout",
  params: any
) {
  const { allowed, retryAfterMs } = arcadeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Arcade rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const rigMode = globalAdminSettings.arcadeRigMode;

    // --- COINFLIP ---
    if (game === "coinflip") {
      const bet = Number(params.bet);
      const chosenSide = params.side as "heads" | "tails";
      if (!chosenSide || !["heads", "tails"].includes(chosenSide)) {
        throw new Error("Choose heads or tails.");
      }
      if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }

      let resultSide: "heads" | "tails";
      if (rigMode === "win") {
        resultSide = chosenSide;
      } else if (rigMode === "lose") {
        resultSide = chosenSide === "heads" ? "tails" : "heads";
      } else {
        resultSide = secureRandomInt(0, 1) === 0 ? "heads" : "tails";
      }

      const won = resultSide === chosenSide;
      let payout = 0;
      let nextCash = userState.cash - bet;

      if (won) {
        payout = Math.floor(bet * 1.9);
        nextCash += payout;
      }

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          totalProfit: (userState.totalProfit || 0) + (won ? payout - bet : -bet),
        },
        user.jwt
      );

      return {
        game: "coinflip",
        outcome: resultSide,
        won,
        payout,
        profit: won ? payout - bet : -bet,
        userStats: updatedUser,
      };
    }

    // --- SLOTS ---
    if (game === "slots") {
      const bet = Number(params.bet);
      if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }

      let reels: string[];
      if (rigMode === "win") {
        reels = ["7️⃣", "7️⃣", "7️⃣"];
      } else if (rigMode === "lose") {
        reels = ["🍒", "🍋", "🔔"];
      } else {
        reels = [
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
        ];
      }

      const matchCount = new Set(reels).size;
      let payout = 0;
      let nextCash = userState.cash - bet;

      if (matchCount === 1) {
        // Triple match
        let multiplier = 3;
        if (reels[0] === "7️⃣") multiplier = 6;
        else if (reels[0] === "💎") multiplier = 4;
        payout = bet * multiplier;
      } else if (matchCount === 2) {
        // Double match
        payout = Math.floor(bet * 0.95);
      }

      nextCash += payout;
      const won = payout > 0;

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          totalProfit: (userState.totalProfit || 0) + (payout - bet),
        },
        user.jwt
      );

      return {
        game: "slots",
        reels,
        matchCount,
        payout,
        profit: payout - bet,
        userStats: updatedUser,
      };
    }

    // --- DICE ---
    if (game === "dice") {
      const bet = Number(params.bet);
      const selectedNum = Number(params.selectedNum);
      if (!selectedNum || selectedNum < 1 || selectedNum > 6) {
        throw new Error("Choose a face number between 1 and 6.");
      }
      if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }

      let landedFace: number;
      if (rigMode === "win") {
        landedFace = selectedNum;
      } else if (rigMode === "lose") {
        landedFace = (selectedNum % 6) + 1;
      } else {
        landedFace = secureRandomInt(1, 6);
      }

      const won = landedFace === selectedNum;
      let payout = 0;
      let nextCash = userState.cash - bet;

      if (won) {
        payout = Math.floor(bet * 3);
        nextCash += payout;
      }

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          totalProfit: (userState.totalProfit || 0) + (won ? payout - bet : -bet),
        },
        user.jwt
      );

      return {
        game: "dice",
        landedFace,
        won,
        payout,
        profit: won ? payout - bet : -bet,
        userStats: updatedUser,
      };
    }

    // --- MINES ---
    if (game === "mines") {
      if (action === "start") {
        const bet = Number(params.bet);
        const minesCount = Number(params.minesCount) || 3;
        if (minesCount < 1 || minesCount > 24) {
          throw new Error("Mines count must be between 1 and 24.");
        }
        if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }

        // Deduct bet from cash
        const nextCash = userState.cash - bet;
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
          },
          user.jwt
        );

        // Populate secret mines map on the server
        const secretMap = Array(25).fill(false);
        let placed = 0;
        while (placed < minesCount) {
          const idx = secureRandomInt(0, 24);
          if (!secretMap[idx]) {
            secretMap[idx] = true;
            placed++;
          }
        }

        const session: MinesSession = {
          bet,
          minesCount,
          secretMinesMap: secretMap,
          revealedGrid: Array(25).fill("hidden"),
          safeSelections: 0,
          multiplier: 1,
          active: true,
        };
        activeMinesSessions.set(user.userId, session);

        return {
          game: "mines",
          action: "start",
          safeSelections: 0,
          multiplier: 1,
          userStats: updatedUser,
        };
      }

      const session = activeMinesSessions.get(user.userId);
      if (!session || !session.active) {
        throw new Error("No active Mines game found. Please place a bet to start.");
      }

      if (action === "step") {
        const cellIdx = Number(params.cellIndex);
        if (cellIdx < 0 || cellIdx >= 25 || session.revealedGrid[cellIdx] !== "hidden") {
          throw new Error("Invalid tile selection.");
        }

        let isMine = session.secretMinesMap[cellIdx];
        if (rigMode === "win" && isMine) {
          // Swap mine with safe
          const safeIdx = session.secretMinesMap.findIndex(
            (m, i) => !m && session.revealedGrid[i] === "hidden" && i !== cellIdx
          );
          if (safeIdx !== -1) {
            session.secretMinesMap[cellIdx] = false;
            session.secretMinesMap[safeIdx] = true;
            isMine = false;
          }
        } else if (rigMode === "lose") {
          isMine = true;
        }

        if (isMine) {
          // Mine exploded
          session.active = false;
          activeMinesSessions.delete(user.userId);

          return {
            game: "mines",
            action: "step",
            hitMine: true,
            explodedCell: cellIdx,
            secretMinesMap: session.secretMinesMap, // Revealed on loss for transparency
            multiplier: 0,
            userStats: userState,
          };
        }

        // Safe cell
        session.revealedGrid[cellIdx] = "revealed-gem";
        session.safeSelections += 1;

        // Calculate dynamic multiplier
        const totalTiles = 25;
        let mult = 0.98;
        for (let i = 0; i < session.safeSelections; i++) {
          mult *= (totalTiles - i) / (totalTiles - session.minesCount - i);
        }
        session.multiplier = Number(Math.max(1.05, mult).toFixed(2));

        const maxSafe = 25 - session.minesCount;
        const clearedAll = session.safeSelections >= maxSafe;

        if (clearedAll) {
          // Auto cashout on total clear
          const winnings = Math.floor(session.bet * session.multiplier);
          const nextCash = userState.cash + winnings;
          session.active = false;
          activeMinesSessions.delete(user.userId);

          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: (userState.totalProfit || 0) + (winnings - session.bet),
            },
            user.jwt
          );

          return {
            game: "mines",
            action: "step",
            hitMine: false,
            clearedAll: true,
            winnings,
            multiplier: session.multiplier,
            secretMinesMap: session.secretMinesMap,
            userStats: updatedUser,
          };
        }

        return {
          game: "mines",
          action: "step",
          hitMine: false,
          cellIndex: cellIdx,
          safeSelections: session.safeSelections,
          multiplier: session.multiplier,
        };
      }

      if (action === "cashout") {
        if (session.safeSelections === 0) {
          throw new Error("Must select at least one safe cell before cashing out.");
        }

        const winnings = Math.floor(session.bet * session.multiplier);
        const nextCash = userState.cash + winnings;
        session.active = false;
        activeMinesSessions.delete(user.userId);

        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
            totalProfit: (userState.totalProfit || 0) + (winnings - session.bet),
          },
          user.jwt
        );

        return {
          game: "mines",
          action: "cashout",
          winnings,
          multiplier: session.multiplier,
          secretMinesMap: session.secretMinesMap,
          userStats: updatedUser,
        };
      }
    }

    // --- TOWER ---
    if (game === "tower") {
      if (action === "start") {
        const bet = Number(params.bet);
        const difficulty = (params.difficulty || "easy") as "easy" | "medium" | "hard";
        if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }

        const nextCash = userState.cash - bet;
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
          },
          user.jwt
        );

        let colsCount = 3;
        let safeCount = 2;
        if (difficulty === "medium") {
          colsCount = 2;
          safeCount = 1;
        } else if (difficulty === "hard") {
          colsCount = 3;
          safeCount = 1;
        }

        // Generate 10 floors of secret safe blocks
        const secretGrid: number[][] = [];
        for (let l = 0; l < 10; l++) {
          const arr = Array(colsCount).fill(0);
          const safeCols = new Set<number>();
          while (safeCols.size < safeCount) {
            safeCols.add(secureRandomInt(0, colsCount - 1));
          }
          safeCols.forEach((idx) => (arr[idx] = 1));
          secretGrid.push(arr);
        }

        const session: TowerSession = {
          bet,
          difficulty,
          currentLevel: 0,
          secretGrid,
          multiplier: 1,
          active: true,
        };
        activeTowerSessions.set(user.userId, session);

        return {
          game: "tower",
          action: "start",
          colsCount,
          safeCount,
          currentLevel: 0,
          userStats: updatedUser,
        };
      }

      const session = activeTowerSessions.get(user.userId);
      if (!session || !session.active) {
        throw new Error("No active Tower game found. Please place a bet.");
      }

      if (action === "step") {
        const colIndex = Number(params.colIndex);
        const currentFloor = session.secretGrid[session.currentLevel];
        if (!currentFloor || colIndex < 0 || colIndex >= currentFloor.length) {
          throw new Error("Invalid tower column.");
        }

        let isSafe = currentFloor[colIndex] === 1;
        if (rigMode === "win") isSafe = true;
        else if (rigMode === "lose") isSafe = false;

        if (!isSafe) {
          session.active = false;
          activeTowerSessions.delete(user.userId);
          return {
            game: "tower",
            action: "step",
            hitSkull: true,
            secretGrid: session.secretGrid,
            userStats: userState,
          };
        }

        session.currentLevel += 1;
        // Multiplier progression
        const multTable = {
          easy: [1.35, 1.85, 2.5, 3.4, 4.6, 6.2, 8.4, 11.5, 15.6, 21.0],
          medium: [1.8, 3.2, 5.8, 10.5, 19.0, 34.0, 61.0, 110.0, 198.0, 350.0],
          hard: [2.7, 7.3, 19.8, 53.5, 144.0, 390.0, 1050.0, 2800.0, 7600.0, 20000.0],
        };
        session.multiplier = multTable[session.difficulty][session.currentLevel - 1] || 1;

        if (session.currentLevel >= 10) {
          // Reached top floor! Auto cashout
          const winnings = Math.floor(session.bet * session.multiplier);
          const nextCash = userState.cash + winnings;
          session.active = false;
          activeTowerSessions.delete(user.userId);

          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: (userState.totalProfit || 0) + (winnings - session.bet),
            },
            user.jwt
          );

          return {
            game: "tower",
            action: "step",
            hitSkull: false,
            level: session.currentLevel,
            multiplier: session.multiplier,
            clearedTop: true,
            winnings,
            secretGrid: session.secretGrid,
            userStats: updatedUser,
          };
        }

        return {
          game: "tower",
          action: "step",
          hitSkull: false,
          level: session.currentLevel,
          multiplier: session.multiplier,
        };
      }

      if (action === "cashout") {
        if (session.currentLevel === 0) {
          throw new Error("Climb at least one floor before cashing out.");
        }

        const winnings = Math.floor(session.bet * session.multiplier);
        const nextCash = userState.cash + winnings;
        session.active = false;
        activeTowerSessions.delete(user.userId);

        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
            totalProfit: (userState.totalProfit || 0) + (winnings - session.bet),
          },
          user.jwt
        );

        return {
          game: "tower",
          action: "cashout",
          winnings,
          multiplier: session.multiplier,
          secretGrid: session.secretGrid,
          userStats: updatedUser,
        };
      }
    }

    throw new Error("Unsupported arcade game or action.");
  });
}

// ----------------------------------------------------
// 4. AUTHORITATIVE FORGE SHOP ENGINE
// ----------------------------------------------------
export async function processShopBuy(
  user: AuthenticatedUser,
  type: "color" | "crate",
  params: any
) {
  if (user.isGuest) {
    throw new Error("Connecting your Google profile is required to purchase items in the Shop.");
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const costGems = Number(params.costGems);

    if (typeof costGems !== "number" || isNaN(costGems) || costGems <= 0) {
      throw new Error("Invalid item cost specified.");
    }

    if (userState.gems < costGems) {
      throw new Error(`Insufficient gems. Required: ${costGems}, Available: ${userState.gems}`);
    }

    if (type === "color") {
      const colorClass = params.colorClass;
      if (!colorClass || typeof colorClass !== "string") {
        throw new Error("Invalid color cosmetic specified.");
      }

      const nextGems = userState.gems - costGems;
      const updated = await saveAuthoritativeUser(
        user.userId,
        {
          gems: nextGems,
          nameColor: colorClass,
        },
        user.jwt
      );

      return {
        success: true,
        type: "color",
        equippedColor: colorClass,
        userStats: updated,
      };
    } else if (type === "crate") {
      const crateId = params.crateId;
      let minCash = 5000;
      let maxCash = 15000;
      let minBonusGems = 5;
      let maxBonusGems = 25;

      if (crateId === "fatass") {
        minCash = 20000;
        maxCash = 60000;
        minBonusGems = 20;
        maxBonusGems = 80;
      } else if (crateId === "motion") {
        minCash = 100000;
        maxCash = 250000;
        minBonusGems = 50;
        maxBonusGems = 200;
      } else if (crateId === "auraful") {
        minCash = 300000;
        maxCash = 1000000;
        minBonusGems = 150;
        maxBonusGems = 600;
      }

      const cashReward = secureRandomInt(minCash, maxCash);
      const bonusGems = secureRandomInt(minBonusGems, maxBonusGems);

      const nextGems = userState.gems - costGems + bonusGems;
      const nextCash = userState.cash + cashReward;

      const updated = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          gems: nextGems,
        },
        user.jwt
      );

      return {
        success: true,
        type: "crate",
        crateId,
        cashReward,
        bonusGems,
        userStats: updated,
      };
    }

    throw new Error("Invalid shop action.");
  });
}

// ----------------------------------------------------
// 5. PRESTIGE SYSTEM ENGINE
// ----------------------------------------------------
export async function processPrestige(user: AuthenticatedUser) {
  if (user.isGuest) {
    throw new Error("Authentication required for prestige resets.");
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);

    if (userState.cash < 100000.0) {
      throw new Error(`Prestige requires at least $100,000.00 cash reserves. Current: $${userState.cash.toFixed(2)}`);
    }

    const nextPrestige = (userState.prestigeLevel || 0) + 1;
    const nextGems = (userState.gems || 0) + 500;

    // Reset user holdings in Appwrite
    try {
      const databases = getDatabases(user.jwt);
      const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
        Query.equal("userId", user.userId),
        Query.limit(100),
      ]);
      for (const h of holdingsRes.documents) {
        await databases.deleteDocument("pumpforge", "holdings", h.$id);
      }
    } catch (e) {
      console.warn("Could not clear holdings during prestige:", e);
    }

    const updated = await saveAuthoritativeUser(
      user.userId,
      {
        cash: 5000.0,
        gems: nextGems,
        prestigeLevel: nextPrestige,
        totalProfit: 0,
      },
      user.jwt
    );

    return {
      success: true,
      nextPrestige,
      gemsAwarded: 500,
      userStats: updated,
    };
  });
}

// ----------------------------------------------------
// 6. PROMO CODE REDEMPTION
// ----------------------------------------------------
export async function processPromocode(user: AuthenticatedUser, code: string) {
  if (user.isGuest) {
    throw new Error("Authentication required to redeem promo codes.");
  }

  const cleanCode = (code || "").trim().toUpperCase();
  if (!cleanCode) {
    throw new Error("Please enter a valid code.");
  }

  return withUserLock(user.userId, async () => {
    const databases = getDatabases(user.jwt);
    const promoRes = await databases.listDocuments("pumpforge", "promocodes", [
      Query.equal("code", cleanCode),
    ]);

    if (promoRes.documents.length === 0) {
      throw new Error("Promo code does not exist or has expired.");
    }

    const promoDoc = promoRes.documents[0];
    if (promoDoc.isActive === false) {
      throw new Error("This promo code is no longer active.");
    }

    if (promoDoc.expiresAt && new Date(promoDoc.expiresAt).getTime() < Date.now()) {
      throw new Error("This promo code has expired.");
    }

    const claimedArray: string[] = promoDoc.claimedBy || [];
    if (promoDoc.maxUses && claimedArray.length >= promoDoc.maxUses) {
      throw new Error("This promo code has reached its maximum usage limit.");
    }

    if (claimedArray.includes(user.userId)) {
      throw new Error("Promo code has already been redeemed on this account.");
    }

    const rewardType = promoDoc.rewardType || "cash";
    const rewardAmt = Number(promoDoc.rewardAmount) || 1000;

    // Record redemption on promocode document
    await databases.updateDocument("pumpforge", "promocodes", promoDoc.$id, {
      claimedBy: [...claimedArray, user.userId],
    });

    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    let nextCash = userState.cash;
    let nextGems = userState.gems;

    if (rewardType === "gems") {
      nextGems += rewardAmt;
    } else {
      nextCash += rewardAmt;
    }

    const updated = await saveAuthoritativeUser(
      user.userId,
      {
        cash: nextCash,
        gems: nextGems,
      },
      user.jwt
    );

    return {
      success: true,
      rewardType,
      rewardAmount: rewardAmt,
      userStats: updated,
    };
  });
}

// Helper to sanitize plain text against HTML/XSS injection
function sanitizePlainText(input: string): string {
  return (input || "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/[&<>"'/]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;" }[s] || s))
    .trim();
}

// ----------------------------------------------------
// 7. COIN CREATION ENGINE (Authoritative Server Logic)
// ----------------------------------------------------
export async function processCreateCoin(user: AuthenticatedUser, params: any) {
  if (user.isGuest) {
    throw new Error("Authentication required to launch custom meme tokens.");
  }

  const rawName = (params.name || "").trim();
  const rawSymbol = (params.symbol || "").trim().toUpperCase();
  const rawDescription = (params.description || "").trim();
  const avatarEmoji = params.avatarEmoji || "🪙";

  const cleanName = sanitizePlainText(rawName);
  const cleanSymbol = rawSymbol.replace(/[^A-Z0-9]/g, "");
  const cleanDescription = sanitizePlainText(rawDescription);
  const slug = cleanSymbol.toLowerCase();

  if (cleanName.length < 2 || cleanName.length > 30) {
    throw new Error("Token name must be between 2 and 30 characters.");
  }
  if (cleanSymbol.length < 2 || cleanSymbol.length > 6) {
    throw new Error("Ticker symbol must be 2-6 alphanumeric characters.");
  }
  if (cleanDescription.length < 5 || cleanDescription.length > 300) {
    throw new Error("Description must be between 5 and 300 characters.");
  }

  // Prevent duplicate symbols/slugs
  const existingCoins = coinStore.getAllCoins();
  const duplicate = existingCoins.some(
    (c) =>
      c.symbol.toUpperCase() === cleanSymbol ||
      (c as any).slug?.toLowerCase() === slug ||
      c.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A token with symbol "${cleanSymbol}" or name "${cleanName}" already exists.`);
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const creationCost = 1100.0; // $100 list fee + $1000 initial liquidity

    if (userState.cash < creationCost) {
      throw new Error(`Insufficient funds. Creation fee is $${creationCost.toFixed(2)}.`);
    }

    if ((userState.coinsCreatedCount || 0) >= 10) {
      throw new Error("10-Coin Limit reached for this account.");
    }

    const newCoinId = ID.unique();
    // Core economy requirements: 1,000,000,000 supply, $1,000 initial market cap, $0.000001 initial price
    const initSupply = 1000000000;
    const initMarketCap = 1000;
    const initPrice = 0.000001;
    const initLiquidity = 1000;

    const newCoin = {
      id: newCoinId,
      name: cleanName,
      symbol: cleanSymbol,
      slug,
      creator: user.name || `@${user.userId.slice(0, 6)}`,
      creatorId: user.userId,
      description: cleanDescription,
      avatarEmoji,
      avatarBg: "bg-emerald-950 text-emerald-300 border-emerald-500",
      price: initPrice,
      marketCap: initMarketCap,
      supply: initSupply,
      totalLiquidity: initLiquidity,
      volume24h: 0,
      change24h: 0,
      history: [initPrice],
      createdAt: new Date().toISOString(),
    };

    // Save in authoritative coin store
    coinStore.setCoin(newCoin);

    // Persist in Appwrite
    try {
      const databases = getDatabases(user.jwt);
      await databases.createDocument(
        "pumpforge",
        "coins",
        newCoinId,
        {
          coinId: newCoinId,
          creator: newCoin.creator,
          creatorId: user.userId,
          creatorName: user.name,
          name: newCoin.name,
          symbol: newCoin.symbol,
          slug,
          description: newCoin.description,
          price: initPrice,
          marketCap: initMarketCap,
          totalLiquidity: initLiquidity,
          volume24h: 0,
          change24h: 0,
          history: [initPrice],
          avatarEmoji,
          avatarBg: newCoin.avatarBg,
          supply: initSupply,
        },
        [Permission.read(Role.any())] // Least privilege: read-only for public, NO Role.any() update/delete!
      );
    } catch (e) {
      console.warn("Non-fatal error creating coin doc in Appwrite:", e);
    }

    const nextCash = userState.cash - creationCost;
    const nextCreated = (userState.coinsCreatedCount || 0) + 1;

    const updatedUser = await saveAuthoritativeUser(
      user.userId,
      {
        cash: nextCash,
        coinsCreatedCount: nextCreated,
      },
      user.jwt
    );

    return {
      success: true,
      coin: newCoin,
      userStats: updatedUser,
    };
  });
}

// ----------------------------------------------------
// 8. BUG REPORTING ENGINE
// ----------------------------------------------------
export async function processBugReport(user: AuthenticatedUser, title: string, description: string) {
  const { allowed, retryAfterMs } = bugReportLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s before submitting another report.`);
  }

  const cleanTitle = (title || "").trim();
  const cleanDesc = (description || "").trim();

  if (cleanTitle.length < 3 || cleanTitle.length > 100) {
    throw new Error("Title must be between 3 and 100 characters.");
  }
  if (cleanDesc.length < 10 || cleanDesc.length > 1000) {
    throw new Error("Description must be between 10 and 1000 characters.");
  }

  try {
    const databases = getDatabases(user.jwt);
    await databases.createDocument(
      "pumpforge",
      "bugs",
      ID.unique(),
      {
        title: cleanTitle,
        description: cleanDesc,
        userName: user.name || "Anonymous",
        userEmail: user.email || "",
        reportedBy: `${user.name} (${user.email || "No Email"}) [${user.userId}]`,
        timestamp: new Date().toISOString(),
        status: "open",
      },
      [Permission.read(Role.any())]
    );
  } catch (e) {
    console.warn("Could not save bug report to Appwrite:", e);
  }

  return { success: true };
}

// ----------------------------------------------------
// 9. POLYMARKET WAGERS ENGINE
// ----------------------------------------------------
export async function processPolymarketWager(
  user: AuthenticatedUser,
  marketId: string,
  choice: "YES" | "NO",
  amount: number
) {
  if (user.isGuest) {
    throw new Error("Authentication required to place prediction wagers.");
  }
  if (!["YES", "NO"].includes(choice)) {
    throw new Error("Must select YES or NO outcome.");
  }
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    throw new Error("Invalid bet amount.");
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    if (userState.cash < amount) {
      throw new Error(`Insufficient cash balance. Available: $${userState.cash.toFixed(2)}`);
    }

    const databases = getDatabases(user.jwt);
    const market = await databases.getDocument("pumpforge", "polymarkets", marketId);

    if (market.status === "closed" || market.resolved) {
      throw new Error("This prediction market has already closed or resolved.");
    }

    const nextCash = userState.cash - amount;
    const updatedUser = await saveAuthoritativeUser(
      user.userId,
      {
        cash: nextCash,
      },
      user.jwt
    );

    // Update market pool
    const newYesPool = choice === "YES" ? (Number(market.poolYes) || 0) + amount : Number(market.poolYes) || 0;
    const newNoPool = choice === "NO" ? (Number(market.poolNo) || 0) + amount : Number(market.poolNo) || 0;

    await databases.updateDocument("pumpforge", "polymarkets", marketId, {
      poolYes: newYesPool,
      poolNo: newNoPool,
    });

    // Create wager document
    const wagerDoc = await databases.createDocument(
      "pumpforge",
      "wagers",
      ID.unique(),
      {
        userId: user.userId,
        polymarketId: marketId,
        amount: Number(amount),
        choice,
        timestamp: new Date().toISOString(),
        isPaid: false,
      },
      [Permission.read(Role.user(user.userId))] // Least-privilege: only the owner can read
    );

    return {
      success: true,
      wager: wagerDoc,
      userStats: updatedUser,
      newPoolYes: newYesPool,
      newPoolNo: newNoPool,
    };
  });
}

export async function getUserWagers(user: AuthenticatedUser) {
  if (user.isGuest || !user.userId) {
    return { wagers: [] };
  }

  try {
    const databases = getDatabases(user.jwt);
    const res = await databases.listDocuments("pumpforge", "wagers", [
      Query.equal("userId", user.userId),
      Query.limit(100),
    ]);
    return { wagers: res.documents };
  } catch (err: any) {
    console.warn("Could not fetch user wagers from Appwrite:", err);
    return { wagers: [] };
  }
}

// ----------------------------------------------------
// 12. PREDICTION MARKET CREATION ENGINE
// ----------------------------------------------------
const predictionMarketCreationLimiter = new RateLimiter(2, 60 * 60 * 1000); // 2 per hour per user

export async function processCreatePredictionMarket(
  user: AuthenticatedUser,
  params: { question: string; description?: string; endDate: string }
) {
  if (user.isGuest) {
    throw new Error("Authentication required to create prediction markets.");
  }

  const { allowed, retryAfterMs } = predictionMarketCreationLimiter.isAllowed(user.userId);
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    throw new Error(`Creation limit reached (max 2 markets/hour). Try again in ${mins} minutes.`);
  }

  const question = sanitizePlainText(params.question || "");
  const description = sanitizePlainText(params.description || "");
  if (question.length < 5 || question.length > 200) {
    throw new Error("Question must be between 5 and 200 characters.");
  }

  const expiryTimestamp = new Date(params.endDate).getTime();
  if (isNaN(expiryTimestamp) || expiryTimestamp <= Date.now() + 60 * 60 * 1000) {
    throw new Error("Market expiration must be at least 1 hour in the future.");
  }

  const creationCost = 100000; // 100,000 cash requirement

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    if (userState.cash < creationCost) {
      throw new Error(`Insufficient funds. Market creation requires $${creationCost.toLocaleString()} cash.`);
    }

    const nextCash = userState.cash - creationCost;
    const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);

    const marketId = ID.unique();
    const marketDoc = {
      id: marketId,
      question: description ? `${question} --- ${description}` : question,
      creatorId: user.userId,
      creator: user.name || `@${user.userId.slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      endDate: new Date(expiryTimestamp).toISOString(),
      status: "active",
      poolYes: 0,
      poolNo: 0,
      resolved: false,
      winningOutcome: null,
      resolutionTimestamp: null,
    };

    try {
      const databases = getDatabases(user.jwt);
      await databases.createDocument(
        "pumpforge",
        "polymarkets",
        marketId,
        marketDoc,
        [Permission.read(Role.any())] // Least privilege: read-only for public
      );
    } catch (err) {
      console.warn("Could not save prediction market in Appwrite directly:", err);
    }

    return {
      success: true,
      market: marketDoc,
      userStats: updatedUser,
    };
  });
}

// ----------------------------------------------------
// 13. COMMENTS ENGINE (Sanitized, Rate-Limited, Moderated)
// ----------------------------------------------------
export interface CommentItem {
  id: string;
  targetId: string; // coinId or profileId
  userId: string;
  username: string;
  handle: string;
  text: string;
  createdAt: string;
  reported?: boolean;
}

const commentRateLimiter = new RateLimiter(5, 30 * 1000); // 5 comments per 30s

export async function processAddComment(
  user: AuthenticatedUser,
  targetId: string,
  text: string
): Promise<CommentItem> {
  if (user.isGuest) {
    throw new Error("Authentication required to post comments.");
  }

  const { allowed, retryAfterMs } = commentRateLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Comment rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
  }

  const cleanText = sanitizePlainText(text || "");
  if (cleanText.length < 1 || cleanText.length > 500) {
    throw new Error("Comment text must be between 1 and 500 characters.");
  }

  const userState = await getAuthoritativeUser(user.userId, user.jwt);
  const commentId = ID.unique();
  const createdAt = new Date().toISOString();

  const commentData = {
    targetId,
    userId: user.userId,
    username: userState.username || user.name || "Trader",
    handle: userState.handle || `@user${userState.playerId || user.userId.slice(0, 6)}`,
    text: cleanText,
    createdAt,
    reported: false,
  };

  try {
    const databases = getDatabases(user.jwt);
    await databases.createDocument(
      "pumpforge",
      "comments",
      commentId,
      commentData,
      [Permission.read(Role.any())]
    );
  } catch (err) {
    console.warn("Could not persist comment to Appwrite:", err);
  }

  return {
    id: commentId,
    targetId,
    userId: user.userId,
    username: commentData.username,
    handle: commentData.handle,
    text: cleanText,
    createdAt,
    reported: false,
  };
}

export async function processGetComments(targetId: string): Promise<CommentItem[]> {
  try {
    const databases = getDatabases();
    const res = await databases.listDocuments("pumpforge", "comments", [
      Query.equal("targetId", targetId),
      Query.orderDesc("createdAt"),
      Query.limit(100),
    ]);

    return res.documents.map((doc: any) => ({
      id: doc.$id,
      targetId: doc.targetId,
      userId: doc.userId,
      username: doc.username || "Trader",
      handle: doc.handle || `@user`,
      text: doc.text,
      createdAt: doc.createdAt || doc.$createdAt,
      reported: !!doc.reported,
    }));
  } catch (err) {
    console.warn("Could not query comments from Appwrite:", err);
    return [];
  }
}

export async function processDeleteComment(user: AuthenticatedUser, commentId: string): Promise<boolean> {
  if (user.isGuest) {
    throw new Error("Authentication required to delete comments.");
  }
  const databases = getDatabases(user.jwt);
  const doc = await databases.getDocument("pumpforge", "comments", commentId);
  if (doc.userId !== user.userId && !user.isAdmin) {
    throw new Error("You do not have permission to delete this comment.");
  }
  await databases.deleteDocument("pumpforge", "comments", commentId);
  return true;
}

export async function processReportComment(commentId: string): Promise<boolean> {
  const databases = getDatabases();
  await databases.updateDocument("pumpforge", "comments", commentId, {
    reported: true,
  });
  return true;
}

// ----------------------------------------------------
// 13b. PROFILE COSMETIC UPDATE ENGINE
// ----------------------------------------------------
export async function processUpdateProfile(
  user: AuthenticatedUser,
  updates: {
    title?: string;
    username?: string;
    handle?: string;
    nameColor?: string;
    isPremium?: boolean;
  }
) {
  if (user.isGuest) {
    throw new Error("Authentication required to update profile.");
  }

  const sanitizedUpdates: any = {};

  if (updates.username !== undefined) {
    const cleanUser = sanitizePlainText(updates.username);
    if (cleanUser.length >= 2 && cleanUser.length <= 30) {
      sanitizedUpdates.username = cleanUser;
    }
  }

  if (updates.handle !== undefined) {
    const rawHandle = updates.handle.replace(/[^a-zA-Z0-9_@]/g, "");
    const cleanHandle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    if (cleanHandle.length >= 2 && cleanHandle.length <= 30) {
      sanitizedUpdates.handle = cleanHandle;
    }
  }

  if (updates.title !== undefined) {
    const cleanTitle = sanitizePlainText(updates.title);
    if (cleanTitle.length <= 30) {
      sanitizedUpdates.title = cleanTitle;
    }
  }

  if (updates.nameColor !== undefined) {
    sanitizedUpdates.nameColor = String(updates.nameColor).slice(0, 100);
  }

  if (updates.isPremium !== undefined) {
    sanitizedUpdates.isPremium = !!updates.isPremium;
  }

  const updatedUser = await saveAuthoritativeUser(user.userId, sanitizedUpdates, user.jwt);
  return { success: true, userStats: updatedUser };
}

// ----------------------------------------------------
// 14. CANDLESTICK OHLCV AGGREGATOR ENGINE
// ----------------------------------------------------
export interface CandleOHLCV {
  id: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isUp: boolean;
}

export async function processGetCoinCandles(
  coinId: string,
  intervalMinutes: number = 1
): Promise<CandleOHLCV[]> {
  const coin = coinStore.getCoin(coinId);
  const basePrice = coin ? coin.price : 0.000001;

  try {
    const databases = getDatabases();
    const res = await databases.listDocuments("pumpforge", "trades", [
      Query.equal("coinId", coinId),
      Query.orderAsc("timestamp"),
      Query.limit(200),
    ]);

    const trades = res.documents;
    if (!trades || trades.length === 0) {
      // Return 15 synthetic 1-minute seed candles based on coin's price & history
      const history = coin?.history && coin.history.length > 0 ? coin.history : [basePrice];
      const now = Date.now();
      const count = 15;
      const candles: CandleOHLCV[] = [];
      let lastClose = basePrice;

      for (let i = count - 1; i >= 0; i--) {
        const timeStr = new Date(now - i * 60 * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const tick = history[history.length - 1 - (i % history.length)] || lastClose;
        const open = lastClose;
        const close = tick;
        const isUp = close >= open;
        const wiggle = Math.max(basePrice * 0.005, 0.0000001);
        const high = Math.max(open, close) + (isUp ? wiggle : wiggle * 0.3);
        const low = Math.max(0.0000001, Math.min(open, close) - (!isUp ? wiggle : wiggle * 0.3));

        candles.push({
          id: count - i,
          time: timeStr,
          open,
          high,
          low,
          close,
          volume: Math.round(10000 + ((count - i) * 3700) % 40000),
          isUp,
        });
        lastClose = close;
      }
      return candles;
    }

    // Group actual trades into 1-minute time buckets
    const bucketMap = new Map<number, { prices: number[]; volume: number; timestamp: number }>();
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

    for (const t of trades) {
      const ts = new Date(t.timestamp || (t as any).$createdAt || Date.now()).getTime();
      const bucketKey = Math.floor(ts / intervalMs) * intervalMs;
      const price = Number(t.price) || basePrice;
      const total = Number(t.total) || (Number(t.amount) || 0) * price;

      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, { prices: [], volume: 0, timestamp: bucketKey });
      }
      const b = bucketMap.get(bucketKey)!;
      b.prices.push(price);
      b.volume += total;
    }

    const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    const candles: CandleOHLCV[] = [];
    let prevClose = sortedBuckets[0]?.prices[0] || basePrice;

    sortedBuckets.forEach((b, idx) => {
      const open = idx === 0 ? b.prices[0] : prevClose;
      const close = b.prices[b.prices.length - 1];
      const high = Math.max(...b.prices, open, close);
      const low = Math.min(...b.prices, open, close);
      const isUp = close >= open;

      candles.push({
        id: idx + 1,
        time: new Date(b.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        open,
        high,
        low,
        close,
        volume: Math.round(b.volume),
        isUp,
      });
      prevClose = close;
    });

    return candles;
  } catch (err) {
    console.warn("Could not load trades for candles:", err);
    return [
      {
        id: 1,
        time: "Now",
        open: basePrice,
        high: basePrice * 1.01,
        low: basePrice * 0.99,
        close: basePrice,
        volume: 0,
        isUp: true,
      },
    ];
  }
}

export function computeUserBadges(user: {
  userId?: string;
  playerId?: number;
  cash?: number;
  totalProfit?: number;
  tradesCount?: number;
  coinsCreatedCount?: number;
  rugPullsCount?: number;
  prestigeLevel?: number;
}): Array<{ id: string; label: string; icon: string; color: string }> {
  const badges: Array<{ id: string; label: string; icon: string; color: string }> = [];

  if ((user.playerId || 0) <= 100 && (user.playerId || 0) > 0) {
    badges.push({ id: "early_adopter", label: "OG Trader", icon: "👑", color: "text-amber-400" });
  }
  if ((user.prestigeLevel || 0) >= 5) {
    badges.push({ id: "prestige_master", label: `Prestige ${user.prestigeLevel}`, icon: "✨", color: "text-purple-400" });
  } else if ((user.prestigeLevel || 0) > 0) {
    badges.push({ id: "prestige", label: `P${user.prestigeLevel}`, icon: "⭐", color: "text-blue-400" });
  }
  if ((user.totalProfit || 0) >= 1000000) {
    badges.push({ id: "whale", label: "Whale Trader", icon: "🐋", color: "text-cyan-400" });
  }
  if ((user.tradesCount || 0) >= 100) {
    badges.push({ id: "veteran", label: "Veteran", icon: "⚔️", color: "text-emerald-400" });
  }
  if ((user.coinsCreatedCount || 0) >= 5) {
    badges.push({ id: "creator", label: "Token Founder", icon: "🚀", color: "text-rose-400" });
  }
  if ((user.rugPullsCount || 0) >= 1) {
    badges.push({ id: "rugger", label: "Rug Specialist", icon: "🧹", color: "text-orange-400" });
  }

  return badges;
}

// ----------------------------------------------------
// 15. LEADERBOARD RANKINGS ENGINE
// ----------------------------------------------------
export async function processGetLeaderboard(category: string = "gains", limit: number = 50) {
  try {
    const databases = getDatabases();
    let queryOrder = Query.orderDesc("totalProfit");

    if (category === "prestige") {
      queryOrder = Query.orderDesc("prestigeLevel");
    } else if (category === "losses") {
      queryOrder = Query.orderAsc("totalProfit");
    } else if (category === "trades") {
      queryOrder = Query.orderDesc("tradesCount");
    } else if (category === "creations") {
      queryOrder = Query.orderDesc("coinsCreatedCount");
    } else if (category === "rugpulls") {
      queryOrder = Query.orderDesc("rugPullsCount");
    } else {
      // default: "gains" or "profit"
      queryOrder = Query.orderDesc("totalProfit");
    }

    const res = await databases.listDocuments("pumpforge", "users", [
      queryOrder,
      Query.limit(limit),
    ]);

    return res.documents.map((doc: any, idx: number) => ({
      rank: idx + 1,
      playerId: doc.playerId || idx + 1,
      name: doc.username || "Trader",
      handle: doc.handle || `@user${doc.playerId || idx + 1}`,
      totalProfit: Number(doc.totalProfit || 0),
      tradesCount: Number(doc.tradesCount || 0),
      coinsCreatedCount: Number(doc.coinsCreatedCount || 0),
      rugPullsCount: Number(doc.rugPullsCount || 0),
      prestigeLevel: Number(doc.prestigeLevel || 0),
      nameColor: doc.nameColor || "text-zinc-200",
      title: doc.title || "Trader",
      badges: computeUserBadges({
        userId: doc.$id,
        playerId: doc.playerId,
        cash: Number(doc.cash || 0),
        totalProfit: Number(doc.totalProfit || 0),
        tradesCount: Number(doc.tradesCount || 0),
        coinsCreatedCount: Number(doc.coinsCreatedCount || 0),
        rugPullsCount: Number(doc.rugPullsCount || 0),
        prestigeLevel: Number(doc.prestigeLevel || 0),
      } as any),
    }));
  } catch (err) {
    console.warn("Could not query Appwrite for leaderboard:", err);
    return [];
  }
}


