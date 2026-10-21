import { Client, Databases, Query, ID, Permission, Role } from "./appwriteServer";
import { INITIAL_COINS } from "../data/memeCoins";
import { MemeCoin } from "../types";

/**
 * Creates an Appwrite Client configured for server operations.
 */
export function createServerAppwriteClient(jwt?: string) {
  const endpoint = (process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1").trim();
  const project = (process.env.VITE_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT_ID || "6a1416eb001f50cdb902").trim();
  const apiKey = (process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "").trim();

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project);

  if (apiKey) {
    client.setKey(apiKey);
  } else if (jwt && typeof jwt === "string" && jwt.split(".").length === 3) {
    client.setJWT(jwt);
  }

  return client;
}

export function getDatabases(jwt?: string) {
  const client = createServerAppwriteClient(jwt);
  return new Databases(client);
}

// In-memory Authoritative Coins Cache
// Initialized from INITIAL_COINS and synced with Appwrite
class AuthoritativeCoinStore {
  private coins: Map<string, MemeCoin> = new Map();
  private deletedCoinIds: Set<string> = new Set();
  private isInitialized = false;
  private lastSyncAt = 0;

  constructor() {
    this.initDefaultCoins();
  }

  private initDefaultCoins() {
    for (const coin of INITIAL_COINS) {
      this.coins.set(coin.id, {
        ...coin,
        history: coin.history && coin.history.length > 0 ? [...coin.history] : [coin.price],
      });
    }
  }

  public async syncWithDatabase(jwt?: string, force = false) {
    if (!force && this.isInitialized && Date.now() - this.lastSyncAt < 3000) {
      return;
    }
    try {
      const databases = getDatabases(jwt);
      const res = await databases.listDocuments("pumpforge", "coins", [Query.limit(100)]);
      const foundIds = new Set<string>();

      for (const doc of res.documents) {
        const docId = doc.$id || (doc as any).coinId;
        if (!docId) continue;
        if (this.deletedCoinIds.has(docId) || this.deletedCoinIds.has((doc as any).coinId)) {
          continue;
        }

        // Match against existing coin by id, coinId, or symbol
        let canonicalId = docId;
        const matchedInit = INITIAL_COINS.find(
          (ic) =>
            ic.id.toLowerCase() === String(docId).toLowerCase() ||
            ic.id.toLowerCase() === String((doc as any).coinId || "").toLowerCase() ||
            ic.symbol.toLowerCase() === String(doc.symbol || "").toLowerCase()
        );
        if (matchedInit) {
          canonicalId = matchedInit.id;
        }

        foundIds.add(canonicalId);
        const existing = this.coins.get(canonicalId);

        const merged: MemeCoin = {
          id: canonicalId,
          name: doc.name || existing?.name || "Unknown Token",
          symbol: doc.symbol || existing?.symbol || "COIN",
          creator: doc.creator || existing?.creator || "@system",
          creatorId: (doc as any).creatorId || (existing as any)?.creatorId,
          description: doc.description || existing?.description || "",
          price: Number(doc.price ?? existing?.price ?? 0.01),
          marketCap: Math.floor(Number(doc.marketCap ?? existing?.marketCap ?? 1000)),
          totalLiquidity: Number(doc.totalLiquidity ?? (doc as any).total_value ?? existing?.totalLiquidity ?? 1000),
          volume24h: Number(doc.volume24h ?? existing?.volume24h ?? 0),
          change24h: Number(doc.change24h ?? existing?.change24h ?? 0),
          history:
            Array.isArray(doc.history) && doc.history.length > 0
              ? doc.history
              : existing?.history && existing.history.length > 0
              ? [...existing.history.slice(-29), Number(doc.price ?? existing.price ?? 0.01)]
              : [Number(doc.price ?? 0.01)],
          avatarEmoji: doc.avatarEmoji || existing?.avatarEmoji || "🪙",
          avatarBg: doc.avatarBg || existing?.avatarBg || "bg-zinc-900 border-zinc-800",
          supply: Number(doc.supply ?? existing?.supply ?? 1000000),
          createdAt: doc.createdAt || doc.$createdAt || existing?.createdAt,
        };

        this.coins.set(canonicalId, merged);
      }

      // Seed any missing default coins into Appwrite so they persist across serverless instances
      for (const initCoin of INITIAL_COINS) {
        if (!foundIds.has(initCoin.id) && !this.deletedCoinIds.has(initCoin.id)) {
          const current = this.coins.get(initCoin.id) || initCoin;
          this.persistCoinToDatabase(current, jwt).catch(() => {});
        }
      }

      this.isInitialized = true;
      this.lastSyncAt = Date.now();
    } catch (e) {
      if (!this.isInitialized) {
        this.initDefaultCoins();
        this.isInitialized = true;
      }
    }
  }

  public async persistCoinToDatabase(coin: MemeCoin, jwt?: string) {
    try {
      const databases = getDatabases(jwt);
      const payload: Record<string, any> = {
        coinId: String(coin.id).slice(0, 64),
        name: String(coin.name || "Coin").slice(0, 64),
        symbol: String(coin.symbol || "COIN").slice(0, 16),
        slug: String((coin as any).slug || coin.symbol?.toLowerCase() || coin.id).slice(0, 64),
        creator: String(coin.creator || "@system").slice(0, 64),
        description: String(coin.description || "").slice(0, 1000),
        price: Number(coin.price || 0.000001),
        marketCap: Math.floor(Number(coin.marketCap || 1000)),
        totalLiquidity: Number(coin.totalLiquidity || coin.marketCap || 1000),
        volume24h: Number(coin.volume24h || 0),
        change24h: Number(coin.change24h || 0),
        supply: Number(coin.supply || 1000000),
        avatarEmoji: String(coin.avatarEmoji || "🪙").slice(0, 16),
        avatarBg: String(coin.avatarBg || "bg-zinc-900 border-zinc-800").slice(0, 64),
      };
      if ((coin as any).creatorId) {
        payload.creatorId = String((coin as any).creatorId).slice(0, 64);
      }

      try {
        await databases.updateDocument("pumpforge", "coins", coin.id, {
          price: payload.price,
          marketCap: payload.marketCap,
          totalLiquidity: payload.totalLiquidity,
          volume24h: payload.volume24h,
          change24h: payload.change24h,
        });
      } catch (updateErr: any) {
        const msg = String(updateErr?.message || "").toLowerCase();
        if (updateErr?.code === 404 || updateErr?.status === 404 || msg.includes("not found")) {
          await databases.createDocument(
            "pumpforge",
            "coins",
            coin.id,
            payload,
            [Permission.read(Role.any())]
          );
        }
      }
    } catch (err) {
      // Non-fatal if coin write fails
    }
  }

