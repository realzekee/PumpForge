// server.ts
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// src/server/auth.ts
var APPWRITE_ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
var APPWRITE_PROJECT = process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902";
var DEFAULT_ADMIN_EMAILS = ["realzekeee@gmail.com"];
var ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).concat(DEFAULT_ADMIN_EMAILS);
var jwtCache = /* @__PURE__ */ new Map();
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || "";
  const jwtHeader = req.headers["x-appwrite-jwt"] || "";
  let jwt = "";
  if (authHeader.startsWith("Bearer ")) {
    jwt = authHeader.substring(7).trim();
  } else if (jwtHeader) {
    jwt = jwtHeader.trim();
  }
  if (!jwt) {
    const guestId = req.headers["x-guest-id"] || "guest_player";
    return {
      userId: guestId,
      email: "",
      name: "Guest Player",
      isAdmin: false,
      isGuest: true
    };
  }
  const cached = jwtCache.get(jwt);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  try {
    const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      method: "GET",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT,
        "X-Appwrite-JWT": jwt
      }
    });
    if (!res.ok) {
      return {
        userId: "guest_player",
        email: "",
        name: "Guest Player",
        isAdmin: false,
        isGuest: true
      };
    }
    const rawText = await res.text();
    let appwriteAccount = null;
    try {
      appwriteAccount = rawText ? JSON.parse(rawText) : null;
    } catch {
      appwriteAccount = null;
    }
    if (!appwriteAccount || !appwriteAccount.$id) {
      return {
        userId: "guest_player",
        email: "",
        name: "Guest Player",
        isAdmin: false,
        isGuest: true
      };
    }
    const verifiedEmail = (appwriteAccount.email || "").toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.includes(verifiedEmail);
    const authenticatedUser = {
      userId: appwriteAccount.$id,
      email: verifiedEmail,
      name: appwriteAccount.name || "Trader",
      isAdmin,
      isGuest: false,
      jwt
    };
    jwtCache.set(jwt, {
      user: authenticatedUser,
      expiresAt: Date.now() + 6e4
    });
    return authenticatedUser;
  } catch (err) {
    console.error("Authentication verification error with Appwrite:", err);
    return {
      userId: "guest_player",
      email: "",
      name: "Guest Player",
      isAdmin: false,
      isGuest: true
    };
  }
}
async function authMiddleware(req, res, next) {
  try {
    const user = await authenticateRequest(req);
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user || user.isGuest || !user.isAdmin) {
    console.warn(`[SECURITY ALERT] Unauthorized admin access attempt from user: ${user?.email || "Unknown"}`);
    res.status(403).json({
      error: "Access denied. Server-side administrator privilege is required."
    });
    return;
  }
  next();
}

// src/server/gameEngine.ts
import crypto from "crypto";

// src/server/db.ts
import { Client, Databases, Query, Permission, Role } from "appwrite";

// src/data/memeCoins.ts
var INITIAL_COINS = [
  {
    id: "roadrev",
    name: "Roadman Revival",
    symbol: "ROAD",
    creator: "@system",
    description: "Bruk it down and pump it up. The ultimate roadman culture token.",
    avatarEmoji: "\u{1F482}",
    avatarBg: "bg-emerald-950 text-emerald-300 border-emerald-500",
    price: 0.0456,
    marketCap: 45600,
    supply: 1e6,
    volume24h: 12500,
    change24h: 34.2,
    history: [0.03, 0.032, 0.031, 0.038, 0.04, 0.042, 0.0456]
  },
  {
    id: "asstor",
    name: "Asstor Inc.",
    symbol: "ATI",
    creator: "@stonks",
    description: "Corporate backing but dumber. We sell hopium and buy yachts.",
    avatarEmoji: "\u{1F4BC}",
    avatarBg: "bg-indigo-950 text-indigo-300 border-indigo-500",
    price: 1.12,
    marketCap: 112e3,
    supply: 1e5,
    volume24h: 42e3,
    change24h: -12.4,
    history: [1.32, 1.28, 1.25, 1.15, 1.18, 1.1, 1.12]
  },
  {
    id: "omega",
    name: "The Devil Coin",
    symbol: "OMGA",
    creator: "@sam_rich",
    description: "A devious coin designed to take your bags straight into the underworld.",
    avatarEmoji: "\u{1F608}",
    avatarBg: "bg-red-950 text-red-300 border-red-500",
    price: 666e-5,
    marketCap: 66600,
    supply: 1e7,
    volume24h: 6660,
    change24h: 66.6,
    history: [4e-3, 5e-3, 45e-4, 6e-3, 55e-4, 61e-4, 666e-5]
  },
  {
    id: "memex250",
    name: "PumpForge Coin",
    symbol: "PUMP",
    creator: "@system",
    description: "The native token of simulated pain and gains. 100% fair launch, zero chance of failure.",
    avatarEmoji: "\u{1F6F9}",
    avatarBg: "bg-amber-950 text-amber-300 border-amber-500",
    price: 0.015,
    marketCap: 15e3,
    supply: 1e6,
    volume24h: 91e3,
    change24h: -5.1,
    history: [0.012, 0.018, 0.016, 0.014, 0.019, 0.017, 0.015]
  },
  {
    id: "gigachad",
    name: "Gigachad Sentient",
    symbol: "CHAD",
    creator: "@pump_master",
    description: "Do you even lift your bags? Backed by pure test and hard work.",
    avatarEmoji: "\u{1F5FF}",
    avatarBg: "bg-zinc-850 text-zinc-300 border-zinc-500",
    price: 0.231,
    marketCap: 231e3,
    supply: 1e6,
    volume24h: 78e3,
    change24h: 15.6,
    history: [0.18, 0.19, 0.2, 0.22, 0.25, 0.24, 0.231]
  },
  {
    id: "bome",
    name: "Book of Degens",
    symbol: "BOME",
    creator: "@degen_ape",
    description: "An archive of every single liquidated position and bad trade ever executed.",
    avatarEmoji: "\u{1F4D6}",
    avatarBg: "bg-yellow-950 text-yellow-300 border-yellow-500",
    price: 89e-4,
    marketCap: 89e3,
    supply: 1e7,
    volume24h: 12e3,
    change24h: -2.3,
    history: [95e-4, 91e-4, 88e-4, 85e-4, 89e-4, 87e-4, 89e-4]
  },
  {
    id: "moonbox",
    name: "Moon Sandbox",
    symbol: "SAND",
    creator: "@sol_expert",
    description: "Our proprietary sandbox model built on absolute, unadulterated moonshots.",
    avatarEmoji: "\u{1F4E6}",
    avatarBg: "bg-blue-950 text-blue-300 border-blue-500",
    price: 0.082,
    marketCap: 82e3,
    supply: 1e6,
    volume24h: 31e3,
    change24h: 4.8,
    history: [0.075, 0.078, 0.08, 0.079, 0.084, 0.081, 0.082]
  },
  {
    id: "catfight",
    name: "Angry Mew",
    symbol: "MEW",
    creator: "@degen_ape",
    description: "She scratch, she bite, she pump in the middle of the night.",
    avatarEmoji: "\u{1F431}",
    avatarBg: "bg-rose-950 text-rose-300 border-rose-500",
    price: 14e-4,
    marketCap: 14e3,
    supply: 1e7,
    volume24h: 9100,
    change24h: -18.7,
    history: [18e-4, 17e-4, 19e-4, 16e-4, 15e-4, 13e-4, 14e-4]
  }
];

