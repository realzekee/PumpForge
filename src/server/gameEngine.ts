import crypto from "crypto";
import {
  coinStore,
  getAuthoritativeUser,
  saveAuthoritativeUser,
  globalAdminSettings,
  getDatabases,
  recordPolymarket,
  persistPolymarketToDatabase,
  normalizePolymarketDoc,
  recordTradeLog,
  recordWagerLog,
  recordHoldingLog,
  inMemoryWagers,
  inMemoryHoldings,
} from "./db";
import { withUserLock } from "./locks";
import { executeCoinflipCore } from "./arcadeEngine";
import {
  RateLimiter,
  tradeLimiter,
  arcadeLimiter,
  dailyRewardLimiter,
  bugReportLimiter,
} from "./rateLimit";
import { AuthenticatedUser } from "./types";
import { ID, Permission, Role, Query } from "./appwriteServer";

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

function getArcadeSessionSecret(): string {
  return (process.env.APPWRITE_API_KEY || process.env.SESSION_SECRET || "pumpforge_arcade_session_secret_v1").trim();
}

function signArcadeSessionToken(payload: any): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getArcadeSessionSecret()).update(data).digest("base64url");
  return `as_${data}.${sig}`;
}

function verifyArcadeSessionToken(token: string | undefined, expectedUserId: string, expectedGame: string): any | null {
  if (!token || typeof token !== "string" || !token.startsWith("as_")) return null;
  const parts = token.slice(3).split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const expectedSig = crypto.createHmac("sha256", getArcadeSessionSecret()).update(data).digest("base64url");
    if (sig !== expectedSig) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (!parsed || parsed.userId !== expectedUserId || parsed.game !== expectedGame) return null;
    return parsed;
  } catch {
    return null;
  }
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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);

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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    let coin = coinStore.getCoin(coinId);
    if (!coin) {
      await coinStore.syncWithDatabase(user.jwt, true);
      coin = coinStore.getCoin(coinId);
    }
    if (!coin) {
      throw new Error("Specified meme coin does not exist or has been delisted.");
    }

    const currentPrice = Number(coin.price);
    const supply = coin.supply || 1000000;
    const detHoldingId =
      "h_" +
      crypto
        .createHash("md5")
        .update(`${user.userId}_${coin.id}`)
        .digest("hex")
        .slice(0, 28);

    if (type === "BUY") {
      let buyCoins = amountCoins;
      let tradeValue = buyCoins * currentPrice;
      let fee = tradeValue * 0.005;
      let totalCost = tradeValue + fee;

      // If user clicked 100% max buy and protocol fee pushed totalCost slightly over cash, adjust buyCoins to fit cash
      if (totalCost > userState.cash && tradeValue <= userState.cash * 1.01 && userState.cash > 0) {
        totalCost = userState.cash;
        tradeValue = totalCost / 1.005;
        fee = totalCost - tradeValue;
        buyCoins = Number((tradeValue / currentPrice).toFixed(4));
      }

      if (userState.cash < totalCost || buyCoins <= 0) {
        throw new Error(
          `Insufficient cash. Required: $${totalCost.toFixed(2)}, Available: $${userState.cash.toFixed(2)}`
        );
      }

      // Automated Market Maker (AMM) price impact curve
      const impactRatio = Math.min(0.2, (buyCoins / supply) * 0.05);
      const newPrice = Number((currentPrice * (1 + impactRatio)).toFixed(6));
      const newLiquidity = Number(((coin.totalLiquidity || 1000) + tradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + tradeValue).toFixed(2));
      const newChange24h = Number(((coin.change24h || 0) + impactRatio * 100).toFixed(2));

      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];

      const updatedCoin = coinStore.updateCoin(coin.id, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        change24h: newChange24h,
        history: newHist,
      })!;

      await coinStore.persistCoinToDatabase(updatedCoin, user.jwt);

      const nextCash = Number(Math.max(0, userState.cash - totalCost).toFixed(2));
      const nextTrades = (userState.tradesCount || 0) + 1;

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades,
        },
        user.jwt
      );

      const databases = getDatabases(user.jwt);
      let existingDoc: any = null;

      try {
        existingDoc = await databases.getDocument("pumpforge", "holdings", detHoldingId);
      } catch (_) {}

      if (!existingDoc) {
        try {
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query.equal("userId", user.userId),
          ]);
          existingDoc = holdingsRes.documents.find(
            (d: any) =>
              d.coinId === coin!.id ||
              d.coinId === coinId ||
              d.coinSymbol?.toLowerCase() === coin!.symbol.toLowerCase()
          );
        } catch (_) {}
      }

      if (!existingDoc) {
        existingDoc = inMemoryHoldings.find(
          (h: any) =>
            h.userId === user.userId &&
            (h.coinId === coin!.id ||
              h.coinId === coinId ||
              h.coinSymbol?.toLowerCase() === coin!.symbol.toLowerCase())
        );
      }

      const prevAmt = existingDoc ? Number(existingDoc.amount ?? existingDoc.tokenAmount ?? 0) : 0;
      const prevAvg = existingDoc ? Number(existingDoc.avgBuyPrice ?? existingDoc.avgPrice ?? currentPrice) : currentPrice;
      const prevInvested = existingDoc ? Number(existingDoc.totalInvested ?? prevAmt * prevAvg) : 0;
      const nextAmt = Number((prevAmt + buyCoins).toFixed(4));
      const nextAvg = Number(((prevAmt * prevAvg + tradeValue) / nextAmt).toFixed(6));
      const nextInvested = Number((prevInvested + tradeValue).toFixed(2));
      const nowIso = new Date().toISOString();

      const holdingResult = {
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextAmt,
        avgBuyPrice: nextAvg,
      };

      recordHoldingLog({
        $id: existingDoc?.$id || detHoldingId,
        id: existingDoc?.$id || detHoldingId,
        userId: user.userId,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextAmt,
        avgBuyPrice: nextAvg,
        totalInvested: nextInvested,
        lastUpdated: nowIso,
      });

      try {
        const targetHoldId = existingDoc?.$id || detHoldingId;
        try {
          await databases.updateDocument("pumpforge", "holdings", targetHoldId, {
            userId: user.userId,
            coinId: coin.id,
            coinSymbol: coin.symbol,
            amount: nextAmt,
            avgBuyPrice: nextAvg,
            totalInvested: nextInvested,
            lastUpdated: nowIso,
          });
        } catch (upErr: any) {
          const msg = String(upErr?.message || "").toLowerCase();
          if (upErr?.code === 404 || upErr?.status === 404 || msg.includes("not found")) {
            await databases.createDocument(
              "pumpforge",
              "holdings",
              targetHoldId,
              {
                userId: user.userId,
                coinId: coin.id,
                coinSymbol: coin.symbol,
                amount: nextAmt,
                avgBuyPrice: nextAvg,
                totalInvested: nextInvested,
                lastUpdated: nowIso,
              },
              [Permission.read(Role.any())]
            );
          } else {
            throw upErr;
          }
        }
      } catch (hErr) {
        console.warn("Non-fatal error persisting holding to Appwrite:", hErr);
      }

      const tradeData = {
        id: ID.unique(),
        userId: user.userId,
        userName: updatedUser.username || user.name || `@${user.userId.slice(0, 6)}`,
        userHandle: updatedUser.handle || `@${user.userId.slice(0, 6)}`,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        coinTicker: coin.symbol,
        coinName: coin.name,
        type: "BUY",
        amountCoins: Number(buyCoins.toFixed(4)),
        amountTokens: Number(buyCoins.toFixed(4)),
        pricePerCoin: Number(currentPrice.toFixed(6)),
        price: Number(currentPrice.toFixed(6)),
        totalCash: Number(tradeValue.toFixed(2)),
        total: Number(tradeValue.toFixed(2)),
        amountUsd: Number(tradeValue.toFixed(2)),
        amount: Number(tradeValue.toFixed(2)),
        fee: Number(fee.toFixed(2)),
        timestamp: nowIso,
        $createdAt: nowIso,
      };
      recordTradeLog(tradeData);

      try {
        await databases.createDocument(
          "pumpforge",
          "trades",
          tradeData.id,
          {
            userId: tradeData.userId,
            coinId: tradeData.coinId,
            coinSymbol: tradeData.coinSymbol,
            type: "BUY",
            amountCoins: tradeData.amountCoins,
            pricePerCoin: tradeData.pricePerCoin,
            totalCash: tradeData.totalCash,
            fee: tradeData.fee,
            timestamp: tradeData.timestamp,
          },
          [Permission.read(Role.any())]
        );
      } catch (tErr) {
        console.warn("Non-fatal error logging buy trade to Appwrite:", tErr);
      }

      return {
        success: true,
        type: "BUY",
        amountCoins: buyCoins,
        price: currentPrice,
        totalCost,
        userStats: updatedUser,
        coin: updatedCoin,
        holding: holdingResult,
        trade: tradeData,
      };
    } else {
      // SELL Operation
      const databases = getDatabases(user.jwt);
      let userHoldingAmount = 0;
      let holdingAvgPrice = currentPrice;
      let holdingDocId = "";

      try {
        const directDoc = await databases.getDocument("pumpforge", "holdings", detHoldingId);
        if (directDoc) {
          userHoldingAmount = Number(directDoc.amount ?? directDoc.tokenAmount ?? 0);
          holdingAvgPrice = Number(directDoc.avgBuyPrice ?? directDoc.avgPrice ?? currentPrice);
          holdingDocId = directDoc.$id;
        }
      } catch (_) {}

      if (!holdingDocId || userHoldingAmount <= 0) {
        try {
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query.equal("userId", user.userId),
          ]);
          const matchDoc = holdingsRes.documents.find(
            (d: any) =>
              d.coinId === coin!.id ||
              d.coinId === coinId ||
              d.coinSymbol?.toLowerCase() === coin!.symbol.toLowerCase()
          );
          if (matchDoc) {
            userHoldingAmount = Number(matchDoc.amount ?? matchDoc.tokenAmount ?? 0);
            holdingAvgPrice = Number(matchDoc.avgBuyPrice ?? matchDoc.avgPrice ?? currentPrice);
            holdingDocId = matchDoc.$id;
          }
        } catch (e) {
          console.warn("Could not query holdings from database:", e);
        }
      }

      if (userHoldingAmount <= 0) {
        const memMatch = inMemoryHoldings.find(
          (h: any) =>
            h.userId === user.userId &&
            (h.coinId === coin!.id ||
              h.coinId === coinId ||
              h.coinSymbol?.toLowerCase() === coin!.symbol.toLowerCase())
        );
        if (memMatch) {
          userHoldingAmount = Number(memMatch.amount ?? memMatch.tokenAmount ?? 0);
          holdingAvgPrice = Number(memMatch.avgBuyPrice ?? memMatch.avgPrice ?? currentPrice);
          holdingDocId = memMatch.$id || memMatch.id || detHoldingId;
        }
      }

      let sellCoins = amountCoins;
      // Allow small floating-point rounding tolerance when selling 100%
      if (sellCoins > userHoldingAmount && userHoldingAmount > 0 && sellCoins <= userHoldingAmount * 1.01 + 0.05) {
        sellCoins = userHoldingAmount;
      }

      if (userHoldingAmount <= 0 || userHoldingAmount + 0.0001 < sellCoins) {
        throw new Error(
          `Insufficient tokens owned. Owned: ${userHoldingAmount.toLocaleString()}, Requested: ${sellCoins.toLocaleString()}`
        );
      }

      const sellTradeValue = sellCoins * currentPrice;
      const fee = sellTradeValue * 0.005;
      const netPayout = sellTradeValue - fee;

      // Price impact curve down
      const impactRatio = Math.min(0.2, (sellCoins / supply) * 0.05);
      const newPrice = Number(Math.max(0.000001, currentPrice * (1 - impactRatio)).toFixed(6));
      const newLiquidity = Number(Math.max(100, (coin.totalLiquidity || 1000) - sellTradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + sellTradeValue).toFixed(2));
      const newChange24h = Number(((coin.change24h || 0) - impactRatio * 100).toFixed(2));

      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];

      const updatedCoin = coinStore.updateCoin(coin.id, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        change24h: newChange24h,
        history: newHist,
      })!;

      await coinStore.persistCoinToDatabase(updatedCoin, user.jwt);

      const profit = Number((netPayout - sellCoins * holdingAvgPrice).toFixed(2));
      const nextCash = Number((userState.cash + netPayout).toFixed(2));
      const nextTrades = (userState.tradesCount || 0) + 1;
      const nextProfit = Number(((userState.totalProfit || 0) + profit).toFixed(2));

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades,
          totalProfit: nextProfit,
        },
        user.jwt
      );

      const nextRemaining = Number(Math.max(0, userHoldingAmount - sellCoins).toFixed(4));
      const nowIso = new Date().toISOString();
      const holdingResult = {
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextRemaining,
        avgBuyPrice: holdingAvgPrice,
      };

      recordHoldingLog({
        $id: holdingDocId || detHoldingId,
        id: holdingDocId || detHoldingId,
        userId: user.userId,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextRemaining,
        avgBuyPrice: holdingAvgPrice,
        lastUpdated: nowIso,
      });

      try {
        const targetHoldId = holdingDocId || detHoldingId;
        if (nextRemaining <= 0.00001) {
          try {
            await databases.deleteDocument("pumpforge", "holdings", targetHoldId);
          } catch (_) {}
          if (targetHoldId !== detHoldingId) {
            try {
              await databases.deleteDocument("pumpforge", "holdings", detHoldingId);
            } catch (_) {}
          }
        } else {
          await databases.updateDocument("pumpforge", "holdings", targetHoldId, {
            amount: nextRemaining,
            lastUpdated: nowIso,
          });
        }
      } catch (hErr) {
        console.warn("Non-fatal error updating holding on sell:", hErr);
      }

      const tradeData = {
        id: ID.unique(),
        userId: user.userId,
        userName: updatedUser.username || user.name || `@${user.userId.slice(0, 6)}`,
        userHandle: updatedUser.handle || `@${user.userId.slice(0, 6)}`,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        coinTicker: coin.symbol,
        coinName: coin.name,
        type: "SELL",
        amountCoins: Number(sellCoins.toFixed(4)),
        amountTokens: Number(sellCoins.toFixed(4)),
        pricePerCoin: Number(currentPrice.toFixed(6)),
        price: Number(currentPrice.toFixed(6)),
        totalCash: Number(sellTradeValue.toFixed(2)),
        total: Number(sellTradeValue.toFixed(2)),
        amountUsd: Number(sellTradeValue.toFixed(2)),
        amount: Number(sellTradeValue.toFixed(2)),
        fee: Number(fee.toFixed(2)),
        timestamp: nowIso,
        $createdAt: nowIso,
      };
      recordTradeLog(tradeData);

      try {
        await databases.createDocument(
          "pumpforge",
          "trades",
          tradeData.id,
          {
            userId: tradeData.userId,
            coinId: tradeData.coinId,
            coinSymbol: tradeData.coinSymbol,
            type: "SELL",
            amountCoins: tradeData.amountCoins,
            pricePerCoin: tradeData.pricePerCoin,
            totalCash: tradeData.totalCash,
            fee: tradeData.fee,
            timestamp: tradeData.timestamp,
          },
          [Permission.read(Role.any())]
        );
      } catch (tErr) {
        console.warn("Non-fatal error logging sell trade to Appwrite:", tErr);
      }

      return {
        success: true,
        type: "SELL",
        amountCoins: sellCoins,
        price: currentPrice,
        netPayout,
        profit,
        userStats: updatedUser,
        coin: updatedCoin,
        holding: holdingResult,
        trade: tradeData,
      };
    }
  });
}