  public getAllCoins(): MemeCoin[] {
    return Array.from(this.coins.values()).filter((c) => !this.deletedCoinIds.has(c.id));
  }

  public getCoin(coinId: string): MemeCoin | undefined {
    if (!coinId) return undefined;
    if (this.deletedCoinIds.has(coinId)) return undefined;
    const direct = this.coins.get(coinId);
    if (direct) return direct;
    const lower = coinId.toLowerCase().trim();
    for (const c of this.coins.values()) {
      if (this.deletedCoinIds.has(c.id)) continue;
      if (
        c.id.toLowerCase() === lower ||
        c.symbol.toLowerCase() === lower ||
        (c as any).slug?.toLowerCase() === lower ||
        (c as any).$id?.toLowerCase() === lower ||
        (c as any).coinId?.toLowerCase() === lower
      ) {
        return c;
      }
    }
    return undefined;
  }

  public setCoin(coin: MemeCoin) {
    this.coins.set(coin.id, coin);
  }

  public updateCoin(coinId: string, updates: Partial<MemeCoin>): MemeCoin | undefined {
    const existing = this.getCoin(coinId);
    if (!existing) return undefined;

    const updated: MemeCoin = {
      ...existing,
      ...updates,
      price: updates.price !== undefined ? Number(updates.price) : existing.price,
      marketCap: updates.marketCap !== undefined ? Math.floor(Number(updates.marketCap)) : existing.marketCap,
      totalLiquidity: updates.totalLiquidity !== undefined ? Number(updates.totalLiquidity) : existing.totalLiquidity,
      change24h: updates.change24h !== undefined ? Number(updates.change24h) : existing.change24h,
      volume24h: updates.volume24h !== undefined ? Number(updates.volume24h) : existing.volume24h,
      history: updates.history || existing.history,
    };

    this.coins.set(existing.id, updated);
    if (coinId !== existing.id) {
      this.coins.set(coinId, updated);
    }
    return updated;
  }

  public deleteCoin(coinId: string): boolean {
    this.deletedCoinIds.add(coinId);
    this.coins.delete(coinId);
    return true;
  }
}

export const coinStore = new AuthoritativeCoinStore();

// In-memory active user caches to prevent repeated DB latency
export interface UserStateCache {
  userId: string;
  docId?: string;
  playerId?: number;
  username?: string;
  handle?: string;
  title?: string;
  isPremium?: boolean;
  cash: number;
  gems: number;
  prestigeLevel: number;
  tradesCount: number;
  coinsCreatedCount: number;
  totalProfit: number;
  nameColor: string;
  dailyStreak: number;
  lastDailyRewardClaim?: string;
  predictionWins?: number;
  rugPullsCount?: number;
  isBanned?: boolean;
  isSuspended?: boolean;
  suspendedUntil?: number | null;
  createdAt?: string;
  updatedAt: number;
  dirty?: boolean;
}

const userCache = new Map<string, UserStateCache>();

interface ClientUserHint {
  cash?: number;
  gems?: number;
  totalProfit?: number;
  tradesCount?: number;
  updatedAt?: number;
  username?: string;
}
const userHintsMap = new Map<string, ClientUserHint>();

export function hydrateUserHintsFromHeaders(userId: string, hint: ClientUserHint) {
  if (!userId) return;
  const existing = userHintsMap.get(userId) || {};
  userHintsMap.set(userId, {
    cash: typeof hint.cash === "number" && !isNaN(hint.cash) && hint.cash >= 0 ? hint.cash : existing.cash,
    gems: typeof hint.gems === "number" && !isNaN(hint.gems) && hint.gems >= 0 ? hint.gems : existing.gems,
    totalProfit: typeof hint.totalProfit === "number" && !isNaN(hint.totalProfit) ? hint.totalProfit : existing.totalProfit,
    tradesCount: typeof hint.tradesCount === "number" && !isNaN(hint.tradesCount) && hint.tradesCount >= 0 ? hint.tradesCount : existing.tradesCount,
    updatedAt: typeof hint.updatedAt === "number" && !isNaN(hint.updatedAt) ? hint.updatedAt : existing.updatedAt,
    username: hint.username || existing.username,
  });
}

let nextPlayerId = 1;
let isPlayerCounterInitialized = false;

async function initPlayerIdCounter(databases: Databases) {
  if (isPlayerCounterInitialized) return;
  try {
    const res = await databases.listDocuments("pumpforge", "users", [
      Query.orderDesc("playerId"),
      Query.limit(1),
    ]);
    if (res.documents.length > 0 && res.documents[0].playerId) {
      nextPlayerId = Math.max(nextPlayerId, Number(res.documents[0].playerId) + 1);
    }
  } catch (err) {
    try {
      const allUsers = await databases.listDocuments("pumpforge", "users", [Query.limit(1)]);
      nextPlayerId = Math.max(nextPlayerId, (allUsers.total || 0) + 1);
    } catch (_) {}
  }
  isPlayerCounterInitialized = true;
}

export function computeUserBadges(user: UserStateCache): string[] {
  const badges: string[] = [];
  if (user.playerId && user.playerId <= 100) badges.push("Early Player");
  if ((user.coinsCreatedCount || 0) >= 1) badges.push("Coin Creator");
  if ((user.tradesCount || 0) >= 5) badges.push("Trader");
  if ((user.cash || 0) >= 100000 || (user.totalProfit || 0) >= 100000) badges.push("Whale");
  if ((user.tradesCount || 0) >= 25 || (user.totalProfit || 0) >= 500000) badges.push("Top Trader");
  if ((user.prestigeLevel || 0) >= 1 || (user.tradesCount || 0) >= 50) badges.push("Market Veteran");
  if ((user.predictionWins || 0) >= 3) badges.push("Prediction Master");
  if ((user.rugPullsCount || 0) >= 1) badges.push("Rug Puller");
  return badges;
}

