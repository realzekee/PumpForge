import express from "express";
import path from "path";
import { authMiddleware, requireAdmin, requireAuth } from "./src/server/auth";
import {
  processDailyReward,
  processTrade,
  processArcadeWager,
  processShopBuy,
  processPrestige,
  processPromocode,
  processCreateCoin,
  processBugReport,
  processPolymarketWager,
  processCreatePredictionMarket,
  processAddComment,
  processGetComments,
  processDeleteComment,
  processReportComment,
  processUpdateProfile,
  processGetCoinCandles,
  processGetLeaderboard,
  getUserWagers,
} from "./src/server/gameEngine";
import {
  resolveMarketAndPayout,
  adminUpdateCoin,
  adminPumpCoin,
  adminDumpCoin,
  adminDeleteCoin,
  adminGrantBalance,
  adminSanctionUser,
  adminUpdateUserProfile,
  adminUpdateSettings,
  adminUpdateBugStatus,
  adminDeleteBugReport,
  adminGetBugs,
  adminCreateBroadcast,
  adminDeleteBroadcast,
  adminCreatePromoCode,
  getAuditLogs,
} from "./src/server/adminEngine";
import {
  coinStore,
  getAuthoritativeUser,
  getPublicUserProfile,
  syncAdminSettingsWithDatabase,
  globalAdminSettings,
  getAllUsersList,
  getBroadcastsList,
} from "./src/server/db";
import { auditAppwriteSchema } from "./src/server/schemaAudit";
import { processCoinflip } from "./src/server/arcadeEngine";

const app = express();
const PORT = 3000;

// CORS & Preflight handling for all environments (Local, Cloud Run, Vercel, Iframe)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With, X-Appwrite-JWT, X-Guest-ID");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use((req, _res, next) => {
  if (req.body !== undefined && req.body !== null) {
    (req as any)._body = true;
    if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
      try {
        req.body = JSON.parse(req.body);
      } catch (_) {}
    }
  }
  next();
});

app.use(express.json());

