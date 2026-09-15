import { account } from "../appwrite";

let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

/**
 * Retrieves an Appwrite JWT for authenticating API requests.
 */
export async function getAuthJwt(): Promise<string | null> {
  const now = Date.now();
  if (cachedJwt && now < jwtExpiresAt) {
    return cachedJwt;
  }

  try {
    const sessionRes = await account.createJWT();
    if (sessionRes && sessionRes.jwt) {
      cachedJwt = sessionRes.jwt;
      jwtExpiresAt = now + 9 * 60 * 1000; // 9 minutes cache
      return cachedJwt;
    }
  } catch (err) {
    // User not signed in (Guest mode)
    cachedJwt = null;
    jwtExpiresAt = 0;
  }
  return null;
}

export function clearAuthJwt() {
  cachedJwt = null;
  jwtExpiresAt = 0;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const jwt = await getAuthJwt();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Server request failed.");
  }
  return data as T;
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
    body: JSON.stringify({ code }),
  });
}

export const apiRedeemPromocode = apiPromocode;

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

export async function apiAdminResolveMarket(marketId: string, winningChoice: "YES" | "NO" | "CANCEL") {
  return request<any>("/api/admin/polymarket/resolve", {
    method: "POST",
    body: JSON.stringify({ marketId, winningChoice }),
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

export async function apiGetAuditLogs() {
  return request<{ logs: any[] }>("/api/admin/audit-logs");
}

export async function apiGetSchemaAudit() {
  return request<any>("/api/admin/schema-audit");
}