/**
 * Fetches authoritative user state from Appwrite or cache.
 * Never overwrites a newer dirty in-memory state or newer client-verified balance with a stale Appwrite read.
 */
export async function getAuthoritativeUser(userId: string, jwt?: string, defaultName?: string): Promise<UserStateCache> {
  const cached = userCache.get(userId);
  const hint = userHintsMap.get(userId);

  // If cached state has unsynced mutations on this instance or was updated within the last 5 seconds, trust it immediately
  if (cached && (cached.dirty || Date.now() - cached.updatedAt < 5000)) {
    return cached;
  }

  const isOwnerAccount = userId === "admin_realzekeee";
  const databases = getDatabases(jwt);

  try {
    await initPlayerIdCounter(databases);
    let doc: any = null;
    try {
      doc = await databases.getDocument("pumpforge", "users", userId);
    } catch (getErr: any) {
      const errMsg = String(getErr?.message || "").toLowerCase();
      if (getErr?.code === 404 || getErr?.status === 404 || errMsg.includes("not found")) {
        try {
          const listRes = await databases.listDocuments("pumpforge", "users", [
            Query.equal("userId", userId),
            Query.limit(1),
          ]);
          if (listRes.documents.length > 0) {
            doc = listRes.documents[0];
          }
        } catch (_) {}
      } else {
        throw getErr;
      }
    }

    if (!doc) {
      throw new Error("User document not found in Appwrite");
    }

    const docId = doc.$id || userId;
    const docUpdatedAt = doc.$updatedAt ? new Date(doc.$updatedAt).getTime() : 0;
    let assignedPlayerId = doc.playerId ? Number(doc.playerId) : cached?.playerId;
    if (!assignedPlayerId) {
      assignedPlayerId = isOwnerAccount ? 1 : nextPlayerId++;
      try {
        await databases.updateDocument("pumpforge", "users", docId, {
          playerId: assignedPlayerId,
        });
      } catch (_) {}
    }

    // Determine whether our cached state or client hint is newer than the Appwrite document
    // (e.g., if a previous serverless instance updated the balance or if Appwrite writes were restricted)
    const useCachedBalance = Boolean(cached && (cached.dirty || (docUpdatedAt > 0 && cached.updatedAt > docUpdatedAt + 2000)));
    const useHintBalance = Boolean(
      !useCachedBalance &&
        hint &&
        typeof hint.cash === "number" &&
        hint.updatedAt &&
        (!docUpdatedAt || hint.updatedAt > docUpdatedAt + 2000)
    );

    const resolvedCash = useCachedBalance
      ? cached!.cash
      : useHintBalance
      ? Number(hint!.cash)
      : Number(doc.cash ?? cached?.cash ?? hint?.cash ?? (isOwnerAccount ? 100000.0 : 5000.0));

    const resolvedGems = useCachedBalance
      ? cached!.gems
      : useHintBalance && typeof hint!.gems === "number"
      ? Number(hint!.gems)
      : Number(doc.gems ?? cached?.gems ?? hint?.gems ?? (isOwnerAccount ? 5000 : 90));

    const resolvedProfit = useCachedBalance
      ? cached!.totalProfit
      : useHintBalance && typeof hint!.totalProfit === "number"
      ? Number(hint!.totalProfit)
      : Number(doc.totalProfit ?? cached?.totalProfit ?? hint?.totalProfit ?? 0);

    const resolvedTrades = useCachedBalance
      ? cached!.tradesCount
      : useHintBalance && typeof hint!.tradesCount === "number"
      ? Number(hint!.tradesCount)
      : Number(doc.tradesCount ?? doc.allTimeTrades ?? cached?.tradesCount ?? hint?.tradesCount ?? 0);

    const state: UserStateCache = {
      userId,
      docId,
      playerId: assignedPlayerId,
      username: doc.username || doc.name || cached?.username || defaultName || hint?.username || (isOwnerAccount ? "Zeke (Owner)" : `Player_${assignedPlayerId}`),
      handle: doc.handle || cached?.handle || (isOwnerAccount ? "@zeke" : `@user${assignedPlayerId}`),
      title: doc.title || cached?.title || (isOwnerAccount ? "Founder & Owner" : "Member"),
      isPremium: doc.isPremium !== undefined ? !!doc.isPremium : (cached?.isPremium ?? isOwnerAccount),
      cash: resolvedCash,
      gems: resolvedGems,
      prestigeLevel: Number(doc.prestigeLevel ?? cached?.prestigeLevel ?? 0),
      tradesCount: resolvedTrades,
      coinsCreatedCount: Number(doc.coinsCreatedCount ?? cached?.coinsCreatedCount ?? 0),
      totalProfit: resolvedProfit,
      nameColor: doc.nameColor || doc.equippedColor || cached?.nameColor || (isOwnerAccount ? "text-rose-500 font-extrabold text-glow tracking-wider" : "text-zinc-400 font-extrabold"),
      dailyStreak: Number(doc.dailyStreak ?? cached?.dailyStreak ?? 1),
      lastDailyRewardClaim: doc.lastDailyRewardClaim || cached?.lastDailyRewardClaim || "",
      predictionWins: Number(doc.predictionWins ?? cached?.predictionWins ?? 0),
      rugPullsCount: Number(doc.rugPullsCount ?? cached?.rugPullsCount ?? 0),
      isBanned: doc.isBanned || false,
      isSuspended: doc.isSuspended || false,
      suspendedUntil: doc.suspendedUntil || null,
      createdAt: doc.$createdAt || cached?.createdAt || new Date().toISOString(),
      updatedAt: Math.max(Date.now(), cached?.updatedAt || 0, hint?.updatedAt || 0),
      dirty: useCachedBalance || useHintBalance,
    };

    userCache.set(userId, state);
    return state;
  } catch (err) {
    // If we already have an in-memory state on this instance, preserve it
    if (cached) {
      cached.updatedAt = Date.now();
      return cached;
    }

    const assignedPlayerId = isOwnerAccount ? 1 : nextPlayerId++;
    const fallbackUsername = defaultName || hint?.username || (isOwnerAccount ? "Zeke (Owner)" : `Player_${assignedPlayerId}`);
    const fallbackHandle = isOwnerAccount ? "@zeke" : (`@${fallbackUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}` || `@user${assignedPlayerId}`);
    const initialCash = typeof hint?.cash === "number" && !isNaN(hint.cash) ? hint.cash : (isOwnerAccount ? 100000.0 : 5000.0);
    const initialGems = typeof hint?.gems === "number" && !isNaN(hint.gems) ? hint.gems : (isOwnerAccount ? 5000 : 90);

    const initial: UserStateCache = {
      userId,
      docId: userId,
      playerId: assignedPlayerId,
      username: fallbackUsername,
      handle: fallbackHandle,
      title: isOwnerAccount ? "Founder & Owner" : "Member",
      isPremium: isOwnerAccount,
      cash: initialCash,
      gems: initialGems,
      prestigeLevel: 0,
      tradesCount: typeof hint?.tradesCount === "number" ? hint.tradesCount : 0,
      coinsCreatedCount: 0,
      totalProfit: typeof hint?.totalProfit === "number" ? hint.totalProfit : 0,
      nameColor: isOwnerAccount ? "text-rose-500 font-extrabold text-glow tracking-wider" : "text-zinc-400 font-bold",
      dailyStreak: 1,
      lastDailyRewardClaim: "",
      predictionWins: 0,
      rugPullsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      dirty: true,
    };
    userCache.set(userId, initial);

    // Bootstrap in Appwrite via server key
    try {
      const serverDatabases = getDatabases(jwt);
      await serverDatabases.createDocument(
        "pumpforge",
        "users",
        userId,
        {
          userId,
          playerId: initial.playerId,
          username: initial.username,
          handle: initial.handle,
          cash: initial.cash,
          gems: initial.gems,
          prestigeLevel: initial.prestigeLevel,
          totalProfit: initial.totalProfit,
          tradesCount: initial.tradesCount,
          coinsCreatedCount: 0,
          dailyStreak: 1,
          lastDailyRewardClaim: "",
          nameColor: initial.nameColor,
          title: initial.title,
        },
        [Permission.read(Role.any())]
      );
      initial.dirty = false;
    } catch (createErr) {
      console.warn("Could not create initial user in Appwrite DB (in-memory cached):", createErr);
    }

    return initial;
  }
}

