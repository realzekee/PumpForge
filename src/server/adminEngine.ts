import { getDatabases, coinStore, globalAdminSettings, getAuthoritativeUser, saveAuthoritativeUser } from "./db";
import { withMarketLock, withUserLock } from "./locks";
import { adminLimiter } from "./rateLimit";
import { AuthenticatedUser } from "./types";
import { Query, Permission, Role, ID } from "appwrite";

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  details: any;
  timestamp: string;
}

const auditLogsStore: AuditLogEntry[] = [];

export async function recordAuditLog(admin: AuthenticatedUser, action: string, details: any) {
  const entry: AuditLogEntry = {
    id: ID.unique(),
    adminId: admin.userId,
    adminEmail: admin.email,
    action,
    details,
    timestamp: new Date().toISOString(),
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
        timestamp: entry.timestamp,
      },
      [Permission.read(Role.user(admin.userId))]
    );
  } catch (err) {
    // Non-fatal if audit_logs collection not initialized yet
  }
}

export function getAuditLogs(): AuditLogEntry[] {
  return auditLogsStore;
}

// ----------------------------------------------------
// 1. POLYMARKET AUTHORITATIVE RESOLUTION & PAYOUTS
// ----------------------------------------------------
export async function resolveMarketAndPayout(
  admin: AuthenticatedUser,
  marketId: string,
  winningChoice: "YES" | "NO" | "CANCEL"
) {
  if (!admin.isAdmin) {
    throw new Error("Admin privileges required to resolve prediction markets.");
  }

  const { allowed, retryAfterMs } = adminLimiter.isAllowed(admin.userId);
  if (!allowed) {
    throw new Error(`Admin rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)}s.`);
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

    // Mark market as closed and resolved first
    await databases.updateDocument("pumpforge", "polymarkets", marketId, {
      status: "closed",
      resolved: true,
      winningOutcome: winningChoice,
      resolvedAt: new Date().toISOString(),
    });

    // Query all wagers for this market
    const wagersRes = await databases.listDocuments("pumpforge", "wagers", [
      Query.equal("polymarketId", marketId),
      Query.limit(500),
    ]);

    let totalPaidOut = 0;
    let winnersCount = 0;

    for (const wager of wagersRes.documents) {
      // Idempotency: skip if already paid
      if (wager.isPaid === true) {
        continue;
      }

      const wagerUserId = wager.userId;
      const wagerAmount = Number(wager.amount || 0);
      const choice = wager.choice;

      let payoutAmount = 0;

      if (winningChoice === "CANCEL") {
        // Full refund
        payoutAmount = wagerAmount;
      } else if (choice === winningChoice) {
        // Pro-rata distribution from losing pool
        const winningPool = winningChoice === "YES" ? poolYes : poolNo;
        if (winningPool > 0 && totalPool > 0) {
          const shareRatio = wagerAmount / winningPool;
          payoutAmount = Math.floor(shareRatio * totalPool);
        } else {
          payoutAmount = wagerAmount;
        }
      }

      // Mark wager as paid FIRST to prevent double-payouts
      await databases.updateDocument("pumpforge", "wagers", wager.$id, {
        isPaid: true,
        payoutAmount,
      });

      if (payoutAmount > 0) {
        await withUserLock(wagerUserId, async () => {
          const uState = await getAuthoritativeUser(wagerUserId, admin.jwt);
          const nextCash = uState.cash + payoutAmount;
          await saveAuthoritativeUser(
            wagerUserId,
            {
              cash: nextCash,
              totalProfit: (uState.totalProfit || 0) + (payoutAmount - wagerAmount),
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
      totalPaidOut,
    });

    return {
      success: true,
      marketId,
      winningChoice,
      winnersCount,
      totalPaidOut,
    };
  });
}

// ----------------------------------------------------
// 2. AUTHORITATIVE COIN MANAGER (PERSISTS ACROSS REFRESH)
// ----------------------------------------------------
export async function adminUpdateCoin(admin: AuthenticatedUser, coinId: string, updates: any) {
  if (!admin.isAdmin) {
    throw new Error("Admin privileges required to configure coins.");
  }

  // 1. Update in-memory authoritative store immediately
  const updated = coinStore.updateCoin(coinId, updates);

  // 2. Sync permanently with Appwrite
  try {
    const databases = getDatabases(admin.jwt);
    const payload: any = {};
    if (updates.price !== undefined) payload.price = Number(updates.price);
    if (updates.marketCap !== undefined) payload.marketCap = Math.floor(Number(updates.marketCap));
    if (updates.totalLiquidity !== undefined) payload.totalLiquidity = Number(updates.totalLiquidity);
    if (updates.volume24h !== undefined) payload.volume24h = Number(updates.volume24h);
    if (updates.change24h !== undefined) payload.change24h = Number(updates.change24h);
    if (updates.history !== undefined) payload.history = updates.history;
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.symbol !== undefined) payload.symbol = updates.symbol;
    if (updates.supply !== undefined) payload.supply = Number(updates.supply);

    try {
      await databases.updateDocument("pumpforge", "coins", coinId, payload);
    } catch (updateErr) {
      // If doc does not exist, create it so it persists forever
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
            avatarEmoji: existing.avatarEmoji || "🪙",
            avatarBg: existing.avatarBg || "bg-zinc-900 border-zinc-800",
            supply: Number(updates.supply ?? existing.supply ?? 1000000),
          },
          [Permission.read(Role.any())]
        );
      }
    }
  } catch (err) {
    console.warn("Could not save coin update to Appwrite directly:", err);
  }

  await recordAuditLog(admin, "COIN_UPDATE", { coinId, updates });
  return { success: true, coin: updated };
}