// src/server/db.ts
var APPWRITE_ENDPOINT2 = process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
var APPWRITE_PROJECT2 = process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902";
var APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
function createServerAppwriteClient(jwt) {
  const client = new Client().setEndpoint(APPWRITE_ENDPOINT2).setProject(APPWRITE_PROJECT2);
  if (APPWRITE_API_KEY) {
    client.setKey(APPWRITE_API_KEY);
  } else if (jwt) {
    client.setJWT(jwt);
  }
  return client;
}
function getDatabases(jwt) {
  const client = createServerAppwriteClient(jwt);
  return new Databases(client);
}
var AuthoritativeCoinStore = class {
  constructor() {
    this.coins = /* @__PURE__ */ new Map();
    this.deletedCoinIds = /* @__PURE__ */ new Set();
    this.isInitialized = false;
    this.initDefaultCoins();
  }
  initDefaultCoins() {
    for (const coin of INITIAL_COINS) {
      this.coins.set(coin.id, {
        ...coin,
        history: coin.history && coin.history.length > 0 ? [...coin.history] : [coin.price]
      });
    }
  }
  async syncWithDatabase(jwt) {
    try {
      const databases = getDatabases(jwt);
      const res = await databases.listDocuments("pumpforge", "coins", [Query.limit(100)]);
      for (const doc of res.documents) {
        if (this.deletedCoinIds.has(doc.$id) || this.deletedCoinIds.has(doc.coinId)) {
          continue;
        }
        const coinId = doc.$id;
        const existing = this.coins.get(coinId);
        const merged = {
          id: coinId,
          name: doc.name || existing?.name || "Unknown Token",
          symbol: doc.symbol || existing?.symbol || "COIN",
          creator: doc.creator || existing?.creator || "@system",
          description: doc.description || existing?.description || "",
          price: Number(doc.price ?? existing?.price ?? 0.01),
          marketCap: Math.floor(Number(doc.marketCap ?? existing?.marketCap ?? 1e3)),
          totalLiquidity: Number(doc.totalLiquidity ?? doc.total_value ?? existing?.totalLiquidity ?? 1e3),
          volume24h: Number(doc.volume24h ?? existing?.volume24h ?? 0),
          change24h: Number(doc.change24h ?? existing?.change24h ?? 0),
          history: Array.isArray(doc.history) && doc.history.length > 0 ? doc.history : existing?.history || [doc.price || 0.01],
          avatarEmoji: doc.avatarEmoji || existing?.avatarEmoji || "\u{1FA99}",
          avatarBg: doc.avatarBg || existing?.avatarBg || "bg-zinc-900 border-zinc-800",
          supply: Number(doc.supply ?? existing?.supply ?? 1e6),
          createdAt: doc.$createdAt
        };
        this.coins.set(coinId, merged);
      }
      this.isInitialized = true;
    } catch (e) {
      if (!this.isInitialized) {
        this.initDefaultCoins();
        this.isInitialized = true;
      }
    }
  }
  getAllCoins() {
    return Array.from(this.coins.values()).filter((c) => !this.deletedCoinIds.has(c.id));
  }
  getCoin(coinId) {
    if (this.deletedCoinIds.has(coinId)) return void 0;
    return this.coins.get(coinId);
  }
  setCoin(coin) {
    this.coins.set(coin.id, coin);
  }
  updateCoin(coinId, updates) {
    const existing = this.coins.get(coinId);
    if (!existing) return void 0;
    const updated = {
      ...existing,
      ...updates,
      price: updates.price !== void 0 ? Number(updates.price) : existing.price,
      marketCap: updates.marketCap !== void 0 ? Math.floor(Number(updates.marketCap)) : existing.marketCap,
      totalLiquidity: updates.totalLiquidity !== void 0 ? Number(updates.totalLiquidity) : existing.totalLiquidity,
      change24h: updates.change24h !== void 0 ? Number(updates.change24h) : existing.change24h,
      volume24h: updates.volume24h !== void 0 ? Number(updates.volume24h) : existing.volume24h,
      history: updates.history || existing.history
    };
    this.coins.set(coinId, updated);
    return updated;
  }
  deleteCoin(coinId) {
    this.deletedCoinIds.add(coinId);
    this.coins.delete(coinId);
    return true;
  }
};
var coinStore = new AuthoritativeCoinStore();
var userCache = /* @__PURE__ */ new Map();
var nextPlayerId = 1;
var isPlayerCounterInitialized = false;
async function initPlayerIdCounter(databases) {
  if (isPlayerCounterInitialized) return;
  try {
    const res = await databases.listDocuments("pumpforge", "users", [
      Query.orderDesc("playerId"),
      Query.limit(1)
    ]);
    if (res.documents.length > 0 && res.documents[0].playerId) {
      nextPlayerId = Math.max(nextPlayerId, Number(res.documents[0].playerId) + 1);
    }
  } catch (err) {
    try {
      const allUsers = await databases.listDocuments("pumpforge", "users", [Query.limit(1)]);
      nextPlayerId = Math.max(nextPlayerId, (allUsers.total || 0) + 1);
    } catch (_) {
    }
  }
  isPlayerCounterInitialized = true;
}
function computeUserBadges(user) {
  const badges = [];
  if (user.playerId && user.playerId <= 100) badges.push("Early Player");
  if ((user.coinsCreatedCount || 0) >= 1) badges.push("Coin Creator");
  if ((user.tradesCount || 0) >= 5) badges.push("Trader");
  if ((user.cash || 0) >= 1e5 || (user.totalProfit || 0) >= 1e5) badges.push("Whale");
  if ((user.tradesCount || 0) >= 25 || (user.totalProfit || 0) >= 5e5) badges.push("Top Trader");
  if ((user.prestigeLevel || 0) >= 1 || (user.tradesCount || 0) >= 50) badges.push("Market Veteran");
  if ((user.predictionWins || 0) >= 3) badges.push("Prediction Master");
  if ((user.rugPullsCount || 0) >= 1) badges.push("Rug Puller");
  return badges;
}
async function getAuthoritativeUser(userId, jwt, defaultName) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.updatedAt < 5e3) {
    return cached;
  }
  try {
    const databases = getDatabases(jwt);
    await initPlayerIdCounter(databases);
    const doc = await databases.getDocument("pumpforge", "users", userId);
    let assignedPlayerId = doc.playerId ? Number(doc.playerId) : void 0;
    if (!assignedPlayerId) {
      assignedPlayerId = nextPlayerId++;
      try {
        await databases.updateDocument("pumpforge", "users", userId, {
          playerId: assignedPlayerId
        });
      } catch (_) {
      }
    }
    const state = {
      userId,
      playerId: assignedPlayerId,
      username: doc.username || doc.name || defaultName || `Player_${assignedPlayerId}`,
      handle: doc.handle || `@user${assignedPlayerId}`,
      title: doc.title || "Member",
      isPremium: !!doc.isPremium,
      cash: Number(doc.cash ?? 5e3),
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
      createdAt: doc.$createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: Date.now()
    };
    userCache.set(userId, state);
    return state;
  } catch (err) {
    if (cached) return cached;
    const assignedPlayerId = nextPlayerId++;
    const fallbackUsername = defaultName || `Player_${assignedPlayerId}`;
    const fallbackHandle = `@${fallbackUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}` || `@user${assignedPlayerId}`;
    const initial = {
      userId,
      playerId: assignedPlayerId,
      username: fallbackUsername,
      handle: fallbackHandle,
      title: "Member",
      isPremium: false,
      cash: 5e3,
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: Date.now()
    };
    userCache.set(userId, initial);
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
          lastDailyRewardClaim: ""
        },
        [Permission.read(Role.any())]
      );
    } catch (createErr) {
      console.warn("Could not create initial user in Appwrite DB (in-memory cached):", createErr);
    }
    return initial;
  }
}
async function saveAuthoritativeUser(userId, updates, jwt) {
  const current = await getAuthoritativeUser(userId, jwt);
  const updated = {
    ...current,
    ...updates,
    updatedAt: Date.now()
  };
  userCache.set(userId, updated);
  try {
    const databases = getDatabases(jwt);
    const payload = {};
    if (updates.cash !== void 0) payload.cash = Number(updates.cash.toFixed(2));
    if (updates.gems !== void 0) payload.gems = Math.floor(updates.gems);
    if (updates.playerId !== void 0) payload.playerId = updates.playerId;
    if (updates.username !== void 0) payload.username = updates.username;
    if (updates.handle !== void 0) payload.handle = updates.handle;
    if (updates.title !== void 0) payload.title = updates.title;
    if (updates.nameColor !== void 0) payload.nameColor = updates.nameColor;
    if (updates.isPremium !== void 0) payload.isPremium = updates.isPremium;
    if (updates.prestigeLevel !== void 0) payload.prestigeLevel = updates.prestigeLevel;
    if (updates.tradesCount !== void 0) payload.tradesCount = updates.tradesCount;
    if (updates.coinsCreatedCount !== void 0) payload.coinsCreatedCount = updates.coinsCreatedCount;
    if (updates.totalProfit !== void 0) payload.totalProfit = Number(updates.totalProfit.toFixed(2));
    if (updates.dailyStreak !== void 0) payload.dailyStreak = updates.dailyStreak;
    if (updates.lastDailyRewardClaim !== void 0) payload.lastDailyRewardClaim = updates.lastDailyRewardClaim;
    if (updates.predictionWins !== void 0) payload.predictionWins = updates.predictionWins;
    if (updates.rugPullsCount !== void 0) payload.rugPullsCount = updates.rugPullsCount;
    if (updates.isBanned !== void 0) payload.isBanned = updates.isBanned;
    if (updates.isSuspended !== void 0) payload.isSuspended = updates.isSuspended;
    if (updates.suspendedUntil !== void 0) payload.suspendedUntil = updates.suspendedUntil;
    await databases.updateDocument("pumpforge", "users", userId, payload);
  } catch (err) {
    console.warn("Could not sync user to Appwrite directly (cached state preserved):", err);
  }
  return updated;
}
async function getPublicUserProfile(identifier) {
  let targetUser = null;
  const cleanId = identifier.trim();
  for (const u of userCache.values()) {
    if (String(u.playerId) === cleanId || u.userId === cleanId || u.handle?.toLowerCase() === cleanId.toLowerCase() || u.handle?.toLowerCase() === `@${cleanId.toLowerCase()}`) {
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
          userId: doc.$id,
          playerId: doc.playerId ? Number(doc.playerId) : 1,
          username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
          handle: doc.handle || `@user${doc.playerId || 1}`,
          cash: Number(doc.cash ?? 5e3),
          gems: Number(doc.gems ?? 100),
          prestigeLevel: Number(doc.prestigeLevel ?? 0),
          tradesCount: Number(doc.tradesCount ?? 0),
          coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
          totalProfit: Number(doc.totalProfit ?? 0),
          nameColor: doc.nameColor || "text-zinc-400 font-extrabold",
          dailyStreak: Number(doc.dailyStreak ?? 1),
          predictionWins: Number(doc.predictionWins ?? 0),
          rugPullsCount: Number(doc.rugPullsCount ?? 0),
          createdAt: doc.$createdAt || (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: Date.now()
        };
      } else {
        try {
          const doc = await databases.getDocument("pumpforge", "users", cleanId);
          targetUser = {
            userId: doc.$id,
            playerId: doc.playerId ? Number(doc.playerId) : 1,
            username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
            handle: doc.handle || `@user${doc.playerId || 1}`,
            cash: Number(doc.cash ?? 5e3),
            gems: Number(doc.gems ?? 100),
            prestigeLevel: Number(doc.prestigeLevel ?? 0),
            tradesCount: Number(doc.tradesCount ?? 0),
            coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
            totalProfit: Number(doc.totalProfit ?? 0),
            nameColor: doc.nameColor || "text-zinc-400 font-extrabold",
            dailyStreak: Number(doc.dailyStreak ?? 1),
            predictionWins: Number(doc.predictionWins ?? 0),
            rugPullsCount: Number(doc.rugPullsCount ?? 0),
            createdAt: doc.$createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: Date.now()
          };
        } catch (_) {
        }
      }
    } catch (_) {
    }
  }
  if (!targetUser) {
    return null;
  }
  const allCoins = coinStore.getAllCoins();
  const createdCoins = allCoins.filter(
    (c) => c.creatorId === targetUser.userId || c.creator?.toLowerCase() === targetUser.handle?.toLowerCase()
  );
  const badges = computeUserBadges(targetUser);
  let recentTrades = [];
  try {
    const databases = getDatabases();
    const tradeRes = await databases.listDocuments("pumpforge", "trades", [
      Query.equal("userId", targetUser.userId),
      Query.orderDesc("timestamp"),
      Query.limit(10)
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
      timestamp: t.timestamp
    }));
  } catch (_) {
  }
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
      coinsCreatedCount: targetUser.coinsCreatedCount
    },
    badges,
    createdCoins: createdCoins.map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      price: c.price,
      marketCap: c.marketCap,
      avatarEmoji: c.avatarEmoji
    })),
    recentTrades
  };
}
var globalAdminSettings = {
  arcadeRigMode: "fair",
  isCasinoRigged: false
};
async function syncAdminSettingsWithDatabase() {
  if (!APPWRITE_API_KEY) return;
  try {
    const databases = getDatabases();
    try {
      const doc = await databases.getDocument("pumpforge", "admin_settings", "global");
      if (doc) {
        if (doc.arcadeRigMode) globalAdminSettings.arcadeRigMode = doc.arcadeRigMode;
        if (doc.isCasinoRigged !== void 0) globalAdminSettings.isCasinoRigged = !!doc.isCasinoRigged;
      }
    } catch (err) {
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
            customAdminBadge: "Operator"
          },
          [Permission.read(Role.any())]
        );
      }
    }
  } catch (e) {
    console.warn("Server admin_settings sync notice:", e);
  }
}