/**
 * Commits updated user balances/progression to Appwrite and local cache
 */
export async function saveAuthoritativeUser(
  userId: string,
  updates: Partial<UserStateCache>,
  jwt?: string
): Promise<UserStateCache> {
  const current = userCache.get(userId) || (await getAuthoritativeUser(userId, jwt));
  const now = Date.now();
  const updated: UserStateCache = {
    ...current,
    ...updates,
    updatedAt: now,
    dirty: true,
  };

  userCache.set(userId, updated);
  hydrateUserHintsFromHeaders(userId, {
    cash: updated.cash,
    gems: updated.gems,
    totalProfit: updated.totalProfit,
    tradesCount: updated.tradesCount,
    updatedAt: now,
    username: updated.username,
  });

  try {
    const databases = getDatabases(jwt);
    const targetDocId = updated.docId || userId;
    const payload: any = {};
    if (updates.cash !== undefined) payload.cash = Number(Number(updates.cash).toFixed(2));
    if (updates.gems !== undefined) payload.gems = Math.floor(Number(updates.gems));
    if (updates.username !== undefined) payload.username = String(updates.username).slice(0, 64);
    if (updates.handle !== undefined) payload.handle = String(updates.handle).slice(0, 64);
    if (updates.nameColor !== undefined) payload.nameColor = String(updates.nameColor).slice(0, 64);
    if (updates.title !== undefined) payload.title = String(updates.title).slice(0, 64);
    if (updates.prestigeLevel !== undefined) payload.prestigeLevel = Math.floor(Number(updates.prestigeLevel));
    if (updates.tradesCount !== undefined) payload.tradesCount = Math.floor(Number(updates.tradesCount));
    if (updates.coinsCreatedCount !== undefined) payload.coinsCreatedCount = Math.floor(Number(updates.coinsCreatedCount));
    if (updates.totalProfit !== undefined) payload.totalProfit = Number(Number(updates.totalProfit).toFixed(2));
    if (updates.lastDailyRewardClaim !== undefined) payload.lastDailyRewardClaim = String(updates.lastDailyRewardClaim).slice(0, 64);
    if (updates.dailyStreak !== undefined) payload.dailyStreak = Math.max(1, Math.floor(Number(updates.dailyStreak)));
    if (updates.isBanned !== undefined) payload.isBanned = Boolean(updates.isBanned);
    if (updates.isSuspended !== undefined) payload.isSuspended = Boolean(updates.isSuspended);
    if (updates.suspendedUntil !== undefined) payload.suspendedUntil = updates.suspendedUntil ? Math.floor(Number(updates.suspendedUntil)) : null;

    if (Object.keys(payload).length > 0) {
      try {
        await databases.updateDocument("pumpforge", "users", targetDocId, payload);
        updated.dirty = false;
      } catch (updateErr: any) {
        const msg = String(updateErr?.message || "").toLowerCase();
        if (updateErr?.code === 404 || updateErr?.status === 404 || msg.includes("not found") || msg.includes("could not be found")) {
          await databases.createDocument(
            "pumpforge",
            "users",
            targetDocId,
            {
              userId,
              playerId: updated.playerId || 1,
              username: String(updated.username || "Player").slice(0, 64),
              handle: String(updated.handle || "@player").slice(0, 64),
              cash: Number(Number(updated.cash ?? 5000).toFixed(2)),
              gems: Math.floor(Number(updated.gems ?? 90)),
              prestigeLevel: Math.floor(Number(updated.prestigeLevel ?? 0)),
              totalProfit: Number(Number(updated.totalProfit ?? 0).toFixed(2)),
              tradesCount: Math.floor(Number(updated.tradesCount ?? 0)),
              coinsCreatedCount: Math.floor(Number(updated.coinsCreatedCount ?? 0)),
              dailyStreak: Math.max(1, Math.floor(Number(updated.dailyStreak ?? 1))),
              lastDailyRewardClaim: String(updated.lastDailyRewardClaim || "").slice(0, 64),
              nameColor: String(updated.nameColor || "text-zinc-400 font-bold").slice(0, 64),
              title: String(updated.title || "Member").slice(0, 64),
            },
            [Permission.read(Role.any())]
          );
          updated.dirty = false;
        } else {
          // Failsafe: guarantee core cash & gems balance persistence even if an optional field failed
          await databases.updateDocument("pumpforge", "users", targetDocId, {
            cash: Number(Number(updated.cash ?? 5000).toFixed(2)),
            gems: Math.floor(Number(updated.gems ?? 90)),
          });
          updated.dirty = false;
        }
      }
    }
  } catch (err: any) {
    console.warn("Could not sync user to Appwrite directly (cached state preserved):", err?.message || err);
  }

  userCache.set(userId, updated);
  return updated;
}

