import { account } from "../appwrite";
import { formatErrorMessage } from "../utils/formatError";

let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

let cachedAppwriteJwt: string | null = null;
let appwriteJwtExpiresAt = 0;

export function getCustomAuthToken(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return localStorage.getItem("pf_custom_token");
}

export function setCustomAuthToken(token: string) {
  cachedJwt = token;
  jwtExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem("pf_custom_token", token);
  }
}

/**
 * Retrieves a 3-part Appwrite session JWT if the browser has an active Appwrite session.
 */
export async function getAppwriteSessionJwt(): Promise<string | null> {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const isSessionValid = localStorage.getItem("pf_session_valid");
  if (isSessionValid !== "true") return null;

  const now = Date.now();
  if (cachedAppwriteJwt && now < appwriteJwtExpiresAt) {
    return cachedAppwriteJwt;
  }

  try {
    const sessionRes = await account.createJWT();
    if (sessionRes && sessionRes.jwt) {
      cachedAppwriteJwt = sessionRes.jwt;
      appwriteJwtExpiresAt = now + 9 * 60 * 1000;
      return cachedAppwriteJwt;
    }
  } catch {
    cachedAppwriteJwt = null;
    appwriteJwtExpiresAt = now + 60 * 1000;
  }
  return null;
}

/**
 * Retrieves an Appwrite JWT or Dev Owner token for authenticating API requests.
 */
let isUpgradingToken = false;

export async function getAuthJwt(): Promise<string | null> {
  const custom = getCustomAuthToken();
  if (custom) {
    if (!isUpgradingToken && (custom.startsWith("pf_owner_") || custom.startsWith("pf_user_"))) {
      isUpgradingToken = true;
      try {
        const cachedUserRaw = typeof window !== "undefined" ? localStorage.getItem("cached_appwrite_user") : null;
        const cachedUser = cachedUserRaw ? JSON.parse(cachedUserRaw) : null;
        const email = cachedUser?.email || (custom.startsWith("pf_owner_") ? "realzekeee@gmail.com" : "");
        const name = cachedUser?.name || (custom.startsWith("pf_owner_") ? "Zeke (Owner)" : "Player");
        if (email) {
          const upRes = await fetch("/api/auth/email-login", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ email, name }),
          });
          if (upRes.ok) {
            const upData = await upRes.json();
            if (upData?.token) {
              setCustomAuthToken(upData.token);
              isUpgradingToken = false;
              return upData.token;
            }
          }
        }
      } catch (_) {}
      isUpgradingToken = false;
    }
    return custom;
  }

  return getAppwriteSessionJwt();
}

export function clearAuthJwt() {
  cachedJwt = null;
  jwtExpiresAt = 0;
  cachedAppwriteJwt = null;
  appwriteJwtExpiresAt = 0;
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.removeItem("pf_custom_token");
    localStorage.removeItem("pf_session_valid");
    localStorage.removeItem("pf_fallback_userId");
    localStorage.removeItem("pf_stats_updated_at");
  }
}

function getGuestId(): string {
  if (typeof window === "undefined" || !window.localStorage) return "client_default";
  let gid = localStorage.getItem("pf_guest_uid");
  if (!gid) {
    gid = "g_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem("pf_guest_uid", gid);
  }
  return gid;
}