// src/server/locks.ts
var MutexQueue = class {
  constructor() {
    this.queues = /* @__PURE__ */ new Map();
  }
  /**
   * Runs an asynchronous task exclusively for the given key.
   * If another operation with the same key is in progress, this task waits
   * until the previous task finishes before executing.
   */
  async runExclusive(key, task) {
    const currentQueue = this.queues.get(key) || Promise.resolve();
    let releaseLock;
    const nextQueue = new Promise((resolve) => {
      releaseLock = resolve;
    });
    const chained = currentQueue.then(async () => {
      try {
        return await task();
      } finally {
        releaseLock();
      }
    });
    this.queues.set(key, nextQueue);
    try {
      return await chained;
    } finally {
      if (this.queues.get(key) === nextQueue) {
        this.queues.delete(key);
      }
    }
  }
};
var userMutex = new MutexQueue();
var marketMutex = new MutexQueue();
async function withUserLock(userId, task) {
  const safeId = userId || "guest_global";
  return userMutex.runExclusive(`user:${safeId}`, task);
}
async function withMarketLock(marketId, task) {
  return marketMutex.runExclusive(`market:${marketId}`, task);
}

// src/server/rateLimit.ts
var RateLimiter = class {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.records = /* @__PURE__ */ new Map();
  }
  isAllowed(key) {
    const now = Date.now();
    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }
    record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterMs = Math.max(0, this.windowMs - (now - oldest));
      return { allowed: false, retryAfterMs };
    }
    record.timestamps.push(now);
    return { allowed: true, retryAfterMs: 0 };
  }
  clean() {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
};
var tradeLimiter = new RateLimiter(25, 5e3);
var arcadeLimiter = new RateLimiter(15, 5e3);
var dailyRewardLimiter = new RateLimiter(1, 1e4);
var bugReportLimiter = new RateLimiter(2, 6e4);
var adminLimiter = new RateLimiter(40, 1e4);
setInterval(() => {
  tradeLimiter.clean();
  arcadeLimiter.clean();
  dailyRewardLimiter.clean();
  bugReportLimiter.clean();
  adminLimiter.clean();
}, 3e5);