/**
 * Retrieves public safe user profile information by PlayerId, Handle, or UserId.
 */
export async function getPublicUserProfile(identifier: string) {
  let targetUser: UserStateCache | null = null;
  const cleanId = identifier.trim();

  for (const u of userCache.values()) {
    if (
      String(u.playerId) === cleanId ||
      u.userId === cleanId ||
      u.handle?.toLowerCase() === cleanId.toLowerCase() ||
      u.handle?.toLowerCase() === `@${cleanId.toLowerCase()}`
    ) {
      targetUser = u;
      break;
    }
  }

  if (!targetUser) {
    try {
      const databases = getDatabases();
      const queries = [];
      if (!isNaN(Number(cleanId))) {
        queries.push(Query.equal("playerId", Number(cleanId)));
      } else if (cleanId.startsWith("@")) {
        queries.push(Query.equal("handle", cleanId));
      } else {
        queries.push(Query.equal("handle", `@${cleanId}`));
      }

      const res = await databases.listDocuments("pumpforge", "users", queries);
      if (res.documents.length > 0) {
        const doc = res.documents[0];
        targetUser = {
          userId: doc.userId || doc.$id,
          playerId: doc.playerId ? Number(doc.playerId) : 1,
          username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
          handle: doc.handle || `@user${doc.playerId || 1}`,
          cash: Number(doc.cash ?? 5000),
          gems: Number(doc.gems ?? 100),
          prestigeLevel: Number(doc.prestigeLevel ?? 0),
          tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
          coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
          totalProfit: Number(doc.totalProfit ?? 0),
          nameColor: doc.nameColor || doc.equippedColor || "text-zinc-400 font-extrabold",
          dailyStreak: Number(doc.dailyStreak ?? 1),
          predictionWins: Number(doc.predictionWins ?? 0),
          rugPullsCount: Number(doc.rugPullsCount ?? 0),
          createdAt: doc.$createdAt || new Date().toISOString(),
          updatedAt: Date.now(),
        };
      } else {
        try {
          const doc = await databases.getDocument("pumpforge", "users", cleanId);
          targetUser = {
            userId: doc.userId || doc.$id,
            playerId: doc.playerId ? Number(doc.playerId) : 1,
            username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
            handle: doc.handle || `@user${doc.playerId || 1}`,
            cash: Number(doc.cash ?? 5000),
            gems: Number(doc.gems ?? 100),
            prestigeLevel: Number(doc.prestigeLevel ?? 0),
            tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
            coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
            totalProfit: Number(doc.totalProfit ?? 0),
            nameColor: doc.nameColor || doc.equippedColor || "text-zinc-400 font-extrabold",
            dailyStreak: Number(doc.dailyStreak ?? 1),
            predictionWins: Number(doc.predictionWins ?? 0),
            rugPullsCount: Number(doc.rugPullsCount ?? 0),
            createdAt: doc.$createdAt || new Date().toISOString(),
            updatedAt: Date.now(),
          };
        } catch (_) {}
      }
    } catch (_) {}
  }

  if (!targetUser) {
    return null;
  }

  const allCoins = coinStore.getAllCoins();
  const createdCoins = allCoins.filter(
    (c) => (c as any).creatorId === targetUser!.userId || c.creator?.toLowerCase() === targetUser!.handle?.toLowerCase()
  );

  const badges = computeUserBadges(targetUser);

  let recentTrades: any[] = [];
  try {
    const trades = await getTradesList({ limit: 25 });
    recentTrades = trades
      .filter((t) => t.userId === targetUser!.userId)
      .slice(0, 10)
      .map((t) => ({
        id: t.id || t.$id,
        coinId: t.coinId,
        coinSymbol: t.coinSymbol,
        coinName: t.coinName,
        type: t.type,
        amount: t.amountCoins || t.amount,
        price: t.pricePerCoin || t.price,
        total: t.totalCash || t.total,
        timestamp: t.timestamp,
      }));
  } catch (_) {}

  return {
    playerId: targetUser.playerId || 1,
    username: targetUser.username,
    handle: targetUser.handle,
    createdAt: targetUser.createdAt,
    nameColor: targetUser.nameColor,
    tradingStats: {
      tradesCount: targetUser.tradesCount,
      totalProfit: targetUser.totalProfit,
      prestigeLevel: targetUser.prestigeLevel,
      coinsCreatedCount: targetUser.coinsCreatedCount,
    },
    badges,
    createdCoins: createdCoins.map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      price: c.price,
      marketCap: c.marketCap,
      avatarEmoji: c.avatarEmoji,
    })),
    recentTrades,
  };
}

// Global Admin Settings state (Rig mode, Casino state)
export interface GlobalAdminSettings {
  arcadeRigMode: "fair" | "win" | "lose";
  isCasinoRigged: boolean;
}

export const globalAdminSettings: GlobalAdminSettings = {
  arcadeRigMode: "fair",
  isCasinoRigged: false,
};