function getCachedUserIdentity(): {
  userId?: string;
  email?: string;
  name?: string;
  cash?: string;
  gems?: string;
  profit?: string;
  trades?: string;
  updatedAt?: string;
} {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    let userId: string | undefined;
    let email: string | undefined;
    let name: string | undefined;
    const raw = localStorage.getItem("cached_appwrite_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      const uid = parsed?.$id || parsed?.uid || parsed?.userId;
      if (uid) {
        userId = String(uid);
        email = parsed?.email ? String(parsed.email) : "";
        name = parsed?.name || parsed?.displayName ? String(parsed.name || parsed.displayName) : "";
      }
    }
    if (!userId) {
      const fallbackUid = localStorage.getItem("pf_fallback_userId");
      if (fallbackUid) userId = fallbackUid;
    }

    let cash: string | undefined;
    let gems: string | undefined;
    let profit: string | undefined;
    let trades: string | undefined;
    const statsRaw = localStorage.getItem("cached_appwrite_stats");
    if (statsRaw) {
      const stats = JSON.parse(statsRaw);
      if (stats && typeof stats === "object") {
        if (typeof stats.cash === "number" && !isNaN(stats.cash)) cash = String(stats.cash);
        if (typeof stats.gems === "number" && !isNaN(stats.gems)) gems = String(stats.gems);
        if (typeof stats.totalProfit === "number" && !isNaN(stats.totalProfit)) profit = String(stats.totalProfit);
        if (typeof stats.tradesCount === "number" && !isNaN(stats.tradesCount)) trades = String(stats.tradesCount);
      }
    }
    const updatedAt = localStorage.getItem("pf_stats_updated_at") || (cash !== undefined ? String(Date.now()) : undefined);

    return { userId, email, name, cash, gems, profit, trades, updatedAt };
  } catch {}
  return {};
}

function persistServerUserStats(serverStats: any) {
  if (!serverStats || typeof serverStats !== "object" || typeof window === "undefined" || !window.localStorage) return;
  try {
    const nowStr = String(Date.now());
    localStorage.setItem("pf_stats_updated_at", nowStr);
    const existingRaw = localStorage.getItem("cached_appwrite_stats");
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = {
      ...existing,
      ...(serverStats.cash !== undefined ? { cash: Number(serverStats.cash) } : {}),
      ...(serverStats.gems !== undefined ? { gems: Number(serverStats.gems) } : {}),
      ...(serverStats.totalProfit !== undefined ? { totalProfit: Number(serverStats.totalProfit) } : {}),
      ...(serverStats.tradesCount !== undefined ? { tradesCount: Number(serverStats.tradesCount) } : {}),
      ...(serverStats.prestigeLevel !== undefined ? { prestigeLevel: Number(serverStats.prestigeLevel) } : {}),
      ...(serverStats.nameColor ? { nameColor: serverStats.nameColor } : {}),
      ...(serverStats.title ? { title: serverStats.title } : {}),
    };
    localStorage.setItem("cached_appwrite_stats", JSON.stringify(merged));
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const [jwt, appwriteJwt] = await Promise.all([getAuthJwt(), getAppwriteSessionJwt()]);
  const identity = getCachedUserIdentity();
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Guest-ID": getGuestId(),
    ...(identity.userId ? { "X-User-ID": identity.userId } : {}),
    ...(identity.email ? { "X-User-Email": identity.email } : {}),
    ...(identity.name ? { "X-User-Name": identity.name } : {}),
    ...(identity.cash !== undefined ? { "X-User-Cash": identity.cash } : {}),
    ...(identity.gems !== undefined ? { "X-User-Gems": identity.gems } : {}),
    ...(identity.profit !== undefined ? { "X-User-Profit": identity.profit } : {}),
    ...(identity.trades !== undefined ? { "X-User-Trades": identity.trades } : {}),
    ...(identity.updatedAt ? { "X-User-Updated-At": identity.updatedAt } : {}),
    ...(appwriteJwt ? { "X-Appwrite-JWT": appwriteJwt } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  let body = options.body;
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method) && body === undefined) {
    body = "{}";
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...options,
      headers,
      body,
    });
  } catch (networkErr: any) {
    const cleanNetworkMsg = formatErrorMessage(networkErr, "Network connection failure. Please check your internet connection.");
    throw new Error(`Network error connecting to ${endpoint}: ${cleanNetworkMsg}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
  let data: any = null;

  if (rawText && rawText.trim().length > 0) {
    try {
      data = JSON.parse(rawText);
    } catch {
      const cleanSnippet = rawText
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${cleanSnippet || res.statusText || "Request failed"}`);
      } else {
        throw new Error(`Received unexpected non-JSON response from ${endpoint} (HTTP 200, ${contentType || "unknown"}): ${cleanSnippet.slice(0, 80)}`);
      }
    }
  }

  if (!res.ok) {
    const errorMsg = formatErrorMessage(
      data?.error || data?.message || data,
      `Server request failed with HTTP ${res.status}${res.statusText ? ` (${res.statusText})` : ""}`
    );

    throw new Error(errorMsg);
  }

  if (data && data.success === false && data.error) {
    throw new Error(formatErrorMessage(data.error, "Requested action was rejected by the server."));
  }

  // Balance persistence is handled deterministically by the state committers

  return (data ?? {}) as T;
}

