import { Client, Databases, Query, ID, Permission, Role } from "node-appwrite";
import { INITIAL_COINS } from "../data/memeCoins";
import { MemeCoin } from "../types";

const APPWRITE_ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

/**
 * Creates an Appwrite Client configured for server operations.
 */
export function createServerAppwriteClient(jwt?: string) {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);

  if (APPWRITE_API_KEY) {
    client.setKey(APPWRITE_API_KEY);
  } else if (jwt && typeof jwt === "string" && jwt.split(".").length === 3) {
    // Only pass real 3-part JWTs to Appwrite client
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

  public async syncWithDatabase(jwt?: string) {
    try {
      const databases = getDatabases(jwt);
      const res = await databases.listDocuments("pumpforge", "coins", [Query.limit(100)]);

      for (const doc of res.documents) {
        if (this.deletedCoinIds.has(doc.$id) || this.deletedCoinIds.has((doc as any).coinId)) {
          continue;
        }

        const coinId = doc.$id;
        const existing = this.coins.get(coinId);

        const merged: MemeCoin = {
          id: coinId,
          name: doc.name || existing?.name || "Unknown Token",
          symbol: doc.symbol || existing?.symbol || "COIN",
          creator: doc.creator || existing?.creator || "@system",
          description: doc.description || existing?.description || "",
          price: Number(doc.price ?? existing?.price ?? 0.01),
          marketCap: Math.floor(Number(doc.marketCap ?? existing?.marketCap ?? 1000)),
          totalLiquidity: Number(doc.totalLiquidity ?? (doc as any).total_value ?? existing?.totalLiquidity ?? 1000),
          volume24h: Number(doc.volume24h ?? existing?.volume24h ?? 0),
          change24h: Number(doc.change24h ?? existing?.change24h ?? 0),
          history: Array.isArray(doc.history) && doc.history.length > 0 ? doc.history : existing?.history || [doc.price || 0.01],
          avatarEmoji: doc.avatarEmoji || existing?.avatarEmoji || "🪙",
          avatarBg: doc.avatarBg || existing?.avatarBg || "bg-zinc-900 border-zinc-800",
          supply: Number(doc.supply ?? existing?.supply ?? 1000000),
          createdAt: doc.$createdAt,
        };

        this.coins.set(coinId, merged);
      }
      this.isInitialized = true;
    } catch (e) {
      // If DB list fails, defaults remain intact
      if (!this.isInitialized) {
        this.initDefaultCoins();
        this.isInitialized = true;
      }
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
}

const userCache = new Map<string, UserStateCache>();

// Sequential Player ID Counter management (atomic lock protected)
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
    // If column doesn't exist yet or query fails, count total docs
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
 * Fetches authoritative user state from Appwrite or cache
 */
export async function getAuthoritativeUser(userId: string, jwt?: string, defaultName?: string): Promise<UserStateCache> {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.updatedAt < 5000) {
    return cached;
  }

  try {
    const databases = getDatabases(jwt);
    await initPlayerIdCounter(databases);
    const doc = await databases.getDocument("pumpforge", "users", userId);

    let assignedPlayerId = doc.playerId ? Number(doc.playerId) : undefined;
    if (!assignedPlayerId) {
      assignedPlayerId = nextPlayerId++;
      try {
        await databases.updateDocument("pumpforge", "users", userId, {
          playerId: assignedPlayerId,
        });
      } catch (_) {}
    }

    const state: UserStateCache = {
      userId,
      playerId: assignedPlayerId,
      username: doc.username || doc.name || defaultName || `Player_${assignedPlayerId}`,
      handle: doc.handle || `@user${assignedPlayerId}`,
      title: doc.title || "Member",
      isPremium: !!doc.isPremium,
      cash: Number(doc.cash ?? 5000.0),
      gems: Number(doc.gems ?? 90),
      prestigeLevel: Number(doc.prestigeLevel ?? 0),
      tradesCount: Number(doc.tradesCount ?? 0),
      coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
      totalProfit: Number(doc.totalProfit ?? 0),
      nameColor: doc.nameColor || "text-zinc-400 font-extrabold",
      dailyStreak: Number(doc.dailyStreak ?? 1),
      lastDailyRewardClaim: doc.lastDailyRewardClaim || "",
      predictionWins: Number(doc.predictionWins ?? 0),
      rugPullsCount: Number(doc.rugPullsCount ?? 0),
      isBanned: doc.isBanned || false,
      isSuspended: doc.isSuspended || false,
      suspendedUntil: doc.suspendedUntil || null,
      createdAt: doc.$createdAt || new Date().toISOString(),
      updatedAt: Date.now(),
    };

    userCache.set(userId, state);
    return state;
  } catch (err) {
    // If not found in Appwrite, provide clean initial state and persist via server key
    if (cached) return cached;

    const assignedPlayerId = nextPlayerId++;
    const fallbackUsername = defaultName || `Player_${assignedPlayerId}`;
    const fallbackHandle = `@${fallbackUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}` || `@user${assignedPlayerId}`;
    const initial: UserStateCache = {
      userId,
      playerId: assignedPlayerId,
      username: fallbackUsername,
      handle: fallbackHandle,
      title: "Member",
      isPremium: false,
      cash: 5000.0,
      gems: 90,
      prestigeLevel: 0,
      tradesCount: 0,
      coinsCreatedCount: 0,
      totalProfit: 0,
      nameColor: "text-zinc-400 font-bold",
      dailyStreak: 1,
      lastDailyRewardClaim: "",
      predictionWins: 0,
      rugPullsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    };
    userCache.set(userId, initial);

    // Bootstrap in Appwrite via server key
    try {
      const serverDatabases = getDatabases();
      await serverDatabases.createDocument(
        "pumpforge",
        "users",
        userId,
        {
          userId,
          playerId: assignedPlayerId,
          username: initial.username,
          handle: initial.handle,
          cash: initial.cash,
          gems: initial.gems,
          prestigeLevel: initial.prestigeLevel,
          totalProfit: initial.totalProfit,
          tradesCount: 0,
          coinsCreatedCount: 0,
          nameColor: initial.nameColor,
          dailyStreak: 1,
          lastDailyRewardClaim: "",
        },
        [Permission.read(Role.any())]
      );
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
  const current = await getAuthoritativeUser(userId, jwt);
  const updated: UserStateCache = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };

  userCache.set(userId, updated);

  try {
    const databases = getDatabases(jwt);
    const payload: any = {};
    if (updates.cash !== undefined) payload.cash = Number(updates.cash.toFixed(2));
    if (updates.gems !== undefined) payload.gems = Math.floor(updates.gems);
    if (updates.playerId !== undefined) payload.playerId = updates.playerId;
    if (updates.username !== undefined) payload.username = updates.username;
    if (updates.handle !== undefined) payload.handle = updates.handle;
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.nameColor !== undefined) payload.nameColor = updates.nameColor;
    if (updates.isPremium !== undefined) payload.isPremium = updates.isPremium;
    if (updates.prestigeLevel !== undefined) payload.prestigeLevel = updates.prestigeLevel;
    if (updates.tradesCount !== undefined) payload.tradesCount = updates.tradesCount;
    if (updates.coinsCreatedCount !== undefined) payload.coinsCreatedCount = updates.coinsCreatedCount;
    if (updates.totalProfit !== undefined) payload.totalProfit = Number(updates.totalProfit.toFixed(2));
    if (updates.dailyStreak !== undefined) payload.dailyStreak = updates.dailyStreak;
    if (updates.lastDailyRewardClaim !== undefined) payload.lastDailyRewardClaim = updates.lastDailyRewardClaim;
    if (updates.predictionWins !== undefined) payload.predictionWins = updates.predictionWins;
    if (updates.rugPullsCount !== undefined) payload.rugPullsCount = updates.rugPullsCount;
    if (updates.isBanned !== undefined) payload.isBanned = updates.isBanned;
    if (updates.isSuspended !== undefined) payload.isSuspended = updates.isSuspended;
    if (updates.suspendedUntil !== undefined) payload.suspendedUntil = updates.suspendedUntil;

    await databases.updateDocument("pumpforge", "users", userId, payload);
  } catch (err) {
    console.warn("Could not sync user to Appwrite directly (cached state preserved):", err);
  }

  return updated;
}

/**
 * Retrieves public safe user profile information by PlayerId, Handle, or UserId.
 * Guaranteed to NEVER expose emails, passwords, tokens, or private sensitive fields.
 */
export async function getPublicUserProfile(identifier: string) {
  let targetUser: UserStateCache | null = null;
  const cleanId = identifier.trim();

  // 1. Check in-memory cache
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

  // 2. Query Appwrite if not cached
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
          userId: doc.$id,
          playerId: doc.playerId ? Number(doc.playerId) : 1,
          username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
          handle: doc.handle || `@user${doc.playerId || 1}`,
          cash: Number(doc.cash ?? 5000),
          gems: Number(doc.gems ?? 100),
          prestigeLevel: Number(doc.prestigeLevel ?? 0),
          tradesCount: Number(doc.tradesCount ?? 0),
          coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
          totalProfit: Number(doc.totalProfit ?? 0),
          nameColor: doc.nameColor || "text-zinc-400 font-extrabold",
          dailyStreak: Number(doc.dailyStreak ?? 1),
          predictionWins: Number(doc.predictionWins ?? 0),
          rugPullsCount: Number(doc.rugPullsCount ?? 0),
          createdAt: doc.$createdAt || new Date().toISOString(),
          updatedAt: Date.now(),
        };
      } else {
        // Try get by doc ID
        try {
          const doc = await databases.getDocument("pumpforge", "users", cleanId);
          targetUser = {
            userId: doc.$id,
            playerId: doc.playerId ? Number(doc.playerId) : 1,
            username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
            handle: doc.handle || `@user${doc.playerId || 1}`,
            cash: Number(doc.cash ?? 5000),
            gems: Number(doc.gems ?? 100),
            prestigeLevel: Number(doc.prestigeLevel ?? 0),
            tradesCount: Number(doc.tradesCount ?? 0),
            coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
            totalProfit: Number(doc.totalProfit ?? 0),
            nameColor: doc.nameColor || "text-zinc-400 font-extrabold",
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

  // Fetch coins created by this user
  const allCoins = coinStore.getAllCoins();
  const createdCoins = allCoins.filter(
    (c) => (c as any).creatorId === targetUser!.userId || c.creator?.toLowerCase() === targetUser!.handle?.toLowerCase()
  );

  const badges = computeUserBadges(targetUser);

  // Fetch recent public trades for this user
  let recentTrades: any[] = [];
  try {
    const databases = getDatabases();
    const tradeRes = await databases.listDocuments("pumpforge", "trades", [
      Query.equal("userId", targetUser.userId),
      Query.orderDesc("timestamp"),
      Query.limit(10),
    ]);
    recentTrades = tradeRes.documents.map((t) => ({
      id: t.$id,
      coinId: t.coinId,
      coinSymbol: t.coinSymbol,
      coinName: t.coinName,
      type: t.type,
      amount: t.amount,
      price: t.price,
      total: t.total,
      timestamp: t.timestamp,
    }));
  } catch (_) {}

  // Return strictly public profile payload - NO passwords, NO tokens, NO emails
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
  if (!APPWRITE_API_KEY) return;
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
        console.log("Creating default global admin_settings via server key...");
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
      if (!usersMap.has(uid)) {
        usersMap.set(uid, {
          userId: uid,
          playerId: doc.playerId,
          username: doc.username || doc.name || `Player_${doc.playerId || ""}`,
          handle: doc.handle || `@user${doc.playerId || ""}`,
          title: doc.title || "Member",
          isPremium: !!doc.isPremium,
          cash: Number(doc.cash ?? 5000),
          gems: Number(doc.gems ?? 90),
          prestigeLevel: Number(doc.prestigeLevel ?? 0),
          tradesCount: Number(doc.tradesCount ?? 0),
          coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
          totalProfit: Number(doc.totalProfit ?? 0),
          nameColor: doc.nameColor || "text-zinc-400 font-bold",
          dailyStreak: Number(doc.dailyStreak ?? 1),
          lastDailyRewardClaim: doc.lastDailyRewardClaim || "",
          predictionWins: Number(doc.predictionWins ?? 0),
          rugPullsCount: Number(doc.rugPullsCount ?? 0),
          createdAt: doc.$createdAt || new Date().toISOString(),
          updatedAt: Date.now(),
        });
      }
    }
  } catch (e) {
    // Non-fatal if Appwrite users collection cannot be listed directly
  }

  return Array.from(usersMap.values());
}

export const inMemoryBroadcasts: any[] = [];

export async function getBroadcastsList(jwt?: string): Promise<any[]> {
  const list: any[] = [...inMemoryBroadcasts];
  try {
    const databases = getDatabases(jwt);
    const res = await databases.listDocuments("pumpforge", "broadcasts", [
      Query.orderDesc("timestamp"),
      Query.limit(50),
    ]);
    for (const doc of res.documents) {
      if (!list.some(b => (b.id && b.id === doc.$id) || (b.$id && b.$id === doc.$id))) {
        list.push(doc);
      }
    }
  } catch (e) {
    // Non-fatal if Appwrite broadcasts collection cannot be listed directly
  }
  return list;
}