export async function syncAdminSettingsWithDatabase() {
  const apiKey = (process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "").trim();
  if (!apiKey) return;
  try {
    const databases = getDatabases();
    try {
      const doc = await databases.getDocument("pumpforge", "admin_settings", "global");
      if (doc) {
        if (doc.arcadeRigMode) globalAdminSettings.arcadeRigMode = doc.arcadeRigMode;
        if (doc.isCasinoRigged !== undefined) globalAdminSettings.isCasinoRigged = !!doc.isCasinoRigged;
      }
    } catch (err: any) {
      if (err?.code === 404 || err?.status === 404) {
        await databases.createDocument(
          "pumpforge",
          "admin_settings",
          "global",
          {
            arcadeRigMode: "fair",
            isCasinoRigged: false,
            rainbowCosmetics: false,
            customAdminBadge: "Operator",
          },
          [Permission.read(Role.any())]
        );
      }
    }
  } catch (e) {
    console.warn("Server admin_settings sync notice:", e);
  }
}

export async function getAllUsersList(jwt?: string): Promise<UserStateCache[]> {
  const usersMap = new Map<string, UserStateCache>();
  for (const [id, user] of userCache.entries()) {
    usersMap.set(id, user);
  }

  try {
    const databases = getDatabases(jwt);
    const docs = await databases.listDocuments("pumpforge", "users", [Query.limit(100)]);
    for (const doc of docs.documents) {
      const uid = doc.userId || doc.$id;
      const existing = usersMap.get(uid);
      if (existing && existing.dirty) continue;
      usersMap.set(uid, {
        userId: uid,
        docId: doc.$id,
        playerId: doc.playerId,
        username: doc.username || doc.name || `Player_${doc.playerId || ""}`,
        handle: doc.handle || `@user${doc.playerId || ""}`,
        title: doc.title || "Member",
        isPremium: !!doc.isPremium,
        cash: Number(doc.cash ?? 5000),
        gems: Number(doc.gems ?? 90),
        prestigeLevel: Number(doc.prestigeLevel ?? 0),
        tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
        coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
        totalProfit: Number(doc.totalProfit ?? 0),
        nameColor: doc.nameColor || doc.equippedColor || "text-zinc-400 font-bold",
        dailyStreak: Number(doc.dailyStreak ?? 1),
        lastDailyRewardClaim: doc.lastDailyRewardClaim || "",
        predictionWins: Number(doc.predictionWins ?? 0),
        rugPullsCount: Number(doc.rugPullsCount ?? 0),
        createdAt: doc.$createdAt || new Date().toISOString(),
        updatedAt: Date.now(),
      });
    }
  } catch (e) {
    // Non-fatal
  }

  return Array.from(usersMap.values());
}

export const inMemoryBroadcasts: any[] = [];