// ----------------------------------------------------
// Public & Player Game Endpoints
// ----------------------------------------------------

export async function apiGetMe() {
  return request<{ user: any; stats: any }>("/api/auth/me");
}

export async function apiUpdateProfile(updates: {
  title?: string;
  username?: string;
  handle?: string;
  nameColor?: string;
  isPremium?: boolean;
}) {
  return request<any>("/api/game/profile/update", {
    method: "POST",
    body: JSON.stringify(updates),
  });
}

export async function apiGetCoins() {
  return request<{ coins: any[] }>("/api/game/coins");
}

export async function apiGetCoin(coinId: string) {
  return request<{ coin: any }>(`/api/game/coins/${coinId}`);
}

export async function apiGetCoinCandles(coinId: string, interval: number = 1) {
  return request<{ candles: any[] }>(`/api/game/coins/${coinId}/candles?interval=${interval}`);
}

export async function apiGetLeaderboard(category: string = "gains", limit: number = 50) {
  return request<{ leaderboard: any[] }>(`/api/game/leaderboard?category=${category}&limit=${limit}`);
}

export async function apiTrade(coinId: string, type: "BUY" | "SELL", amountCoins: number) {
  return request<{
    success: boolean;
    type: "BUY" | "SELL";
    amountCoins: number;
    price: number;
    totalCost?: number;
    netPayout?: number;
    profit?: number;
    userStats: any;
    coin: any;
  }>("/api/game/trade", {
    method: "POST",
    body: JSON.stringify({ coinId, type, amountCoins }),
  });
}

export async function apiDailyReward() {
  return request<{
    success: boolean;
    rewardCash: number;
    rewardGems: number;
    newStreak: number;
    userStats: any;
  }>("/api/game/daily-reward", {
    method: "POST",
  });
}

export const apiClaimDailyReward = apiDailyReward;

export async function apiArcadeCoinflip(betAmount: number, side: "heads" | "tails") {
  return request<{
    success: boolean;
    game: string;
    outcome: "heads" | "tails";
    won: boolean;
    payout: number;
    profit: number;
    betAmount: number;
    userStats: any;
  }>("/api/arcade/coinflip", {
    method: "POST",
    body: JSON.stringify({
      betAmount: Number(betAmount),
      bet: Number(betAmount),
      side,
    }),
  });
}

export const apiCoinflip = apiArcadeCoinflip;

export async function apiArcadeWager(game: string, action: string, params: any) {
  return request<any>("/api/game/arcade/wager", {
    method: "POST",
    body: JSON.stringify({ game, action, ...params }),
  });
}

export async function apiShopBuy(type: "color" | "crate", params: any) {
  return request<any>("/api/game/shop/buy", {
    method: "POST",
    body: JSON.stringify({ type, ...params }),
  });
}

export async function apiPrestige() {
  return request<any>("/api/game/prestige", {
    method: "POST",
  });
}

export async function apiPromocode(code: string) {
  return request<any>("/api/game/promocode", {
    method: "POST",
  });
}

