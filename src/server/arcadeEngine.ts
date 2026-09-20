import crypto from "crypto";
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Role as NodeRole,
} from "node-appwrite";
import { AuthenticatedUser } from "./types";
import { getAuthoritativeUser, saveAuthoritativeUser, globalAdminSettings, UserStateCache } from "./db";
import { withUserLock } from "./locks";
import { arcadeLimiter } from "./rateLimit";

const APPWRITE_ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

/**
 * Initializes a privileged server-side Appwrite Databases client using node-appwrite and APPWRITE_API_KEY.
 * Follows zero-trust principles by performing all balance and wager mutations exclusively on the backend.
 */
export function getNodeAppwriteDatabases() {
  const client = new NodeClient()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);

  if (APPWRITE_API_KEY) {
    client.setKey(APPWRITE_API_KEY);
  }

  return new NodeDatabases(client);
}

/**
 * Core internal coinflip logic executed inside an acquired lock.
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
    // Cryptographically secure RNG (0 or 1)
    resultSide = crypto.randomInt(0, 2) === 0 ? "heads" : "tails";
  }

  const won = resultSide === normalizedSide;
  const payout = won ? Math.floor(betAmount * 1.9) : 0;
  const profit = won ? payout - betAmount : -betAmount;
  const nextCash = Number((userCash + profit).toFixed(2));
  const nextTotalProfit = Number(((userState.totalProfit || 0) + profit).toFixed(2));

  // 2. Initialize node-appwrite with process.env.APPWRITE_API_KEY for privileged balance update
  const nodeDb = getNodeAppwriteDatabases();

  try {
    await nodeDb.updateDocument("pumpforge", "users", user.userId, {
      cash: nextCash,
      totalProfit: nextTotalProfit,
    });
  } catch (dbErr: any) {
    console.warn(
      "node-appwrite users balance update notice (cached state preserved):",
      dbErr?.message || dbErr
    );
  }

  // 3. Insert authoritative wager document into wagers collection with node-appwrite
  try {
    await nodeDb.createDocument(
      "pumpforge",
      "wagers",
      NodeID.unique(),
      {
        userId: user.userId,
        polymarketId: "arcade_coinflip",
        amount: betAmount,
        choice: normalizedSide.toUpperCase(),
        timestamp: new Date().toISOString(),
        isPaid: won,
      },
      [NodePermission.read(NodeRole.user(user.userId))]
    );
  } catch (wagerErr: any) {
    console.warn(
      "node-appwrite wagers create notice:",
      wagerErr?.message || wagerErr
    );
  }

  // 4. Update authoritative in-memory cache and retrieve synchronized state
  const updatedUser = await saveAuthoritativeUser(
    user.userId,
    {
      cash: nextCash,
      totalProfit: nextTotalProfit,
    },
    user.jwt
  );

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
 * - Parses and verifies betAmount as a positive number before comparison and dispatch.
 * - Enforces per-user mutex locking to prevent double-spending or race conditions.
 * - Utilizes node-appwrite initialized with process.env.APPWRITE_API_KEY to perform balance updates and wager inserts.
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

  // Verify numbers: Parse betAmount as Number before comparison or payload dispatch
  const betAmount = Number(rawBetAmount);
  if (typeof betAmount !== "number" || isNaN(betAmount) || betAmount <= 0) {
    throw new Error("Invalid bet amount. Must be a positive number.");
  }

  const normalizedSide = String(rawSide || "").toLowerCase().trim();
  if (normalizedSide !== "heads" && normalizedSide !== "tails") {
    throw new Error("Invalid side choice. Please choose either 'heads' or 'tails'.");
  }

  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    return executeCoinflipCore(
      user,
      betAmount,
      normalizedSide as "heads" | "tails",
      userState
    );
  });
}