export async function adminPumpCoin(admin: AuthenticatedUser, coinId: string, multiplier: number = 2.0) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  const coin = coinStore.getCoin(coinId);
  if (!coin) throw new Error("Coin not found.");

  const newPrice = Number((coin.price * multiplier).toFixed(6));
  const newMcap = Math.floor(newPrice * (coin.supply || 1000000));
  const newHist = [...(coin.history || [coin.price]).slice(-29), newPrice];

  return adminUpdateCoin(admin, coinId, {
    price: newPrice,
    marketCap: newMcap,
    change24h: (coin.change24h || 0) + (multiplier - 1) * 100,
    history: newHist,
  });
}

export async function adminDumpCoin(admin: AuthenticatedUser, coinId: string, dropRatio: number = 0.5) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  const coin = coinStore.getCoin(coinId);
  if (!coin) throw new Error("Coin not found.");

  const newPrice = Number(Math.max(0.000001, coin.price * dropRatio).toFixed(6));
  const newMcap = Math.floor(newPrice * (coin.supply || 1000000));
  const newHist = [...(coin.history || [coin.price]).slice(-29), newPrice];

  return adminUpdateCoin(admin, coinId, {
    price: newPrice,
    marketCap: newMcap,
    change24h: (coin.change24h || 0) - (1 - dropRatio) * 100,
    history: newHist,
  });
}

export async function adminDeleteCoin(admin: AuthenticatedUser, coinId: string) {
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

// ----------------------------------------------------
// 3. ADMIN USER BALANCE GRANTS & SANCTIONS
// ----------------------------------------------------
export async function adminGrantBalance(
  admin: AuthenticatedUser,
  targetUserId: string,
  mode: "add" | "deduct" | "set",
  currency: "cash" | "gems",
  amount: number
) {
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

export async function adminSanctionUser(
  admin: AuthenticatedUser,
  targetUserId: string,
  sanction: "ban" | "unban" | "suspend" | "unsuspend",
  durationMinutes?: number
) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  return withUserLock(targetUserId, async () => {
    const updates: any = {};
    if (sanction === "ban") updates.isBanned = true;
    else if (sanction === "unban") updates.isBanned = false;
    else if (sanction === "suspend") {
      updates.isSuspended = true;
      updates.suspendedUntil = Date.now() + (durationMinutes || 60) * 60 * 1000;
    } else if (sanction === "unsuspend") {
      updates.isSuspended = false;
      updates.suspendedUntil = null;
    }

    const updated = await saveAuthoritativeUser(targetUserId, updates, admin.jwt);
    await recordAuditLog(admin, "USER_SANCTION", { targetUserId, sanction, durationMinutes });
    return { success: true, userStats: updated };
  });
}

export async function adminUpdateUserProfile(
  admin: AuthenticatedUser,
  targetUserId: string,
  updates: any
) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  return withUserLock(targetUserId, async () => {
    const allowedFields = ["prestigeLevel", "title", "badge", "badges", "equippedColor"];
    const safeUpdates: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    const updated = await saveAuthoritativeUser(targetUserId, safeUpdates, admin.jwt);
    await recordAuditLog(admin, "USER_PROFILE_UPDATE", { targetUserId, safeUpdates });
    return { success: true, userStats: updated };
  });
}