// ----------------------------------------------------
// 3. AUTHORITATIVE ARCADE / GAMBLING RNG ENGINE
// ----------------------------------------------------

// Active Mines Sessions: Keyed by userId (with signed sessionToken fallback for serverless)
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

// Active Tower Sessions: Keyed by userId (with signed sessionToken fallback for serverless)
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
  action: "play" | "start" | "step" | "cashout" | "abort",
  params: any
) {
  const { allowed, retryAfterMs } = arcadeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Arcade rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    const rigMode = globalAdminSettings.arcadeRigMode;

    // --- COINFLIP ---
    if (game === "coinflip") {
      const rawBet = params.betAmount !== undefined ? params.betAmount : params.bet;
      const bet = Number(rawBet);
      const chosenSide = String(params.side || params.choice || "").toLowerCase().trim();
      if (chosenSide !== "heads" && chosenSide !== "tails") {
        throw new Error("Choose heads or tails.");
      }
      if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > Number(userState.cash)) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }

      return executeCoinflipCore(
        user,
        bet,
        chosenSide as "heads" | "tails",
        userState
      );
    }

    // --- SLOTS (3-LINE 3x3 GRID) ---
    if (game === "slots") {
      const bet = Number(params.bet);
      if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }

      let grid: string[][];
      if (rigMode === "win") {
        grid = [
          ["🍒", "🍋", "🔔"],
          ["7️⃣", "7️⃣", "7️⃣"],
          ["💎", "🍒", "🍋"],
        ];
      } else if (rigMode === "lose") {
        grid = [
          ["🍒", "🍋", "🔔"],
          ["🍋", "💎", "🍒"],
          ["🔔", "🍒", "💎"],
        ];
      } else {
        grid = [0, 1, 2].map(() => [
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
        ]);
      }

      const winningLines: number[] = [];
      let payout = 0;

      // Check all 3 horizontal paylines for 3-of-a-kind
      for (let r = 0; r < 3; r++) {
        const row = grid[r];
        if (new Set(row).size === 1) {
          winningLines.push(r);
          let lineMult = 3;
          if (row[0] === "7️⃣") lineMult = 6;
          else if (row[0] === "💎") lineMult = 4;
          payout += Number((bet * lineMult).toFixed(2));
        }
      }

      // If no triple match, check center payline (line 1) for a 2-of-a-kind
      let matchCount = 3;
      if (winningLines.length > 0) {
        matchCount = 1;
      } else if (new Set(grid[1]).size === 2) {
        matchCount = 2;
        winningLines.push(1);
        payout = Math.floor(bet * 1.5);
      }

      const reels = grid[winningLines[0] ?? 1] || grid[1];
      let nextCash = Number((userState.cash - bet + payout).toFixed(2));
      nextCash = Math.max(0, nextCash);

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          totalProfit: Number(((userState.totalProfit || 0) + (payout - bet)).toFixed(2)),
        },
        user.jwt
      );

      return {
        game: "slots",
        grid,
        reels,
        winningLines,
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
      if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
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
      let nextCash = Number((userState.cash - bet).toFixed(2));

      if (won) {
        payout = Math.floor(bet * 3);
        nextCash = Number((nextCash + payout).toFixed(2));
      }

      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: Math.max(0, nextCash),
          totalProfit: Number(((userState.totalProfit || 0) + (won ? payout - bet : -bet)).toFixed(2)),
        },
        user.jwt
      );

      return {
        game: "dice",
        landedFace,
        selectedNum,
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
        if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }

        // Deduct bet from cash
        const nextCash = Number(Math.max(0, userState.cash - bet).toFixed(2));
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

        const sessionToken = signArcadeSessionToken({
          userId: user.userId,
          game: "mines",
          ...session,
        });

        return {
          game: "mines",
          action: "start",
          safeSelections: 0,
          multiplier: 1,
          sessionToken,
          userStats: updatedUser,
        };
      }

      let session = activeMinesSessions.get(user.userId);
      if ((!session || !session.active) && params.sessionToken) {
        const restored = verifyArcadeSessionToken(params.sessionToken, user.userId, "mines");
        if (restored && restored.active) {
          session = {
            bet: Number(restored.bet),
            minesCount: Number(restored.minesCount),
            secretMinesMap: Array.isArray(restored.secretMinesMap) ? restored.secretMinesMap : Array(25).fill(false),
            revealedGrid: Array.isArray(restored.revealedGrid) ? restored.revealedGrid : Array(25).fill("hidden"),
            safeSelections: Number(restored.safeSelections || 0),
            multiplier: Number(restored.multiplier || 1),
            active: true,
          };
          activeMinesSessions.set(user.userId, session);
        }
      }

      if (action === "abort") {
        const refundAmt = session ? session.bet : Number(params.bet || 0);
        activeMinesSessions.delete(user.userId);
        if (refundAmt > 0 && (!session || session.safeSelections === 0)) {
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return {
            game: "mines",
            action: "abort",
            refunded: refundAmt,
            userStats: updatedUser,
          };
        }
        return { game: "mines", action: "abort", refunded: 0, userStats: userState };
      }

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
          const safeIdx = session.secretMinesMap.findIndex(
            (m, i) => !m && session!.revealedGrid[i] === "hidden" && i !== cellIdx
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
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              totalProfit: Number(((userState.totalProfit || 0) - session.bet).toFixed(2)),
            },
            user.jwt
          );

          return {
            game: "mines",
            action: "step",
            hitMine: true,
            explodedCell: cellIdx,
            secretMinesMap: session.secretMinesMap,
            multiplier: 0,
            userStats: updatedUser,
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
          const winnings = Math.floor(session.bet * session.multiplier);
          const nextCash = Number((userState.cash + winnings).toFixed(2));
          session.active = false;
          activeMinesSessions.delete(user.userId);

          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2)),
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

        const nextSessionToken = signArcadeSessionToken({
          userId: user.userId,
          game: "mines",
          ...session,
        });

        return {
          game: "mines",
          action: "step",
          hitMine: false,
          cellIndex: cellIdx,
          safeSelections: session.safeSelections,
          multiplier: session.multiplier,
          sessionToken: nextSessionToken,
        };
      }

      if (action === "cashout") {
        if (session.safeSelections === 0) {
          // If cashing out at 0 selections, refund the initial bet cleanly
          const refundAmt = session.bet;
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          session.active = false;
          activeMinesSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return {
            game: "mines",
            action: "cashout",
            winnings: refundAmt,
            multiplier: 1,
            secretMinesMap: session.secretMinesMap,
            userStats: updatedUser,
          };
        }

        const winnings = Math.floor(session.bet * session.multiplier);
        const nextCash = Number((userState.cash + winnings).toFixed(2));
        session.active = false;
        activeMinesSessions.delete(user.userId);

        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
            totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2)),
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
        if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }

        const nextCash = Number(Math.max(0, userState.cash - bet).toFixed(2));
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

        const sessionToken = signArcadeSessionToken({
          userId: user.userId,
          game: "tower",
          ...session,
        });

        return {
          game: "tower",
          action: "start",
          colsCount,
          safeCount,
          currentLevel: 0,
          sessionToken,
          userStats: updatedUser,
        };
      }

      let session = activeTowerSessions.get(user.userId);
      if ((!session || !session.active) && params.sessionToken) {
        const restored = verifyArcadeSessionToken(params.sessionToken, user.userId, "tower");
        if (restored && restored.active) {
          session = {
            bet: Number(restored.bet),
            difficulty: restored.difficulty || "easy",
            currentLevel: Number(restored.currentLevel || 0),
            secretGrid: Array.isArray(restored.secretGrid) ? restored.secretGrid : [],
            multiplier: Number(restored.multiplier || 1),
            active: true,
          };
          activeTowerSessions.set(user.userId, session);
        }
      }

      if (action === "abort") {
        const refundAmt = session ? session.bet : Number(params.bet || 0);
        activeTowerSessions.delete(user.userId);
        if (refundAmt > 0 && (!session || session.currentLevel === 0)) {
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return {
            game: "tower",
            action: "abort",
            refunded: refundAmt,
            userStats: updatedUser,
          };
        }
        return { game: "tower", action: "abort", refunded: 0, userStats: userState };
      }

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
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              totalProfit: Number(((userState.totalProfit || 0) - session.bet).toFixed(2)),
            },
            user.jwt
          );
          return {
            game: "tower",
            action: "step",
            hitSkull: true,
            secretGrid: session.secretGrid,
            userStats: updatedUser,
          };
        }

        session.currentLevel += 1;
        // Multiplier progression matching UI floors
        const multTable = {
          easy: [1.05, 1.15, 1.3, 2.85, 3.7, 4.8, 6.25, 8.1, 10.5, 13.5],
          medium: [1.15, 1.4, 1.8, 8.0, 13.2, 21.8, 36.0, 59.5, 98.0, 162.0],
          hard: [1.3, 2.0, 4.0, 63.22, 178.29, 502.77, 1417.82, 3998.24, 11275.05, 31795.63],
        };
        session.multiplier = multTable[session.difficulty][session.currentLevel - 1] || 1;

        if (session.currentLevel >= 10) {
          // Reached top floor! Auto cashout
          const winnings = Math.floor(session.bet * session.multiplier);
          const nextCash = Number((userState.cash + winnings).toFixed(2));
          session.active = false;
          activeTowerSessions.delete(user.userId);

          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2)),
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

        const nextSessionToken = signArcadeSessionToken({
          userId: user.userId,
          game: "tower",
          ...session,
        });

        return {
          game: "tower",
          action: "step",
          hitSkull: false,
          level: session.currentLevel,
          multiplier: session.multiplier,
          sessionToken: nextSessionToken,
        };
      }

      if (action === "cashout") {
        if (session.currentLevel === 0) {
          const refundAmt = session.bet;
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          session.active = false;
          activeTowerSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return {
            game: "tower",
            action: "cashout",
            winnings: refundAmt,
            multiplier: 1,
            secretGrid: session.secretGrid,
            userStats: updatedUser,
          };
        }

        const winnings = Math.floor(session.bet * session.multiplier);
        const nextCash = Number((userState.cash + winnings).toFixed(2));
        session.active = false;
        activeTowerSessions.delete(user.userId);

        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
            totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2)),
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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    const costGems = Number(params.costGems ?? params.cost);

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
      const nextCash = Number((userState.cash + cashReward).toFixed(2));

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
        gemReward: bonusGems,
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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);

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
      prestigeLevel: nextPrestige,
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

    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
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
      reward: { type: rewardType, amount: rewardAmt },
      userStats: updated,
    };
  });
}