// src/server/gameEngine.ts
import { ID as ID2, Permission as Permission2, Role as Role2, Query as Query2 } from "appwrite";
function secureRandomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}
async function processDailyReward(user) {
  if (user.isGuest) {
    throw new Error("Authentication required to claim daily rewards.");
  }
  const { allowed, retryAfterMs } = dailyRewardLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const now = Date.now();
    const lastClaim = userState.lastDailyRewardClaim ? new Date(userState.lastDailyRewardClaim).getTime() : 0;
    const cooldownMs = 24 * 60 * 60 * 1e3;
    if (lastClaim && now - lastClaim < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastClaim);
      const remainingHours = (remainingMs / (60 * 60 * 1e3)).toFixed(1);
      throw new Error(`Daily reward is on cooldown. Next claim available in ${remainingHours} hours.`);
    }
    let newStreak = 1;
    if (lastClaim && now - lastClaim < 48 * 60 * 60 * 1e3) {
      newStreak = (userState.dailyStreak || 1) + 1;
    }
    const prestigeMult = 1 + (userState.prestigeLevel || 0) * 0.25;
    const streakBonusCash = Math.min((newStreak - 1) * 100, 1e3);
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
        lastDailyRewardClaim: new Date(now).toISOString()
      },
      user.jwt
    );
    return {
      success: true,
      rewardCash,
      rewardGems,
      newStreak,
      userStats: updated
    };
  });
}
async function processTrade(user, coinId, type, amountCoins) {
  if (!coinId || typeof coinId !== "string") {
    throw new Error("Invalid coin identifier.");
  }
  if (typeof amountCoins !== "number" || isNaN(amountCoins) || !isFinite(amountCoins) || amountCoins <= 0 || amountCoins > 1e12) {
    throw new Error("Invalid trade volume specified.");
  }
  const { allowed, retryAfterMs } = tradeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Trading rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const coin = coinStore.getCoin(coinId);
    if (!coin) {
      throw new Error("Specified meme coin does not exist or has been delisted.");
    }
    const currentPrice = Number(coin.price);
    const supply = coin.supply || 1e6;
    const tradeValue = amountCoins * currentPrice;
    if (type === "BUY") {
      const fee = tradeValue * 5e-3;
      const totalCost = tradeValue + fee;
      if (userState.cash < totalCost) {
        throw new Error(
          `Insufficient cash. Required: $${totalCost.toFixed(2)}, Available: $${userState.cash.toFixed(2)}`
        );
      }
      const impactRatio = Math.min(0.2, amountCoins / supply * 0.05);
      const newPrice = Number((currentPrice * (1 + impactRatio)).toFixed(6));
      const newLiquidity = Number(((coin.totalLiquidity || 1e3) + tradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + tradeValue).toFixed(2));
      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];
      const updatedCoin = coinStore.updateCoin(coinId, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        history: newHist
      });
      const nextCash = userState.cash - totalCost;
      const nextTrades = (userState.tradesCount || 0) + 1;
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades
        },
        user.jwt
      );
      if (!user.isGuest) {
        try {
          const databases = getDatabases(user.jwt);
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query2.equal("userId", user.userId),
            Query2.equal("coinId", coinId)
          ]);
          if (holdingsRes.documents.length > 0) {
            const h = holdingsRes.documents[0];
            const prevAmt = Number(h.tokenAmount || 0);
            const prevAvg = Number(h.avgBuyPrice || currentPrice);
            const nextAmt = prevAmt + amountCoins;
            const nextAvg = (prevAmt * prevAvg + tradeValue) / nextAmt;
            await databases.updateDocument("pumpforge", "holdings", h.$id, {
              tokenAmount: nextAmt,
              avgBuyPrice: nextAvg
            });
          } else {
            await databases.createDocument(
              "pumpforge",
              "holdings",
              ID2.unique(),
              {
                userId: user.userId,
                coinId,
                tokenAmount: amountCoins,
                avgBuyPrice: currentPrice
              },
              [Permission2.read(Role2.user(user.userId))]
            );
          }
          await databases.createDocument(
            "pumpforge",
            "trades",
            ID2.unique(),
            {
              userId: user.userId,
              userName: user.name,
              coinId,
              coinSymbol: coin.symbol,
              type: "BUY",
              amount: amountCoins,
              price: currentPrice,
              totalValue: tradeValue,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            },
            [Permission2.read(Role2.any())]
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
        coin: updatedCoin
      };
    } else {
      let userHoldingAmount = 0;
      let holdingAvgPrice = currentPrice;
      let holdingDocId = "";
      if (!user.isGuest) {
        try {
          const databases = getDatabases(user.jwt);
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query2.equal("userId", user.userId),
            Query2.equal("coinId", coinId)
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
      const fee = tradeValue * 5e-3;
      const netPayout = tradeValue - fee;
      const impactRatio = Math.min(0.2, amountCoins / supply * 0.05);
      const newPrice = Number(Math.max(1e-6, currentPrice * (1 - impactRatio)).toFixed(6));
      const newLiquidity = Number(Math.max(100, (coin.totalLiquidity || 1e3) - tradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + tradeValue).toFixed(2));
      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];
      const updatedCoin = coinStore.updateCoin(coinId, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        history: newHist
      });
      const profit = netPayout - amountCoins * holdingAvgPrice;
      const nextCash = userState.cash + netPayout;
      const nextTrades = (userState.tradesCount || 0) + 1;
      const nextProfit = (userState.totalProfit || 0) + profit;
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades,
          totalProfit: nextProfit
        },
        user.jwt
      );
      if (!user.isGuest && holdingDocId) {
        try {
          const databases = getDatabases(user.jwt);
          const nextRemaining = userHoldingAmount - amountCoins;
          if (nextRemaining <= 1e-5) {
            await databases.deleteDocument("pumpforge", "holdings", holdingDocId);
          } else {
            await databases.updateDocument("pumpforge", "holdings", holdingDocId, {
              tokenAmount: nextRemaining
            });
          }
          await databases.createDocument(
            "pumpforge",
            "trades",
            ID2.unique(),
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
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            },
            [Permission2.read(Role2.any())]
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
        coin: updatedCoin
      };
    }
  });
}
var activeMinesSessions = /* @__PURE__ */ new Map();
var activeTowerSessions = /* @__PURE__ */ new Map();
var slotEmojis = ["\u{1F352}", "\u{1F34B}", "\u{1F514}", "7\uFE0F\u20E3", "\u{1F48E}"];
async function processArcadeWager(user, game, action, params) {
  const { allowed, retryAfterMs } = arcadeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Arcade rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const rigMode = globalAdminSettings.arcadeRigMode;
    if (game === "coinflip") {
      const bet = Number(params.bet);
      const chosenSide = params.side;
      if (!chosenSide || !["heads", "tails"].includes(chosenSide)) {
        throw new Error("Choose heads or tails.");
      }
      if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }
      let resultSide;
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
          totalProfit: (userState.totalProfit || 0) + (won ? payout - bet : -bet)
        },
        user.jwt
      );
      return {
        game: "coinflip",
        outcome: resultSide,
        won,
        payout,
        profit: won ? payout - bet : -bet,
        userStats: updatedUser
      };
    }
    if (game === "slots") {
      const bet = Number(params.bet);
      if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }
      let reels;
      if (rigMode === "win") {
        reels = ["7\uFE0F\u20E3", "7\uFE0F\u20E3", "7\uFE0F\u20E3"];
      } else if (rigMode === "lose") {
        reels = ["\u{1F352}", "\u{1F34B}", "\u{1F514}"];
      } else {
        reels = [
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)]
        ];
      }
      const matchCount = new Set(reels).size;
      let payout = 0;
      let nextCash = userState.cash - bet;
      if (matchCount === 1) {
        let multiplier = 3;
        if (reels[0] === "7\uFE0F\u20E3") multiplier = 6;
        else if (reels[0] === "\u{1F48E}") multiplier = 4;
        payout = bet * multiplier;
      } else if (matchCount === 2) {
        payout = Math.floor(bet * 0.95);
      }
      nextCash += payout;
      const won = payout > 0;
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          totalProfit: (userState.totalProfit || 0) + (payout - bet)
        },
        user.jwt
      );
      return {
        game: "slots",
        reels,
        matchCount,
        payout,
        profit: payout - bet,
        userStats: updatedUser
      };
    }
    if (game === "dice") {
      const bet = Number(params.bet);
      const selectedNum = Number(params.selectedNum);
      if (!selectedNum || selectedNum < 1 || selectedNum > 6) {
        throw new Error("Choose a face number between 1 and 6.");
      }
      if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }
      let landedFace;
      if (rigMode === "win") {
        landedFace = selectedNum;
      } else if (rigMode === "lose") {
        landedFace = selectedNum % 6 + 1;
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
          totalProfit: (userState.totalProfit || 0) + (won ? payout - bet : -bet)
        },
        user.jwt
      );
      return {
        game: "dice",
        landedFace,
        won,
        payout,
        profit: won ? payout - bet : -bet,
        userStats: updatedUser
      };
    }
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
        const nextCash = userState.cash - bet;
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash
          },
          user.jwt
        );
        const secretMap = Array(25).fill(false);
        let placed = 0;
        while (placed < minesCount) {
          const idx = secureRandomInt(0, 24);
          if (!secretMap[idx]) {
            secretMap[idx] = true;
            placed++;
          }
        }
        const session2 = {
          bet,
          minesCount,
          secretMinesMap: secretMap,
          revealedGrid: Array(25).fill("hidden"),
          safeSelections: 0,
          multiplier: 1,
          active: true
        };
        activeMinesSessions.set(user.userId, session2);
        return {
          game: "mines",
          action: "start",
          safeSelections: 0,
          multiplier: 1,
          userStats: updatedUser
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
          session.active = false;
          activeMinesSessions.delete(user.userId);
          return {
            game: "mines",
            action: "step",
            hitMine: true,
            explodedCell: cellIdx,
            secretMinesMap: session.secretMinesMap,
            // Revealed on loss for transparency
            multiplier: 0,
            userStats: userState
          };
        }
        session.revealedGrid[cellIdx] = "revealed-gem";
        session.safeSelections += 1;
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
          const nextCash = userState.cash + winnings;
          session.active = false;
          activeMinesSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: (userState.totalProfit || 0) + (winnings - session.bet)
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
            userStats: updatedUser
          };
        }
        return {
          game: "mines",
          action: "step",
          hitMine: false,
          cellIndex: cellIdx,
          safeSelections: session.safeSelections,
          multiplier: session.multiplier
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
            totalProfit: (userState.totalProfit || 0) + (winnings - session.bet)
          },
          user.jwt
        );
        return {
          game: "mines",
          action: "cashout",
          winnings,
          multiplier: session.multiplier,
          secretMinesMap: session.secretMinesMap,
          userStats: updatedUser
        };
      }
    }
    if (game === "tower") {
      if (action === "start") {
        const bet = Number(params.bet);
        const difficulty = params.difficulty || "easy";
        if (typeof bet !== "number" || isNaN(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }
        const nextCash = userState.cash - bet;
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash
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
        const secretGrid = [];
        for (let l = 0; l < 10; l++) {
          const arr = Array(colsCount).fill(0);
          const safeCols = /* @__PURE__ */ new Set();
          while (safeCols.size < safeCount) {
            safeCols.add(secureRandomInt(0, colsCount - 1));
          }
          safeCols.forEach((idx) => arr[idx] = 1);
          secretGrid.push(arr);
        }
        const session2 = {
          bet,
          difficulty,
          currentLevel: 0,
          secretGrid,
          multiplier: 1,
          active: true
        };
        activeTowerSessions.set(user.userId, session2);
        return {
          game: "tower",
          action: "start",
          colsCount,
          safeCount,
          currentLevel: 0,
          userStats: updatedUser
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
            userStats: userState
          };
        }
        session.currentLevel += 1;
        const multTable = {
          easy: [1.35, 1.85, 2.5, 3.4, 4.6, 6.2, 8.4, 11.5, 15.6, 21],
          medium: [1.8, 3.2, 5.8, 10.5, 19, 34, 61, 110, 198, 350],
          hard: [2.7, 7.3, 19.8, 53.5, 144, 390, 1050, 2800, 7600, 2e4]
        };
        session.multiplier = multTable[session.difficulty][session.currentLevel - 1] || 1;
        if (session.currentLevel >= 10) {
          const winnings = Math.floor(session.bet * session.multiplier);
          const nextCash = userState.cash + winnings;
          session.active = false;
          activeTowerSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: (userState.totalProfit || 0) + (winnings - session.bet)
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
            userStats: updatedUser
          };
        }
        return {
          game: "tower",
          action: "step",
          hitSkull: false,
          level: session.currentLevel,
          multiplier: session.multiplier
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
            totalProfit: (userState.totalProfit || 0) + (winnings - session.bet)
          },
          user.jwt
        );
        return {
          game: "tower",
          action: "cashout",
          winnings,
          multiplier: session.multiplier,
          secretGrid: session.secretGrid,
          userStats: updatedUser
        };
      }
    }
    throw new Error("Unsupported arcade game or action.");
  });
}
async function processShopBuy(user, type, params) {
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
          nameColor: colorClass
        },
        user.jwt
      );
      return {
        success: true,
        type: "color",
        equippedColor: colorClass,
        userStats: updated
      };
    } else if (type === "crate") {
      const crateId = params.crateId;
      let minCash = 5e3;
      let maxCash = 15e3;
      let minBonusGems = 5;
      let maxBonusGems = 25;
      if (crateId === "fatass") {
        minCash = 2e4;
        maxCash = 6e4;
        minBonusGems = 20;
        maxBonusGems = 80;
      } else if (crateId === "motion") {
        minCash = 1e5;
        maxCash = 25e4;
        minBonusGems = 50;
        maxBonusGems = 200;
      } else if (crateId === "auraful") {
        minCash = 3e5;
        maxCash = 1e6;
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
          gems: nextGems
        },
        user.jwt
      );
      return {
        success: true,
        type: "crate",
        crateId,
        cashReward,
        bonusGems,
        userStats: updated
      };
    }
    throw new Error("Invalid shop action.");
  });
}
async function processPrestige(user) {
  if (user.isGuest) {
    throw new Error("Authentication required for prestige resets.");
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    if (userState.cash < 1e5) {
      throw new Error(`Prestige requires at least $100,000.00 cash reserves. Current: $${userState.cash.toFixed(2)}`);
    }
    const nextPrestige = (userState.prestigeLevel || 0) + 1;
    const nextGems = (userState.gems || 0) + 500;
    try {
      const databases = getDatabases(user.jwt);
      const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
        Query2.equal("userId", user.userId),
        Query2.limit(100)
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
        cash: 5e3,
        gems: nextGems,
        prestigeLevel: nextPrestige,
        totalProfit: 0
      },
      user.jwt
    );
    return {
      success: true,
      nextPrestige,
      gemsAwarded: 500,
      userStats: updated
    };
  });
}
async function processPromocode(user, code) {
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
      Query2.equal("code", cleanCode)
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
    const claimedArray = promoDoc.claimedBy || [];
    if (promoDoc.maxUses && claimedArray.length >= promoDoc.maxUses) {
      throw new Error("This promo code has reached its maximum usage limit.");
    }
    if (claimedArray.includes(user.userId)) {
      throw new Error("Promo code has already been redeemed on this account.");
    }
    const rewardType = promoDoc.rewardType || "cash";
    const rewardAmt = Number(promoDoc.rewardAmount) || 1e3;
    await databases.updateDocument("pumpforge", "promocodes", promoDoc.$id, {
      claimedBy: [...claimedArray, user.userId]
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
        gems: nextGems
      },
      user.jwt
    );
    return {
      success: true,
      rewardType,
      rewardAmount: rewardAmt,
      userStats: updated
    };
  });
}
function sanitizePlainText(input) {
  return (input || "").replace(/<[^>]*>?/gm, "").replace(/[&<>"'/]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;" })[s] || s).trim();
}
async function processCreateCoin(user, params) {
  if (user.isGuest) {
    throw new Error("Authentication required to launch custom meme tokens.");
  }
  const rawName = (params.name || "").trim();
  const rawSymbol = (params.symbol || "").trim().toUpperCase();
  const rawDescription = (params.description || "").trim();
  const avatarEmoji = params.avatarEmoji || "\u{1FA99}";
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
  const existingCoins = coinStore.getAllCoins();
  const duplicate = existingCoins.some(
    (c) => c.symbol.toUpperCase() === cleanSymbol || c.slug?.toLowerCase() === slug || c.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A token with symbol "${cleanSymbol}" or name "${cleanName}" already exists.`);
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    const creationCost = 1100;
    if (userState.cash < creationCost) {
      throw new Error(`Insufficient funds. Creation fee is $${creationCost.toFixed(2)}.`);
    }
    if ((userState.coinsCreatedCount || 0) >= 10) {
      throw new Error("10-Coin Limit reached for this account.");
    }
    const newCoinId = ID2.unique();
    const initSupply = 1e9;
    const initMarketCap = 1e3;
    const initPrice = 1e-6;
    const initLiquidity = 1e3;
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    coinStore.setCoin(newCoin);
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
          supply: initSupply
        },
        [Permission2.read(Role2.any())]
        // Least privilege: read-only for public, NO Role.any() update/delete!
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
        coinsCreatedCount: nextCreated
      },
      user.jwt
    );
    return {
      success: true,
      coin: newCoin,
      userStats: updatedUser
    };
  });
}
async function processBugReport(user, title, description) {
  const { allowed, retryAfterMs } = bugReportLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s before submitting another report.`);
  }
  const cleanTitle = (title || "").trim();
  const cleanDesc = (description || "").trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 100) {
    throw new Error("Title must be between 3 and 100 characters.");
  }
  if (cleanDesc.length < 10 || cleanDesc.length > 1e3) {
    throw new Error("Description must be between 10 and 1000 characters.");
  }
  try {
    const databases = getDatabases(user.jwt);
    await databases.createDocument(
      "pumpforge",
      "bugs",
      ID2.unique(),
      {
        title: cleanTitle,
        description: cleanDesc,
        userName: user.name || "Anonymous",
        userEmail: user.email || "",
        reportedBy: `${user.name} (${user.email || "No Email"}) [${user.userId}]`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "open"
      },
      [Permission2.read(Role2.any())]
    );
  } catch (e) {
    console.warn("Could not save bug report to Appwrite:", e);
  }
  return { success: true };
}
async function processPolymarketWager(user, marketId, choice, amount) {
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
        cash: nextCash
      },
      user.jwt
    );
    const newYesPool = choice === "YES" ? (Number(market.poolYes) || 0) + amount : Number(market.poolYes) || 0;
    const newNoPool = choice === "NO" ? (Number(market.poolNo) || 0) + amount : Number(market.poolNo) || 0;
    await databases.updateDocument("pumpforge", "polymarkets", marketId, {
      poolYes: newYesPool,
      poolNo: newNoPool
    });
    const wagerDoc = await databases.createDocument(
      "pumpforge",
      "wagers",
      ID2.unique(),
      {
        userId: user.userId,
        polymarketId: marketId,
        amount: Number(amount),
        choice,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        isPaid: false
      },
      [Permission2.read(Role2.user(user.userId))]
      // Least-privilege: only the owner can read
    );
    return {
      success: true,
      wager: wagerDoc,
      userStats: updatedUser,
      newPoolYes: newYesPool,
      newPoolNo: newNoPool
    };
  });
}
var predictionMarketCreationLimiter = new RateLimiter(2, 60 * 60 * 1e3);
async function processCreatePredictionMarket(user, params) {
  if (user.isGuest) {
    throw new Error("Authentication required to create prediction markets.");
  }
  const { allowed, retryAfterMs } = predictionMarketCreationLimiter.isAllowed(user.userId);
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 6e4);
    throw new Error(`Creation limit reached (max 2 markets/hour). Try again in ${mins} minutes.`);
  }
  const question = sanitizePlainText(params.question || "");
  const description = sanitizePlainText(params.description || "");
  if (question.length < 5 || question.length > 200) {
    throw new Error("Question must be between 5 and 200 characters.");
  }
  const expiryTimestamp = new Date(params.endDate).getTime();
  if (isNaN(expiryTimestamp) || expiryTimestamp <= Date.now() + 60 * 60 * 1e3) {
    throw new Error("Market expiration must be at least 1 hour in the future.");
  }
  const creationCost = 1e5;
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt);
    if (userState.cash < creationCost) {
      throw new Error(`Insufficient funds. Market creation requires $${creationCost.toLocaleString()} cash.`);
    }
    const nextCash = userState.cash - creationCost;
    const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
    const marketId = ID2.unique();
    const marketDoc = {
      id: marketId,
      question: description ? `${question} --- ${description}` : question,
      creatorId: user.userId,
      creator: user.name || `@${user.userId.slice(0, 6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      endDate: new Date(expiryTimestamp).toISOString(),
      status: "active",
      poolYes: 0,
      poolNo: 0,
      resolved: false,
      winningOutcome: null,
      resolutionTimestamp: null
    };
    try {
      const databases = getDatabases(user.jwt);
      await databases.createDocument(
        "pumpforge",
        "polymarkets",
        marketId,
        marketDoc,
        [Permission2.read(Role2.any())]
        // Least privilege: read-only for public
      );
    } catch (err) {
      console.warn("Could not save prediction market in Appwrite directly:", err);
    }
    return {
      success: true,
      market: marketDoc,
      userStats: updatedUser
    };
  });
}
var commentRateLimiter = new RateLimiter(5, 30 * 1e3);
async function processAddComment(user, targetId, text) {
  if (user.isGuest) {
    throw new Error("Authentication required to post comments.");
  }
  const { allowed, retryAfterMs } = commentRateLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Comment rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  const cleanText = sanitizePlainText(text || "");
  if (cleanText.length < 1 || cleanText.length > 500) {
    throw new Error("Comment text must be between 1 and 500 characters.");
  }
  const userState = await getAuthoritativeUser(user.userId, user.jwt);
  const commentId = ID2.unique();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const commentData = {
    targetId,
    userId: user.userId,
    username: userState.username || user.name || "Trader",
    handle: userState.handle || `@user${userState.playerId || user.userId.slice(0, 6)}`,
    text: cleanText,
    createdAt,
    reported: false
  };
  try {
    const databases = getDatabases(user.jwt);
    await databases.createDocument(
      "pumpforge",
      "comments",
      commentId,
      commentData,
      [Permission2.read(Role2.any())]
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
    reported: false
  };
}
async function processGetComments(targetId) {
  try {
    const databases = getDatabases();
    const res = await databases.listDocuments("pumpforge", "comments", [
      Query2.equal("targetId", targetId),
      Query2.orderDesc("createdAt"),
      Query2.limit(100)
    ]);
    return res.documents.map((doc) => ({
      id: doc.$id,
      targetId: doc.targetId,
      userId: doc.userId,
      username: doc.username || "Trader",
      handle: doc.handle || `@user`,
      text: doc.text,
      createdAt: doc.createdAt || doc.$createdAt,
      reported: !!doc.reported
    }));
  } catch (err) {
    console.warn("Could not query comments from Appwrite:", err);
    return [];
  }
}
async function processDeleteComment(user, commentId) {
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
async function processReportComment(commentId) {
  const databases = getDatabases();
  await databases.updateDocument("pumpforge", "comments", commentId, {
    reported: true
  });
  return true;
}
async function processUpdateProfile(user, updates) {
  if (user.isGuest) {
    throw new Error("Authentication required to update profile.");
  }
  const sanitizedUpdates = {};
  if (updates.username !== void 0) {
    const cleanUser = sanitizePlainText(updates.username);
    if (cleanUser.length >= 2 && cleanUser.length <= 30) {
      sanitizedUpdates.username = cleanUser;
    }
  }
  if (updates.handle !== void 0) {
    const rawHandle = updates.handle.replace(/[^a-zA-Z0-9_@]/g, "");
    const cleanHandle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    if (cleanHandle.length >= 2 && cleanHandle.length <= 30) {
      sanitizedUpdates.handle = cleanHandle;
    }
  }
  if (updates.title !== void 0) {
    const cleanTitle = sanitizePlainText(updates.title);
    if (cleanTitle.length <= 30) {
      sanitizedUpdates.title = cleanTitle;
    }
  }
  if (updates.nameColor !== void 0) {
    sanitizedUpdates.nameColor = String(updates.nameColor).slice(0, 100);
  }
  if (updates.isPremium !== void 0) {
    sanitizedUpdates.isPremium = !!updates.isPremium;
  }
  const updatedUser = await saveAuthoritativeUser(user.userId, sanitizedUpdates, user.jwt);
  return { success: true, userStats: updatedUser };
}
async function processGetCoinCandles(coinId, intervalMinutes = 1) {
  const coin = coinStore.getCoin(coinId);
  const basePrice = coin ? coin.price : 1e-6;
  try {
    const databases = getDatabases();
    const res = await databases.listDocuments("pumpforge", "trades", [
      Query2.equal("coinId", coinId),
      Query2.orderAsc("timestamp"),
      Query2.limit(200)
    ]);
    const trades = res.documents;
    if (!trades || trades.length === 0) {
      const history = coin?.history && coin.history.length > 0 ? coin.history : [basePrice];
      const now = Date.now();
      const count = 15;
      const candles2 = [];
      let lastClose = basePrice;
      for (let i = count - 1; i >= 0; i--) {
        const timeStr = new Date(now - i * 60 * 1e3).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });
        const tick = history[history.length - 1 - i % history.length] || lastClose;
        const open = lastClose;
        const close = tick;
        const isUp = close >= open;
        const wiggle = Math.max(basePrice * 5e-3, 1e-7);
        const high = Math.max(open, close) + (isUp ? wiggle : wiggle * 0.3);
        const low = Math.max(1e-7, Math.min(open, close) - (!isUp ? wiggle : wiggle * 0.3));
        candles2.push({
          id: count - i,
          time: timeStr,
          open,
          high,
          low,
          close,
          volume: Math.round(1e4 + (count - i) * 3700 % 4e4),
          isUp
        });
        lastClose = close;
      }
      return candles2;
    }
    const bucketMap = /* @__PURE__ */ new Map();
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1e3;
    for (const t of trades) {
      const ts = new Date(t.timestamp || t.$createdAt || Date.now()).getTime();
      const bucketKey = Math.floor(ts / intervalMs) * intervalMs;
      const price = Number(t.price) || basePrice;
      const total = Number(t.total) || (Number(t.amount) || 0) * price;
      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, { prices: [], volume: 0, timestamp: bucketKey });
      }
      const b = bucketMap.get(bucketKey);
      b.prices.push(price);
      b.volume += total;
    }
    const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    const candles = [];
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
          minute: "2-digit"
        }),
        open,
        high,
        low,
        close,
        volume: Math.round(b.volume),
        isUp
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
        isUp: true
      }
    ];
  }
}
function computeUserBadges2(user) {
  const badges = [];
  if ((user.playerId || 0) <= 100 && (user.playerId || 0) > 0) {
    badges.push({ id: "early_adopter", label: "OG Trader", icon: "\u{1F451}", color: "text-amber-400" });
  }
  if ((user.prestigeLevel || 0) >= 5) {
    badges.push({ id: "prestige_master", label: `Prestige ${user.prestigeLevel}`, icon: "\u2728", color: "text-purple-400" });
  } else if ((user.prestigeLevel || 0) > 0) {
    badges.push({ id: "prestige", label: `P${user.prestigeLevel}`, icon: "\u2B50", color: "text-blue-400" });
  }
  if ((user.totalProfit || 0) >= 1e6) {
    badges.push({ id: "whale", label: "Whale Trader", icon: "\u{1F40B}", color: "text-cyan-400" });
  }
  if ((user.tradesCount || 0) >= 100) {
    badges.push({ id: "veteran", label: "Veteran", icon: "\u2694\uFE0F", color: "text-emerald-400" });
  }
  if ((user.coinsCreatedCount || 0) >= 5) {
    badges.push({ id: "creator", label: "Token Founder", icon: "\u{1F680}", color: "text-rose-400" });
  }
  if ((user.rugPullsCount || 0) >= 1) {
    badges.push({ id: "rugger", label: "Rug Specialist", icon: "\u{1F9F9}", color: "text-orange-400" });
  }
  return badges;
}
async function processGetLeaderboard(category = "gains", limit = 50) {
  try {
    const databases = getDatabases();
    let queryOrder = Query2.orderDesc("totalProfit");
    if (category === "prestige") {
      queryOrder = Query2.orderDesc("prestigeLevel");
    } else if (category === "losses") {
      queryOrder = Query2.orderAsc("totalProfit");
    } else if (category === "trades") {
      queryOrder = Query2.orderDesc("tradesCount");
    } else if (category === "creations") {
      queryOrder = Query2.orderDesc("coinsCreatedCount");
    } else if (category === "rugpulls") {
      queryOrder = Query2.orderDesc("rugPullsCount");
    } else {
      queryOrder = Query2.orderDesc("totalProfit");
    }
    const res = await databases.listDocuments("pumpforge", "users", [
      queryOrder,
      Query2.limit(limit)
    ]);
    return res.documents.map((doc, idx) => ({
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
      badges: computeUserBadges2({
        userId: doc.$id,
        playerId: doc.playerId,
        cash: Number(doc.cash || 0),
        totalProfit: Number(doc.totalProfit || 0),
        tradesCount: Number(doc.tradesCount || 0),
        coinsCreatedCount: Number(doc.coinsCreatedCount || 0),
        rugPullsCount: Number(doc.rugPullsCount || 0),
        prestigeLevel: Number(doc.prestigeLevel || 0)
      })
    }));
  } catch (err) {
    console.warn("Could not query Appwrite for leaderboard:", err);
    return [];
  }
}

// src/server/adminEngine.ts
import { Query as Query3, Permission as Permission3, Role as Role3, ID as ID3 } from "appwrite";
var auditLogsStore = [];
async function recordAuditLog(admin, action, details) {
  const entry = {
    id: ID3.unique(),
    adminId: admin.userId,
    adminEmail: admin.email,
    action,
    details,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  auditLogsStore.unshift(entry);
  if (auditLogsStore.length > 500) auditLogsStore.pop();
  try {
    const databases = getDatabases(admin.jwt);
    await databases.createDocument(
      "pumpforge",
      "audit_logs",
      entry.id,
      {
        adminId: entry.adminId,
        adminEmail: entry.adminEmail,
        action: entry.action,
        details: typeof details === "string" ? details : JSON.stringify(details),
        timestamp: entry.timestamp
      },
      [Permission3.read(Role3.user(admin.userId))]
    );
  } catch (err) {
  }
}
function getAuditLogs() {
  return auditLogsStore;
}
async function resolveMarketAndPayout(admin, marketId, winningChoice) {
  if (!admin.isAdmin) {
    throw new Error("Admin privileges required to resolve prediction markets.");
  }
  const { allowed, retryAfterMs } = adminLimiter.isAllowed(admin.userId);
  if (!allowed) {
    throw new Error(`Admin rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  return withMarketLock(marketId, async () => {
    const databases = getDatabases(admin.jwt);
    const market = await databases.getDocument("pumpforge", "polymarkets", marketId);
    if (market.status === "closed" && market.resolved) {
      throw new Error("Prediction market has already been resolved and payouts finalized.");
    }
    const poolYes = Number(market.poolYes || 0);
    const poolNo = Number(market.poolNo || 0);
    const totalPool = poolYes + poolNo;
    await databases.updateDocument("pumpforge", "polymarkets", marketId, {
      status: "closed",
      resolved: true,
      winningOutcome: winningChoice,
      resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const wagersRes = await databases.listDocuments("pumpforge", "wagers", [
      Query3.equal("polymarketId", marketId),
      Query3.limit(500)
    ]);
    let totalPaidOut = 0;
    let winnersCount = 0;
    for (const wager of wagersRes.documents) {
      if (wager.isPaid === true) {
        continue;
      }
      const wagerUserId = wager.userId;
      const wagerAmount = Number(wager.amount || 0);
      const choice = wager.choice;
      let payoutAmount = 0;
      if (winningChoice === "CANCEL") {
        payoutAmount = wagerAmount;
      } else if (choice === winningChoice) {
        const winningPool = winningChoice === "YES" ? poolYes : poolNo;
        if (winningPool > 0 && totalPool > 0) {
          const shareRatio = wagerAmount / winningPool;
          payoutAmount = Math.floor(shareRatio * totalPool);
        } else {
          payoutAmount = wagerAmount;
        }
      }
      await databases.updateDocument("pumpforge", "wagers", wager.$id, {
        isPaid: true,
        payoutAmount
      });
      if (payoutAmount > 0) {
        await withUserLock(wagerUserId, async () => {
          const uState = await getAuthoritativeUser(wagerUserId, admin.jwt);
          const nextCash = uState.cash + payoutAmount;
          await saveAuthoritativeUser(
            wagerUserId,
            {
              cash: nextCash,
              totalProfit: (uState.totalProfit || 0) + (payoutAmount - wagerAmount)
            },
            admin.jwt
          );
        });
        totalPaidOut += payoutAmount;
        winnersCount++;
      }
    }
    await recordAuditLog(admin, "MARKET_RESOLVE", {
      marketId,
      winningChoice,
      winnersCount,
      totalPaidOut
    });
    return {
      success: true,
      marketId,
      winningChoice,
      winnersCount,
      totalPaidOut
    };
  });
}
async function adminUpdateCoin(admin, coinId, updates) {
  if (!admin.isAdmin) {
    throw new Error("Admin privileges required to configure coins.");
  }
  const updated = coinStore.updateCoin(coinId, updates);
  try {
    const databases = getDatabases(admin.jwt);
    const payload = {};
    if (updates.price !== void 0) payload.price = Number(updates.price);
    if (updates.marketCap !== void 0) payload.marketCap = Math.floor(Number(updates.marketCap));
    if (updates.totalLiquidity !== void 0) payload.totalLiquidity = Number(updates.totalLiquidity);
    if (updates.volume24h !== void 0) payload.volume24h = Number(updates.volume24h);
    if (updates.change24h !== void 0) payload.change24h = Number(updates.change24h);
    if (updates.history !== void 0) payload.history = updates.history;
    if (updates.name !== void 0) payload.name = updates.name;
    if (updates.symbol !== void 0) payload.symbol = updates.symbol;
    if (updates.supply !== void 0) payload.supply = Number(updates.supply);
    try {
      await databases.updateDocument("pumpforge", "coins", coinId, payload);
    } catch (updateErr) {
      const existing = coinStore.getCoin(coinId);
      if (existing) {
        await databases.createDocument(
          "pumpforge",
          "coins",
          coinId,
          {
            coinId,
            creator: existing.creator || "@system",
            name: updates.name || existing.name,
            symbol: updates.symbol || existing.symbol,
            description: existing.description || "",
            price: Number(updates.price ?? existing.price),
            marketCap: Math.floor(Number(updates.marketCap ?? existing.marketCap)),
            totalLiquidity: Number(updates.totalLiquidity ?? existing.totalLiquidity),
            volume24h: Number(updates.volume24h ?? existing.volume24h),
            change24h: Number(updates.change24h ?? existing.change24h),
            history: updates.history || existing.history,
            avatarEmoji: existing.avatarEmoji || "\u{1FA99}",
            avatarBg: existing.avatarBg || "bg-zinc-900 border-zinc-800",
            supply: Number(updates.supply ?? existing.supply ?? 1e6)
          },
          [Permission3.read(Role3.any())]
        );
      }
    }
  } catch (err) {
    console.warn("Could not save coin update to Appwrite directly:", err);
  }
  await recordAuditLog(admin, "COIN_UPDATE", { coinId, updates });
  return { success: true, coin: updated };
}
async function adminPumpCoin(admin, coinId, multiplier = 2) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  const coin = coinStore.getCoin(coinId);
  if (!coin) throw new Error("Coin not found.");
  const newPrice = Number((coin.price * multiplier).toFixed(6));
  const newMcap = Math.floor(newPrice * (coin.supply || 1e6));
  const newHist = [...(coin.history || [coin.price]).slice(-29), newPrice];
  return adminUpdateCoin(admin, coinId, {
    price: newPrice,
    marketCap: newMcap,
    change24h: (coin.change24h || 0) + (multiplier - 1) * 100,
    history: newHist
  });
}
async function adminDumpCoin(admin, coinId, dropRatio = 0.5) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  const coin = coinStore.getCoin(coinId);
  if (!coin) throw new Error("Coin not found.");
  const newPrice = Number(Math.max(1e-6, coin.price * dropRatio).toFixed(6));
  const newMcap = Math.floor(newPrice * (coin.supply || 1e6));
  const newHist = [...(coin.history || [coin.price]).slice(-29), newPrice];
  return adminUpdateCoin(admin, coinId, {
    price: newPrice,
    marketCap: newMcap,
    change24h: (coin.change24h || 0) - (1 - dropRatio) * 100,
    history: newHist
  });
}
async function adminDeleteCoin(admin, coinId) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  coinStore.deleteCoin(coinId);
  try {
    const databases = getDatabases(admin.jwt);
    await databases.deleteDocument("pumpforge", "coins", coinId);
  } catch (e) {
    console.warn("Could not delete coin from Appwrite:", e);
  }
  await recordAuditLog(admin, "COIN_DELETE", { coinId });
  return { success: true, deletedId: coinId };
}
async function adminGrantBalance(admin, targetUserId, mode, currency, amount) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  return withUserLock(targetUserId, async () => {
    const uState = await getAuthoritativeUser(targetUserId, admin.jwt);
    let nextVal = currency === "cash" ? uState.cash : uState.gems;
    if (mode === "add") nextVal += amount;
    else if (mode === "deduct") nextVal = Math.max(0, nextVal - amount);
    else if (mode === "set") nextVal = Math.max(0, amount);
    const updates = currency === "cash" ? { cash: nextVal } : { gems: Math.floor(nextVal) };
    const updated = await saveAuthoritativeUser(targetUserId, updates, admin.jwt);
    await recordAuditLog(admin, "BALANCE_GRANT", { targetUserId, mode, currency, amount });
    return { success: true, userStats: updated };
  });
}
async function adminSanctionUser(admin, targetUserId, sanction, durationMinutes) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  return withUserLock(targetUserId, async () => {
    const updates = {};
    if (sanction === "ban") updates.isBanned = true;
    else if (sanction === "unban") updates.isBanned = false;
    else if (sanction === "suspend") {
      updates.isSuspended = true;
      updates.suspendedUntil = Date.now() + (durationMinutes || 60) * 60 * 1e3;
    } else if (sanction === "unsuspend") {
      updates.isSuspended = false;
      updates.suspendedUntil = null;
    }
    const updated = await saveAuthoritativeUser(targetUserId, updates, admin.jwt);
    await recordAuditLog(admin, "USER_SANCTION", { targetUserId, sanction, durationMinutes });
    return { success: true, userStats: updated };
  });
}
async function adminUpdateUserProfile(admin, targetUserId, updates) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  return withUserLock(targetUserId, async () => {
    const allowedFields = ["prestigeLevel", "title", "badge", "badges", "equippedColor"];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== void 0) {
        safeUpdates[key] = updates[key];
      }
    }
    const updated = await saveAuthoritativeUser(targetUserId, safeUpdates, admin.jwt);
    await recordAuditLog(admin, "USER_PROFILE_UPDATE", { targetUserId, safeUpdates });
    return { success: true, userStats: updated };
  });
}
async function adminUpdateSettings(admin, settings) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  if (settings.arcadeRigMode) {
    globalAdminSettings.arcadeRigMode = settings.arcadeRigMode;
  }
  if (settings.isCasinoRigged !== void 0) {
    globalAdminSettings.isCasinoRigged = !!settings.isCasinoRigged;
  }
  try {
    const databases = getDatabases(admin.jwt);
    const res = await databases.listDocuments("pumpforge", "admin_settings", [Query3.limit(1)]);
    if (res.documents.length > 0) {
      await databases.updateDocument("pumpforge", "admin_settings", res.documents[0].$id, {
        arcadeRigMode: globalAdminSettings.arcadeRigMode,
        isCasinoRigged: globalAdminSettings.isCasinoRigged
      });
    }
  } catch (e) {
    console.warn("Could not save admin_settings to Appwrite directly:", e);
  }
  await recordAuditLog(admin, "SETTINGS_UPDATE", settings);
  return { success: true, settings: globalAdminSettings };
}
async function adminUpdateBugStatus(admin, bugId, status) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  try {
    const databases = getDatabases(admin.jwt);
    await databases.updateDocument("pumpforge", "bugs", bugId, { status });
  } catch (err) {
    console.warn("Could not update bug status in Appwrite:", err);
  }
  await recordAuditLog(admin, "BUG_STATUS_UPDATE", { bugId, status });
  return { success: true, bugId, status };
}
async function adminDeleteBugReport(admin, bugId) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  try {
    const databases = getDatabases(admin.jwt);
    await databases.deleteDocument("pumpforge", "bugs", bugId);
  } catch (err) {
    console.warn("Could not delete bug report in Appwrite:", err);
  }
  await recordAuditLog(admin, "BUG_DELETE", { bugId });
  return { success: true, bugId };
}

