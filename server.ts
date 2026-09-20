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
import { coinStore, getAuthoritativeUser, getPublicUserProfile, syncAdminSettingsWithDatabase, globalAdminSettings } from "./src/server/db";
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

app.use(express.json());

// Normalize URLs when running on Vercel Serverless or behind reverse proxies
app.use((req, _res, next) => {
  const matchedPath =
    (req.headers["x-matched-path"] as string) ||
    (req.headers["x-vercel-matched-path"] as string) ||
    (req.headers["x-invoke-path"] as string);

  if (matchedPath && matchedPath.startsWith("/api") && (req.url === "/api" || req.url === "/api/" || req.url === "/api/index")) {
    req.url = matchedPath;
  } else if (req.headers["x-now-route-matches"] && (req.url === "/api" || req.url === "/api/" || req.url === "/api/index")) {
    try {
      const match = String(req.headers["x-now-route-matches"]).match(/1=([^&]+)/);
      if (match && match[1]) {
        const subPath = decodeURIComponent(match[1]);
        req.url = `/api/${subPath.replace(/^\/+/, "")}`;
      }
    } catch (_) {}
  }

  // If request arrived without "/api" prefix (e.g. /game/arcade/wager), prepend /api
  if (!req.url.startsWith("/api") && !req.url.startsWith("/@") && !req.url.startsWith("/src")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
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

// Sync coins and settings with Appwrite at startup
coinStore.syncWithDatabase().catch((e) => {
  console.warn("Initial Appwrite coin sync warning:", e);
});
syncAdminSettingsWithDatabase().catch((e) => {
  console.warn("Initial Appwrite admin settings sync warning:", e);
});

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
      res.status(500).json({ error: err.message });
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/game/coins/:coinId/candles", async (req, res) => {
    try {
      const interval = Number(req.query.interval) || 1;
      const candles = await processGetCoinCandles(req.params.coinId, interval);
      res.json({ candles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/game/leaderboard", async (req, res) => {
    try {
      const category = (req.query.category as string) || "gains";
      const limit = Number(req.query.limit) || 50;
      const leaderboard = await processGetLeaderboard(category, limit);
      res.json({ leaderboard });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      res.status(400).json({ error: err.message });
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
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/daily-reward", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processDailyReward(user);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/shop/buy", async (req, res) => {
    try {
      const user = (req as any).user;
      const { type, ...params } = req.body;
      const result = await processShopBuy(user, type, params);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/prestige", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processPrestige(user);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/promocode", async (req, res) => {
    try {
      const user = (req as any).user;
      const { code } = req.body;
      const result = await processPromocode(user, code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/create-coin", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processCreateCoin(user, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/bug-report", async (req, res) => {
    try {
      const user = (req as any).user;
      const { title, description } = req.body;
      const result = await processBugReport(user, title, description);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/polymarket/create", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processCreatePredictionMarket(user, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/polymarket/wager", async (req, res) => {
    try {
      const user = (req as any).user;
      const { marketId, choice, amount } = req.body;
      const result = await processPolymarketWager(user, marketId, choice, Number(amount));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/game/wagers", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await getUserWagers(user);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/game/comments", async (req, res) => {
    try {
      const user = (req as any).user;
      const { targetId, text } = req.body;
      const comment = await processAddComment(user, targetId, text);
      res.json({ success: true, comment });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/game/comments/:commentId", async (req, res) => {
    try {
      const user = (req as any).user;
      const ok = await processDeleteComment(user, req.params.commentId);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/comments/:commentId/report", async (req, res) => {
    try {
      const ok = await processReportComment(req.params.commentId);
      res.json({ success: ok });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/game/profile/update", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await processUpdateProfile(user, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // --- PUBLIC USER PROFILES (SAFE & SANITIZED) ---
  // ==========================================
  app.get("/api/user/:identifier", async (req, res) => {
    try {
      const profile = await getPublicUserProfile(req.params.identifier);
      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/coins/update", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId, updates } = req.body;
      const result = await adminUpdateCoin(admin, coinId, updates);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/coins/pump", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId, multiplier } = req.body;
      const result = await adminPumpCoin(admin, coinId, Number(multiplier) || 2.0);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/coins/dump", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId, dropRatio } = req.body;
      const result = await adminDumpCoin(admin, coinId, Number(dropRatio) || 0.5);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/coins/delete", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { coinId } = req.body;
      const result = await adminDeleteCoin(admin, coinId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/users/grant-balance", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { targetUserId, mode, currency, amount } = req.body;
      const result = await adminGrantBalance(admin, targetUserId, mode, currency, Number(amount));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/users/sanction", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { targetUserId, sanction, durationMinutes } = req.body;
      const result = await adminSanctionUser(admin, targetUserId, sanction, durationMinutes);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/users/update-profile", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { targetUserId, updates } = req.body;
      const result = await adminUpdateUserProfile(admin, targetUserId, updates);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminUpdateSettings(admin, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/admin/bugs", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminGetBugs(admin);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/bugs/update-status", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { bugId, status } = req.body;
      const result = await adminUpdateBugStatus(admin, bugId, status);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/bugs/delete", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { bugId } = req.body;
      const result = await adminDeleteBugReport(admin, bugId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/broadcasts/create", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminCreateBroadcast(admin, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/broadcasts/delete", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const { broadcastId } = req.body;
      const result = await adminDeleteBroadcast(admin, broadcastId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/promocodes/create", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).user;
      const result = await adminCreatePromoCode(admin, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, (_req, res) => {
    try {
      res.json({ logs: getAuditLogs() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/schema-audit", requireAdmin, async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await auditAppwriteSchema(user?.jwt);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(status).json({
      error: err?.message || "Internal server error occurred.",
      code: err?.code || "INTERNAL_ERROR",
    });
  });

  app.all("/api/*", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`,
      code: "NOT_FOUND",
    });
  });

  // ==========================================
  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  // ==========================================
  async function startServer() {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
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

  export default app;

  if (!process.env.VERCEL) {
    startServer().catch((err) => {
      console.error("PumpForge startup error:", err);
    });
  }