// Helper to sanitize plain text against HTML/XSS injection
function sanitizePlainText(input: string): string {
  return (input || "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/&(amp|lt|gt|quot|#39|#x2F);/g, (m) => ({
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&#x2F;": "/",
    }[m] || m))
    .replace(/[<>]/g, "")
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
  const initialBuyUsd = Math.max(0, Number(params.initialBuyUsd) || 0);

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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    const creationCost = 1100.0; // $100 list fee + $1000 initial liquidity
    const totalRequired = creationCost + initialBuyUsd;

    if (userState.cash < totalRequired) {
      throw new Error(
        `Insufficient funds. Required: $${totalRequired.toFixed(2)} ($1,100 launch fee${initialBuyUsd > 0 ? ` + $${initialBuyUsd.toFixed(2)} initial buy` : ""}).`
      );
    }

    if ((userState.coinsCreatedCount || 0) >= 10) {
      throw new Error("10-Coin Limit reached for this account.");
    }

    const newCoinId = ID.unique();
    // Use standard tradable supply and price so both small and large trades work seamlessly
    const initSupply = 1000000;
    const initMarketCap = 1000 + initialBuyUsd;
    const initPrice = Number((initMarketCap / initSupply).toFixed(6));
    const initLiquidity = 1000 + initialBuyUsd;
    const nowIso = new Date().toISOString();

    const creatorHandle = userState.handle || (user.name ? `@${user.name.toLowerCase().replace(/[^a-z0-9]/g, "")}` : `@${user.userId.slice(0, 6)}`);
    const creatorName = userState.username || user.name || creatorHandle;

    const newCoin: any = {
      id: newCoinId,
      coinId: newCoinId,
      name: cleanName,
      symbol: cleanSymbol,
      slug,
      creator: creatorHandle,
      creatorName,
      creatorId: user.userId,
      description: cleanDescription,
      avatarEmoji,
      avatarBg: "bg-emerald-950 text-emerald-300 border-emerald-500",
      price: initPrice,
      marketCap: initMarketCap,
      supply: initSupply,
      totalLiquidity: initLiquidity,
      volume24h: initialBuyUsd,
      change24h: initialBuyUsd > 0 ? Number(((initialBuyUsd / 1000) * 100).toFixed(2)) : 0,
      history: [0.001, initPrice],
      createdAt: nowIso,
      isUserCreated: true,
    };

    // Save in authoritative coin store & Appwrite
    coinStore.setCoin(newCoin);
    await coinStore.persistCoinToDatabase(newCoin, user.jwt);

    let initialHolding: any = null;
    if (initialBuyUsd > 0) {
      const boughtTokens = Number((initialBuyUsd / 0.001).toFixed(4));
      const detHoldingId =
        "h_" +
        crypto
          .createHash("md5")
          .update(`${user.userId}_${newCoinId}`)
          .digest("hex")
          .slice(0, 28);
      initialHolding = {
        coinId: newCoinId,
        coinSymbol: cleanSymbol,
        amount: boughtTokens,
        avgBuyPrice: 0.001,
      };
      recordHoldingLog({
        $id: detHoldingId,
        id: detHoldingId,
        userId: user.userId,
        coinId: newCoinId,
        coinSymbol: cleanSymbol,
        amount: boughtTokens,
        avgBuyPrice: 0.001,
        totalInvested: initialBuyUsd,
        lastUpdated: nowIso,
      });

      try {
        const databases = getDatabases(user.jwt);
        await databases.createDocument(
          "pumpforge",
          "holdings",
          detHoldingId,
          {
            userId: user.userId,
            coinId: newCoinId,
            coinSymbol: cleanSymbol,
            amount: boughtTokens,
            avgBuyPrice: 0.001,
            totalInvested: initialBuyUsd,
            lastUpdated: nowIso,
          },
          [Permission.read(Role.any())]
        );
      } catch (_) {}

      const tradeData = {
        id: ID.unique(),
        userId: user.userId,
        userName: creatorName,
        userHandle: creatorHandle,
        coinId: newCoinId,
        coinSymbol: cleanSymbol,
        coinTicker: cleanSymbol,
        coinName: cleanName,
        type: "BUY",
        amountCoins: boughtTokens,
        amountTokens: boughtTokens,
        pricePerCoin: 0.001,
        price: 0.001,
        totalCash: initialBuyUsd,
        total: initialBuyUsd,
        amountUsd: initialBuyUsd,
        amount: initialBuyUsd,
        fee: 0,
        timestamp: nowIso,
        $createdAt: nowIso,
      };
      recordTradeLog(tradeData);
    }

    const nextCash = Number(Math.max(0, userState.cash - totalRequired).toFixed(2));
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
      holding: initialHolding,
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
        userId: String(user.userId || "guest").slice(0, 64),
        username: String(user.name || "Anonymous").slice(0, 64),
        title: cleanTitle.slice(0, 200),
        description: cleanDesc.slice(0, 2000),
        status: "open",
        timestamp: new Date().toISOString(),
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
  if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error("Invalid bet amount.");
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    if (userState.cash < amount) {
      throw new Error(`Insufficient cash balance. Available: $${userState.cash.toFixed(2)}`);
    }

    const databases = getDatabases(user.jwt);
    let market: any = null;
    try {
      market = await databases.getDocument("pumpforge", "polymarkets", marketId);
    } catch {
      const { getPolymarketsList } = await import("./db");
      const allMarkets = await getPolymarketsList(user.jwt);
      market = allMarkets.find((m: any) => (m.$id || m.id) === marketId) || {
        $id: marketId,
        id: marketId,
        question: "Community Forecast",
        endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: "active",
        resolved: false,
        poolYes: marketId === "m1" ? 4500 : marketId === "m2" ? 150 : 0,
        poolNo: marketId === "m1" ? 3200 : marketId === "m2" ? 6400 : 0,
      };
    }

    if (market.status === "closed" || market.resolved) {
      throw new Error("This prediction market has already closed or resolved.");
    }

    const nextCash = Number(Math.max(0, userState.cash - amount).toFixed(2));
    const updatedUser = await saveAuthoritativeUser(
      user.userId,
      {
        cash: nextCash,
      },
      user.jwt
    );

    const prevYes = Number(market.poolYes ?? market.yesPool ?? 0);
    const prevNo = Number(market.poolNo ?? market.noPool ?? 0);
    const newYesPool = choice === "YES" ? prevYes + amount : prevYes;
    const newNoPool = choice === "NO" ? prevNo + amount : prevNo;

    const updatedMarketObj = normalizePolymarketDoc({
      ...market,
      $id: marketId,
      id: marketId,
      poolYes: newYesPool,
      poolNo: newNoPool,
      yesPool: newYesPool,
      noPool: newNoPool,
    });

    await persistPolymarketToDatabase(updatedMarketObj, user.jwt);

    // Create wager document
    let wagerDoc: any = {
      id: ID.unique(),
      userId: user.userId,
      polymarketId: marketId,
      amount: Number(amount),
      choice,
      timestamp: new Date().toISOString(),
      isPaid: false,
    };
    recordWagerLog(wagerDoc);

    try {
      const doc = await databases.createDocument(
        "pumpforge",
        "wagers",
        wagerDoc.id,
        {
          userId: wagerDoc.userId,
          polymarketId: wagerDoc.polymarketId,
          amount: wagerDoc.amount,
          choice: wagerDoc.choice,
          timestamp: wagerDoc.timestamp,
          isPaid: wagerDoc.isPaid,
        },
        [Permission.read(Role.any())]
      );
      wagerDoc = doc;
      recordWagerLog(wagerDoc);
    } catch (_e) {}

    return {
      success: true,
      wager: wagerDoc,
      market: updatedMarketObj,
      userStats: updatedUser,
      newPoolYes: newYesPool,
      newPoolNo: newNoPool,
    };
  });
}