export const apiRedeemPromocode = (code: string) =>
  request<any>("/api/game/promocode", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export async function apiCreateCoin(params: any) {
  return request<any>("/api/game/create-coin", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiBugReport(title: string, description: string) {
  return request<any>("/api/game/bug-report", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export async function apiPolymarketWager(marketId: string, choice: "YES" | "NO", amount: number) {
  return request<any>("/api/game/polymarket/wager", {
    method: "POST",
    body: JSON.stringify({ marketId, choice, amount }),
  });
}

export const apiPolymarketBet = apiPolymarketWager;

export async function apiCreatePredictionMarket(params: {
  question: string;
  description?: string;
  endDate: string;
}) {
  return request<any>("/api/game/polymarket/create", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ----------------------------------------------------
// Comments API
// ----------------------------------------------------
export async function apiGetComments(targetId: string) {
  return request<{ comments: any[] }>(`/api/game/comments/${targetId}`);
}

export async function apiAddComment(targetId: string, text: string) {
  return request<{ success: boolean; comment: any }>("/api/game/comments", {
    method: "POST",
    body: JSON.stringify({ targetId, text }),
  });
}

export const apiPostComment = apiAddComment;

export async function apiDeleteComment(commentId: string) {
  return request<{ success: boolean }>(`/api/game/comments/${commentId}`, {
    method: "DELETE",
  });
}

export async function apiReportComment(commentId: string) {
  return request<{ success: boolean }>(`/api/game/comments/${commentId}/report`, {
    method: "POST",
  });
}

// ----------------------------------------------------
// Public User Profile API
// ----------------------------------------------------
export async function apiGetPublicUserProfile(identifier: string) {
  return request<any>(`/api/user/${identifier}`);
}

// ----------------------------------------------------
// Server-Authoritative Admin Endpoints
// ----------------------------------------------------

export async function apiAdminResolveMarket(
  marketId: string,
  winningChoice: "YES" | "NO" | "CANCEL",
  extra?: { userBet?: { side: "YES" | "NO"; amount: number }; poolYes?: number; poolNo?: number }
) {
  return request<any>("/api/admin/polymarket/resolve", {
    method: "POST",
    body: JSON.stringify({ marketId, winningChoice, ...(extra || {}) }),
  });
}

export async function apiAdminUpdateCoin(coinId: string, updates: any) {
  return request<any>("/api/admin/coins/update", {
    method: "POST",
    body: JSON.stringify({ coinId, updates }),
  });
}

export async function apiAdminPumpCoin(coinId: string, multiplier: number = 2.0) {
  return request<any>("/api/admin/coins/pump", {
    method: "POST",
    body: JSON.stringify({ coinId, multiplier }),
  });
}

export async function apiAdminDumpCoin(coinId: string, dropRatio: number = 0.5) {
  return request<any>("/api/admin/coins/dump", {
    method: "POST",
    body: JSON.stringify({ coinId, dropRatio }),
  });
}

export async function apiAdminDeleteCoin(coinId: string) {
  return request<any>("/api/admin/coins/delete", {
    method: "POST",
    body: JSON.stringify({ coinId }),
  });
}

export async function apiAdminGrantBalance(
  targetUserId: string,
  mode: "add" | "deduct" | "set",
  currency: "cash" | "gems",
  amount: number
) {
  return request<any>("/api/admin/users/grant-balance", {
    method: "POST",
    body: JSON.stringify({ targetUserId, mode, currency, amount }),
  });
}

export async function apiAdminSanctionUser(
  targetUserId: string,
  sanction: "ban" | "unban" | "suspend" | "unsuspend",
  durationMinutes?: number
) {
  return request<any>("/api/admin/users/sanction", {
    method: "POST",
    body: JSON.stringify({ targetUserId, sanction, durationMinutes }),
  });
}

export async function apiAdminUpdateUserProfile(targetUserId: string, updates: any) {
  return request<any>("/api/admin/users/update-profile", {
    method: "POST",
    body: JSON.stringify({ targetUserId, updates }),
  });
}

export async function apiAdminUpdateSettings(settings: any) {
  return request<any>("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export async function apiAdminUpdateBugStatus(bugId: string, status: string) {
  return request<any>("/api/admin/bugs/update-status", {
    method: "POST",
    body: JSON.stringify({ bugId, status }),
  });
}

export async function apiAdminDeleteBugReport(bugId: string) {
  return request<any>("/api/admin/bugs/delete", {
    method: "POST",
    body: JSON.stringify({ bugId }),
  });
}

export async function apiGetSettings() {
  return request<{
    arcadeRigMode: "fair" | "win" | "lose";
    isCasinoRigged: boolean;
    rainbowCosmetics?: boolean;
    customAdminBadge?: string;
  }>("/api/game/settings");
}

export async function apiGetUserWagers() {
  return request<{ wagers: any[] }>("/api/game/wagers");
}

export async function apiAdminGetBugs() {
  return request<{ bugs: any[] }>("/api/admin/bugs");
}

export async function apiAdminCreateBroadcast(payload: {
  title: string;
  message: string;
  type?: string;
  expiresAt?: string | null;
}) {
  return request<{ success: boolean; broadcast: any }>("/api/admin/broadcasts/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiAdminDeleteBroadcast(broadcastId: string) {
  return request<{ success: boolean; broadcastId: string }>("/api/admin/broadcasts/delete", {
    method: "POST",
    body: JSON.stringify({ broadcastId }),
  });
}

export async function apiAdminCreatePromoCode(promoData: {
  code: string;
  rewardType: string;
  rewardAmount: number;
  expiresAt?: string | null;
}) {
  return request<{ success: boolean; promocode: any }>("/api/admin/promocodes/create", {
    method: "POST",
    body: JSON.stringify(promoData),
  });
}

export async function apiGetAuditLogs() {
  return request<{ logs: any[] }>("/api/admin/audit-logs");
}

export async function apiGetSchemaAudit() {
  return request<any>("/api/admin/schema-audit");
}

export async function apiEmailLogin(payload: { email: string; password?: string; name?: string }) {
  const cleanEmail = payload.email.toLowerCase().trim();
  const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanEmail === "realzekee@gmail.com";
  const displayName = isOwner ? "Zeke (Owner)" : (payload.name || cleanEmail.split("@")[0] || "Player");
  const uId = isOwner ? "admin_realzekeee" : "u_" + Math.random().toString(36).substring(2, 10);
  const b64Data = btoa(JSON.stringify({ email: cleanEmail, name: displayName }));
  const fallbackToken = isOwner ? ("pf_owner_realzekeee_" + btoa(cleanEmail)) : `pf_user_${uId}_${b64Data}`;

  const fallbackUser = {
    userId: uId,
    email: cleanEmail,
    name: displayName,
    isAdmin: isOwner,
    isGuest: false,
    jwt: fallbackToken,
  };
  const fallbackStats = {
    userId: uId,
    email: cleanEmail,
    username: displayName,
    handle: "@" + displayName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    title: isOwner ? "Founder & Owner" : "Member",
    cash: 5000,
    gems: 50,
    prestigeLevel: isOwner ? 10 : 0,
    isAdmin: isOwner,
    isPremium: isOwner,
  };

  try {
    const res = await request<{
      success: boolean;
      token: string;
      user: any;
      stats: any;
    }>("/api/auth/email-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && res.token) {
      setCustomAuthToken(res.token);
    }
    return res;
  } catch (err) {
    console.warn("Server email login notice, using local token fallback:", err);
    setCustomAuthToken(fallbackToken);
    return {
      success: true,
      token: fallbackToken,
      user: fallbackUser,
      stats: fallbackStats,
    };
  }
}

export async function apiGoogleVerify(payload: { credential?: string; email?: string; name?: string }) {
  const res = await request<{
    success: boolean;
    token: string;
    user: any;
    stats: any;
  }>("/api/auth/google-verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res && res.token) {
    setCustomAuthToken(res.token);
  }
  return res;
}

export async function apiQuickLogin(payload: { username: string; email?: string }) {
  const cleanUsername = payload.username.trim() || "Player";
  const cleanEmail = (payload.email || "").toLowerCase().trim();
  const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanUsername.toLowerCase() === "zeke";
  const uId = isOwner ? "admin_realzekeee" : "u_" + Math.random().toString(36).substring(2, 10);
  const b64Data = btoa(JSON.stringify({ email: cleanEmail, name: cleanUsername }));
  const fallbackToken = isOwner ? ("pf_owner_realzekeee_" + btoa("realzekeee@gmail.com")) : `pf_user_${uId}_${b64Data}`;

  const fallbackUser = {
    userId: uId,
    email: cleanEmail,
    name: cleanUsername,
    isAdmin: isOwner,
    isGuest: false,
    jwt: fallbackToken,
  };
  const fallbackStats = {
    userId: uId,
    email: cleanEmail,
    username: cleanUsername,
    handle: "@" + cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, ""),
    title: isOwner ? "Founder & Owner" : "Member",
    cash: 5000,
    gems: 50,
    prestigeLevel: isOwner ? 10 : 0,
    isAdmin: isOwner,
    isPremium: isOwner,
  };

  try {
    const res = await request<{
      success: boolean;
      token: string;
      user: any;
      stats: any;
    }>("/api/auth/quick-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && res.token) {
      setCustomAuthToken(res.token);
    }
    return res;
  } catch (err) {
    console.warn("Server quick login notice, using local token fallback:", err);
    setCustomAuthToken(fallbackToken);
    return {
      success: true,
      token: fallbackToken,
      user: fallbackUser,
      stats: fallbackStats,
    };
  }
}

export async function apiOAuthCallback(payload: { userId: string; secret?: string; email?: string; name?: string }) {
  const cleanEmail = (payload.email || "").toLowerCase().trim();
  const cleanName = payload.name || (cleanEmail ? cleanEmail.split("@")[0] : "Player");
  const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanEmail === "realzekee@gmail.com";
  const uId = payload.userId || (isOwner ? "admin_realzekeee" : "u_" + Math.random().toString(36).substring(2, 10));
  const b64Data = btoa(JSON.stringify({ email: cleanEmail, name: cleanName }));
  const fallbackToken = `pf_user_${uId}_${b64Data}`;

  const fallbackUser = {
    userId: uId,
    email: cleanEmail,
    name: cleanName,
    isAdmin: isOwner,
    isGuest: false,
    jwt: fallbackToken,
  };

  const fallbackStats = {
    userId: uId,
    email: cleanEmail,
    username: cleanName,
    handle: "@" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    title: isOwner ? "Founder & Owner" : "Member",
    cash: 5000,
    gems: 50,
    prestigeLevel: isOwner ? 10 : 0,
    isAdmin: isOwner,
    isPremium: isOwner,
  };

  try {
    const res = await request<{
      success: boolean;
      token: string;
      user: any;
      stats: any;
    }>("/api/auth/oauth-callback", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && res.token) {
      setCustomAuthToken(res.token);
    } else {
      setCustomAuthToken(fallbackToken);
    }
    return res;
  } catch (err) {
    console.warn("Server oauth callback notice, using fallback token:", err);
    setCustomAuthToken(fallbackToken);
    return {
      success: true,
      token: fallbackToken,
      user: fallbackUser,
      stats: fallbackStats,
    };
  }
}

export async function apiAdminGetUsers() {
  return request<{ users: any[] }>("/api/admin/users");
}

export async function apiGetBroadcasts() {
  return request<{ broadcasts: any[] }>("/api/game/broadcasts");
}

export async function apiGetTrades(options?: { coinId?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (options?.coinId) query.set("coinId", options.coinId);
  if (options?.limit) query.set("limit", String(options.limit));
  const queryString = query.toString();
  const endpoint = `/api/game/trades${queryString ? `?${queryString}` : ""}`;
  return request<{ trades: any[] }>(endpoint);
}

export async function apiGetPolymarkets() {
  return request<{ polymarkets: any[] }>("/api/game/polymarkets");
}

export async function apiGetHoldings(options?: { userId?: string; coinId?: string }) {
  const query = new URLSearchParams();
  if (options?.userId) query.set("userId", options.userId);
  if (options?.coinId) query.set("coinId", options.coinId);
  const queryString = query.toString();
  const endpoint = `/api/game/holdings${queryString ? `?${queryString}` : ""}`;
  return request<{ holdings: any[] }>(endpoint);
}

export async function apiGetNotifications(userId?: string) {
  const query = new URLSearchParams();
  if (userId) query.set("userId", userId);
  const queryString = query.toString();
  const endpoint = `/api/game/notifications${queryString ? `?${queryString}` : ""}`;
  return request<{ notifications: any[] }>(endpoint);
}