// Normalize URLs when running on Vercel Serverless or behind reverse proxies
app.use((req, _res, next) => {
  let url = req.url || "/";
  const [pathname, searchStr] = url.split("?");
  const search = searchStr ? `?${searchStr}` : "";

  // 1. Check explicit query parameter path or __path injected by vercel.json rewrite
  try {
    const rawUrl = req.url || "/";
    if (rawUrl.includes("path=") || rawUrl.includes("__path=")) {
      const match = rawUrl.match(/(?:__)?path=([^&]+)/);
      if (match && match[1]) {
        const cleanSub = decodeURIComponent(match[1]).replace(/^\/+/, "");
        req.url = cleanSub.startsWith("api/") ? `/${cleanSub}` : `/api/${cleanSub}`;
        return next();
      }
    }
  } catch (_) {}

  // 2. Strip /api/index.js, /api/index.ts, /api/index prefix
  if (pathname.startsWith("/api/index.js") || pathname.startsWith("/api/index.ts") || pathname.startsWith("/api/index")) {
    const prefix = pathname.startsWith("/api/index.js")
      ? "/api/index.js"
      : pathname.startsWith("/api/index.ts")
      ? "/api/index.ts"
      : "/api/index";
    const remainder = pathname.slice(prefix.length).replace(/^\/+/, "");
    if (remainder.length > 0) {
      req.url = `/api/${remainder}${search}`;
      return next();
    }
  }

  // 3. Check x-now-route-matches header (standard Vercel header for rewrites)
  const nowRouteMatches = req.headers["x-now-route-matches"] as string;
  if (nowRouteMatches && (pathname === "/api" || pathname === "/api/" || pathname === "/api/index" || pathname === "/" || pathname === "/api/index.js")) {
    try {
      const match = String(nowRouteMatches).match(/1=([^&]+)/);
      if (match && match[1]) {
        const subPath = decodeURIComponent(match[1]).replace(/^\/+/, "");
        req.url = subPath.startsWith("api/") ? `/${subPath}${search}` : `/api/${subPath}${search}`;
        return next();
      }
    } catch (_) {}
  }

  // 4. Check x-matched-path header
  const matchedPath = (req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"]) as string;
  if (typeof matchedPath === "string" && matchedPath.startsWith("/api/") && !matchedPath.startsWith("/api/index")) {
    req.url = `${matchedPath}${search}`;
    return next();
  }

  // 5. Prepend /api only if original path targets a known game or admin endpoint
  if (
    !pathname.startsWith("/api") &&
    (pathname.startsWith("/game") ||
      pathname.startsWith("/arcade") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/health"))
  ) {
    req.url = `/api${pathname.startsWith("/") ? "" : "/"}${pathname}${search}`;
    return next();
  }

  next();
});

app.use(authMiddleware);

// 1. Mandatory JSON Content-Type and Cache-Control headers on all API responses
app.use("/api", (_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Root /api and health endpoints
app.get("/api", (_req, res) => {
  res.json({ status: "ok", message: "PumpForge API Gateway Operational", timestamp: new Date().toISOString() });
});

// Sync coins and settings with Appwrite at startup
coinStore.syncWithDatabase().catch((e) => {
  console.warn("Initial Appwrite coin sync warning:", e);
});
syncAdminSettingsWithDatabase().catch((e) => {
  console.warn("Initial Appwrite admin settings sync warning:", e);
});

function safeErrorString(err: any, fallback = "Internal server error"): string {
  if (!err) return fallback;
  if (typeof err === "string") {
    const trimmed = err.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.toLowerCase().includes("object error")) return trimmed;
  }
  if (typeof err?.message === "string") {
    const trimmed = err.message.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.toLowerCase().includes("object error")) return trimmed;
  }
  if (typeof err?.error === "string") {
    const trimmed = err.error.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.toLowerCase().includes("object error")) return trimmed;
  }
  if (typeof err?.description === "string") {
    const trimmed = err.description.trim();
    if (trimmed && trimmed !== "[object Object]" && !trimmed.toLowerCase().includes("object error")) return trimmed;
  }
  return fallback;
}

function sendError(res: express.Response, status: number, err: any, fallback = "Request failed") {
  const message = safeErrorString(err, fallback);
  return res.status(status).json({ error: message, message });
}

  // ==========================================
  // --- HEALTH & AUTH ROUTES ---
  // ==========================================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = (req as any).user;
      let stats = null;
      if (user && !user.isGuest) {
        stats = await getAuthoritativeUser(user.userId, user.jwt, user.name);
      }
      res.json({ user, stats });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load user session.");
    }
  });

  app.post("/api/auth/email-login", async (req, res) => {
    try {
      const { email, password, name } = req.body || {};
      const cleanEmail = String(email || "").toLowerCase().trim();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        return res.status(400).json({ error: "Valid email address is required.", message: "Valid email address is required." });
      }

      const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanEmail === "realzekee@gmail.com";
      const uId = isOwner ? "admin_realzekeee" : "u_" + Buffer.from(cleanEmail).toString("hex").substring(0, 16);
      const displayName = isOwner ? "Zeke (Owner)" : (name || cleanEmail.split("@")[0] || "Player");

      const b64Data = Buffer.from(JSON.stringify({ email: cleanEmail, name: displayName })).toString("base64");
      const token = isOwner
        ? "pf_owner_realzekeee_" + Buffer.from(cleanEmail).toString("base64")
        : `pf_user_${uId}_${b64Data}`;

      const user = {
        userId: uId,
        email: cleanEmail,
        name: displayName,
        isAdmin: isOwner,
        isGuest: false,
        jwt: token,
      };

      const stats = await getAuthoritativeUser(user.userId, undefined, displayName);
      if (isOwner) {
        if (stats.cash < 100000) stats.cash = 100000;
        if (stats.gems < 5000) stats.gems = 5000;
        stats.title = "Founder & Owner";
        stats.isPremium = true;
      }

      res.json({
        success: true,
        token,
        user,
        stats,
      });
    } catch (err: any) {
      sendError(res, 500, err, "Email authentication failed.");
    }
  });

  app.post("/api/auth/quick-login", async (req, res) => {
    try {
      const { username, email } = req.body || {};
      const cleanUsername = String(username || "Player").trim().slice(0, 30);
      const cleanEmail = email ? String(email).toLowerCase().trim() : "";

      const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanUsername.toLowerCase() === "zeke";
      const uId = isOwner ? "admin_realzekeee" : "u_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const b64Data = Buffer.from(JSON.stringify({ email: cleanEmail, name: cleanUsername })).toString("base64");
      const token = isOwner
        ? "pf_owner_realzekeee_" + Buffer.from("realzekeee@gmail.com").toString("base64")
        : `pf_user_${uId}_${b64Data}`;

      const user = {
        userId: uId,
        email: cleanEmail,
        name: cleanUsername,
        isAdmin: isOwner,
        isGuest: false,
        jwt: token,
      };

      const stats = await getAuthoritativeUser(user.userId, undefined, cleanUsername);
      if (isOwner) {
        if (stats.cash < 100000) stats.cash = 100000;
        if (stats.gems < 5000) stats.gems = 5000;
        stats.title = "Founder & Owner";
        stats.isPremium = true;
      }

      res.json({
        success: true,
        token,
        user,
        stats,
      });
    } catch (err: any) {
      sendError(res, 500, err, "Quick login failed.");
    }
  });

  app.post("/api/auth/oauth-callback", async (req, res) => {
    try {
      const { userId, secret, email, name } = req.body || {};
      const uId = String(userId || "").trim();
      if (!uId) {
        return res.status(400).json({ error: "Missing userId for OAuth verification." });
      }

      const cleanEmail = String(email || "").toLowerCase().trim();
      const userName = String(name || "").trim() || (cleanEmail ? cleanEmail.split("@")[0] : "Player");
      const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanEmail === "realzekee@gmail.com";
      const displayName = isOwner ? "Zeke (Owner)" : userName;

      const b64Data = Buffer.from(JSON.stringify({ email: cleanEmail, name: displayName })).toString("base64");
      const token = `pf_user_${uId}_${b64Data}`;

      const user = {
        userId: uId,
        email: cleanEmail,
        name: displayName,
        isAdmin: isOwner,
        isGuest: false,
        jwt: token,
      };

      const stats = await getAuthoritativeUser(user.userId, undefined, displayName);
      if (isOwner) {
        if (stats.cash < 100000) stats.cash = 100000;
        if (stats.gems < 5000) stats.gems = 5000;
        stats.title = "Founder & Owner";
        stats.isPremium = true;
      }

      res.json({
        success: true,
        token,
        user,
        stats,
      });
    } catch (err: any) {
      sendError(res, 500, err, "OAuth callback processing failed.");
    }
  });

  app.get("/api/game/broadcasts", async (req, res) => {
    try {
      const jwt = (req as any).user?.jwt;
      const broadcasts = await getBroadcastsList(jwt);
      res.json({ broadcasts });
    } catch (err: any) {
      res.json({ broadcasts: [] });
    }
  });

  // ==========================================
  // --- AUTHORITATIVE COIN & MARKET ROUTES ---
  // ==========================================
  app.get("/api/game/coins", (_req, res) => {
    try {
      const coins = coinStore.getAllCoins();
      res.json({ coins });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load coins.");
    }
  });

  app.get("/api/game/coins/:coinId", (req, res) => {
    try {
      const coin = coinStore.getCoin(req.params.coinId);
      if (!coin) {
        return res.status(404).json({ error: "Coin not found", message: "Coin not found" });
      }
      res.json({ coin });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load coin.");
    }
  });

  app.get("/api/game/coins/:coinId/candles", async (req, res) => {
    try {
      const interval = Number(req.query.interval) || 1;
      const candles = await processGetCoinCandles(req.params.coinId, interval);
      res.json({ candles });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load chart data.");
    }
  });

  app.get("/api/game/leaderboard", async (req, res) => {
    try {
      const category = (req.query.category as string) || "gains";
      const limit = Number(req.query.limit) || 50;
      const leaderboard = await processGetLeaderboard(category, limit);
      res.json({ leaderboard });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load leaderboard.");
    }
  });

  app.post("/api/game/trade", async (req, res) => {
    try {
      const user = (req as any).user;
      const coinId = req.body.coinId;
      const type = req.body.type;
      const rawAmt = req.body.amountCoins !== undefined ? req.body.amountCoins : req.body.amount;
      const amountCoins = Number(rawAmt);
      const result = await processTrade(user, coinId, type, amountCoins);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Trade execution failed.");
    }
  });

  // ==========================================
  // --- AUTHORITATIVE ARCADE & GAMING ---
  // ==========================================
  // Dedicated Coinflip route (Zero-Trust Authoritative via node-appwrite)
  app.post("/api/arcade/coinflip", async (req, res) => {
    try {
      const user = (req as any).user;
      const rawBet = req.body.betAmount !== undefined ? req.body.betAmount : req.body.bet;
      const betAmount = Number(rawBet);
      const side = req.body.side || req.body.choice || "heads";

      const result = await processCoinflip(user, betAmount, side);
      res.json(result);
    } catch (err: any) {
      const errorMsg =
        typeof err?.message === "string" && err.message.trim() !== "[object Object]"
          ? err.message
          : typeof err === "string"
          ? err
          : "Failed to process coinflip wager.";
      res.status(400).json({ error: errorMsg });
    }
  });

  app.post("/api/game/arcade/wager", async (req, res) => {
    try {
      const user = (req as any).user;
      const { game, action, ...params } = req.body;
      const result = await processArcadeWager(user, game, action, params);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Arcade wager failed.");
    }
  });

  app.post("/api/game/daily-reward", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processDailyReward(user);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Daily reward claim failed.");
    }
  });

  app.post("/api/game/shop/buy", async (req, res) => {
    try {
      const user = (req as any).user;
      const { type, ...params } = req.body;
      const result = await processShopBuy(user, type, params);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Purchase transaction failed.");
    }
  });

  app.post("/api/game/prestige", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processPrestige(user);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Prestige process failed.");
    }
  });

  app.post("/api/game/promocode", async (req, res) => {
    try {
      const user = (req as any).user;
      const { code } = req.body;
      const result = await processPromocode(user, code);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Promo code redemption failed.");
    }
  });

  app.post("/api/game/create-coin", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processCreateCoin(user, req.body);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Coin creation failed.");
    }
  });

  app.post("/api/game/bug-report", async (req, res) => {
    try {
      const user = (req as any).user;
      const { title, description } = req.body;
      const result = await processBugReport(user, title, description);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Bug report submission failed.");
    }
  });

  app.post("/api/game/polymarket/create", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processCreatePredictionMarket(user, req.body);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Market creation failed.");
    }
  });

  app.post("/api/game/polymarket/wager", async (req, res) => {
    try {
      const user = (req as any).user;
      const { marketId, choice, amount } = req.body;
      const result = await processPolymarketWager(user, marketId, choice, Number(amount));
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Market wager failed.");
    }
  });

  app.get("/api/game/wagers", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await getUserWagers(user);
      res.json(result);
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load wagers.");
    }
  });

  app.get("/api/game/settings", (_req, res) => {
    try {
      res.json({
        arcadeRigMode: globalAdminSettings.arcadeRigMode || "fair",
        isCasinoRigged: globalAdminSettings.isCasinoRigged || false,
        rainbowCosmetics: (globalAdminSettings as any).rainbowCosmetics || false,
        customAdminBadge: (globalAdminSettings as any).customAdminBadge || "Operator",
      });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load settings.");
    }
  });

  // ==========================================
  // --- COMMENTS & COMMUNITY ROUTES ---
  // ==========================================
  app.get("/api/game/comments/:targetId", async (req, res) => {
    try {
      const comments = await processGetComments(req.params.targetId);
      res.json({ comments });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load comments.");
    }
  });

  app.post("/api/game/comments", async (req, res) => {
    try {
      const user = (req as any).user;
      const { targetId, text } = req.body;
      const comment = await processAddComment(user, targetId, text);
      res.json({ success: true, comment });
    } catch (err: any) {
      sendError(res, 400, err, "Failed to post comment.");
    }
  });

  app.delete("/api/game/comments/:commentId", async (req, res) => {
    try {
      const user = (req as any).user;
      const ok = await processDeleteComment(user, req.params.commentId);
      res.json({ success: ok });
    } catch (err: any) {
      sendError(res, 400, err, "Failed to delete comment.");
    }
  });

  app.post("/api/game/comments/:commentId/report", async (req, res) => {
    try {
      const ok = await processReportComment(req.params.commentId);
      res.json({ success: ok });
    } catch (err: any) {
      sendError(res, 400, err, "Failed to report comment.");
    }
  });

  app.post("/api/game/profile/update", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processUpdateProfile(user, req.body);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Profile update failed.");
    }
  });

  // ==========================================
  // --- PUBLIC USER PROFILES (SAFE & SANITIZED) ---
  // ==========================================
  app.get("/api/user/:identifier", async (req, res) => {
    try {
      const profile = await getPublicUserProfile(req.params.identifier);
      if (!profile) {
        return res.status(404).json({ error: "User not found", message: "User not found" });
      }
      res.json(profile);
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load user profile.");
    }
  });

  // ==========================================
  // --- SERVER-AUTHORITATIVE ADMIN ROUTES ---
  // ==========================================
  app.post("/api/admin/polymarket/resolve", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { marketId, winningChoice } = req.body;
      const result = await resolveMarketAndPayout(admin, marketId, winningChoice);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Market resolution failed.");
    }
  });

  app.post("/api/admin/coins/update", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId, updates } = req.body;
      const result = await adminUpdateCoin(admin, coinId, updates);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Coin update failed.");
    }
  });

  app.post("/api/admin/coins/pump", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId, multiplier } = req.body;
      const result = await adminPumpCoin(admin, coinId, Number(multiplier) || 2.0);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Pump action failed.");
    }
  });

  app.post("/api/admin/coins/dump", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId, dropRatio } = req.body;
      const result = await adminDumpCoin(admin, coinId, Number(dropRatio) || 0.5);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Dump action failed.");
    }
  });

  app.post("/api/admin/coins/delete", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId } = req.body;
      const result = await adminDeleteCoin(admin, coinId);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Delete coin failed.");
    }
  });

  app.post("/api/admin/users/grant-balance", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { targetUserId, mode, currency, amount } = req.body;
      const result = await adminGrantBalance(admin, targetUserId, mode, currency, Number(amount));
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Balance grant failed.");
    }
  });

  app.post("/api/admin/users/sanction", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { targetUserId, sanction, durationMinutes } = req.body;
      const result = await adminSanctionUser(admin, targetUserId, sanction, durationMinutes);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Sanction failed.");
    }
  });

  app.post("/api/admin/users/update-profile", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { targetUserId, updates } = req.body;
      const result = await adminUpdateUserProfile(admin, targetUserId, updates);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Profile update failed.");
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminUpdateSettings(admin, req.body);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Settings update failed.");
    }
  });

  app.get("/api/admin/bugs", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminGetBugs(admin);
      res.json(result);
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load bugs.");
    }
  });

  app.post("/api/admin/bugs/update-status", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { bugId, status } = req.body;
      const result = await adminUpdateBugStatus(admin, bugId, status);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Status update failed.");
    }
  });

  app.post("/api/admin/bugs/delete", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { bugId } = req.body;
      const result = await adminDeleteBugReport(admin, bugId);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Delete bug failed.");
    }
  });

  app.post("/api/admin/broadcasts/create", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminCreateBroadcast(admin, req.body);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Broadcast creation failed.");
    }
  });

  app.post("/api/admin/broadcasts/delete", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { broadcastId } = req.body;
      const result = await adminDeleteBroadcast(admin, broadcastId);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Delete broadcast failed.");
    }
  });

  app.post("/api/admin/promocodes/create", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminCreatePromoCode(admin, req.body);
      res.json(result);
    } catch (err: any) {
      sendError(res, 400, err, "Promo code creation failed.");
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const jwt = (req as any).user?.jwt;
      const users = await getAllUsersList(jwt);
      res.json({ users });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load users list.");
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, (_req, res) => {
    try {
      res.json({ logs: getAuditLogs() });
    } catch (err: any) {
      sendError(res, 500, err, "Failed to load audit logs.");
    }
  });

  app.get("/api/admin/schema-audit", requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await auditAppwriteSchema(user?.jwt);
      res.json(result);
    } catch (err: any) {
      sendError(res, 500, err, "Schema audit failed.");
    }
  });

  // ==========================================
  // --- STRICT API ERROR & 404 CATCH-ALL ---
  // Guarantees that ALL /api requests return valid JSON, NEVER HTML error pages or SPA fallback.
  // ==========================================
  app.use("/api", (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API Error]", err);
    if (res.headersSent) {
      return;
    }
    const status =
      typeof err.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;

    const errMsg = safeErrorString(err, "Internal server error occurred.");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(status).json({
      error: errMsg,
      message: errMsg,
      code: err?.code || "INTERNAL_ERROR",
    });
  });

  app.all("/api/*", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const notFoundMsg = `API route not found: ${req.method} ${req.originalUrl || req.url}`;
    res.status(404).json({
      error: notFoundMsg,
      message: notFoundMsg,
      code: "NOT_FOUND",
    });
  });

  // ==========================================
  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  // ==========================================
  async function startServer() {
    if (process.env.NODE_ENV !== "production") {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (e) {
        console.warn("Vite middleware not loaded:", e);
      }
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

  export default app;

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY
  );

  if (!isServerless && typeof process.send !== "function" && process.env.NODE_ENV !== "test") {
    startServer().catch((err) => {
      console.error("PumpForge startup error:", err);
    });
  }