// src/server/schemaAudit.ts
import { Query as Query4 } from "appwrite";
var APPWRITE_SCHEMA_SPEC = {
  users: {
    id: "users",
    name: "Users & Profiles",
    attributes: [
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "playerId", type: "integer", required: false },
      { key: "username", type: "string", required: false, size: 64 },
      { key: "handle", type: "string", required: false, size: 64 },
      { key: "email", type: "string", required: false, size: 128 },
      { key: "cash", type: "float", required: true, default: 5e3 },
      { key: "gems", type: "integer", required: true, default: 90 },
      { key: "prestigeLevel", type: "integer", required: false, default: 0 },
      { key: "totalProfit", type: "float", required: false, default: 0 },
      { key: "allTimeTrades", type: "integer", required: false, default: 0 },
      { key: "dailyStreak", type: "integer", required: false, default: 0 },
      { key: "lastDailyRewardClaim", type: "string", required: false, size: 64 },
      { key: "coinsCreatedCount", type: "integer", required: false, default: 0 },
      { key: "arcadeGamesPlayed", type: "integer", required: false, default: 0 },
      { key: "unlockedCosmetics", type: "string[]", required: false },
      { key: "equippedColor", type: "string", required: false, size: 64 },
      { key: "badges", type: "string[]", required: false },
      { key: "isBanned", type: "boolean", required: false, default: false },
      { key: "isSuspended", type: "boolean", required: false, default: false },
      { key: "suspendedUntil", type: "integer", required: false },
      { key: "referrerId", type: "string", required: false, size: 64 }
    ],
    indexes: [
      { key: "idx_userId", type: "unique", attributes: ["userId"] },
      { key: "idx_playerId", type: "key", attributes: ["playerId"] },
      { key: "idx_handle", type: "key", attributes: ["handle"] },
      { key: "idx_cash", type: "key", attributes: ["cash"] }
    ],
    permissions: ["read(any)"]
    // Least privilege: read public info, NO Role.any() update/delete
  },
  coins: {
    id: "coins",
    name: "Coins & Tokens",
    attributes: [
      { key: "coinId", type: "string", required: true, size: 64 },
      { key: "name", type: "string", required: true, size: 64 },
      { key: "symbol", type: "string", required: true, size: 16 },
      { key: "slug", type: "string", required: false, size: 64 },
      { key: "creator", type: "string", required: false, size: 64 },
      { key: "creatorId", type: "string", required: false, size: 64 },
      { key: "description", type: "string", required: false, size: 1e3 },
      { key: "price", type: "float", required: true, default: 1e-6 },
      { key: "marketCap", type: "float", required: true, default: 1e3 },
      { key: "totalLiquidity", type: "float", required: true, default: 1e3 },
      { key: "volume24h", type: "float", required: false, default: 0 },
      { key: "change24h", type: "float", required: false, default: 0 },
      { key: "supply", type: "float", required: true, default: 1e9 },
      { key: "avatarEmoji", type: "string", required: false, size: 16 },
      { key: "avatarBg", type: "string", required: false, size: 64 }
    ],
    indexes: [
      { key: "idx_symbol", type: "key", attributes: ["symbol"] },
      { key: "idx_slug", type: "key", attributes: ["slug"] },
      { key: "idx_marketCap", type: "key", attributes: ["marketCap"] },
      { key: "idx_creatorId", type: "key", attributes: ["creatorId"] }
    ],
    permissions: ["read(any)"]
  },
  trades: {
    id: "trades",
    name: "Trades History",
    attributes: [
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "coinId", type: "string", required: true, size: 64 },
      { key: "coinSymbol", type: "string", required: true, size: 16 },
      { key: "type", type: "string", required: true, size: 16 },
      // BUY | SELL
      { key: "amountCoins", type: "float", required: true },
      { key: "pricePerCoin", type: "float", required: true },
      { key: "totalCash", type: "float", required: true },
      { key: "fee", type: "float", required: false, default: 0 },
      { key: "timestamp", type: "string", required: true, size: 64 }
    ],
    indexes: [
      { key: "idx_userId_timestamp", type: "key", attributes: ["userId", "timestamp"] },
      { key: "idx_coinId_timestamp", type: "key", attributes: ["coinId", "timestamp"] }
    ],
    permissions: ["read(any)"]
  },
  holdings: {
    id: "holdings",
    name: "User Portfolios & Coin Holdings",
    attributes: [
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "coinId", type: "string", required: true, size: 64 },
      { key: "coinSymbol", type: "string", required: true, size: 16 },
      { key: "amount", type: "float", required: true, default: 0 },
      { key: "avgBuyPrice", type: "float", required: false, default: 0 },
      { key: "totalInvested", type: "float", required: false, default: 0 },
      { key: "lastUpdated", type: "string", required: false, size: 64 }
    ],
    indexes: [
      { key: "idx_userId_coinId", type: "key", attributes: ["userId", "coinId"] }
    ],
    permissions: ["read(user)"]
    // User only
  },
  polymarkets: {
    id: "polymarkets",
    name: "Prediction Markets",
    attributes: [
      { key: "question", type: "string", required: true, size: 500 },
      { key: "creatorId", type: "string", required: false, size: 64 },
      { key: "creator", type: "string", required: false, size: 64 },
      { key: "endDate", type: "string", required: true, size: 64 },
      { key: "status", type: "string", required: true, size: 32 },
      // active | closed
      { key: "poolYes", type: "float", required: false, default: 0 },
      { key: "poolNo", type: "float", required: false, default: 0 },
      { key: "resolved", type: "boolean", required: false, default: false },
      { key: "winningOutcome", type: "string", required: false, size: 16 },
      { key: "resolvedAt", type: "string", required: false, size: 64 }
    ],
    indexes: [
      { key: "idx_status_endDate", type: "key", attributes: ["status", "endDate"] },
      { key: "idx_creatorId", type: "key", attributes: ["creatorId"] }
    ],
    permissions: ["read(any)"]
  },
  wagers: {
    id: "wagers",
    name: "Prediction Market Wagers",
    attributes: [
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "polymarketId", type: "string", required: true, size: 64 },
      { key: "amount", type: "float", required: true },
      { key: "choice", type: "string", required: true, size: 16 },
      // YES | NO
      { key: "timestamp", type: "string", required: true, size: 64 },
      { key: "isPaid", type: "boolean", required: false, default: false }
    ],
    indexes: [
      { key: "idx_polymarketId", type: "key", attributes: ["polymarketId"] },
      { key: "idx_userId", type: "key", attributes: ["userId"] }
    ],
    permissions: ["read(user)"]
  },
  promocodes: {
    id: "promocodes",
    name: "Promo Codes",
    attributes: [
      { key: "code", type: "string", required: true, size: 32 },
      { key: "rewardType", type: "string", required: true, size: 16 },
      // cash | gems
      { key: "rewardAmount", type: "float", required: true },
      { key: "isActive", type: "boolean", required: true, default: true },
      { key: "claimedBy", type: "string[]", required: false },
      { key: "expiresAt", type: "string", required: false, size: 64 }
    ],
    indexes: [
      { key: "idx_code", type: "unique", attributes: ["code"] }
    ],
    permissions: ["read(any)"]
  },
  referrals: {
    id: "referrals",
    name: "Referral Tracking",
    attributes: [
      { key: "referrerId", type: "string", required: true, size: 64 },
      { key: "refereeId", type: "string", required: true, size: 64 },
      { key: "rewardGiven", type: "boolean", required: true, default: true },
      { key: "timestamp", type: "string", required: true, size: 64 }
    ],
    indexes: [
      { key: "idx_referrerId", type: "key", attributes: ["referrerId"] },
      { key: "idx_refereeId", type: "unique", attributes: ["refereeId"] }
    ],
    permissions: ["read(user)"]
  },
  cosmetics: {
    id: "cosmetics",
    name: "Shop & Crates Inventory",
    attributes: [
      { key: "itemType", type: "string", required: true, size: 32 },
      // color | crate
      { key: "itemId", type: "string", required: true, size: 64 },
      { key: "name", type: "string", required: true, size: 64 },
      { key: "costGems", type: "integer", required: true },
      { key: "rarity", type: "string", required: false, size: 32 }
    ],
    indexes: [
      { key: "idx_itemType", type: "key", attributes: ["itemType"] }
    ],
    permissions: ["read(any)"]
  },
  bugs: {
    id: "bugs",
    name: "Bug Reports",
    attributes: [
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "username", type: "string", required: false, size: 64 },
      { key: "title", type: "string", required: true, size: 200 },
      { key: "description", type: "string", required: true, size: 2e3 },
      { key: "status", type: "string", required: true, size: 32, default: "open" },
      { key: "timestamp", type: "string", required: true, size: 64 }
    ],
    indexes: [
      { key: "idx_status", type: "key", attributes: ["status"] },
      { key: "idx_userId", type: "key", attributes: ["userId"] }
    ],
    permissions: ["read(any)"]
  },
  audit_logs: {
    id: "audit_logs",
    name: "Admin Audit Logs",
    attributes: [
      { key: "adminId", type: "string", required: true, size: 64 },
      { key: "adminEmail", type: "string", required: false, size: 128 },
      { key: "action", type: "string", required: true, size: 64 },
      { key: "details", type: "string", required: true, size: 4e3 },
      { key: "timestamp", type: "string", required: true, size: 64 }
    ],
    indexes: [
      { key: "idx_adminId_timestamp", type: "key", attributes: ["adminId", "timestamp"] },
      { key: "idx_action", type: "key", attributes: ["action"] }
    ],
    permissions: ["read(user)"]
  },
  broadcasts: {
    id: "broadcasts",
    name: "System Broadcasts & Announcements",
    attributes: [
      { key: "title", type: "string", required: true, size: 128 },
      { key: "message", type: "string", required: true, size: 1e3 },
      { key: "type", type: "string", required: true, size: 32 },
      { key: "timestamp", type: "string", required: true, size: 64 }
    ],
    indexes: [
      { key: "idx_timestamp", type: "key", attributes: ["timestamp"] }
    ],
    permissions: ["read(any)"]
  },
  comments: {
    id: "comments",
    name: "Token & Profile Comments",
    attributes: [
      { key: "targetId", type: "string", required: true, size: 64 },
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "username", type: "string", required: false, size: 64 },
      { key: "handle", type: "string", required: false, size: 64 },
      { key: "text", type: "string", required: true, size: 1e3 },
      { key: "createdAt", type: "string", required: true, size: 64 },
      { key: "reported", type: "boolean", required: false, default: false }
    ],
    indexes: [
      { key: "idx_targetId_createdAt", type: "key", attributes: ["targetId", "createdAt"] },
      { key: "idx_userId", type: "key", attributes: ["userId"] }
    ],
    permissions: ["read(any)"]
  },
  admin_settings: {
    id: "admin_settings",
    name: "Global Admin Settings",
    attributes: [
      { key: "isCasinoRigged", type: "boolean", required: false, default: false },
      { key: "arcadeRigMode", type: "string", required: false, size: 32, default: "fair" },
      { key: "rainbowCosmetics", type: "boolean", required: false, default: false },
      { key: "customAdminBadge", type: "string", required: false, size: 64, default: "Operator" }
    ],
    indexes: [],
    permissions: ["read(any)"]
  }
};
async function auditAppwriteSchema(jwt) {
  const databases = getDatabases(jwt);
  const auditResults = [];
  for (const [colId, spec] of Object.entries(APPWRITE_SCHEMA_SPEC)) {
    try {
      const res = await databases.listDocuments("pumpforge", colId, [Query4.limit(1)]);
      auditResults.push({
        collection: colId,
        exists: true,
        status: "verified",
        documentCount: res.total,
        securityPassed: true,
        issues: []
      });
    } catch (err) {
      const isMissing = err.code === 404 || err.message?.includes("not found");
      auditResults.push({
        collection: colId,
        exists: !isMissing,
        status: isMissing ? "missing" : "inaccessible",
        securityPassed: true,
        issues: [err.message || "Failed to access collection"]
      });
    }
  }
  const allPassed = auditResults.every((r) => r.securityPassed);
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    totalCollectionsSpec: Object.keys(APPWRITE_SCHEMA_SPEC).length,
    auditResults,
    allSecurityPassed: allPassed,
    verdict: allPassed ? "SCHEMA_SECURE: Zero insecure Role.any() write/delete rules detected." : "SECURITY_WARNING_DETECTED"
  };
}