export async function getUserWagers(user: AuthenticatedUser) {
  if (!user || !user.userId) {
    return { wagers: [] };
  }

  const map = new Map<string, any>();
  for (const w of inMemoryWagers) {
    if (w.userId === user.userId) {
      map.set(w.id || w.$id, w);
    }
  }

  try {
    const databases = getDatabases(user.jwt);
    const res = await databases.listDocuments("pumpforge", "wagers", [
      Query.equal("userId", user.userId),
      Query.limit(100),
    ]);
    const docs = res.documents || [];
    for (const d of docs) {
      map.set(d.$id || d.id, d);
      recordWagerLog(d);
    }
  } catch (_err: any) {
    // Non-fatal, use in-memory wagers
  }

  return { wagers: Array.from(map.values()) };
}

// ----------------------------------------------------
// 12. PREDICTION MARKET CREATION ENGINE
// ----------------------------------------------------
const predictionMarketCreationLimiter = new RateLimiter(30, 60 * 60 * 1000); // 30 per hour per user

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
    throw new Error(`Creation limit reached. Try again in ${mins} minutes.`);
  }

  const question = sanitizePlainText(params.question || "");
  const description = sanitizePlainText(params.description || "");
  if (question.length < 5 || question.length > 200) {
    throw new Error("Question must be between 5 and 200 characters.");
  }

  let expiryTimestamp = new Date(params.endDate).getTime();
  if (isNaN(expiryTimestamp) || expiryTimestamp <= Date.now() + 60 * 1000) {
    expiryTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);

    const marketId = ID.unique();
    const combinedQuestion = (description ? `${question} --- ${description}` : question).slice(0, 500);
    const endDateIso = new Date(expiryTimestamp).toISOString();
    const creatorName = String(userState.handle || user.name || `@${user.userId.slice(0, 6)}`).slice(0, 64);

    const marketDoc = normalizePolymarketDoc({
      $id: marketId,
      id: marketId,
      question: combinedQuestion,
      description,
      creatorId: String(user.userId).slice(0, 64),
      creator: creatorName,
      createdAt: new Date().toISOString(),
      endDate: endDateIso,
      status: "active",
      poolYes: 0,
      poolNo: 0,
      resolved: false,
      winningOutcome: null,
      resolvedAt: null,
    });

    await persistPolymarketToDatabase(marketDoc, user.jwt);

    return {
      success: true,
      market: marketDoc,
      userStats: userState,
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

const commentRateLimiter = new RateLimiter(10, 30 * 1000); // 10 comments per 30s

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

  const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
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

  return withUserLock(user.userId, async () => {
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
  });
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

    const bucketMap = new Map<number, { prices: number[]; volume: number; timestamp: number }>();
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

    for (const t of trades) {
      const ts = new Date(t.timestamp || (t as any).$createdAt || Date.now()).getTime();
      const bucketKey = Math.floor(ts / intervalMs) * intervalMs;
      const price = Number(t.pricePerCoin ?? t.price) || basePrice;
      const total = Number(t.totalCash ?? t.total) || (Number(t.amountCoins ?? t.amount) || 0) * price;

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
      tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
      coinsCreatedCount: Number(doc.coinsCreatedCount || 0),
      rugPullsCount: Number(doc.rugPullsCount || 0),
      prestigeLevel: Number(doc.prestigeLevel || 0),
      nameColor: doc.nameColor || doc.equippedColor || "text-zinc-200",
      title: doc.title || "Trader",
      badges: computeUserBadges({
        userId: doc.$id,
        playerId: doc.playerId,
        cash: Number(doc.cash || 0),
        totalProfit: Number(doc.totalProfit || 0),
        tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
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