// ----------------------------------------------------
// 4. ADMIN CASINO SETTINGS
// ----------------------------------------------------
export async function adminUpdateSettings(admin: AuthenticatedUser, settings: any) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  if (settings.arcadeRigMode) {
    globalAdminSettings.arcadeRigMode = settings.arcadeRigMode;
  }
  if (settings.isCasinoRigged !== undefined) {
    globalAdminSettings.isCasinoRigged = !!settings.isCasinoRigged;
  }
  if (settings.rainbowCosmetics !== undefined) {
    (globalAdminSettings as any).rainbowCosmetics = !!settings.rainbowCosmetics;
  }
  if (settings.customAdminBadge !== undefined) {
    (globalAdminSettings as any).customAdminBadge = String(settings.customAdminBadge);
  }

  // Update in Appwrite admin_settings collection
  try {
    const databases = getDatabases(admin.jwt);
    const res = await databases.listDocuments("pumpforge", "admin_settings", [Query.limit(1)]);
    if (res.documents.length > 0) {
      await databases.updateDocument("pumpforge", "admin_settings", res.documents[0].$id, {
        arcadeRigMode: globalAdminSettings.arcadeRigMode,
        isCasinoRigged: globalAdminSettings.isCasinoRigged,
        rainbowCosmetics: (globalAdminSettings as any).rainbowCosmetics ?? false,
        customAdminBadge: (globalAdminSettings as any).customAdminBadge ?? "Operator",
      });
    } else {
      await databases.createDocument("pumpforge", "admin_settings", "global", {
        arcadeRigMode: globalAdminSettings.arcadeRigMode,
        isCasinoRigged: globalAdminSettings.isCasinoRigged,
        rainbowCosmetics: (globalAdminSettings as any).rainbowCosmetics ?? false,
        customAdminBadge: (globalAdminSettings as any).customAdminBadge ?? "Operator",
      });
    }
  } catch (e) {
    console.warn("Could not save admin_settings to Appwrite directly:", e);
  }

  await recordAuditLog(admin, "SETTINGS_UPDATE", settings);
  return { success: true, settings: globalAdminSettings };
}

// ----------------------------------------------------
// 5. BUG REPORTS MANAGEMENT
// ----------------------------------------------------
export async function adminGetBugs(admin: AuthenticatedUser) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  try {
    const databases = getDatabases(admin.jwt);
    const res = await databases.listDocuments("pumpforge", "bugs", [
      Query.orderDesc("timestamp"),
      Query.limit(100),
    ]);
    return { bugs: res.documents };
  } catch (err: any) {
    console.warn("Could not fetch bugs from Appwrite:", err);
    return { bugs: [] };
  }
}

export async function adminUpdateBugStatus(admin: AuthenticatedUser, bugId: string, status: string) {
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

export async function adminDeleteBugReport(admin: AuthenticatedUser, bugId: string) {
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

// ----------------------------------------------------
// 6. BROADCASTS MANAGEMENT
// ----------------------------------------------------
export async function adminCreateBroadcast(
  admin: AuthenticatedUser,
  payload: { title: string; message: string; type?: string; expiresAt?: string | null }
) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  const docId = ID.unique();
  const broadcastDoc = {
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type || "info",
    timestamp: new Date().toISOString(),
    expiresAt: payload.expiresAt || null,
  };

  try {
    const databases = getDatabases(admin.jwt);
    const created = await databases.createDocument(
      "pumpforge",
      "broadcasts",
      docId,
      broadcastDoc,
      [Permission.read(Role.any())]
    );
    await recordAuditLog(admin, "BROADCAST_CREATE", broadcastDoc);
    return { success: true, broadcast: created };
  } catch (err: any) {
    console.error("Failed to create broadcast in Appwrite:", err);
    throw new Error(err.message || "Failed to create broadcast.");
  }
}

export async function adminDeleteBroadcast(admin: AuthenticatedUser, broadcastId: string) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  try {
    const databases = getDatabases(admin.jwt);
    await databases.deleteDocument("pumpforge", "broadcasts", broadcastId);
    await recordAuditLog(admin, "BROADCAST_DELETE", { broadcastId });
    return { success: true, broadcastId };
  } catch (err: any) {
    console.error("Failed to delete broadcast from Appwrite:", err);
    throw new Error(err.message || "Failed to delete broadcast.");
  }
}

// ----------------------------------------------------
// 7. PROMO CODE CREATION (SERVER AUTHORITATIVE)
// ----------------------------------------------------
export async function adminCreatePromoCode(
  admin: AuthenticatedUser,
  promoData: {
    code: string;
    rewardType: "cash" | "gems";
    rewardAmount: number;
    expiresAt?: string | null;
  }
) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");

  const cleanCode = promoData.code.trim().toUpperCase();
  if (!cleanCode) throw new Error("Promo code cannot be empty.");

  const docId = ID.unique();
  const docPayload = {
    code: cleanCode,
    rewardType: promoData.rewardType || "cash",
    rewardAmount: Number(promoData.rewardAmount) || 0,
    isActive: true,
    claimedBy: [],
    expiresAt: promoData.expiresAt ? new Date(promoData.expiresAt).toISOString() : null,
  };

  try {
    const databases = getDatabases(admin.jwt);
    const created = await databases.createDocument(
      "pumpforge",
      "promocodes",
      docId,
      docPayload
    );
    await recordAuditLog(admin, "PROMOCODE_CREATE", { code: cleanCode, rewardAmount: promoData.rewardAmount });
    return { success: true, promocode: created };
  } catch (err: any) {
    console.error("Failed to create promocode in Appwrite:", err);
    throw new Error(err.message || "Failed to create promocode.");
  }
}