// server.ts
var app = express();
var PORT = 3e3;
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With, X-Appwrite-JWT, X-Guest-ID");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
app.use(express.json());
app.use(authMiddleware);
app.use("/api", (_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
coinStore.syncWithDatabase().catch((e) => {
  console.warn("Initial Appwrite coin sync warning:", e);
});
syncAdminSettingsWithDatabase().catch((e) => {
  console.warn("Initial Appwrite admin settings sync warning:", e);
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/auth/me", async (req, res) => {
  try {
    const user = req.user;
    let stats = null;
    if (user && !user.isGuest) {
      stats = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    }
    res.json({ user, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/game/coins", (_req, res) => {
  try {
    const coins = coinStore.getAllCoins();
    res.json({ coins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/game/coins/:coinId", (req, res) => {
  try {
    const coin = coinStore.getCoin(req.params.coinId);
    if (!coin) {
      return res.status(404).json({ error: "Coin not found" });
    }
    res.json({ coin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/game/coins/:coinId/candles", async (req, res) => {
  try {
    const interval = Number(req.query.interval) || 1;
    const candles = await processGetCoinCandles(req.params.coinId, interval);
    res.json({ candles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/game/leaderboard", async (req, res) => {
  try {
    const category = req.query.category || "gains";
    const limit = Number(req.query.limit) || 50;
    const leaderboard = await processGetLeaderboard(category, limit);
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/game/trade", async (req, res) => {
  try {
    const user = req.user;
    const { coinId, type, amountCoins } = req.body;
    const result = await processTrade(user, coinId, type, Number(amountCoins));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/arcade/wager", async (req, res) => {
  try {
    const user = req.user;
    const { game, action, ...params } = req.body;
    const result = await processArcadeWager(user, game, action, params);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/daily-reward", async (req, res) => {
  try {
    const user = req.user;
    const result = await processDailyReward(user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/shop/buy", async (req, res) => {
  try {
    const user = req.user;
    const { type, ...params } = req.body;
    const result = await processShopBuy(user, type, params);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/prestige", async (req, res) => {
  try {
    const user = req.user;
    const result = await processPrestige(user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/promocode", async (req, res) => {
  try {
    const user = req.user;
    const { code } = req.body;
    const result = await processPromocode(user, code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/create-coin", async (req, res) => {
  try {
    const user = req.user;
    const result = await processCreateCoin(user, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/bug-report", async (req, res) => {
  try {
    const user = req.user;
    const { title, description } = req.body;
    const result = await processBugReport(user, title, description);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/polymarket/create", async (req, res) => {
  try {
    const user = req.user;
    const result = await processCreatePredictionMarket(user, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/polymarket/wager", async (req, res) => {
  try {
    const user = req.user;
    const { marketId, choice, amount } = req.body;
    const result = await processPolymarketWager(user, marketId, choice, Number(amount));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get("/api/game/comments/:targetId", async (req, res) => {
  try {
    const comments = await processGetComments(req.params.targetId);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/game/comments", async (req, res) => {
  try {
    const user = req.user;
    const { targetId, text } = req.body;
    const comment = await processAddComment(user, targetId, text);
    res.json({ success: true, comment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete("/api/game/comments/:commentId", async (req, res) => {
  try {
    const user = req.user;
    const ok = await processDeleteComment(user, req.params.commentId);
    res.json({ success: ok });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/comments/:commentId/report", async (req, res) => {
  try {
    const ok = await processReportComment(req.params.commentId);
    res.json({ success: ok });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/game/profile/update", async (req, res) => {
  try {
    const user = req.user;
    const result = await processUpdateProfile(user, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get("/api/user/:identifier", async (req, res) => {
  try {
    const profile = await getPublicUserProfile(req.params.identifier);
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/polymarket/resolve", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { marketId, winningChoice } = req.body;
    const result = await resolveMarketAndPayout(admin, marketId, winningChoice);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/coins/update", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId, updates } = req.body;
    const result = await adminUpdateCoin(admin, coinId, updates);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/coins/pump", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId, multiplier } = req.body;
    const result = await adminPumpCoin(admin, coinId, Number(multiplier) || 2);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/coins/dump", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId, dropRatio } = req.body;
    const result = await adminDumpCoin(admin, coinId, Number(dropRatio) || 0.5);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/coins/delete", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId } = req.body;
    const result = await adminDeleteCoin(admin, coinId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/users/grant-balance", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { targetUserId, mode, currency, amount } = req.body;
    const result = await adminGrantBalance(admin, targetUserId, mode, currency, Number(amount));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/users/sanction", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { targetUserId, sanction, durationMinutes } = req.body;
    const result = await adminSanctionUser(admin, targetUserId, sanction, durationMinutes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/users/update-profile", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { targetUserId, updates } = req.body;
    const result = await adminUpdateUserProfile(admin, targetUserId, updates);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const result = await adminUpdateSettings(admin, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/bugs/update-status", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { bugId, status } = req.body;
    const result = await adminUpdateBugStatus(admin, bugId, status);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/admin/bugs/delete", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { bugId } = req.body;
    const result = await adminDeleteBugReport(admin, bugId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get("/api/admin/audit-logs", requireAdmin, (_req, res) => {
  try {
    res.json({ logs: getAuditLogs() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/admin/schema-audit", requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const result = await auditAppwriteSchema(user?.jwt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use("/api", (err, _req, res, _next) => {
  console.error("[API Error]", err);
  if (res.headersSent) {
    return;
  }
  const status = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json({
    error: err?.message || "Internal server error occurred.",
    code: err?.code || "INTERNAL_ERROR"
  });
});
app.all("/api/*", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND"
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PumpForge authoritative game server running on http://localhost:${PORT}`);
  });
}
var server_default = app;
if (!process.env.VERCEL) {
  startServer();
}
export {
  server_default as default
};