export async function getBroadcastsList(jwt?: string): Promise<any[]> {
  const list: any[] = [...inMemoryBroadcasts];
  try {
    const databases = getDatabases(jwt);
    const res = await databases.listDocuments("pumpforge", "broadcasts", [
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);
    for (const doc of res.documents) {
      if (!list.some((b) => (b.id && b.id === doc.$id) || (b.$id && b.$id === doc.$id))) {
        list.push(doc);
      }
    }
  } catch (e) {
    // Non-fatal
  }
  return list;
}

// Default Seed Polymarkets so m1, m2, m3 exist authoritatively
const DEFAULT_SEED_POLYMARKETS = [
  {
    $id: "m1",
    id: "m1",
    question: "Will *ROAD hit a $150K valuation by Friday? --- Based on shill room hype, ROAD represents the premium culture asset.",
    creatorId: "admin_realzekeee",
    creator: "@zeke",
    endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: "active",
    poolYes: 4500,
    poolNo: 3200,
    resolved: false,
    winningOutcome: null,
    resolvedAt: null,
  },
  {
    $id: "m2",
    id: "m2",
    question: "Will the Slots return a grand Jackpot win on next 10 attempts? --- Probabilities dictate slot engines have a high variance output.",
    creatorId: "admin_realzekeee",
    creator: "@zeke",
    endDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    status: "active",
    poolYes: 150,
    poolNo: 6400,
    resolved: false,
    winningOutcome: null,
    resolvedAt: null,
  },
  {
    $id: "m3",
    id: "m3",
    question: "Will Zeke reach Prestige I status inside the next 12 hours? --- Requires $100K liquid cash balance to trigger Prestige system.",
    creatorId: "admin_realzekeee",
    creator: "@zeke",
    endDate: new Date(Date.now() - 86400000).toISOString(),
    status: "closed",
    poolYes: 8500,
    poolNo: 1000,
    resolved: true,
    winningOutcome: "YES",
    resolvedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function normalizePolymarketDoc(doc: any): any {
  const id = doc.$id || doc.id || `m_${Date.now()}`;
  const rawQuestion = String(doc.question || "Untitled Prediction");
  const parts = rawQuestion.split(" --- ");
  const cleanQuestion = parts[0] || rawQuestion;
  const description = doc.description || parts[1] || "";
  const poolYes = Number(doc.poolYes ?? doc.yesPool ?? 0);
  const poolNo = Number(doc.poolNo ?? doc.noPool ?? 0);
  const total = poolYes + poolNo;
  const yesPercentage = total > 0 ? Math.round((poolYes / total) * 100) : 50;
  const endDate = doc.endDate || doc.endDateIso || doc.endTime || new Date(Date.now() + 7 * 86400000).toISOString();
  const resolved = Boolean(doc.resolved || doc.status === "closed");
  const status = resolved ? "closed" : (doc.status || "active");
  const winningOutcome = doc.winningOutcome || doc.resolvedOutcome || null;
  const resolvedAt = doc.resolvedAt || (resolved ? doc.$updatedAt || new Date().toISOString() : null);

  return {
    ...doc,
    $id: id,
    id,
    question: rawQuestion,
    title: cleanQuestion,
    description,
    poolYes,
    poolNo,
    yesPool: poolYes,
    noPool: poolNo,
    yesPercentage,
    endDate,
    endDateIso: endDate,
    endTime: endDate,
    status,
    resolved,
    winningOutcome,
    resolvedOutcome: winningOutcome,
    resolvedAt,
  };
}

// In-Memory Authoritative Polymarkets Store
export const inMemoryPolymarkets: any[] = DEFAULT_SEED_POLYMARKETS.map(normalizePolymarketDoc);
let polymarketsSeeded = false;

export function recordPolymarket(market: any) {
  const norm = normalizePolymarketDoc(market);
  const existingIdx = inMemoryPolymarkets.findIndex((m) => (m.id || m.$id) === (norm.id || norm.$id));
  if (existingIdx >= 0) {
    inMemoryPolymarkets[existingIdx] = { ...inMemoryPolymarkets[existingIdx], ...norm, updatedAt: Date.now() };
  } else {
    inMemoryPolymarkets.unshift({ ...norm, updatedAt: Date.now() });
  }
}

export async function persistPolymarketToDatabase(market: any, jwt?: string) {
  const norm = normalizePolymarketDoc(market);
  recordPolymarket(norm);
  try {
    const databases = getDatabases(jwt);
    const combinedQuestion = (norm.description && !String(norm.question).includes(" --- ")
      ? `${norm.question} --- ${norm.description}`
      : String(norm.question)
    ).slice(0, 500);
    const payload: Record<string, any> = {
      question: combinedQuestion,
      creatorId: String(norm.creatorId || "admin_realzekeee").slice(0, 64),
      creator: String(norm.creator || "@zeke").slice(0, 64),
      endDate: String(norm.endDate).slice(0, 64),
      status: norm.status || "active",
      poolYes: Number(norm.poolYes || 0),
      poolNo: Number(norm.poolNo || 0),
      resolved: Boolean(norm.resolved),
    };
    if (norm.winningOutcome) payload.winningOutcome = String(norm.winningOutcome).slice(0, 16);
    if (norm.resolvedAt) payload.resolvedAt = String(norm.resolvedAt).slice(0, 64);

    try {
      await databases.updateDocument("pumpforge", "polymarkets", norm.id, payload);
    } catch (upErr: any) {
      const msg = String(upErr?.message || "").toLowerCase();
      if (upErr?.code === 404 || upErr?.status === 404 || msg.includes("not found")) {
        await databases.createDocument(
          "pumpforge",
          "polymarkets",
          norm.id,
          payload,
          [Permission.read(Role.any())]
        );
      }
    }
  } catch (e) {
    // Non-fatal: inMemoryPolymarkets retains authoritative state
  }
}

export async function getPolymarketsList(jwt?: string): Promise<any[]> {
  const map = new Map<string, any>();
  for (const m of inMemoryPolymarkets) {
    const norm = normalizePolymarketDoc(m);
    map.set(norm.id, norm);
  }

  try {
    const databases = getDatabases(jwt);
    const res = await databases.listDocuments("pumpforge", "polymarkets", [
      Query.limit(100),
      Query.orderDesc("$createdAt"),
    ]);
    const foundIds = new Set<string>();
    for (const doc of res.documents) {
      const norm = normalizePolymarketDoc(doc);
      foundIds.add(norm.id);
      const local = map.get(norm.id);
      // If local in-memory state has a higher total pool (e.g. from a recent bet on this instance), keep higher pool
      if (local && (local.poolYes + local.poolNo > norm.poolYes + norm.poolNo || (local.resolved && !norm.resolved))) {
        map.set(norm.id, local);
      } else {
        map.set(norm.id, norm);
        recordPolymarket(norm);
      }
    }

    if (!polymarketsSeeded) {
      polymarketsSeeded = true;
      for (const seed of DEFAULT_SEED_POLYMARKETS) {
        if (!foundIds.has(seed.id)) {
          persistPolymarketToDatabase(seed, jwt).catch(() => {});
        }
      }
    }
  } catch (e) {
    // Non-fatal
  }

  return Array.from(map.values());
}

// In-Memory Authoritative Trades Store
export const inMemoryTrades: any[] = [];

export function normalizeTradeDoc(doc: any): any {
  const coinObj = coinStore.getCoin(doc.coinId || doc.coinSymbol || doc.coinTicker);
  const amountCoins = Number(doc.amountCoins ?? doc.amountTokens ?? doc.amount ?? 0);
  const pricePerCoin = Number(doc.pricePerCoin ?? doc.price ?? coinObj?.price ?? 0);
  const totalCash = Number(
    doc.totalCash ??
      doc.amountUsd ??
      doc.total ??
      (doc.amount !== undefined && doc.amountCoins === undefined ? doc.amount : amountCoins * pricePerCoin) ??
      0
  );
  const coinSymbol = doc.coinSymbol || doc.coinTicker || coinObj?.symbol || "COIN";
  const coinId = coinObj?.id || doc.coinId || coinSymbol.toLowerCase();
  const coinName = doc.coinName || coinObj?.name || coinSymbol;
  const cachedUser = doc.userId ? userCache.get(doc.userId) : undefined;
  const isOwner = doc.userId === "admin_realzekeee";
  const userName =
    doc.userName ||
    cachedUser?.username ||
    (isOwner ? "Zeke (Owner)" : doc.userHandle || (doc.userId ? `Trader_${String(doc.userId).slice(0, 6)}` : "Trader"));
  const userHandle =
    doc.userHandle ||
    cachedUser?.handle ||
    (isOwner ? "@zeke" : `@${String(doc.userId || "trader").replace(/^@/, "").slice(0, 10)}`);
  const ts = doc.timestamp || doc.$createdAt || new Date().toISOString();
  const id = doc.$id || doc.id || `trade_${Date.now()}`;

  return {
    ...doc,
    $id: id,
    id,
    userId: doc.userId || "trader",
    userName,
    userHandle,
    coinId,
    coinSymbol,
    coinTicker: coinSymbol,
    coinName,
    type: doc.type || "BUY",
    amountCoins,
    amountTokens: amountCoins,
    pricePerCoin,
    price: pricePerCoin,
    totalCash,
    total: totalCash,
    amountUsd: totalCash,
    amount: totalCash,
    fee: Number(doc.fee ?? 0),
    timestamp: ts,
    $createdAt: doc.$createdAt || ts,
  };
}

export function recordTradeLog(trade: any) {
  const normalized = normalizeTradeDoc(trade);
  const existingIdx = inMemoryTrades.findIndex((t) => (t.id || t.$id) === (normalized.id || normalized.$id));
  if (existingIdx >= 0) {
    inMemoryTrades[existingIdx] = normalized;
  } else {
    inMemoryTrades.unshift(normalized);
  }
  if (inMemoryTrades.length > 500) {
    inMemoryTrades.pop();
  }
}

export async function getTradesList(options: { coinId?: string; limit?: number; jwt?: string } = {}): Promise<any[]> {
  const limit = options.limit || 50;
  const map = new Map<string, any>();

  for (const t of inMemoryTrades) {
    const norm = normalizeTradeDoc(t);
    map.set(norm.id, norm);
  }

  try {
    const databases = getDatabases(options.jwt);
    const queries: any[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(Math.max(limit, 50)),
    ];
    if (options.coinId) {
      const targetCoin = coinStore.getCoin(options.coinId);
      queries.push(Query.equal("coinId", targetCoin ? targetCoin.id : options.coinId));
    }
    const res = await databases.listDocuments("pumpforge", "trades", queries);
    for (const doc of res.documents) {
      const norm = normalizeTradeDoc(doc);
      map.set(norm.id, norm);
    }
  } catch (e) {
    // Non-fatal, use cached trades
  }

  let list = Array.from(map.values());
  if (options.coinId) {
    const targetCoin = coinStore.getCoin(options.coinId);
    const targetIdLower = String(targetCoin?.id || options.coinId).toLowerCase();
    const targetSymLower = String(targetCoin?.symbol || options.coinId).toLowerCase();
    list = list.filter(
      (t) =>
        String(t.coinId || "").toLowerCase() === targetIdLower ||
        String(t.coinSymbol || "").toLowerCase() === targetSymLower
    );
  }

  list.sort((a, b) => new Date(b.timestamp || b.$createdAt || 0).getTime() - new Date(a.timestamp || a.$createdAt || 0).getTime());
  return list.slice(0, limit);
}

// In-Memory Authoritative Wagers Store
export const inMemoryWagers: any[] = [];

export function recordWagerLog(wager: any) {
  const existingIdx = inMemoryWagers.findIndex((w) => (w.id || w.$id) === (wager.id || wager.$id));
  if (existingIdx >= 0) {
    inMemoryWagers[existingIdx] = wager;
  } else {
    inMemoryWagers.unshift(wager);
  }
  if (inMemoryWagers.length > 500) {
    inMemoryWagers.pop();
  }
}

// In-Memory Authoritative Holdings Store
export const inMemoryHoldings: any[] = [];

export function recordHoldingLog(holding: any) {
  const amt = Number(holding.amount ?? holding.tokenAmount ?? 0);
  const idx = inMemoryHoldings.findIndex(
    (h) =>
      h.userId === holding.userId &&
      (h.coinId === holding.coinId ||
        (h.coinSymbol && holding.coinSymbol && h.coinSymbol.toLowerCase() === holding.coinSymbol.toLowerCase()))
  );
  if (amt <= 0.00001) {
    if (idx >= 0) {
      inMemoryHoldings.splice(idx, 1);
    }
    return;
  }
  if (idx >= 0) {
    inMemoryHoldings[idx] = { ...inMemoryHoldings[idx], ...holding, amount: amt };
  } else {
    inMemoryHoldings.push({ ...holding, amount: amt });
  }
}

export async function getHoldingsList(options: { userId?: string; coinId?: string; jwt?: string } = {}): Promise<any[]> {
  const mergedMap = new Map<string, any>();

  for (const h of inMemoryHoldings) {
    if (Number(h.amount ?? h.tokenAmount ?? 0) > 0.00001) {
      const key = `${h.userId}_${h.coinId}`;
      mergedMap.set(key, h);
    }
  }

  try {
    const databases = getDatabases(options.jwt);
    const queries: any[] = [Query.limit(100)];
    if (options.userId) queries.push(Query.equal("userId", options.userId));
    if (options.coinId) queries.push(Query.equal("coinId", options.coinId));
    const res = await databases.listDocuments("pumpforge", "holdings", queries);

    for (const doc of res.documents) {
      const amt = Number(doc.amount ?? doc.tokenAmount ?? 0);
      const coinObj = coinStore.getCoin(doc.coinId || doc.coinSymbol);
      const canonicalCoinId = coinObj ? coinObj.id : doc.coinId;
      const key = `${doc.userId}_${canonicalCoinId}`;
      if (amt <= 0.00001) {
        mergedMap.delete(key);
      } else {
        const normalizedHolding = {
          ...doc,
          coinId: canonicalCoinId,
          coinSymbol: doc.coinSymbol || coinObj?.symbol || "COIN",
          amount: amt,
          avgBuyPrice: Number(doc.avgBuyPrice ?? doc.avgPrice ?? coinObj?.price ?? 0),
        };
        mergedMap.set(key, normalizedHolding);
        recordHoldingLog(normalizedHolding);
      }
    }
  } catch (e) {
    // Non-fatal, use cached holdings
  }

  let filtered = Array.from(mergedMap.values()).filter((h) => Number(h.amount ?? h.tokenAmount ?? 0) > 0.00001);
  if (options.userId) filtered = filtered.filter((h) => h.userId === options.userId);
  if (options.coinId) {
    const targetCoin = coinStore.getCoin(options.coinId);
    const targetId = targetCoin ? targetCoin.id : options.coinId;
    filtered = filtered.filter(
      (h) =>
        h.coinId === targetId ||
        h.coinId === options.coinId ||
        (targetCoin && String(h.coinSymbol || "").toLowerCase() === targetCoin.symbol.toLowerCase())
    );
  }
  return filtered;
}

// In-Memory Authoritative Notifications Store
export const inMemoryNotifications: any[] = [];

export function recordNotification(notif: any) {
  inMemoryNotifications.unshift(notif);
  if (inMemoryNotifications.length > 200) {
    inMemoryNotifications.pop();
  }
}

export async function getNotificationsList(userId?: string, jwt?: string): Promise<any[]> {
  const list: any[] = userId
    ? inMemoryNotifications.filter((n) => n.userId === userId || n.userId === "all")
    : [...inMemoryNotifications];
  if (userId) {
    try {
      const databases = getDatabases(jwt);
      const res = await databases.listDocuments("pumpforge", "notifications", [
        Query.equal("userId", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]);
      for (const doc of res.documents) {
        if (!list.some((n) => (n.id || n.$id) === doc.$id)) {
          list.push(doc);
        }
      }
    } catch (e) {
      // Non-fatal
    }
  }
  return list;
}
