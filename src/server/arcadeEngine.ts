import crypto from "crypto";
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Role as NodeRole,
} from "./appwriteServer";
import { AuthenticatedUser } from "./types";
import { getAuthoritativeUser, saveAuthoritativeUser, globalAdminSettings, UserStateCache, recordWagerLog } from "./db";
import { withUserLock } from "./locks";
import { arcadeLimiter } from "./rateLimit";

export function getNodeAppwriteDatabases(jwt?: string) {
  const endpoint = (process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1").trim();
  const project = (process.env.VITE_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT_ID || "6a1416eb001f50cdb902").trim();
  const apiKey = (process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "").trim();

  const client = new NodeClient()
    .setEndpoint(endpoint)
    .setProject(project);

  if (apiKey) {
    client.setKey(apiKey);
  } else if (jwt && typeof jwt === "string" && jwt.split(".").length === 3) {
    client.setJWT(jwt);
  }

  return new NodeDatabases(client);
}

/**
 * Core internal coinflip logic executed inside an acquired lock.
 * Strictly pays 2.00x (betAmount * 2) on win!
 */
export async function executeCoinflipCore(
  user: AuthenticatedUser,
  betAmount: number,
  normalizedSide: "heads" | "tails",
  userState: UserStateCache
) {
  const userCash = Number(userState.cash);

  if (betAmount > userCash) {
    throw new Error(
      `Insufficient funds. Your cash balance is $${userCash.toFixed(2)}, but your bet is $${betAmount.toFixed(2)}.`
    );
  }

  // 1. Authoritative outcome determination with administrative rig mode support
  const rigMode = globalAdminSettings.arcadeRigMode;
  let resultSide: "heads" | "tails";

  if (rigMode === "win") {
    resultSide = normalizedSide;
  } else if (rigMode === "lose") {
    resultSide = normalizedSide === "heads" ? "tails" : "heads";
  } else {
    resultSide = crypto.randomInt(0, 2) === 0 ? "heads" : "tails";
  }

  const won = resultSide === normalizedSide;
  // Exact 2x payout on win: deduct betAmount, add betAmount * 2 on win => net +betAmount
  const payout = won ? Number((betAmount * 2).toFixed(2)) : 0;
  const profit = Number((won ? betAmount : -betAmount).toFixed(2));
  const nextCash = Number(Math.max(0, userCash - betAmount + payout).toFixed(2));
  const nextTotalProfit = Number(((userState.totalProfit || 0) + profit).toFixed(2));

  // 2. Commit authoritative user balance update
  const updatedUser = await saveAuthoritativeUser(
    user.userId,
    {
      cash: nextCash,
      totalProfit: nextTotalProfit,
    },
    user.jwt
  );

  // 3. Insert authoritative wager document into wagers collection (non-blocking)
  const wagerId = NodeID.unique();
  const wagerEntry = {
    id: wagerId,
    $id: wagerId,
    userId: user.userId,
    polymarketId: "arcade_coinflip",
    amount: betAmount,
    choice: normalizedSide.toUpperCase(),
    timestamp: new Date().toISOString(),
    isPaid: won,
  };
  recordWagerLog(wagerEntry);

  try {
    const nodeDb = getNodeAppwriteDatabases(user.jwt);
    await nodeDb.createDocument(
      "pumpforge",
      "wagers",
      wagerId,
      {
        userId: user.userId,
        polymarketId: "arcade_coinflip",
        amount: betAmount,
        choice: normalizedSide.toUpperCase(),
        timestamp: wagerEntry.timestamp,
        isPaid: won,
      },
      [NodePermission.read(NodeRole.any())]
    );
  } catch (_) {}

  return {
    success: true,
    game: "coinflip",
    outcome: resultSide,
    won,
    payout,
    profit,
    betAmount,
    userStats: updatedUser,
  };
}

/**
 * Executes a server-authoritative Coinflip wager.
 */
export async function processCoinflip(
  user: AuthenticatedUser,
  rawBetAmount: any,
  rawSide: any
) {
  const { allowed, retryAfterMs } = arcadeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Arcade rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
  }

  const betAmount = Number(rawBetAmount);
  if (typeof betAmount !== "number" || isNaN(betAmount) || !isFinite(betAmount) || betAmount <= 0) {
    throw new Error("Invalid bet amount. Must be a positive number.");
  }

  const normalizedSide = String(rawSide || "").toLowerCase().trim();
  if (normalizedSide !== "heads" && normalizedSide !== "tails") {
    throw new Error("Invalid side choice. Please choose either 'heads' or 'tails'.");
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    return executeCoinflipCore(
      user,
      betAmount,
      normalizedSide as "heads" | "tails",
      userState
    );
  });
}
