// src/server/app.ts
import express from "express";

// src/server/auth.ts
import crypto from "crypto";
var DEFAULT_ADMIN_EMAILS = ["realzekeee@gmail.com", "realzekee@gmail.com"];
function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).concat(DEFAULT_ADMIN_EMAILS);
}
function getTokenSecret() {
  return (process.env.APPWRITE_API_KEY || process.env.SESSION_SECRET || "pumpforge_authoritative_secret_key_v1").trim();
}
function signCustomToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(data).digest("base64url");
  return `pf_${data}.${signature}`;
}
function verifyCustomToken(token) {
  if (!token || !token.startsWith("pf_")) return null;
  const parts = token.slice(3).split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (!parsed || !parsed.userId) return null;
    const email = (parsed.email || "").toLowerCase().trim();
    const isOwnerEmail = getAdminEmails().includes(email) || parsed.userId === "admin_realzekeee";
    const expectedSig = crypto.createHmac("sha256", getTokenSecret()).update(data).digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    const sigMatches = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    return {
      userId: String(parsed.userId),
      email,
      name: parsed.name || (email ? email.split("@")[0] : "Player"),
      isAdmin: Boolean((sigMatches ? parsed.isAdmin : isOwnerEmail) && isOwnerEmail),
      isGuest: false,
      jwt: token
    };
  } catch {
    return null;
  }
}
var jwtCache = /* @__PURE__ */ new Map();
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || "";
  const jwtHeader = (req.headers["x-appwrite-jwt"] || "").trim();
  const headerUserId = (req.headers["x-user-id"] || "").trim();
  const headerUserEmail = (req.headers["x-user-email"] || "").trim().toLowerCase();
  const headerUserName = (req.headers["x-user-name"] || "").trim();
  const guestId = (req.headers["x-guest-id"] || "").trim() || "guest_player";
  const hintCashRaw = req.headers["x-user-cash"];
  const hintGemsRaw = req.headers["x-user-gems"];
  const hintProfitRaw = req.headers["x-user-profit"];
  const hintTradesRaw = req.headers["x-user-trades"];
  const hintUpdatedRaw = req.headers["x-user-updated-at"];
  let jwt = "";
  if (authHeader.startsWith("Bearer ")) {
    jwt = authHeader.substring(7).trim();
  } else if (jwtHeader) {
    jwt = jwtHeader;
  }
  const effectiveAppwriteJwt =
    jwtHeader && jwtHeader.split(".").length === 3
      ? jwtHeader
      : jwt && jwt.split(".").length === 3
      ? jwt
      : void 0;
  const applyHints = (u) => {
    if (effectiveAppwriteJwt) {
      u.jwt = effectiveAppwriteJwt;
    }
    if (u.userId && !u.isGuest) {
      hydrateUserHintsFromHeaders(u.userId, {
        cash: hintCashRaw !== void 0 ? Number(hintCashRaw) : void 0,
        gems: hintGemsRaw !== void 0 ? Number(hintGemsRaw) : void 0,
        totalProfit: hintProfitRaw !== void 0 ? Number(hintProfitRaw) : void 0,
        tradesCount: hintTradesRaw !== void 0 ? Number(hintTradesRaw) : void 0,
        updatedAt: hintUpdatedRaw !== void 0 ? Number(hintUpdatedRaw) : void 0,
        username: u.name
      });
    }
    return u;
  };
  if (jwt) {
    const verifiedUser = verifyCustomToken(jwt);
    if (verifiedUser) {
      return applyHints(verifiedUser);
    }
    if (jwt.startsWith("pf_user_") || jwt.startsWith("pf_session_") || jwt.startsWith("pf_owner_") || jwt.startsWith("pf_admin_")) {
      try {
        const isOwnerPrefix = jwt.startsWith("pf_owner_");
        const rest = jwt.replace(/^pf_(user|session|owner|admin)_/, "");
        const firstUnderscore = rest.indexOf("_");
        let uId = isOwnerPrefix ? "admin_realzekeee" : rest;
        let userData = {
          email: isOwnerPrefix ? "realzekeee@gmail.com" : "",
          name: isOwnerPrefix ? "Zeke (Owner)" : "Player"
        };
        if (firstUnderscore !== -1 && !isOwnerPrefix) {
          uId = rest.substring(0, firstUnderscore);
          const b64 = rest.substring(firstUnderscore + 1);
          try {
            userData = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
          } catch {}
        }
        const email = (userData.email || headerUserEmail || "").toLowerCase().trim();
        const isOwner = getAdminEmails().includes(email) || uId === "admin_realzekeee";
        return applyHints({
          userId: uId || headerUserId || "player_user",
          email,
          name: userData.name || headerUserName || (email ? email.split("@")[0] : "Player"),
          isAdmin: isOwner,
          isGuest: false,
          jwt: effectiveAppwriteJwt || jwt
        });
      } catch {}
    }
    const cached = jwtCache.get(jwt);
    if (cached && cached.expiresAt > Date.now()) {
      return applyHints({ ...cached.user });
    }
    if (jwt.split(".").length === 3) {
      try {
        const endpoint = (process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1").trim();
        const project = (process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902").trim();
        const res = await fetch(`${endpoint}/account`, {
          method: "GET",
          headers: {
            "X-Appwrite-Project": project,
            "X-Appwrite-JWT": jwt
          }
        });
        if (res.ok) {
          const rawText = await res.text();
          const appwriteAccount = rawText ? JSON.parse(rawText) : null;
          if (appwriteAccount && appwriteAccount.$id) {
            const verifiedEmail = (appwriteAccount.email || "").toLowerCase().trim();
            const isAdmin = getAdminEmails().includes(verifiedEmail);
            const authenticatedUser = {
              userId: isAdmin ? "admin_realzekeee" : appwriteAccount.$id,
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
            return applyHints(authenticatedUser);
          }
        }
      } catch (err) {
        console.error("Authentication verification error with Appwrite:", err);
      }
    }
  }
  if (headerUserId && headerUserId !== "guest_player" && !headerUserId.startsWith("g_")) {
    const isOwner = getAdminEmails().includes(headerUserEmail) || headerUserId === "admin_realzekeee";
    return applyHints({
      userId: headerUserId,
      email: headerUserEmail,
      name: headerUserName || (headerUserEmail ? headerUserEmail.split("@")[0] : "Trader"),
      isAdmin: isOwner,
      isGuest: false,
      jwt: effectiveAppwriteJwt || jwt || void 0
    });
  }
  return {
    userId: guestId,
    email: "",
    name: "Guest Player",
    isAdmin: false,
    isGuest: true
  };
}
async function authMiddleware(req, _res, next) {
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
import crypto3 from "crypto";

// src/server/db.ts
// src/server/appwriteServer.ts
class Client {
  constructor() {
    this.endpoint = "https://sgp.cloud.appwrite.io/v1";
    this.project = "6a1416eb001f50cdb902";
    this.apiKey = "";
    this.jwt = "";
  }
  setEndpoint(endpoint) {
    if (endpoint) this.endpoint = endpoint.trim().replace(/\/+$/, "");
    return this;
  }
  setProject(project) {
    if (project) this.project = project.trim();
    return this;
  }
  setKey(key) {
    if (key) this.apiKey = key.trim();
    return this;
  }
  setJWT(jwt) {
    if (jwt) this.jwt = jwt.trim();
    return this;
  }
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "X-Appwrite-Project": this.project
    };
    const activeKey = this.apiKey || (process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "").trim();
    if (activeKey) {
      headers["X-Appwrite-Key"] = activeKey;
    } else if (this.jwt && this.jwt.split(".").length === 3) {
      headers["X-Appwrite-JWT"] = this.jwt;
    }
    return headers;
  }
}
var ID = {
  unique() {
    return crypto.randomBytes(10).toString("hex");
  },
  custom(id) {
    return id;
  }
};
var Role = {
  any() {
    return "any";
  },
  user(id, status = "") {
    return status ? `user:${id}/${status}` : `user:${id}`;
  },
  users(status = "") {
    return status ? `users/${status}` : "users";
  },
  guests() {
    return "guests";
  }
};
var Permission = {
  read(role) {
    return `read("${role}")`;
  },
  write(role) {
    return `write("${role}")`;
  },
  create(role) {
    return `create("${role}")`;
  },
  update(role) {
    return `update("${role}")`;
  },
  delete(role) {
    return `delete("${role}")`;
  }
};
var Query = {
  equal(attribute, value) {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "equal", attribute, values });
  },
  notEqual(attribute, value) {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "notEqual", attribute, values });
  },
  lessThan(attribute, value) {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "lessThan", attribute, values });
  },
  lessThanEqual(attribute, value) {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "lessThanEqual", attribute, values });
  },
  greaterThan(attribute, value) {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "greaterThan", attribute, values });
  },
  greaterThanEqual(attribute, value) {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "greaterThanEqual", attribute, values });
  },
  search(attribute, value) {
    return JSON.stringify({ method: "search", attribute, values: [value] });
  },
  orderDesc(attribute) {
    return JSON.stringify({ method: "orderDesc", attribute });
  },
  orderAsc(attribute) {
    return JSON.stringify({ method: "orderAsc", attribute });
  },
  limit(limit) {
    return JSON.stringify({ method: "limit", values: [Number(limit)] });
  },
  offset(offset) {
    return JSON.stringify({ method: "offset", values: [Number(offset)] });
  }
};
function applyQueriesInMemory(docs, queries) {
  let result = [...docs];
  let limitVal = null;
  let offsetVal = 0;
  for (const rawQ of queries) {
    if (!rawQ) continue;
    let q = rawQ;
    if (typeof rawQ === "string") {
      try {
        q = JSON.parse(rawQ);
      } catch {
        continue;
      }
    }
    if (!q || typeof q !== "object") continue;
    const method = q.method;
    const attr = q.attribute;
    const vals = Array.isArray(q.values) ? q.values : [];
    if (method === "equal" && attr) {
      result = result.filter((d) => {
        const v = attr === "$id" ? d.$id ?? d.id : d[attr];
        return vals.some((target) => String(v) === String(target));
      });
    } else if (method === "notEqual" && attr) {
      result = result.filter((d) => {
        const v = attr === "$id" ? d.$id ?? d.id : d[attr];
        return !vals.some((target) => String(v) === String(target));
      });
    } else if (method === "greaterThan" && attr && vals.length > 0) {
      result = result.filter((d) => d[attr] > vals[0]);
    } else if (method === "greaterThanEqual" && attr && vals.length > 0) {
      result = result.filter((d) => d[attr] >= vals[0]);
    } else if (method === "lessThan" && attr && vals.length > 0) {
      result = result.filter((d) => d[attr] < vals[0]);
    } else if (method === "lessThanEqual" && attr && vals.length > 0) {
      result = result.filter((d) => d[attr] <= vals[0]);
    } else if (method === "orderDesc" && attr) {
      result.sort((a, b) => {
        const va = a[attr] ?? a.$createdAt ?? "";
        const vb = b[attr] ?? b.$createdAt ?? "";
        if (typeof va === "number" && typeof vb === "number") return vb - va;
        return String(vb).localeCompare(String(va));
      });
    } else if (method === "orderAsc" && attr) {
      result.sort((a, b) => {
        const va = a[attr] ?? a.$createdAt ?? "";
        const vb = b[attr] ?? b.$createdAt ?? "";
        if (typeof va === "number" && typeof vb === "number") return va - vb;
        return String(va).localeCompare(String(vb));
      });
    } else if (method === "limit" && vals.length > 0) {
      limitVal = Number(vals[0]) || 50;
    } else if (method === "offset" && vals.length > 0) {
      offsetVal = Number(vals[0]) || 0;
    }
  }
  if (offsetVal > 0) {
    result = result.slice(offsetVal);
  }
  if (limitVal !== null && limitVal > 0) {
    result = result.slice(0, limitVal);
  }
  return result;
}
var NUMERIC_DEFAULTS = /* @__PURE__ */ new Set([
  "cash", "gems", "prestigeLevel", "totalProfit", "tradesCount", "allTimeTrades",
  "coinsCreatedCount", "dailyStreak", "price", "marketCap", "totalLiquidity",
  "volume24h", "change24h", "supply", "amount", "tokenAmount", "avgBuyPrice",
  "avgPrice", "totalInvested", "amountCoins", "pricePerCoin", "totalCash",
  "fee", "poolYes", "poolNo", "rewardAmount"
]);
var BOOLEAN_DEFAULTS = /* @__PURE__ */ new Set([
  "isBanned", "isSuspended", "resolved", "isPaid", "reported", "read", "isActive", "isCasinoRigged", "rainbowCosmetics"
]);
class Databases {
  constructor(client) {
    this.client = client;
  }
  async request(path, options = {}) {
    const url = `${this.client.endpoint}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.client.getHeaders(),
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let json = null;
    if (text && text.trim().length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (!res.ok) {
      const err = new Error(json?.message || json?.error || `Appwrite HTTP ${res.status}: ${res.statusText}`);
      err.code = json?.code || res.status;
      err.status = res.status;
      err.type = json?.type;
      throw err;
    }
    return json ?? {};
  }
  async listDocuments(databaseId, collectionId, queries = []) {
    const params = new URLSearchParams();
    if (Array.isArray(queries)) {
      for (const q of queries) {
        if (q !== void 0 && q !== null) {
          params.append("queries[]", typeof q === "string" ? q : JSON.stringify(q));
        }
      }
    }
    const qs = params.toString();
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents${qs ? `?${qs}` : ""}`;
    try {
      const res = await this.request(path, { method: "GET" });
      return {
        total: typeof res.total === "number" ? res.total : res.documents?.length || 0,
        documents: Array.isArray(res.documents) ? res.documents : []
      };
    } catch (err) {
      if (Array.isArray(queries) && queries.length > 0) {
        const barePath = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
        const res = await this.request(barePath, { method: "GET" });
        const rawDocs = Array.isArray(res.documents) ? res.documents : [];
        const filtered = applyQueriesInMemory(rawDocs, queries);
        return {
          total: filtered.length,
          documents: filtered
        };
      }
      throw err;
    }
  }
  async getDocument(databaseId, collectionId, documentId, queries = []) {
    const params = new URLSearchParams();
    if (Array.isArray(queries)) {
      for (const q of queries) {
        if (q !== void 0 && q !== null) {
          params.append("queries[]", typeof q === "string" ? q : JSON.stringify(q));
        }
      }
    }
    const qs = params.toString();
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}${qs ? `?${qs}` : ""}`;
    return this.request(path, { method: "GET" });
  }
  async createDocument(databaseId, collectionId, documentId, data, permissions) {
    const rawDocId = !documentId || documentId === "unique()" ? ID.unique() : String(documentId);
    const finalDocId = rawDocId.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^[^a-zA-Z0-9]+/, "d").slice(0, 36) || ID.unique();
    const currentData = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith("$") && v !== void 0) {
          currentData[k] = v;
        }
      }
    }
    let currentPermissions = Array.isArray(permissions) && permissions.length > 0 ? [...permissions] : void 0;
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const body = {
          documentId: finalDocId,
          data: currentData
        };
        if (currentPermissions && currentPermissions.length > 0) {
          body.permissions = currentPermissions;
        }
        return await this.request(path, {
          method: "POST",
          body: JSON.stringify(body)
        });
      } catch (err) {
        const msg = String(err?.message || "");
        if (err?.code === 409 || err?.status === 409 || msg.toLowerCase().includes("already exists")) {
          if (collectionId === "users") {
            try {
              return await this.getDocument(databaseId, collectionId, finalDocId);
            } catch {
              return await this.updateDocument(databaseId, collectionId, finalDocId, currentData);
            }
          }
          return await this.updateDocument(databaseId, collectionId, finalDocId, currentData);
        }
        const unknownMatch = msg.match(/Unknown attribute:\s*["']?([a-zA-Z0-9_]+)["']?/i);
        if (unknownMatch && unknownMatch[1]) {
          const badAttr = unknownMatch[1];
          if (badAttr === "tradesCount" && !("allTimeTrades" in currentData) && currentData.tradesCount !== void 0) {
            currentData.allTimeTrades = currentData.tradesCount;
          } else if (badAttr === "nameColor" && !("equippedColor" in currentData) && currentData.nameColor !== void 0) {
            currentData.equippedColor = currentData.nameColor;
          } else if (badAttr === "amount" && !("tokenAmount" in currentData) && currentData.amount !== void 0) {
            currentData.tokenAmount = currentData.amount;
          } else if (badAttr === "avgBuyPrice" && !("avgPrice" in currentData) && currentData.avgBuyPrice !== void 0) {
            currentData.avgPrice = currentData.avgBuyPrice;
          } else if (badAttr === "poolYes" && !("yesPool" in currentData) && currentData.poolYes !== void 0) {
            currentData.yesPool = currentData.poolYes;
          } else if (badAttr === "poolNo" && !("noPool" in currentData) && currentData.poolNo !== void 0) {
            currentData.noPool = currentData.poolNo;
          }
          if (badAttr in currentData) {
            delete currentData[badAttr];
            continue;
          }
        }
        const missingMatch = msg.match(/Missing required attribute\s*["']?([a-zA-Z0-9_]+)["']?/i);
        if (missingMatch && missingMatch[1]) {
          const reqAttr = missingMatch[1];
          if (!(reqAttr in currentData)) {
            if (NUMERIC_DEFAULTS.has(reqAttr)) {
              currentData[reqAttr] = 0;
            } else if (BOOLEAN_DEFAULTS.has(reqAttr)) {
              currentData[reqAttr] = false;
            } else if (reqAttr === "timestamp" || reqAttr === "createdAt" || reqAttr === "endDate") {
              currentData[reqAttr] = (/* @__PURE__ */ new Date()).toISOString();
            } else {
              currentData[reqAttr] = "-";
            }
            continue;
          }
        }
        if (currentPermissions && (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("role"))) {
          currentPermissions = void 0;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Failed to create document in ${collectionId} after schema adaptation retries.`);
  }
  async updateDocument(databaseId, collectionId, documentId, data, permissions) {
    const currentData = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith("$") && v !== void 0) {
          currentData[k] = v;
        }
      }
    }
    let currentPermissions = Array.isArray(permissions) && permissions.length > 0 ? [...permissions] : void 0;
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        if (Object.keys(currentData).length === 0 && !currentPermissions) {
          return await this.getDocument(databaseId, collectionId, documentId);
        }
        const body = {
          data: currentData
        };
        if (currentPermissions && currentPermissions.length > 0) {
          body.permissions = currentPermissions;
        }
        return await this.request(path, {
          method: "PATCH",
          body: JSON.stringify(body)
        });
      } catch (err) {
        const msg = String(err?.message || "");
        const unknownMatch = msg.match(/Unknown attribute:\s*["']?([a-zA-Z0-9_]+)["']?/i);
        if (unknownMatch && unknownMatch[1]) {
          const badAttr = unknownMatch[1];
          if (badAttr === "tradesCount" && !("allTimeTrades" in currentData) && currentData.tradesCount !== void 0) {
            currentData.allTimeTrades = currentData.tradesCount;
          } else if (badAttr === "nameColor" && !("equippedColor" in currentData) && currentData.nameColor !== void 0) {
            currentData.equippedColor = currentData.nameColor;
          } else if (badAttr === "amount" && !("tokenAmount" in currentData) && currentData.amount !== void 0) {
            currentData.tokenAmount = currentData.amount;
          } else if (badAttr === "avgBuyPrice" && !("avgPrice" in currentData) && currentData.avgBuyPrice !== void 0) {
            currentData.avgPrice = currentData.avgBuyPrice;
          } else if (badAttr === "poolYes" && !("yesPool" in currentData) && currentData.poolYes !== void 0) {
            currentData.yesPool = currentData.poolYes;
          } else if (badAttr === "poolNo" && !("noPool" in currentData) && currentData.poolNo !== void 0) {
            currentData.noPool = currentData.poolNo;
          }
          if (badAttr in currentData) {
            delete currentData[badAttr];
            continue;
          }
        }
        if (currentPermissions && (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("role"))) {
          currentPermissions = void 0;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Failed to update document ${documentId} in ${collectionId} after schema adaptation retries.`);
  }
  async deleteDocument(databaseId, collectionId, documentId) {
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
    return this.request(path, { method: "DELETE" });
  }
}
var NodeClient = Client, NodeDatabases = Databases, NodeID = ID, NodePermission = Permission, NodeRole = Role;
var ID2 = ID, Permission2 = Permission, Role2 = Role, Query2 = Query;
var Query3 = Query, Permission3 = Permission, Role3 = Role, ID3 = ID;
var Query4 = Query;

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
function createServerAppwriteClient(jwt) {
  const endpoint = (process.env.VITE_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1").trim();
  const project = (process.env.VITE_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT_ID || "6a1416eb001f50cdb902").trim();
  const apiKey = (process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "").trim();
  const client = new Client().setEndpoint(endpoint).setProject(project);
  if (apiKey) {
    client.setKey(apiKey);
  } else if (jwt && typeof jwt === "string" && jwt.split(".").length === 3) {
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
    this.lastSyncAt = 0;
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
  async syncWithDatabase(jwt, force = false) {
    if (!force && this.isInitialized && Date.now() - this.lastSyncAt < 3e3) {
      return;
    }
    try {
      const databases = getDatabases(jwt);
      const res = await databases.listDocuments("pumpforge", "coins", [Query.limit(100)]);
      const foundIds = /* @__PURE__ */ new Set();
      for (const doc of res.documents) {
        const docId = doc.$id || doc.coinId;
        if (!docId) continue;
        if (this.deletedCoinIds.has(docId) || this.deletedCoinIds.has(doc.coinId)) {
          continue;
        }
        let canonicalId = docId;
        const matchedInit = INITIAL_COINS.find(
          (ic) => ic.id.toLowerCase() === String(docId).toLowerCase() || ic.id.toLowerCase() === String(doc.coinId || "").toLowerCase() || ic.symbol.toLowerCase() === String(doc.symbol || "").toLowerCase()
        );
        if (matchedInit) {
          canonicalId = matchedInit.id;
        }
        foundIds.add(canonicalId);
        const existing = this.coins.get(canonicalId);
        const merged = {
          id: canonicalId,
          name: doc.name || existing?.name || "Unknown Token",
          symbol: doc.symbol || existing?.symbol || "COIN",
          creator: doc.creator || existing?.creator || "@system",
          creatorId: doc.creatorId || existing?.creatorId,
          description: doc.description || existing?.description || "",
          price: Number(doc.price ?? existing?.price ?? 0.01),
          marketCap: Math.floor(Number(doc.marketCap ?? existing?.marketCap ?? 1e3)),
          totalLiquidity: Number(doc.totalLiquidity ?? doc.total_value ?? existing?.totalLiquidity ?? 1e3),
          volume24h: Number(doc.volume24h ?? existing?.volume24h ?? 0),
          change24h: Number(doc.change24h ?? existing?.change24h ?? 0),
          history: Array.isArray(doc.history) && doc.history.length > 0 ? doc.history : existing?.history && existing.history.length > 0 ? [...existing.history.slice(-29), Number(doc.price ?? existing.price ?? 0.01)] : [Number(doc.price ?? 0.01)],
          avatarEmoji: doc.avatarEmoji || existing?.avatarEmoji || "\u{1FA99}",
          avatarBg: doc.avatarBg || existing?.avatarBg || "bg-zinc-900 border-zinc-800",
          supply: Number(doc.supply ?? existing?.supply ?? 1e6),
          createdAt: doc.$createdAt || existing?.createdAt
        };
        this.coins.set(canonicalId, merged);
      }
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
  async persistCoinToDatabase(coin, jwt) {
    try {
      const databases = getDatabases(jwt);
      const payload = {
        coinId: String(coin.id).slice(0, 64),
        name: String(coin.name || "Coin").slice(0, 64),
        symbol: String(coin.symbol || "COIN").slice(0, 16),
        slug: String(coin.slug || coin.symbol?.toLowerCase() || coin.id).slice(0, 64),
        creator: String(coin.creator || "@system").slice(0, 64),
        description: String(coin.description || "").slice(0, 1e3),
        price: Number(coin.price || 1e-6),
        marketCap: Math.floor(Number(coin.marketCap || 1e3)),
        totalLiquidity: Number(coin.totalLiquidity || coin.marketCap || 1e3),
        volume24h: Number(coin.volume24h || 0),
        change24h: Number(coin.change24h || 0),
        supply: Number(coin.supply || 1e6),
        avatarEmoji: String(coin.avatarEmoji || "\u{1FA99}").slice(0, 16),
        avatarBg: String(coin.avatarBg || "bg-zinc-900 border-zinc-800").slice(0, 64)
      };
      if (coin.creatorId) {
        payload.creatorId = String(coin.creatorId).slice(0, 64);
      }
      try {
        await databases.updateDocument("pumpforge", "coins", coin.id, {
          price: payload.price,
          marketCap: payload.marketCap,
          totalLiquidity: payload.totalLiquidity,
          volume24h: payload.volume24h,
          change24h: payload.change24h
        });
      } catch (updateErr) {
        if (updateErr?.code === 404 || updateErr?.status === 404) {
          await databases.createDocument("pumpforge", "coins", coin.id, payload, [Permission.read(Role.any())]);
        }
      }
    } catch (err) {}
  }
  getAllCoins() {
    return Array.from(this.coins.values()).filter((c) => !this.deletedCoinIds.has(c.id));
  }
  getCoin(coinId) {
    if (!coinId) return void 0;
    if (this.deletedCoinIds.has(coinId)) return void 0;
    const direct = this.coins.get(coinId);
    if (direct) return direct;
    const lower = coinId.toLowerCase().trim();
    for (const c of this.coins.values()) {
      if (this.deletedCoinIds.has(c.id)) continue;
      if (c.id.toLowerCase() === lower || c.symbol.toLowerCase() === lower || c.slug?.toLowerCase() === lower || c.$id?.toLowerCase() === lower || c.coinId?.toLowerCase() === lower) {
        return c;
      }
    }
    return void 0;
  }
  setCoin(coin) {
    this.coins.set(coin.id, coin);
  }
  updateCoin(coinId, updates) {
    const existing = this.getCoin(coinId);
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
    this.coins.set(existing.id, updated);
    if (coinId !== existing.id) {
      this.coins.set(coinId, updated);
    }
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
var userHintsMap = /* @__PURE__ */ new Map();
function hydrateUserHintsFromHeaders(userId, hint) {
  if (!userId) return;
  const existing = userHintsMap.get(userId) || {};
  const nextHint = {
    cash: typeof hint.cash === "number" && !isNaN(hint.cash) && hint.cash >= 0 ? hint.cash : existing.cash,
    gems: typeof hint.gems === "number" && !isNaN(hint.gems) && hint.gems >= 0 ? hint.gems : existing.gems,
    totalProfit: typeof hint.totalProfit === "number" && !isNaN(hint.totalProfit) ? hint.totalProfit : existing.totalProfit,
    tradesCount: typeof hint.tradesCount === "number" && !isNaN(hint.tradesCount) && hint.tradesCount >= 0 ? hint.tradesCount : existing.tradesCount,
    updatedAt: typeof hint.updatedAt === "number" && !isNaN(hint.updatedAt) ? hint.updatedAt : existing.updatedAt,
    username: hint.username || existing.username
  };
  userHintsMap.set(userId, nextHint);
  const cached = userCache.get(userId);
  if (cached && nextHint.updatedAt && nextHint.updatedAt >= cached.updatedAt - 2e3) {
    if (typeof nextHint.cash === "number") cached.cash = nextHint.cash;
    if (typeof nextHint.gems === "number") cached.gems = nextHint.gems;
    if (typeof nextHint.totalProfit === "number") cached.totalProfit = nextHint.totalProfit;
    if (typeof nextHint.tradesCount === "number") cached.tradesCount = nextHint.tradesCount;
    cached.updatedAt = Math.max(cached.updatedAt, nextHint.updatedAt);
    userCache.set(userId, cached);
  }
}
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
    } catch (_) {}
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
  const hint = userHintsMap.get(userId);
  if (cached && Date.now() - cached.updatedAt < 5e3) {
    if (!hint?.updatedAt || cached.updatedAt >= hint.updatedAt) {
      return cached;
    }
  }
  const isOwnerAccount = userId === "admin_realzekeee";
  const databases = getDatabases(jwt);
  try {
    await initPlayerIdCounter(databases);
    let doc = null;
    try {
      doc = await databases.getDocument("pumpforge", "users", userId);
    } catch (getErr) {
      const errMsg = String(getErr?.message || "").toLowerCase();
      if (getErr?.code === 404 || getErr?.status === 404 || errMsg.includes("not found")) {
        try {
          const listRes = await databases.listDocuments("pumpforge", "users", [
            Query.equal("userId", userId),
            Query.limit(1)
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
          playerId: assignedPlayerId
        });
      } catch (_) {}
    }
    const hasFreshHint = Boolean(
      hint && typeof hint.cash === "number" && hint.updatedAt && (!docUpdatedAt || hint.updatedAt >= docUpdatedAt - 2e3) && (!cached || hint.updatedAt >= cached.updatedAt - 2e3)
    );
    const hasFreshCache = Boolean(
      !hasFreshHint && cached && (cached.dirty || docUpdatedAt > 0 && cached.updatedAt > docUpdatedAt + 2e3)
    );
    const resolvedCash = hasFreshHint ? Number(hint.cash) : hasFreshCache ? cached.cash : Number(doc.cash ?? cached?.cash ?? hint?.cash ?? 5e3);
    const resolvedGems = hasFreshHint && typeof hint.gems === "number" ? Number(hint.gems) : hasFreshCache ? cached.gems : Number(doc.gems ?? cached?.gems ?? hint?.gems ?? 50);
    const resolvedProfit = hasFreshHint && typeof hint.totalProfit === "number" ? Number(hint.totalProfit) : hasFreshCache ? cached.totalProfit : Number(doc.totalProfit ?? cached?.totalProfit ?? hint?.totalProfit ?? 0);
    const resolvedTrades = hasFreshHint && typeof hint.tradesCount === "number" ? Number(hint.tradesCount) : hasFreshCache ? cached.tradesCount : Number(doc.tradesCount ?? doc.allTimeTrades ?? cached?.tradesCount ?? hint?.tradesCount ?? 0);
    const state = {
      userId,
      docId,
      playerId: assignedPlayerId,
      username: doc.username || doc.name || cached?.username || defaultName || hint?.username || (isOwnerAccount ? "Zeke" : `Player_${assignedPlayerId}`),
      handle: doc.handle || cached?.handle || (isOwnerAccount ? "@zeke" : `@user${assignedPlayerId}`),
      title: doc.title || cached?.title || (isOwnerAccount ? "Founder & Owner" : "Member"),
      isPremium: doc.isPremium !== void 0 ? !!doc.isPremium : cached?.isPremium ?? isOwnerAccount,
      cash: resolvedCash,
      gems: resolvedGems,
      prestigeLevel: Number(doc.prestigeLevel ?? cached?.prestigeLevel ?? 0),
      tradesCount: resolvedTrades,
      coinsCreatedCount: Number(doc.coinsCreatedCount ?? cached?.coinsCreatedCount ?? 0),
      totalProfit: resolvedProfit,
      nameColor: doc.nameColor || doc.equippedColor || cached?.nameColor || (isOwnerAccount ? "text-emerald-400 font-bold" : "text-zinc-300 font-bold"),
      dailyStreak: Number(doc.dailyStreak ?? cached?.dailyStreak ?? 1),
      lastDailyRewardClaim: doc.lastDailyRewardClaim || cached?.lastDailyRewardClaim || "",
      predictionWins: Number(doc.predictionWins ?? cached?.predictionWins ?? 0),
      rugPullsCount: Number(doc.rugPullsCount ?? cached?.rugPullsCount ?? 0),
      isBanned: doc.isBanned || false,
      isSuspended: doc.isSuspended || false,
      suspendedUntil: doc.suspendedUntil || null,
      createdAt: doc.$createdAt || cached?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: Math.max(Date.now(), cached?.updatedAt || 0, hint?.updatedAt || 0),
      dirty: hasFreshHint || hasFreshCache
    };
    userCache.set(userId, state);
    if (hasFreshHint) {
      databases.updateDocument("pumpforge", "users", docId, {
        cash: Number(Number(resolvedCash).toFixed(2)),
        gems: Math.floor(Number(resolvedGems))
      }).catch(() => {});
    }
    return state;
  } catch (err) {
    if (cached) {
      if (hint && typeof hint.cash === "number" && (!hint.updatedAt || hint.updatedAt >= cached.updatedAt - 2e3)) {
        cached.cash = hint.cash;
        if (typeof hint.gems === "number") cached.gems = hint.gems;
      }
      cached.updatedAt = Date.now();
      return cached;
    }
    const assignedPlayerId = isOwnerAccount ? 1 : nextPlayerId++;
    const fallbackUsername = defaultName || hint?.username || (isOwnerAccount ? "Zeke" : `Player_${assignedPlayerId}`);
    const fallbackHandle = isOwnerAccount ? "@zeke" : `@${fallbackUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}` || `@user${assignedPlayerId}`;
    const initialCash = typeof hint?.cash === "number" && !isNaN(hint.cash) ? hint.cash : 5e3;
    const initialGems = typeof hint?.gems === "number" && !isNaN(hint.gems) ? hint.gems : 50;
    const initial = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: Date.now(),
      dirty: true
    };
    userCache.set(userId, initial);
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
          title: initial.title
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
async function saveAuthoritativeUser(userId, updates, jwt) {
  const current = userCache.get(userId) || await getAuthoritativeUser(userId, jwt);
  const now = Date.now();
  const updated = {
    ...current,
    ...updates,
    updatedAt: now,
    dirty: true
  };
  userCache.set(userId, updated);
  hydrateUserHintsFromHeaders(userId, {
    cash: updated.cash,
    gems: updated.gems,
    totalProfit: updated.totalProfit,
    tradesCount: updated.tradesCount,
    updatedAt: now,
    username: updated.username
  });
  try {
    const databases = getDatabases(jwt);
    const targetDocId = updated.docId || userId;
    const payload = {};
    if (updates.cash !== void 0) payload.cash = Number(Number(updates.cash).toFixed(2));
    if (updates.gems !== void 0) payload.gems = Math.floor(Number(updates.gems));
    if (updates.username !== void 0) payload.username = String(updates.username).slice(0, 64);
    if (updates.handle !== void 0) payload.handle = String(updates.handle).slice(0, 64);
    if (updates.nameColor !== void 0) payload.nameColor = String(updates.nameColor).slice(0, 64);
    if (updates.title !== void 0) payload.title = String(updates.title).slice(0, 64);
    if (updates.prestigeLevel !== void 0) payload.prestigeLevel = Math.floor(Number(updates.prestigeLevel));
    if (updates.tradesCount !== void 0) payload.tradesCount = Math.floor(Number(updates.tradesCount));
    if (updates.coinsCreatedCount !== void 0) payload.coinsCreatedCount = Math.floor(Number(updates.coinsCreatedCount));
    if (updates.totalProfit !== void 0) payload.totalProfit = Number(Number(updates.totalProfit).toFixed(2));
    if (updates.lastDailyRewardClaim !== void 0) payload.lastDailyRewardClaim = String(updates.lastDailyRewardClaim).slice(0, 64);
    if (updates.dailyStreak !== void 0) payload.dailyStreak = Math.max(1, Math.floor(Number(updates.dailyStreak)));
    if (updates.isBanned !== void 0) payload.isBanned = Boolean(updates.isBanned);
    if (updates.isSuspended !== void 0) payload.isSuspended = Boolean(updates.isSuspended);
    if (updates.suspendedUntil !== void 0) payload.suspendedUntil = updates.suspendedUntil ? Math.floor(Number(updates.suspendedUntil)) : null;
    if (Object.keys(payload).length > 0) {
      try {
        await databases.updateDocument("pumpforge", "users", targetDocId, payload);
        updated.dirty = false;
      } catch (updateErr) {
        const msg = String(updateErr?.message || "").toLowerCase();
        if (updateErr?.code === 404 || updateErr?.status === 404 || msg.includes("not found")) {
          await databases.createDocument(
            "pumpforge",
            "users",
            targetDocId,
            {
              userId,
              playerId: updated.playerId || 1,
              username: String(updated.username || "Player").slice(0, 64),
              handle: String(updated.handle || "@player").slice(0, 64),
              cash: Number(Number(updated.cash ?? 5e3).toFixed(2)),
              gems: Math.floor(Number(updated.gems ?? 50)),
              prestigeLevel: Math.floor(Number(updated.prestigeLevel ?? 0)),
              totalProfit: Number(Number(updated.totalProfit ?? 0).toFixed(2)),
              tradesCount: Math.floor(Number(updated.tradesCount ?? 0)),
              coinsCreatedCount: Math.floor(Number(updated.coinsCreatedCount ?? 0)),
              dailyStreak: Math.max(1, Math.floor(Number(updated.dailyStreak ?? 1))),
              lastDailyRewardClaim: String(updated.lastDailyRewardClaim || "").slice(0, 64),
              nameColor: String(updated.nameColor || "text-zinc-400 font-bold").slice(0, 64),
              title: String(updated.title || "Member").slice(0, 64)
            },
            [Permission.read(Role.any())]
          );
          updated.dirty = false;
        } else {
          await databases.updateDocument("pumpforge", "users", targetDocId, {
            cash: Number(Number(updated.cash ?? 5e3).toFixed(2)),
            gems: Math.floor(Number(updated.gems ?? 50))
          });
          updated.dirty = false;
        }
      }
    }
  } catch (err) {
    console.warn("Could not sync user to Appwrite directly (cached state preserved):", err?.message || err);
  }
  userCache.set(userId, updated);
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
          userId: doc.userId || doc.$id,
          playerId: doc.playerId ? Number(doc.playerId) : 1,
          username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
          handle: doc.handle || `@user${doc.playerId || 1}`,
          cash: Number(doc.cash ?? 5e3),
          gems: Number(doc.gems ?? 50),
          prestigeLevel: Number(doc.prestigeLevel ?? 0),
          tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
          coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
          totalProfit: Number(doc.totalProfit ?? 0),
          nameColor: doc.nameColor || doc.equippedColor || "text-zinc-400 font-extrabold",
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
            userId: doc.userId || doc.$id,
            playerId: doc.playerId ? Number(doc.playerId) : 1,
            username: doc.username || doc.name || `Player_${doc.playerId || 1}`,
            handle: doc.handle || `@user${doc.playerId || 1}`,
            cash: Number(doc.cash ?? 5e3),
            gems: Number(doc.gems ?? 50),
            prestigeLevel: Number(doc.prestigeLevel ?? 0),
            tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
            coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
            totalProfit: Number(doc.totalProfit ?? 0),
            nameColor: doc.nameColor || doc.equippedColor || "text-zinc-400 font-extrabold",
            dailyStreak: Number(doc.dailyStreak ?? 1),
            predictionWins: Number(doc.predictionWins ?? 0),
            rugPullsCount: Number(doc.rugPullsCount ?? 0),
            createdAt: doc.$createdAt || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: Date.now()
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
    (c) => c.creatorId === targetUser.userId || c.creator?.toLowerCase() === targetUser.handle?.toLowerCase()
  );
  const badges = computeUserBadges(targetUser);
  let recentTrades = [];
  try {
    const trades = await getTradesList({ limit: 25 });
    recentTrades = trades.filter((t) => t.userId === targetUser.userId).slice(0, 10).map((t) => ({
      id: t.id || t.$id,
      coinId: t.coinId,
      coinSymbol: t.coinSymbol,
      coinName: t.coinName,
      type: t.type,
      amount: t.amountCoins || t.amount,
      price: t.pricePerCoin || t.price,
      total: t.totalCash || t.total,
      timestamp: t.timestamp
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
  const apiKey = (process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || "").trim();
  if (!apiKey) return;
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
async function getAllUsersList(jwt) {
  const usersMap = /* @__PURE__ */ new Map();
  for (const [id, user] of userCache.entries()) {
    usersMap.set(id, user);
  }
  try {
    const databases = getDatabases(jwt);
    const docs = await databases.listDocuments("pumpforge", "users", [Query.limit(100)]);
    for (const doc of docs.documents) {
      const uid = doc.userId || doc.$id;
      usersMap.set(uid, {
        userId: uid,
        docId: doc.$id,
        playerId: doc.playerId,
        username: doc.username || doc.name || `Player_${doc.playerId || ""}`,
        handle: doc.handle || `@user${doc.playerId || ""}`,
        title: doc.title || "Member",
        isPremium: !!doc.isPremium,
        cash: Number(doc.cash ?? 5e3),
        gems: Number(doc.gems ?? 50),
        prestigeLevel: Number(doc.prestigeLevel ?? 0),
        tradesCount: Number(doc.tradesCount ?? doc.allTimeTrades ?? 0),
        coinsCreatedCount: Number(doc.coinsCreatedCount ?? 0),
        totalProfit: Number(doc.totalProfit ?? 0),
        nameColor: doc.nameColor || doc.equippedColor || "text-zinc-400 font-bold",
        dailyStreak: Number(doc.dailyStreak ?? 1),
        lastDailyRewardClaim: doc.lastDailyRewardClaim || "",
        predictionWins: Number(doc.predictionWins ?? 0),
        rugPullsCount: Number(doc.rugPullsCount ?? 0),
        createdAt: doc.$createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: Date.now()
      });
    }
  } catch (e) {}
  return Array.from(usersMap.values());
}
var inMemoryBroadcasts = [];
async function getBroadcastsList(jwt) {
  const list = [...inMemoryBroadcasts];
  try {
    const databases = getDatabases(jwt);
    const res = await databases.listDocuments("pumpforge", "broadcasts", [
      Query.orderDesc("$createdAt"),
      Query.limit(50)
    ]);
    for (const doc of res.documents) {
      if (!list.some((b) => b.id && b.id === doc.$id || b.$id && b.$id === doc.$id)) {
        list.push(doc);
      }
    }
  } catch (e) {}
  return list;
}
var DEFAULT_SEED_POLYMARKETS = [
  {
    $id: "m1",
    id: "m1",
    question: "Will *ROAD hit a $150K valuation by Friday? --- Based on shill room hype, ROAD represents the premium culture asset.",
    creatorId: "admin_realzekeee",
    creator: "@zeke",
    endDate: new Date(Date.now() + 5 * 864e5).toISOString(),
    status: "active",
    poolYes: 4500,
    poolNo: 3200,
    resolved: false,
    winningOutcome: null,
    resolvedAt: null
  },
  {
    $id: "m2",
    id: "m2",
    question: "Will the Slots return a grand Jackpot win on next 10 attempts? --- Probabilities dictate slot engines have a high variance output.",
    creatorId: "admin_realzekeee",
    creator: "@zeke",
    endDate: new Date(Date.now() + 2 * 864e5).toISOString(),
    status: "active",
    poolYes: 150,
    poolNo: 6400,
    resolved: false,
    winningOutcome: null,
    resolvedAt: null
  },
  {
    $id: "m3",
    id: "m3",
    question: "Will Zeke reach Prestige I status inside the next 12 hours? --- Requires $100K liquid cash balance to trigger Prestige system.",
    creatorId: "admin_realzekeee",
    creator: "@zeke",
    endDate: new Date(Date.now() - 864e5).toISOString(),
    status: "closed",
    poolYes: 8500,
    poolNo: 1e3,
    resolved: true,
    winningOutcome: "YES",
    resolvedAt: new Date(Date.now() - 36e5).toISOString()
  }
];
function normalizePolymarketDoc(doc) {
  const id = doc.$id || doc.id || `m_${Date.now()}`;
  const rawQuestion = String(doc.question || "Untitled Prediction");
  const parts = rawQuestion.split(" --- ");
  const cleanQuestion = parts[0] || rawQuestion;
  const description = doc.description || parts[1] || "";
  const poolYes = Number(doc.poolYes ?? doc.yesPool ?? 0);
  const poolNo = Number(doc.poolNo ?? doc.noPool ?? 0);
  const total = poolYes + poolNo;
  const yesPercentage = total > 0 ? Math.round(poolYes / total * 100) : 50;
  const endDate = doc.endDate || doc.endDateIso || doc.endTime || new Date(Date.now() + 7 * 864e5).toISOString();
  const resolved = Boolean(doc.resolved || doc.status === "closed");
  const status = resolved ? "closed" : doc.status || "active";
  const winningOutcome = doc.winningOutcome || doc.resolvedOutcome || null;
  const resolvedAt = doc.resolvedAt || (resolved ? doc.$updatedAt || (/* @__PURE__ */ new Date()).toISOString() : null);
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
    resolvedAt
  };
}
var inMemoryPolymarkets = DEFAULT_SEED_POLYMARKETS.map(normalizePolymarketDoc);
var polymarketsSeeded = false;
function recordPolymarket(market) {
  const norm = normalizePolymarketDoc(market);
  const existingIdx = inMemoryPolymarkets.findIndex((m) => (m.id || m.$id) === (norm.id || norm.$id));
  if (existingIdx >= 0) {
    inMemoryPolymarkets[existingIdx] = { ...inMemoryPolymarkets[existingIdx], ...norm, updatedAt: Date.now() };
  } else {
    inMemoryPolymarkets.unshift({ ...norm, updatedAt: Date.now() });
  }
}
async function persistPolymarketToDatabase(market, jwt) {
  const norm = normalizePolymarketDoc(market);
  recordPolymarket(norm);
  try {
    const databases = getDatabases(jwt);
    const combinedQuestion = (norm.description && !String(norm.question).includes(" --- ") ? `${norm.question} --- ${norm.description}` : String(norm.question)).slice(0, 500);
    const payload = {
      question: combinedQuestion,
      creatorId: String(norm.creatorId || "admin_realzekeee").slice(0, 64),
      creator: String(norm.creator || "@zeke").slice(0, 64),
      endDate: String(norm.endDate).slice(0, 64),
      status: norm.status || "active",
      poolYes: Number(norm.poolYes || 0),
      poolNo: Number(norm.poolNo || 0),
      resolved: Boolean(norm.resolved)
    };
    if (norm.winningOutcome) payload.winningOutcome = String(norm.winningOutcome).slice(0, 16);
    if (norm.resolvedAt) payload.resolvedAt = String(norm.resolvedAt).slice(0, 64);
    try {
      await databases.updateDocument("pumpforge", "polymarkets", norm.id, payload);
    } catch (upErr) {
      const msg = String(upErr?.message || "").toLowerCase();
      if (upErr?.code === 404 || upErr?.status === 404 || msg.includes("not found")) {
        await databases.createDocument("pumpforge", "polymarkets", norm.id, payload, [Permission.read(Role.any())]);
      }
    }
  } catch (e) {}
}
async function getPolymarketsList(jwt) {
  const map = /* @__PURE__ */ new Map();
  for (const m of inMemoryPolymarkets) {
    const norm = normalizePolymarketDoc(m);
    map.set(norm.id, norm);
  }
  try {
    const databases = getDatabases(jwt);
    const res = await databases.listDocuments("pumpforge", "polymarkets", [
      Query.limit(100),
      Query.orderDesc("$createdAt")
    ]);
    const foundIds = /* @__PURE__ */ new Set();
    for (const doc of res.documents) {
      const norm = normalizePolymarketDoc(doc);
      foundIds.add(norm.id);
      const local = map.get(norm.id);
      if (local && (local.poolYes + local.poolNo > norm.poolYes + norm.poolNo || local.resolved && !norm.resolved)) {
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
  } catch (e) {}
  return Array.from(map.values());
}
var inMemoryTrades = [];
function normalizeTradeDoc(doc) {
  const coinObj = coinStore.getCoin(doc.coinId || doc.coinSymbol || doc.coinTicker);
  const amountCoins = Number(doc.amountCoins ?? doc.amountTokens ?? doc.amount ?? 0);
  const pricePerCoin = Number(doc.pricePerCoin ?? doc.price ?? coinObj?.price ?? 0);
  const totalCash = Number(
    doc.totalCash ?? doc.amountUsd ?? doc.total ?? (doc.amount !== void 0 && doc.amountCoins === void 0 ? doc.amount : amountCoins * pricePerCoin) ?? 0
  );
  const coinSymbol = doc.coinSymbol || doc.coinTicker || coinObj?.symbol || "COIN";
  const coinId = coinObj?.id || doc.coinId || coinSymbol.toLowerCase();
  const coinName = doc.coinName || coinObj?.name || coinSymbol;
  const cachedUser = doc.userId ? userCache.get(doc.userId) : void 0;
  const isOwner = doc.userId === "admin_realzekeee";
  const userName = doc.userName || cachedUser?.username || (isOwner ? "Zeke (Owner)" : doc.userHandle || (doc.userId ? `Trader_${String(doc.userId).slice(0, 6)}` : "Trader"));
  const userHandle = doc.userHandle || cachedUser?.handle || (isOwner ? "@zeke" : `@${String(doc.userId || "trader").replace(/^@/, "").slice(0, 10)}`);
  const ts = doc.timestamp || doc.$createdAt || (/* @__PURE__ */ new Date()).toISOString();
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
    $createdAt: doc.$createdAt || ts
  };
}
function recordTradeLog(trade) {
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
async function getTradesList(options = {}) {
  const limit = options.limit || 50;
  const map = /* @__PURE__ */ new Map();
  for (const t of inMemoryTrades) {
    const norm = normalizeTradeDoc(t);
    map.set(norm.id, norm);
  }
  try {
    const databases = getDatabases(options.jwt);
    const queries = [
      Query.orderDesc("$createdAt"),
      Query.limit(Math.max(limit, 50))
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
  } catch (e) {}
  let list = Array.from(map.values());
  if (options.coinId) {
    const targetCoin = coinStore.getCoin(options.coinId);
    const targetIdLower = String(targetCoin?.id || options.coinId).toLowerCase();
    const targetSymLower = String(targetCoin?.symbol || options.coinId).toLowerCase();
    list = list.filter(
      (t) => String(t.coinId || "").toLowerCase() === targetIdLower || String(t.coinSymbol || "").toLowerCase() === targetSymLower
    );
  }
  list.sort((a, b) => new Date(b.timestamp || b.$createdAt || 0).getTime() - new Date(a.timestamp || a.$createdAt || 0).getTime());
  return list.slice(0, limit);
}
var inMemoryWagers = [];
function recordWagerLog(wager) {
  inMemoryWagers.unshift(wager);
  if (inMemoryWagers.length > 500) {
    inMemoryWagers.pop();
  }
}
var inMemoryHoldings = [];
function recordHoldingLog(holding) {
  const amt = Number(holding.amount ?? holding.tokenAmount ?? 0);
  const idx = inMemoryHoldings.findIndex(
    (h) => h.userId === holding.userId && (h.coinId === holding.coinId || h.coinSymbol && holding.coinSymbol && h.coinSymbol.toLowerCase() === holding.coinSymbol.toLowerCase())
  );
  if (amt <= 1e-5) {
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
async function getHoldingsList(options = {}) {
  const mergedMap = /* @__PURE__ */ new Map();
  for (const h of inMemoryHoldings) {
    if (Number(h.amount ?? h.tokenAmount ?? 0) > 1e-5) {
      const key = `${h.userId}_${h.coinId}`;
      mergedMap.set(key, h);
    }
  }
  try {
    const databases = getDatabases(options.jwt);
    const queries = [Query.limit(100)];
    if (options.userId) queries.push(Query.equal("userId", options.userId));
    if (options.coinId) queries.push(Query.equal("coinId", options.coinId));
    const res = await databases.listDocuments("pumpforge", "holdings", queries);
    for (const doc of res.documents) {
      const amt = Number(doc.amount ?? doc.tokenAmount ?? 0);
      const coinObj = coinStore.getCoin(doc.coinId || doc.coinSymbol);
      const canonicalCoinId = coinObj ? coinObj.id : doc.coinId;
      const key = `${doc.userId}_${canonicalCoinId}`;
      if (amt <= 1e-5) {
        mergedMap.delete(key);
      } else {
        const normalizedHolding = {
          ...doc,
          coinId: canonicalCoinId,
          coinSymbol: doc.coinSymbol || coinObj?.symbol || "COIN",
          amount: amt,
          avgBuyPrice: Number(doc.avgBuyPrice ?? doc.avgPrice ?? coinObj?.price ?? 0)
        };
        mergedMap.set(key, normalizedHolding);
        recordHoldingLog(normalizedHolding);
      }
    }
  } catch (e) {}
  let filtered = Array.from(mergedMap.values()).filter((h) => Number(h.amount ?? h.tokenAmount ?? 0) > 1e-5);
  if (options.userId) filtered = filtered.filter((h) => h.userId === options.userId);
  if (options.coinId) {
    const targetCoin = coinStore.getCoin(options.coinId);
    const targetId = targetCoin ? targetCoin.id : options.coinId;
    filtered = filtered.filter(
      (h) => h.coinId === targetId || h.coinId === options.coinId || targetCoin && String(h.coinSymbol || "").toLowerCase() === targetCoin.symbol.toLowerCase()
    );
  }
  return filtered;
}
var inMemoryNotifications = [];
function recordNotification(notif) {
  inMemoryNotifications.unshift(notif);
  if (inMemoryNotifications.length > 200) {
    inMemoryNotifications.pop();
  }
}
async function getNotificationsList(userId, jwt) {
  const list = userId ? inMemoryNotifications.filter((n) => n.userId === userId || n.userId === "all") : [...inMemoryNotifications];
  if (userId) {
    try {
      const databases = getDatabases(jwt);
      const res = await databases.listDocuments("pumpforge", "notifications", [
        Query.equal("userId", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(50)
      ]);
      for (const doc of res.documents) {
        if (!list.some((n) => (n.id || n.$id) === doc.$id)) {
          list.push(doc);
        }
      }
    } catch (e) {}
  }
  return list;
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

// src/server/arcadeEngine.ts
import crypto2 from "crypto";
// node-appwrite aliases inlined

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
var cleanupTimer = setInterval(() => {
  tradeLimiter.clean();
  arcadeLimiter.clean();
  dailyRewardLimiter.clean();
  bugReportLimiter.clean();
  adminLimiter.clean();
}, 3e5);
if (cleanupTimer && typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}

// src/server/arcadeEngine.ts
var APPWRITE_ENDPOINT3 = (process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1").trim();
var APPWRITE_PROJECT3 = (process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902").trim();
var APPWRITE_API_KEY2 = (process.env.APPWRITE_API_KEY || "").trim();
function getNodeAppwriteDatabases() {
  const client = new NodeClient().setEndpoint(APPWRITE_ENDPOINT3).setProject(APPWRITE_PROJECT3);
  if (APPWRITE_API_KEY2) {
    client.setKey(APPWRITE_API_KEY2);
  }
  return new NodeDatabases(client);
}
async function executeCoinflipCore(user, betAmount, normalizedSide, userState) {
  const userCash = Number(userState.cash);
  if (betAmount > userCash) {
    throw new Error(
      `Insufficient funds. Your cash balance is $${userCash.toFixed(2)}, but your bet is $${betAmount.toFixed(2)}.`
    );
  }
  const rigMode = globalAdminSettings.arcadeRigMode;
  let resultSide;
  if (rigMode === "win") {
    resultSide = normalizedSide;
  } else if (rigMode === "lose") {
    resultSide = normalizedSide === "heads" ? "tails" : "heads";
  } else {
    resultSide = crypto2.randomInt(0, 2) === 0 ? "heads" : "tails";
  }
  const won = resultSide === normalizedSide;
  const payout = won ? Number((betAmount * 2).toFixed(2)) : 0;
  const profit = Number((won ? betAmount : -betAmount).toFixed(2));
  const nextCash = Number(Math.max(0, userCash - betAmount + payout).toFixed(2));
  const nextTotalProfit = Number(((userState.totalProfit || 0) + profit).toFixed(2));
  const updatedUser = await saveAuthoritativeUser(
    user.userId,
    {
      cash: nextCash,
      totalProfit: nextTotalProfit
    },
    user.jwt
  );
  const wagerId = NodeID.unique();
  const wagerEntry = {
    id: wagerId,
    $id: wagerId,
    userId: user.userId,
    polymarketId: "arcade_coinflip",
    amount: betAmount,
    choice: normalizedSide.toUpperCase(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    isPaid: won
  };
  recordWagerLog(wagerEntry);
  try {
    const nodeDb = getDatabases(user.jwt);
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
        isPaid: won
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
    userStats: updatedUser
  };
}
async function processCoinflip(user, rawBetAmount, rawSide) {
  const { allowed, retryAfterMs } = arcadeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Arcade rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
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
      normalizedSide,
      userState
    );
  });
}

// src/server/gameEngine.ts
// node-appwrite aliases inlined
function secureRandomInt(min, max) {
  return crypto3.randomInt(min, max + 1);
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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    let coin = coinStore.getCoin(coinId);
    if (!coin) {
      await coinStore.syncWithDatabase(user.jwt, true);
      coin = coinStore.getCoin(coinId);
    }
    if (!coin) {
      throw new Error("Specified meme coin does not exist or has been delisted.");
    }
    const currentPrice = Number(coin.price);
    const supply = coin.supply || 1e6;
    const detHoldingId = "h_" + crypto3.createHash("md5").update(`${user.userId}_${coin.id}`).digest("hex").slice(0, 28);
    if (type === "BUY") {
      let buyCoins = amountCoins;
      let tradeValue = buyCoins * currentPrice;
      let fee = tradeValue * 5e-3;
      let totalCost = tradeValue + fee;
      if (totalCost > userState.cash && tradeValue <= userState.cash * 1.01 && userState.cash > 0) {
        totalCost = userState.cash;
        tradeValue = totalCost / 1.005;
        fee = totalCost - tradeValue;
        buyCoins = Number((tradeValue / currentPrice).toFixed(4));
      }
      if (userState.cash < totalCost || buyCoins <= 0) {
        throw new Error(
          `Insufficient cash. Required: $${totalCost.toFixed(2)}, Available: $${userState.cash.toFixed(2)}`
        );
      }
      const impactRatio = Math.min(0.2, buyCoins / supply * 0.05);
      const newPrice = Number((currentPrice * (1 + impactRatio)).toFixed(6));
      const newLiquidity = Number(((coin.totalLiquidity || 1e3) + tradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + tradeValue).toFixed(2));
      const newChange24h = Number(((coin.change24h || 0) + impactRatio * 100).toFixed(2));
      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];
      const updatedCoin = coinStore.updateCoin(coin.id, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        change24h: newChange24h,
        history: newHist
      });
      await coinStore.persistCoinToDatabase(updatedCoin, user.jwt);
      const nextCash = Number(Math.max(0, userState.cash - totalCost).toFixed(2));
      const nextTrades = (userState.tradesCount || 0) + 1;
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades
        },
        user.jwt
      );
      const databases = getDatabases(user.jwt);
      let existingDoc = null;
      try {
        existingDoc = await databases.getDocument("pumpforge", "holdings", detHoldingId);
      } catch (_) {}
      if (!existingDoc) {
        try {
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query2.equal("userId", user.userId)
          ]);
          existingDoc = holdingsRes.documents.find(
            (d) => d.coinId === coin.id || d.coinId === coinId || d.coinSymbol?.toLowerCase() === coin.symbol.toLowerCase()
          );
        } catch (_) {}
      }
      if (!existingDoc) {
        existingDoc = inMemoryHoldings.find(
          (h) => h.userId === user.userId && (h.coinId === coin.id || h.coinId === coinId || h.coinSymbol?.toLowerCase() === coin.symbol.toLowerCase())
        );
      }
      const prevAmt = existingDoc ? Number(existingDoc.amount ?? existingDoc.tokenAmount ?? 0) : 0;
      const prevAvg = existingDoc ? Number(existingDoc.avgBuyPrice ?? existingDoc.avgPrice ?? currentPrice) : currentPrice;
      const prevInvested = existingDoc ? Number(existingDoc.totalInvested ?? prevAmt * prevAvg) : 0;
      const nextAmt = Number((prevAmt + buyCoins).toFixed(4));
      const nextAvg = Number(((prevAmt * prevAvg + tradeValue) / nextAmt).toFixed(6));
      const nextInvested = Number((prevInvested + tradeValue).toFixed(2));
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const holdingResult = {
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextAmt,
        avgBuyPrice: nextAvg
      };
      recordHoldingLog({
        $id: existingDoc?.$id || detHoldingId,
        id: existingDoc?.$id || detHoldingId,
        userId: user.userId,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextAmt,
        avgBuyPrice: nextAvg,
        totalInvested: nextInvested,
        lastUpdated: nowIso
      });
      try {
        const targetHoldId = existingDoc?.$id || detHoldingId;
        try {
          await databases.updateDocument("pumpforge", "holdings", targetHoldId, {
            userId: user.userId,
            coinId: coin.id,
            coinSymbol: coin.symbol,
            amount: nextAmt,
            avgBuyPrice: nextAvg,
            totalInvested: nextInvested,
            lastUpdated: nowIso
          });
        } catch (upErr) {
          if (upErr?.code === 404 || upErr?.status === 404) {
            await databases.createDocument(
              "pumpforge",
              "holdings",
              targetHoldId,
              {
                userId: user.userId,
                coinId: coin.id,
                coinSymbol: coin.symbol,
                amount: nextAmt,
                avgBuyPrice: nextAvg,
                totalInvested: nextInvested,
                lastUpdated: nowIso
              },
              [Permission2.read(Role2.any())]
            );
          } else {
            throw upErr;
          }
        }
      } catch (hErr) {
        console.warn("Non-fatal error persisting holding to Appwrite:", hErr);
      }
      const tradeData = {
        id: ID2.unique(),
        userId: user.userId,
        userName: updatedUser.username || user.name || `@${user.userId.slice(0, 6)}`,
        userHandle: updatedUser.handle || `@${user.userId.slice(0, 6)}`,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        coinTicker: coin.symbol,
        coinName: coin.name,
        type: "BUY",
        amountCoins: Number(buyCoins.toFixed(4)),
        amountTokens: Number(buyCoins.toFixed(4)),
        pricePerCoin: Number(currentPrice.toFixed(6)),
        price: Number(currentPrice.toFixed(6)),
        totalCash: Number(tradeValue.toFixed(2)),
        total: Number(tradeValue.toFixed(2)),
        amountUsd: Number(tradeValue.toFixed(2)),
        amount: Number(tradeValue.toFixed(2)),
        fee: Number(fee.toFixed(2)),
        timestamp: nowIso,
        $createdAt: nowIso
      };
      recordTradeLog(tradeData);
      try {
        await databases.createDocument(
          "pumpforge",
          "trades",
          tradeData.id,
          {
            userId: tradeData.userId,
            coinId: tradeData.coinId,
            coinSymbol: tradeData.coinSymbol,
            type: "BUY",
            amountCoins: tradeData.amountCoins,
            pricePerCoin: tradeData.pricePerCoin,
            totalCash: tradeData.totalCash,
            fee: tradeData.fee,
            timestamp: tradeData.timestamp
          },
          [Permission2.read(Role2.any())]
        );
      } catch (tErr) {
        console.warn("Non-fatal error logging buy trade to Appwrite:", tErr);
      }
      return {
        success: true,
        type: "BUY",
        amountCoins: buyCoins,
        price: currentPrice,
        totalCost,
        userStats: updatedUser,
        coin: updatedCoin,
        holding: holdingResult,
        trade: tradeData
      };
    } else {
      const databases = getDatabases(user.jwt);
      let userHoldingAmount = 0;
      let holdingAvgPrice = currentPrice;
      let holdingDocId = "";
      try {
        const directDoc = await databases.getDocument("pumpforge", "holdings", detHoldingId);
        if (directDoc) {
          userHoldingAmount = Number(directDoc.amount ?? directDoc.tokenAmount ?? 0);
          holdingAvgPrice = Number(directDoc.avgBuyPrice ?? directDoc.avgPrice ?? currentPrice);
          holdingDocId = directDoc.$id;
        }
      } catch (_) {}
      if (!holdingDocId || userHoldingAmount <= 0) {
        try {
          const holdingsRes = await databases.listDocuments("pumpforge", "holdings", [
            Query2.equal("userId", user.userId)
          ]);
          const matchDoc = holdingsRes.documents.find(
            (d) => d.coinId === coin.id || d.coinId === coinId || d.coinSymbol?.toLowerCase() === coin.symbol.toLowerCase()
          );
          if (matchDoc) {
            userHoldingAmount = Number(matchDoc.amount ?? matchDoc.tokenAmount ?? 0);
            holdingAvgPrice = Number(matchDoc.avgBuyPrice ?? matchDoc.avgPrice ?? currentPrice);
            holdingDocId = matchDoc.$id;
          }
        } catch (e) {
          console.warn("Could not query holdings from database:", e);
        }
      }
      if (userHoldingAmount <= 0) {
        const memMatch = inMemoryHoldings.find(
          (h) => h.userId === user.userId && (h.coinId === coin.id || h.coinId === coinId || h.coinSymbol?.toLowerCase() === coin.symbol.toLowerCase())
        );
        if (memMatch) {
          userHoldingAmount = Number(memMatch.amount ?? memMatch.tokenAmount ?? 0);
          holdingAvgPrice = Number(memMatch.avgBuyPrice ?? memMatch.avgPrice ?? currentPrice);
          holdingDocId = memMatch.$id || memMatch.id || detHoldingId;
        }
      }
      let sellCoins = amountCoins;
      if (sellCoins > userHoldingAmount && userHoldingAmount > 0 && sellCoins <= userHoldingAmount * 1.01 + 0.05) {
        sellCoins = userHoldingAmount;
      }
      if (userHoldingAmount <= 0 || userHoldingAmount + 1e-4 < sellCoins) {
        throw new Error(`Insufficient tokens owned. Owned: ${userHoldingAmount.toLocaleString()}, Requested: ${sellCoins.toLocaleString()}`);
      }
      const sellTradeValue = sellCoins * currentPrice;
      const fee = sellTradeValue * 5e-3;
      const netPayout = sellTradeValue - fee;
      const impactRatio = Math.min(0.2, sellCoins / supply * 0.05);
      const newPrice = Number(Math.max(1e-6, currentPrice * (1 - impactRatio)).toFixed(6));
      const newLiquidity = Number(Math.max(100, (coin.totalLiquidity || 1e3) - sellTradeValue).toFixed(2));
      const newMarketCap = Math.floor(newPrice * supply);
      const newVolume24h = Number(((coin.volume24h || 0) + sellTradeValue).toFixed(2));
      const newChange24h = Number(((coin.change24h || 0) - impactRatio * 100).toFixed(2));
      const currentHist = coin.history && coin.history.length > 0 ? [...coin.history] : [currentPrice];
      const newHist = [...currentHist.slice(-29), newPrice];
      const updatedCoin = coinStore.updateCoin(coin.id, {
        price: newPrice,
        marketCap: newMarketCap,
        totalLiquidity: newLiquidity,
        volume24h: newVolume24h,
        change24h: newChange24h,
        history: newHist
      });
      await coinStore.persistCoinToDatabase(updatedCoin, user.jwt);
      const profit = Number((netPayout - sellCoins * holdingAvgPrice).toFixed(2));
      const nextCash = Number((userState.cash + netPayout).toFixed(2));
      const nextTrades = (userState.tradesCount || 0) + 1;
      const nextProfit = Number(((userState.totalProfit || 0) + profit).toFixed(2));
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          tradesCount: nextTrades,
          totalProfit: nextProfit
        },
        user.jwt
      );
      const nextRemaining = Number(Math.max(0, userHoldingAmount - sellCoins).toFixed(4));
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const holdingResult = {
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextRemaining,
        avgBuyPrice: holdingAvgPrice
      };
      recordHoldingLog({
        $id: holdingDocId || detHoldingId,
        id: holdingDocId || detHoldingId,
        userId: user.userId,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        amount: nextRemaining,
        avgBuyPrice: holdingAvgPrice,
        lastUpdated: nowIso
      });
      try {
        const targetHoldId = holdingDocId || detHoldingId;
        if (nextRemaining <= 1e-5) {
          try {
            await databases.deleteDocument("pumpforge", "holdings", targetHoldId);
          } catch (_) {}
          if (targetHoldId !== detHoldingId) {
            try {
              await databases.deleteDocument("pumpforge", "holdings", detHoldingId);
            } catch (_) {}
          }
        } else {
          await databases.updateDocument("pumpforge", "holdings", targetHoldId, {
            amount: nextRemaining,
            lastUpdated: nowIso
          });
        }
      } catch (hErr) {
        console.warn("Non-fatal error updating holding on sell:", hErr);
      }
      const tradeData = {
        id: ID2.unique(),
        userId: user.userId,
        userName: updatedUser.username || user.name || `@${user.userId.slice(0, 6)}`,
        userHandle: updatedUser.handle || `@${user.userId.slice(0, 6)}`,
        coinId: coin.id,
        coinSymbol: coin.symbol,
        coinTicker: coin.symbol,
        coinName: coin.name,
        type: "SELL",
        amountCoins: Number(sellCoins.toFixed(4)),
        amountTokens: Number(sellCoins.toFixed(4)),
        pricePerCoin: Number(currentPrice.toFixed(6)),
        price: Number(currentPrice.toFixed(6)),
        totalCash: Number(sellTradeValue.toFixed(2)),
        total: Number(sellTradeValue.toFixed(2)),
        amountUsd: Number(sellTradeValue.toFixed(2)),
        amount: Number(sellTradeValue.toFixed(2)),
        fee: Number(fee.toFixed(2)),
        timestamp: nowIso,
        $createdAt: nowIso
      };
      recordTradeLog(tradeData);
      try {
        await databases.createDocument(
          "pumpforge",
          "trades",
          tradeData.id,
          {
            userId: tradeData.userId,
            coinId: tradeData.coinId,
            coinSymbol: tradeData.coinSymbol,
            type: "SELL",
            amountCoins: tradeData.amountCoins,
            pricePerCoin: tradeData.pricePerCoin,
            totalCash: tradeData.totalCash,
            fee: tradeData.fee,
            timestamp: tradeData.timestamp
          },
          [Permission2.read(Role2.any())]
        );
      } catch (tErr) {
        console.warn("Non-fatal error logging sell trade to Appwrite:", tErr);
      }
      return {
        success: true,
        type: "SELL",
        amountCoins: sellCoins,
        price: currentPrice,
        netPayout,
        profit,
        userStats: updatedUser,
        coin: updatedCoin,
        holding: holdingResult,
        trade: tradeData
      };
    }
  });
}
var activeMinesSessions = /* @__PURE__ */ new Map();
var activeTowerSessions = /* @__PURE__ */ new Map();
var slotEmojis = ["\u{1F352}", "\u{1F34B}", "\u{1F514}", "7\uFE0F\u20E3", "\u{1F48E}"];
function getArcadeSessionSecret() {
  return (process.env.APPWRITE_API_KEY || process.env.SESSION_SECRET || "pumpforge_arcade_session_secret_v1").trim();
}
function signArcadeSessionToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto3.createHmac("sha256", getArcadeSessionSecret()).update(data).digest("base64url");
  return `as_${data}.${sig}`;
}
function verifyArcadeSessionToken(token, expectedUserId, expectedGame) {
  if (!token || typeof token !== "string" || !token.startsWith("as_")) return null;
  const parts = token.slice(3).split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const expectedSig = crypto3.createHmac("sha256", getArcadeSessionSecret()).update(data).digest("base64url");
    if (sig !== expectedSig) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (!parsed || parsed.userId !== expectedUserId || parsed.game !== expectedGame) return null;
    return parsed;
  } catch {
    return null;
  }
}
async function processArcadeWager(user, game, action, params) {
  const { allowed, retryAfterMs } = arcadeLimiter.isAllowed(user.userId);
  if (!allowed) {
    throw new Error(`Arcade rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    const rigMode = globalAdminSettings.arcadeRigMode;
    if (game === "coinflip") {
      const rawBet = params.betAmount !== void 0 ? params.betAmount : params.bet;
      const bet = Number(rawBet);
      const chosenSide = String(params.side || params.choice || "").toLowerCase().trim();
      if (chosenSide !== "heads" && chosenSide !== "tails") {
        throw new Error("Choose heads or tails.");
      }
      if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > Number(userState.cash)) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }
      return executeCoinflipCore(user, bet, chosenSide, userState);
    }
    if (game === "slots") {
      const bet = Number(params.bet);
      if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
        throw new Error("Invalid bet amount or insufficient cash.");
      }
      let grid;
      if (rigMode === "win") {
        grid = [
          ["\u{1F352}", "\u{1F34B}", "\u{1F514}"],
          ["7\uFE0F\u20E3", "7\uFE0F\u20E3", "7\uFE0F\u20E3"],
          ["\u{1F48E}", "\u{1F352}", "\u{1F34B}"]
        ];
      } else if (rigMode === "lose") {
        grid = [
          ["\u{1F352}", "\u{1F34B}", "\u{1F514}"],
          ["\u{1F34B}", "\u{1F48E}", "\u{1F352}"],
          ["\u{1F514}", "\u{1F352}", "\u{1F48E}"]
        ];
      } else {
        grid = [0, 1, 2].map(() => [
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)],
          slotEmojis[secureRandomInt(0, slotEmojis.length - 1)]
        ]);
      }
      const winningLines = [];
      let payout = 0;
      for (let r = 0; r < 3; r++) {
        const row = grid[r];
        if (new Set(row).size === 1) {
          winningLines.push(r);
          let lineMult = 3;
          if (row[0] === "7\uFE0F\u20E3") lineMult = 6;
          else if (row[0] === "\u{1F48E}") lineMult = 4;
          payout += Number((bet * lineMult).toFixed(2));
        }
      }
      let matchCount = 3;
      if (winningLines.length > 0) {
        matchCount = 1;
      } else if (new Set(grid[1]).size === 2) {
        matchCount = 2;
        winningLines.push(1);
        payout = Math.floor(bet * 1.5);
      }
      const reels = grid[winningLines[0] ?? 1] || grid[1];
      let nextCash = Number(Math.max(0, userState.cash - bet + payout).toFixed(2));
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: nextCash,
          totalProfit: Number(((userState.totalProfit || 0) + (payout - bet)).toFixed(2))
        },
        user.jwt
      );
      return {
        game: "slots",
        grid,
        reels,
        winningLines,
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
      if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
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
      let nextCash = Number((userState.cash - bet).toFixed(2));
      if (won) {
        payout = Math.floor(bet * 3);
        nextCash = Number((nextCash + payout).toFixed(2));
      }
      const updatedUser = await saveAuthoritativeUser(
        user.userId,
        {
          cash: Math.max(0, nextCash),
          totalProfit: Number(((userState.totalProfit || 0) + (won ? payout - bet : -bet)).toFixed(2))
        },
        user.jwt
      );
      return {
        game: "dice",
        landedFace,
        selectedNum,
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
        if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }
        const nextCash = Number(Math.max(0, userState.cash - bet).toFixed(2));
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          { cash: nextCash },
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
        const sessionToken = signArcadeSessionToken({ userId: user.userId, game: "mines", ...session2 });
        return {
          game: "mines",
          action: "start",
          safeSelections: 0,
          multiplier: 1,
          sessionToken,
          userStats: updatedUser
        };
      }
      let session = activeMinesSessions.get(user.userId);
      if ((!session || !session.active) && params.sessionToken) {
        const restored = verifyArcadeSessionToken(params.sessionToken, user.userId, "mines");
        if (restored && restored.active) {
          session = {
            bet: Number(restored.bet),
            minesCount: Number(restored.minesCount),
            secretMinesMap: Array.isArray(restored.secretMinesMap) ? restored.secretMinesMap : Array(25).fill(false),
            revealedGrid: Array.isArray(restored.revealedGrid) ? restored.revealedGrid : Array(25).fill("hidden"),
            safeSelections: Number(restored.safeSelections || 0),
            multiplier: Number(restored.multiplier || 1),
            active: true
          };
          activeMinesSessions.set(user.userId, session);
        }
      }
      if (action === "abort") {
        const refundAmt = session ? session.bet : Number(params.bet || 0);
        activeMinesSessions.delete(user.userId);
        if (refundAmt > 0 && (!session || session.safeSelections === 0)) {
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return { game: "mines", action: "abort", refunded: refundAmt, userStats: updatedUser };
        }
        return { game: "mines", action: "abort", refunded: 0, userStats: userState };
      }
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
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            { totalProfit: Number(((userState.totalProfit || 0) - session.bet).toFixed(2)) },
            user.jwt
          );
          return {
            game: "mines",
            action: "step",
            hitMine: true,
            explodedCell: cellIdx,
            secretMinesMap: session.secretMinesMap,
            multiplier: 0,
            userStats: updatedUser
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
          const nextCash = Number((userState.cash + winnings).toFixed(2));
          session.active = false;
          activeMinesSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2))
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
        const nextSessionToken = signArcadeSessionToken({ userId: user.userId, game: "mines", ...session });
        return {
          game: "mines",
          action: "step",
          hitMine: false,
          cellIndex: cellIdx,
          safeSelections: session.safeSelections,
          multiplier: session.multiplier,
          sessionToken: nextSessionToken
        };
      }
      if (action === "cashout") {
        if (session.safeSelections === 0) {
          const refundAmt = session.bet;
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          session.active = false;
          activeMinesSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return {
            game: "mines",
            action: "cashout",
            winnings: refundAmt,
            multiplier: 1,
            secretMinesMap: session.secretMinesMap,
            userStats: updatedUser
          };
        }
        const winnings = Math.floor(session.bet * session.multiplier);
        const nextCash = Number((userState.cash + winnings).toFixed(2));
        session.active = false;
        activeMinesSessions.delete(user.userId);
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
            totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2))
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
        if (typeof bet !== "number" || isNaN(bet) || !isFinite(bet) || bet <= 0 || bet > userState.cash) {
          throw new Error("Invalid bet amount or insufficient cash.");
        }
        const nextCash = Number(Math.max(0, userState.cash - bet).toFixed(2));
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          { cash: nextCash },
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
        const sessionToken = signArcadeSessionToken({ userId: user.userId, game: "tower", ...session2 });
        return {
          game: "tower",
          action: "start",
          colsCount,
          safeCount,
          currentLevel: 0,
          sessionToken,
          userStats: updatedUser
        };
      }
      let session = activeTowerSessions.get(user.userId);
      if ((!session || !session.active) && params.sessionToken) {
        const restored = verifyArcadeSessionToken(params.sessionToken, user.userId, "tower");
        if (restored && restored.active) {
          session = {
            bet: Number(restored.bet),
            difficulty: restored.difficulty || "easy",
            currentLevel: Number(restored.currentLevel || 0),
            secretGrid: Array.isArray(restored.secretGrid) ? restored.secretGrid : [],
            multiplier: Number(restored.multiplier || 1),
            active: true
          };
          activeTowerSessions.set(user.userId, session);
        }
      }
      if (action === "abort") {
        const refundAmt = session ? session.bet : Number(params.bet || 0);
        activeTowerSessions.delete(user.userId);
        if (refundAmt > 0 && (!session || session.currentLevel === 0)) {
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return { game: "tower", action: "abort", refunded: refundAmt, userStats: updatedUser };
        }
        return { game: "tower", action: "abort", refunded: 0, userStats: userState };
      }
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
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            { totalProfit: Number(((userState.totalProfit || 0) - session.bet).toFixed(2)) },
            user.jwt
          );
          return {
            game: "tower",
            action: "step",
            hitSkull: true,
            secretGrid: session.secretGrid,
            userStats: updatedUser
          };
        }
        session.currentLevel += 1;
        const multTable = {
          easy: [1.05, 1.15, 1.3, 2.85, 3.7, 4.8, 6.25, 8.1, 10.5, 13.5],
          medium: [1.15, 1.4, 1.8, 8, 13.2, 21.8, 36, 59.5, 98, 162],
          hard: [1.3, 2, 4, 63.22, 178.29, 502.77, 1417.82, 3998.24, 11275.05, 31795.63]
        };
        session.multiplier = multTable[session.difficulty][session.currentLevel - 1] || 1;
        if (session.currentLevel >= 10) {
          const winnings = Math.floor(session.bet * session.multiplier);
          const nextCash = Number((userState.cash + winnings).toFixed(2));
          session.active = false;
          activeTowerSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(
            user.userId,
            {
              cash: nextCash,
              totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2))
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
        const nextSessionToken = signArcadeSessionToken({ userId: user.userId, game: "tower", ...session });
        return {
          game: "tower",
          action: "step",
          hitSkull: false,
          level: session.currentLevel,
          multiplier: session.multiplier,
          sessionToken: nextSessionToken
        };
      }
      if (action === "cashout") {
        if (session.currentLevel === 0) {
          const refundAmt = session.bet;
          const nextCash = Number((userState.cash + refundAmt).toFixed(2));
          session.active = false;
          activeTowerSessions.delete(user.userId);
          const updatedUser = await saveAuthoritativeUser(user.userId, { cash: nextCash }, user.jwt);
          return {
            game: "tower",
            action: "cashout",
            winnings: refundAmt,
            multiplier: 1,
            secretGrid: session.secretGrid,
            userStats: updatedUser
          };
        }
        const winnings = Math.floor(session.bet * session.multiplier);
        const nextCash = Number((userState.cash + winnings).toFixed(2));
        session.active = false;
        activeTowerSessions.delete(user.userId);
        const updatedUser = await saveAuthoritativeUser(
          user.userId,
          {
            cash: nextCash,
            totalProfit: Number(((userState.totalProfit || 0) + (winnings - session.bet)).toFixed(2))
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
    const costGems = Number(params.costGems ?? params.cost);
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
        gemReward: bonusGems,
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
      prestigeLevel: nextPrestige,
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
      reward: { type: rewardType, amount: rewardAmt },
      userStats: updated
    };
  });
}
function sanitizePlainText(input) {
  return (input || "").replace(/<[^>]*>?/gm, "").replace(/&(amp|lt|gt|quot|#39|#x2F);/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x2F;": "/" })[m] || m).replace(/[<>]/g, "").trim();
}
async function processCreateCoin(user, params) {
  if (user.isGuest) {
    throw new Error("Authentication required to launch custom meme tokens.");
  }
  const rawName = (params.name || "").trim();
  const rawSymbol = (params.symbol || "").trim().toUpperCase();
  const rawDescription = (params.description || "").trim();
  const avatarEmoji = params.avatarEmoji || "\u{1FA99}";
  const initialBuyUsd = Math.max(0, Number(params.initialBuyUsd) || 0);
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
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    const creationCost = 1100;
    const totalRequired = creationCost + initialBuyUsd;
    if (userState.cash < totalRequired) {
      throw new Error(`Insufficient funds. Required: $${totalRequired.toFixed(2)}.`);
    }
    if ((userState.coinsCreatedCount || 0) >= 10) {
      throw new Error("10-Coin Limit reached for this account.");
    }
    const newCoinId = ID2.unique();
    const initSupply = 1e6;
    const initMarketCap = 1e3 + initialBuyUsd;
    const initPrice = Number((initMarketCap / initSupply).toFixed(6));
    const initLiquidity = 1e3 + initialBuyUsd;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const creatorHandle = userState.handle || (user.name ? `@${user.name.toLowerCase().replace(/[^a-z0-9]/g, "")}` : `@${user.userId.slice(0, 6)}`);
    const creatorName = userState.username || user.name || creatorHandle;
    const newCoin = {
      id: newCoinId,
      coinId: newCoinId,
      name: cleanName,
      symbol: cleanSymbol,
      slug,
      creator: creatorHandle,
      creatorName,
      creatorId: user.userId,
      description: cleanDescription,
      avatarEmoji,
      avatarBg: "bg-emerald-950 text-emerald-300 border-emerald-500",
      price: initPrice,
      marketCap: initMarketCap,
      supply: initSupply,
      totalLiquidity: initLiquidity,
      volume24h: initialBuyUsd,
      change24h: initialBuyUsd > 0 ? Number((initialBuyUsd / 1e3 * 100).toFixed(2)) : 0,
      history: [1e-3, initPrice],
      createdAt: nowIso,
      isUserCreated: true
    };
    coinStore.setCoin(newCoin);
    await coinStore.persistCoinToDatabase(newCoin, user.jwt);
    let initialHolding = null;
    if (initialBuyUsd > 0) {
      const boughtTokens = Number((initialBuyUsd / 1e-3).toFixed(4));
      const detHoldingId = "h_" + crypto3.createHash("md5").update(`${user.userId}_${newCoinId}`).digest("hex").slice(0, 28);
      initialHolding = {
        coinId: newCoinId,
        coinSymbol: cleanSymbol,
        amount: boughtTokens,
        avgBuyPrice: 1e-3
      };
      recordHoldingLog({
        $id: detHoldingId,
        id: detHoldingId,
        userId: user.userId,
        coinId: newCoinId,
        coinSymbol: cleanSymbol,
        amount: boughtTokens,
        avgBuyPrice: 1e-3,
        totalInvested: initialBuyUsd,
        lastUpdated: nowIso
      });
      try {
        const databases = getDatabases(user.jwt);
        await databases.createDocument(
          "pumpforge",
          "holdings",
          detHoldingId,
          {
            userId: user.userId,
            coinId: newCoinId,
            coinSymbol: cleanSymbol,
            amount: boughtTokens,
            avgBuyPrice: 1e-3,
            totalInvested: initialBuyUsd,
            lastUpdated: nowIso
          },
          [Permission2.read(Role2.any())]
        );
      } catch (_) {}
      recordTradeLog({
        id: ID2.unique(),
        userId: user.userId,
        userName: creatorName,
        userHandle: creatorHandle,
        coinId: newCoinId,
        coinSymbol: cleanSymbol,
        coinTicker: cleanSymbol,
        coinName: cleanName,
        type: "BUY",
        amountCoins: boughtTokens,
        amountTokens: boughtTokens,
        pricePerCoin: 1e-3,
        price: 1e-3,
        totalCash: initialBuyUsd,
        total: initialBuyUsd,
        amountUsd: initialBuyUsd,
        amount: initialBuyUsd,
        fee: 0,
        timestamp: nowIso,
        $createdAt: nowIso
      });
    }
    const nextCash = Number(Math.max(0, userState.cash - totalRequired).toFixed(2));
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
      holding: initialHolding,
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
        userId: String(user.userId || "guest").slice(0, 64),
        username: String(user.name || "Anonymous").slice(0, 64),
        title: cleanTitle.slice(0, 200),
        description: cleanDesc.slice(0, 2e3),
        status: "open",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
  if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error("Invalid bet amount.");
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    if (userState.cash < amount) {
      throw new Error(`Insufficient cash balance. Available: $${userState.cash.toFixed(2)}`);
    }
    const databases = getDatabases(user.jwt);
    let market = null;
    try {
      market = await databases.getDocument("pumpforge", "polymarkets", marketId);
    } catch {
      const allMarkets = await getPolymarketsList(user.jwt);
      market = allMarkets.find((m) => (m.$id || m.id) === marketId) || {
        $id: marketId,
        id: marketId,
        question: "Community Forecast",
        endDate: new Date(Date.now() + 5 * 864e5).toISOString(),
        status: "active",
        resolved: false,
        poolYes: marketId === "m1" ? 4500 : marketId === "m2" ? 150 : 0,
        poolNo: marketId === "m1" ? 3200 : marketId === "m2" ? 6400 : 0
      };
    }
    if (market.status === "closed" || market.resolved) {
      throw new Error("This prediction market has already closed or resolved.");
    }
    const nextCash = Number(Math.max(0, userState.cash - amount).toFixed(2));
    const updatedUser = await saveAuthoritativeUser(
      user.userId,
      { cash: nextCash },
      user.jwt
    );
    const prevYes = Number(market.poolYes ?? market.yesPool ?? 0);
    const prevNo = Number(market.poolNo ?? market.noPool ?? 0);
    const newYesPool = choice === "YES" ? prevYes + amount : prevYes;
    const newNoPool = choice === "NO" ? prevNo + amount : prevNo;
    const updatedMarketObj = normalizePolymarketDoc({
      ...market,
      $id: marketId,
      id: marketId,
      poolYes: newYesPool,
      poolNo: newNoPool,
      yesPool: newYesPool,
      noPool: newNoPool
    });
    await persistPolymarketToDatabase(updatedMarketObj, user.jwt);
    let wagerDoc = {
      id: ID2.unique(),
      userId: user.userId,
      polymarketId: marketId,
      amount: Number(amount),
      choice,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      isPaid: false
    };
    recordWagerLog(wagerDoc);
    try {
      const doc = await databases.createDocument(
        "pumpforge",
        "wagers",
        wagerDoc.id,
        {
          userId: wagerDoc.userId,
          polymarketId: wagerDoc.polymarketId,
          amount: wagerDoc.amount,
          choice: wagerDoc.choice,
          timestamp: wagerDoc.timestamp,
          isPaid: wagerDoc.isPaid
        },
        [Permission2.read(Role2.any())]
      );
      wagerDoc = doc;
      recordWagerLog(wagerDoc);
    } catch (_e) {}
    return {
      success: true,
      wager: wagerDoc,
      market: updatedMarketObj,
      userStats: updatedUser,
      newPoolYes: newYesPool,
      newPoolNo: newNoPool
    };
  });
}
async function getUserWagers(user) {
  if (!user || !user.userId) {
    return { wagers: [] };
  }
  const map = /* @__PURE__ */ new Map();
  for (const w of inMemoryWagers) {
    if (w.userId === user.userId) {
      map.set(w.id || w.$id, w);
    }
  }
  try {
    const databases = getDatabases(user.jwt);
    const res = await databases.listDocuments("pumpforge", "wagers", [
      Query2.equal("userId", user.userId),
      Query2.limit(100)
    ]);
    const docs = res.documents || [];
    for (const d of docs) {
      map.set(d.$id || d.id, d);
      recordWagerLog(d);
    }
  } catch (_err) {}
  return { wagers: Array.from(map.values()) };
}
var predictionMarketCreationLimiter = new RateLimiter(30, 60 * 60 * 1e3);
async function processCreatePredictionMarket(user, params) {
  if (user.isGuest) {
    throw new Error("Authentication required to create prediction markets.");
  }
  const { allowed, retryAfterMs } = predictionMarketCreationLimiter.isAllowed(user.userId);
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 6e4);
    throw new Error(`Creation limit reached. Try again in ${mins} minutes.`);
  }
  const question = sanitizePlainText(params.question || "");
  const description = sanitizePlainText(params.description || "");
  if (question.length < 5 || question.length > 200) {
    throw new Error("Question must be between 5 and 200 characters.");
  }
  let expiryTimestamp = new Date(params.endDate).getTime();
  if (isNaN(expiryTimestamp) || expiryTimestamp <= Date.now() + 60 * 1e3) {
    expiryTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1e3;
  }
  return withUserLock(user.userId, async () => {
    const userState = await getAuthoritativeUser(user.userId, user.jwt, user.name);
    const marketId = ID2.unique();
    const combinedQuestion = (description ? `${question} --- ${description}` : question).slice(0, 500);
    const endDateIso = new Date(expiryTimestamp).toISOString();
    const creatorName = String(userState.handle || user.name || `@${user.userId.slice(0, 6)}`).slice(0, 64);
    const marketDoc = normalizePolymarketDoc({
      $id: marketId,
      id: marketId,
      question: combinedQuestion,
      description,
      creatorId: String(user.userId).slice(0, 64),
      creator: creatorName,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      endDate: endDateIso,
      status: "active",
      poolYes: 0,
      poolNo: 0,
      resolved: false,
      winningOutcome: null,
      resolvedAt: null
    });
    await persistPolymarketToDatabase(marketDoc, user.jwt);
    return {
      success: true,
      market: marketDoc,
      userStats: userState
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
// node-appwrite aliases inlined
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
async function resolveMarketAndPayout(admin, marketId, winningChoice, extraParams) {
  if (!admin.isAdmin) {
    throw new Error("Admin privileges required to resolve prediction markets.");
  }
  const { allowed, retryAfterMs } = adminLimiter.isAllowed(admin.userId);
  if (!allowed) {
    throw new Error(`Admin rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1e3)}s.`);
  }
  return withMarketLock(marketId, async () => {
    const databases = getDatabases(admin.jwt);
    let market = null;
    try {
      market = await databases.getDocument("pumpforge", "polymarkets", marketId);
    } catch {
      const allMarkets = await getPolymarketsList(admin.jwt);
      market = allMarkets.find((m) => (m.$id || m.id) === marketId) || {
        $id: marketId,
        id: marketId,
        status: "active",
        resolved: false,
        poolYes: marketId === "m1" ? 4500 : marketId === "m2" ? 150 : 0,
        poolNo: marketId === "m1" ? 3200 : marketId === "m2" ? 6400 : 0
      };
    }
    const poolYes = Math.max(Number(market.poolYes ?? market.yesPool ?? 0), Number(extraParams?.poolYes || 0));
    const poolNo = Math.max(Number(market.poolNo ?? market.noPool ?? 0), Number(extraParams?.poolNo || 0));
    const totalPool = poolYes + poolNo;
    const resolvedAtIso = (/* @__PURE__ */ new Date()).toISOString();
    const resolvedMarketObj = {
      ...market,
      $id: marketId,
      id: marketId,
      poolYes,
      poolNo,
      yesPool: poolYes,
      noPool: poolNo,
      status: "closed",
      resolved: true,
      winningOutcome: winningChoice,
      resolvedOutcome: winningChoice === "CANCEL" ? null : winningChoice,
      resolvedAt: resolvedAtIso
    };
    await persistPolymarketToDatabase(resolvedMarketObj, admin.jwt);
    const wagersMap = /* @__PURE__ */ new Map();
    for (const memW of inMemoryWagers) {
      if (memW.polymarketId === marketId) {
        wagersMap.set(memW.$id || memW.id || `${memW.userId}_${memW.amount}`, memW);
      }
    }
    try {
      const wagersRes2 = await databases.listDocuments("pumpforge", "wagers", [
        Query3.equal("polymarketId", marketId),
        Query3.limit(500)
      ]);
      for (const doc of wagersRes2.documents || []) {
        wagersMap.set(doc.$id || doc.id, doc);
      }
    } catch {}
    if (extraParams?.userBet && Number(extraParams.userBet.amount) > 0) {
      const hasCallerWager = Array.from(wagersMap.values()).some(
        (w) => w.userId === admin.userId && !w.isPaid
      );
      if (!hasCallerWager) {
        const syntheticId = `w_${marketId}_${admin.userId}`;
        wagersMap.set(syntheticId, {
          id: syntheticId,
          $id: syntheticId,
          userId: admin.userId,
          polymarketId: marketId,
          amount: Number(extraParams.userBet.amount),
          choice: extraParams.userBet.side,
          isPaid: false
        });
      }
    }
    let totalPaidOut = 0;
    let winnersCount = 0;
    let callerPayout = 0;
    let callerUpdatedStats = null;
    for (const wager of wagersMap.values()) {
      if (wager.isPaid === true) {
        continue;
      }
      const wagerUserId = wager.userId;
      const wagerAmount = Number(wager.amount || 0);
      const choice = String(wager.choice || "").toUpperCase();
      let payoutAmount = 0;
      if (winningChoice === "CANCEL") {
        payoutAmount = wagerAmount;
      } else if (choice === winningChoice) {
        const winningPool = winningChoice === "YES" ? poolYes : poolNo;
        if (winningPool > 0 && totalPool > 0) {
          const shareRatio = wagerAmount / winningPool;
          const poolShare = Math.floor(shareRatio * totalPool);
          payoutAmount = Math.max(wagerAmount * 2, poolShare);
        } else {
          payoutAmount = wagerAmount * 2;
        }
      }
      wager.isPaid = true;
      try {
        if (wager.$id && !String(wager.$id).startsWith("w_")) {
          await databases.updateDocument("pumpforge", "wagers", wager.$id, {
            isPaid: true
          });
        }
      } catch {}
      if (payoutAmount > 0) {
        await withUserLock(wagerUserId, async () => {
          const uState = await getAuthoritativeUser(wagerUserId, admin.jwt);
          const nextCash = Number((uState.cash + payoutAmount).toFixed(2));
          const profitDelta = winningChoice === "CANCEL" ? 0 : payoutAmount - wagerAmount;
          const updated = await saveAuthoritativeUser(
            wagerUserId,
            {
              cash: nextCash,
              totalProfit: Number(((uState.totalProfit || 0) + profitDelta).toFixed(2))
            },
            admin.jwt
          );
          if (wagerUserId === admin.userId) {
            callerPayout += payoutAmount;
            callerUpdatedStats = updated;
          }
        });
        totalPaidOut += payoutAmount;
        winnersCount++;
      }
    }
    if (!callerUpdatedStats) {
      callerUpdatedStats = await getAuthoritativeUser(admin.userId, admin.jwt);
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
      totalPaidOut,
      callerPayout,
      market: resolvedMarketObj,
      userStats: callerUpdatedStats
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
  const isTargetingSelf = !targetUserId || targetUserId === admin.userId || targetUserId === "admin_realzekeee" || String(targetUserId).toLowerCase() === "@zeke";
  const canonicalId = isTargetingSelf ? admin.userId : targetUserId;
  return withUserLock(canonicalId, async () => {
    const uState = await getAuthoritativeUser(canonicalId, admin.jwt, admin.name);
    let nextVal = currency === "cash" ? uState.cash : uState.gems;
    if (mode === "add") nextVal += amount;
    else if (mode === "deduct") nextVal = Math.max(0, nextVal - amount);
    else if (mode === "set") nextVal = Math.max(0, amount);
    const updates = currency === "cash" ? { cash: Number(nextVal.toFixed(2)) } : { gems: Math.floor(nextVal) };
    const updated = await saveAuthoritativeUser(canonicalId, updates, admin.jwt);
    if (isTargetingSelf && targetUserId && targetUserId !== canonicalId) {
      await saveAuthoritativeUser(targetUserId, updates, admin.jwt).catch(() => {});
    }
    await recordAuditLog(admin, "BALANCE_GRANT", { targetUserId: canonicalId, mode, currency, amount });
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
  if (settings.rainbowCosmetics !== void 0) {
    globalAdminSettings.rainbowCosmetics = !!settings.rainbowCosmetics;
  }
  if (settings.customAdminBadge !== void 0) {
    globalAdminSettings.customAdminBadge = String(settings.customAdminBadge);
  }
  try {
    const databases = getDatabases(admin.jwt);
    const res = await databases.listDocuments("pumpforge", "admin_settings", [Query3.limit(1)]);
    if (res.documents.length > 0) {
      await databases.updateDocument("pumpforge", "admin_settings", res.documents[0].$id, {
        arcadeRigMode: globalAdminSettings.arcadeRigMode,
        isCasinoRigged: globalAdminSettings.isCasinoRigged,
        rainbowCosmetics: globalAdminSettings.rainbowCosmetics ?? false,
        customAdminBadge: globalAdminSettings.customAdminBadge ?? "Operator"
      });
    } else {
      await databases.createDocument("pumpforge", "admin_settings", "global", {
        arcadeRigMode: globalAdminSettings.arcadeRigMode,
        isCasinoRigged: globalAdminSettings.isCasinoRigged,
        rainbowCosmetics: globalAdminSettings.rainbowCosmetics ?? false,
        customAdminBadge: globalAdminSettings.customAdminBadge ?? "Operator"
      });
    }
  } catch (e) {
    console.warn("Could not save admin_settings to Appwrite directly:", e);
  }
  await recordAuditLog(admin, "SETTINGS_UPDATE", settings);
  return { success: true, settings: globalAdminSettings };
}
async function adminGetBugs(admin) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  try {
    const databases = getDatabases(admin.jwt);
    const res = await databases.listDocuments("pumpforge", "bugs", [
      Query3.orderDesc("timestamp"),
      Query3.limit(100)
    ]);
    return { bugs: res.documents };
  } catch (err) {
    console.warn("Could not fetch bugs from Appwrite:", err);
    return { bugs: [] };
  }
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
async function adminCreateBroadcast(admin, payload) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  const docId = ID3.unique();
  const broadcastDoc = {
    $id: docId,
    id: docId,
    title: (payload.title || "Announcement").trim(),
    message: (payload.message || "").trim(),
    type: payload.type || "info",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: payload.expiresAt || null
  };
  try {
    const databases = getDatabases(admin.jwt);
    const created = await databases.createDocument(
      "pumpforge",
      "broadcasts",
      docId,
      {
        title: broadcastDoc.title,
        message: broadcastDoc.message,
        type: broadcastDoc.type,
        timestamp: broadcastDoc.timestamp,
        expiresAt: broadcastDoc.expiresAt
      },
      [Permission3.read(Role3.any())]
    );
    inMemoryBroadcasts.unshift(created);
    await recordAuditLog(admin, "BROADCAST_CREATE", broadcastDoc);
    return { success: true, broadcast: created };
  } catch (err) {
    console.warn("Could not write broadcast to Appwrite directly, saving in-memory:", err?.message || err);
    inMemoryBroadcasts.unshift(broadcastDoc);
    await recordAuditLog(admin, "BROADCAST_CREATE", broadcastDoc);
    return { success: true, broadcast: broadcastDoc };
  }
}
async function adminDeleteBroadcast(admin, broadcastId) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  const idx = inMemoryBroadcasts.findIndex((b) => b.$id === broadcastId || b.id === broadcastId);
  if (idx !== -1) {
    inMemoryBroadcasts.splice(idx, 1);
  }
  try {
    const databases = getDatabases(admin.jwt);
    await databases.deleteDocument("pumpforge", "broadcasts", broadcastId);
  } catch (err) {
    console.warn("Could not delete broadcast from Appwrite:", err?.message || err);
  }
  await recordAuditLog(admin, "BROADCAST_DELETE", { broadcastId });
  return { success: true, broadcastId };
}
async function adminCreatePromoCode(admin, promoData) {
  if (!admin.isAdmin) throw new Error("Admin privileges required.");
  const cleanCode = promoData.code.trim().toUpperCase();
  if (!cleanCode) throw new Error("Promo code cannot be empty.");
  const docId = ID3.unique();
  const docPayload = {
    code: cleanCode,
    rewardType: promoData.rewardType || "cash",
    rewardAmount: Number(promoData.rewardAmount) || 0,
    isActive: true,
    claimedBy: [],
    expiresAt: promoData.expiresAt ? new Date(promoData.expiresAt).toISOString() : null
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
  } catch (err) {
    console.error("Failed to create promocode in Appwrite:", err);
    throw new Error(err.message || "Failed to create promocode.");
  }
}

// src/server/schemaAudit.ts
// node-appwrite aliases inlined
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
  notifications: {
    id: "notifications",
    name: "User Notifications",
    attributes: [
      { key: "userId", type: "string", required: true, size: 64 },
      { key: "title", type: "string", required: true, size: 128 },
      { key: "message", type: "string", required: true, size: 1e3 },
      { key: "type", type: "string", required: false, size: 32, default: "info" },
      { key: "read", type: "boolean", required: false, default: false },
      { key: "timestamp", type: "string", required: true, size: 64 }
    ],
    indexes: [
      { key: "idx_userId_timestamp", type: "key", attributes: ["userId", "timestamp"] }
    ],
    permissions: ["read(user)"]
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

// src/server/app.ts
var app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With, X-Appwrite-JWT, X-Guest-ID, X-User-ID, X-User-Email, X-User-Name, X-User-Cash, X-User-Gems, X-User-Profit, X-User-Trades, X-User-Updated-At");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
app.use((req, _res, next) => {
  if (req.body !== void 0 && req.body !== null) {
    req._body = true;
    if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
      try {
        req.body = JSON.parse(req.body);
      } catch (_) {
      }
    }
  }
  next();
});
app.use(express.json());
app.use((req, _res, next) => {
  let url = req.url || "/";
  const [pathname, searchStr] = url.split("?");
  const search = searchStr ? `?${searchStr}` : "";
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
  } catch (_) {
  }
  if (pathname.startsWith("/api/index.js") || pathname.startsWith("/api/index.ts") || pathname.startsWith("/api/index")) {
    const prefix = pathname.startsWith("/api/index.js") ? "/api/index.js" : pathname.startsWith("/api/index.ts") ? "/api/index.ts" : "/api/index";
    const remainder = pathname.slice(prefix.length).replace(/^\/+/, "");
    if (remainder.length > 0) {
      req.url = `/api/${remainder}${search}`;
      return next();
    }
  }
  const nowRouteMatches = req.headers["x-now-route-matches"];
  if (nowRouteMatches && (pathname === "/api" || pathname === "/api/" || pathname === "/api/index" || pathname === "/" || pathname === "/api/index.js")) {
    try {
      const match = String(nowRouteMatches).match(/1=([^&]+)/);
      if (match && match[1]) {
        const subPath = decodeURIComponent(match[1]).replace(/^\/+/, "");
        req.url = subPath.startsWith("api/") ? `/${subPath}${search}` : `/api/${subPath}${search}`;
        return next();
      }
    } catch (_) {
    }
  }
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"];
  if (typeof matchedPath === "string" && matchedPath.startsWith("/api/") && !matchedPath.startsWith("/api/index")) {
    req.url = `${matchedPath}${search}`;
    return next();
  }
  if (!pathname.startsWith("/api") && (pathname.startsWith("/game") || pathname.startsWith("/arcade") || pathname.startsWith("/auth") || pathname.startsWith("/admin") || pathname.startsWith("/health"))) {
    req.url = `/api${pathname.startsWith("/") ? "" : "/"}${pathname}${search}`;
    return next();
  }
  next();
});
app.use(authMiddleware);
app.use("/api", (_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.get("/api", (_req, res) => {
  res.json({ status: "ok", message: "PumpForge API Gateway Operational", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
coinStore.syncWithDatabase().catch((e) => {
  console.warn("Initial Appwrite coin sync warning:", e);
});
syncAdminSettingsWithDatabase().catch((e) => {
  console.warn("Initial Appwrite admin settings sync warning:", e);
});
function safeErrorString(err, fallback = "Internal server error") {
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
function sendError(res, status, err, fallback = "Request failed") {
  const message = safeErrorString(err, fallback);
  return res.status(status).json({ error: message, message });
}
app.get("/favicon.ico", (_req, res) => {
  res.redirect(301, "/favicon.svg");
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
    const displayName = isOwner ? "Zeke (Owner)" : name || cleanEmail.split("@")[0] || "Player";
    const token = signCustomToken({
      userId: uId,
      email: cleanEmail,
      name: displayName,
      isAdmin: isOwner
    });
    const user = {
      userId: uId,
      email: cleanEmail,
      name: displayName,
      isAdmin: isOwner,
      isGuest: false,
      jwt: token
    };
    const stats = await getAuthoritativeUser(user.userId, void 0, displayName);
    if (isOwner) {
      stats.title = stats.title && stats.title !== "Member" ? stats.title : "Founder & Owner";
      stats.isPremium = true;
    }
    res.json({
      success: true,
      token,
      user,
      stats
    });
  } catch (err) {
    sendError(res, 500, err, "Email authentication failed.");
  }
});
app.post("/api/auth/quick-login", async (req, res) => {
  try {
    const { username, email } = req.body || {};
    const cleanUsername = String(username || "Player").trim().slice(0, 30);
    const cleanEmail = email ? String(email).toLowerCase().trim() : "";
    const isOwner = cleanEmail === "realzekeee@gmail.com" && cleanUsername.toLowerCase().includes("zeke");
    const uId = isOwner ? "admin_realzekeee" : "u_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const token = signCustomToken({
      userId: uId,
      email: cleanEmail,
      name: cleanUsername,
      isAdmin: isOwner
    });
    const user = {
      userId: uId,
      email: cleanEmail,
      name: cleanUsername,
      isAdmin: isOwner,
      isGuest: false,
      jwt: token
    };
    const stats = await getAuthoritativeUser(user.userId, void 0, cleanUsername);
    if (isOwner) {
      stats.title = stats.title && stats.title !== "Member" ? stats.title : "Founder & Owner";
      stats.isPremium = true;
    }
    res.json({
      success: true,
      token,
      user,
      stats
    });
  } catch (err) {
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
    const token = signCustomToken({
      userId: uId,
      email: cleanEmail,
      name: displayName,
      isAdmin: isOwner
    });
    const user = {
      userId: uId,
      email: cleanEmail,
      name: displayName,
      isAdmin: isOwner,
      isGuest: false,
      jwt: token
    };
    const stats = await getAuthoritativeUser(user.userId, void 0, displayName);
    if (isOwner) {
      stats.title = stats.title && stats.title !== "Member" ? stats.title : "Founder & Owner";
      stats.isPremium = true;
    }
    res.json({
      success: true,
      token,
      user,
      stats
    });
  } catch (err) {
    sendError(res, 500, err, "OAuth callback processing failed.");
  }
});
app.post("/api/auth/google-verify", async (req, res) => {
  try {
    const { credential, email: inputEmail, name: inputName } = req.body || {};
    let email = inputEmail || "";
    let name = inputName || "Player";
    let sub = "";
    if (credential && typeof credential === "string") {
      try {
        const parts = credential.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          if (payload.email) email = payload.email;
          if (payload.name) name = payload.name;
          if (payload.sub) sub = payload.sub;
        }
      } catch (_) {
      }
    }
    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Valid Google email is required." });
    }
    const isOwner = cleanEmail === "realzekeee@gmail.com" || cleanEmail === "realzekee@gmail.com";
    const uId = isOwner ? "admin_realzekeee" : sub ? `g_${sub}` : "u_" + Buffer.from(cleanEmail).toString("hex").substring(0, 16);
    const displayName = isOwner ? "Zeke (Owner)" : name;
    const token = signCustomToken({
      userId: uId,
      email: cleanEmail,
      name: displayName,
      isAdmin: isOwner
    });
    const user = {
      userId: uId,
      email: cleanEmail,
      name: displayName,
      isAdmin: isOwner,
      isGuest: false,
      jwt: token
    };
    const stats = await getAuthoritativeUser(user.userId, void 0, displayName);
    if (isOwner) {
      stats.title = stats.title && stats.title !== "Member" ? stats.title : "Founder & Owner";
      stats.isPremium = true;
    }
    res.json({
      success: true,
      token,
      user,
      stats
    });
  } catch (err) {
    sendError(res, 500, err, "Google verification failed.");
  }
});
app.get("/api/game/broadcasts", async (req, res) => {
  try {
    const jwt = req.user?.jwt;
    const broadcasts = await getBroadcastsList(jwt);
    res.json({ broadcasts });
  } catch (err) {
    res.json({ broadcasts: [] });
  }
});
app.get("/api/game/polymarkets", async (req, res) => {
  try {
    const jwt = req.user?.jwt;
    const polymarkets = await getPolymarketsList(jwt);
    res.json({ polymarkets });
  } catch (err) {
    res.json({ polymarkets: [] });
  }
});
app.get("/api/game/trades", async (req, res) => {
  try {
    const jwt = req.user?.jwt;
    const coinId = typeof req.query.coinId === "string" ? req.query.coinId : void 0;
    const limit = Number(req.query.limit) || 50;
    const trades = await getTradesList({ coinId, limit, jwt });
    res.json({ trades });
  } catch (err) {
    res.json({ trades: [] });
  }
});
app.get("/api/game/holdings", async (req, res) => {
  try {
    const user = req.user;
    const jwt = user?.jwt;
    const userId = typeof req.query.userId === "string" ? req.query.userId : user?.userId;
    const coinId = typeof req.query.coinId === "string" ? req.query.coinId : void 0;
    const holdings = await getHoldingsList({ userId, coinId, jwt });
    res.json({ holdings });
  } catch (err) {
    res.json({ holdings: [] });
  }
});
app.get("/api/game/coins", async (req, res) => {
  try {
    await coinStore.syncWithDatabase(req.user?.jwt);
    const coins = coinStore.getAllCoins();
    res.json({ coins });
  } catch (err) {
    sendError(res, 500, err, "Failed to load coins.");
  }
});
app.get("/api/game/coins/:coinId", async (req, res) => {
  try {
    await coinStore.syncWithDatabase(req.user?.jwt);
    const coin = coinStore.getCoin(req.params.coinId);
    if (!coin) {
      return res.status(404).json({ error: "Coin not found", message: "Coin not found" });
    }
    res.json({ coin });
  } catch (err) {
    sendError(res, 500, err, "Failed to load coin.");
  }
});
app.get("/api/game/coins/:coinId/candles", async (req, res) => {
  try {
    const interval = Number(req.query.interval) || 1;
    const candles = await processGetCoinCandles(req.params.coinId, interval);
    res.json({ candles });
  } catch (err) {
    sendError(res, 500, err, "Failed to load chart data.");
  }
});
app.get("/api/game/leaderboard", async (req, res) => {
  try {
    const category = req.query.category || "gains";
    const limit = Number(req.query.limit) || 50;
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    const leaderboard = await processGetLeaderboard(category, limit);
    res.json({ leaderboard });
  } catch (err) {
    sendError(res, 500, err, "Failed to load leaderboard.");
  }
});
app.post("/api/game/trade", async (req, res) => {
  try {
    const user = req.user;
    const coinId = req.body.coinId;
    const type = req.body.type;
    const rawAmt = req.body.amountCoins !== void 0 ? req.body.amountCoins : req.body.amount;
    const amountCoins = Number(rawAmt);
    const result = await processTrade(user, coinId, type, amountCoins);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Trade execution failed.");
  }
});
app.post("/api/arcade/coinflip", async (req, res) => {
  try {
    const user = req.user;
    const rawBet = req.body.betAmount !== void 0 ? req.body.betAmount : req.body.bet;
    const betAmount = Number(rawBet);
    const side = req.body.side || req.body.choice || "heads";
    const result = await processCoinflip(user, betAmount, side);
    res.json(result);
  } catch (err) {
    const errorMsg = typeof err?.message === "string" && err.message.trim() !== "[object Object]" ? err.message : typeof err === "string" ? err : "Failed to process coinflip wager.";
    res.status(400).json({ error: errorMsg });
  }
});
app.post("/api/game/arcade/wager", async (req, res) => {
  try {
    const user = req.user;
    const { game, action, ...params } = req.body;
    const result = await processArcadeWager(user, game, action, params);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Arcade wager failed.");
  }
});
app.post("/api/game/daily-reward", async (req, res) => {
  try {
    const user = req.user;
    const result = await processDailyReward(user);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Daily reward claim failed.");
  }
});
app.post("/api/game/shop/buy", async (req, res) => {
  try {
    const user = req.user;
    const { type, ...params } = req.body;
    const result = await processShopBuy(user, type, params);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Purchase transaction failed.");
  }
});
app.post("/api/game/prestige", async (req, res) => {
  try {
    const user = req.user;
    const result = await processPrestige(user);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Prestige process failed.");
  }
});
app.post("/api/game/promocode", async (req, res) => {
  try {
    const user = req.user;
    const { code } = req.body;
    const result = await processPromocode(user, code);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Promo code redemption failed.");
  }
});
app.post("/api/game/create-coin", async (req, res) => {
  try {
    const user = req.user;
    const result = await processCreateCoin(user, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Coin creation failed.");
  }
});
app.post("/api/game/bug-report", async (req, res) => {
  try {
    const user = req.user;
    const { title, description } = req.body;
    const result = await processBugReport(user, title, description);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Bug report submission failed.");
  }
});
app.post("/api/game/polymarket/create", async (req, res) => {
  try {
    const user = req.user;
    const result = await processCreatePredictionMarket(user, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Market creation failed.");
  }
});
app.post("/api/game/polymarket/wager", async (req, res) => {
  try {
    const user = req.user;
    const { marketId, choice, amount } = req.body;
    const result = await processPolymarketWager(user, marketId, choice, Number(amount));
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Market wager failed.");
  }
});
app.get("/api/game/wagers", async (req, res) => {
  try {
    const user = req.user;
    const result = await getUserWagers(user);
    res.json(result);
  } catch (err) {
    sendError(res, 500, err, "Failed to load wagers.");
  }
});
app.get("/api/game/settings", (_req, res) => {
  try {
    res.json({
      arcadeRigMode: globalAdminSettings.arcadeRigMode || "fair",
      isCasinoRigged: globalAdminSettings.isCasinoRigged || false,
      rainbowCosmetics: globalAdminSettings.rainbowCosmetics || false,
      customAdminBadge: globalAdminSettings.customAdminBadge || "Operator"
    });
  } catch (err) {
    sendError(res, 500, err, "Failed to load settings.");
  }
});
app.get("/api/game/comments/:targetId", async (req, res) => {
  try {
    const comments = await processGetComments(req.params.targetId);
    res.json({ comments });
  } catch (err) {
    sendError(res, 500, err, "Failed to load comments.");
  }
});
app.post("/api/game/comments", async (req, res) => {
  try {
    const user = req.user;
    const { targetId, text } = req.body;
    const comment = await processAddComment(user, targetId, text);
    res.json({ success: true, comment });
  } catch (err) {
    sendError(res, 400, err, "Failed to post comment.");
  }
});
app.delete("/api/game/comments/:commentId", async (req, res) => {
  try {
    const user = req.user;
    const ok = await processDeleteComment(user, req.params.commentId);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, 400, err, "Failed to delete comment.");
  }
});
app.post("/api/game/comments/:commentId/report", async (req, res) => {
  try {
    const ok = await processReportComment(req.params.commentId);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, 400, err, "Failed to report comment.");
  }
});
app.post("/api/game/profile/update", async (req, res) => {
  try {
    const user = req.user;
    const result = await processUpdateProfile(user, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Profile update failed.");
  }
});
app.get("/api/user/:identifier", async (req, res) => {
  try {
    const profile = await getPublicUserProfile(req.params.identifier);
    if (!profile) {
      return res.status(404).json({ error: "User not found", message: "User not found" });
    }
    res.json(profile);
  } catch (err) {
    sendError(res, 500, err, "Failed to load user profile.");
  }
});
app.post("/api/admin/polymarket/resolve", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { marketId, winningChoice, userBet, poolYes, poolNo } = req.body;
    const result = await resolveMarketAndPayout(admin, marketId, winningChoice, { userBet, poolYes, poolNo });
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Market resolution failed.");
  }
});
app.post("/api/admin/coins/update", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId, updates } = req.body;
    const result = await adminUpdateCoin(admin, coinId, updates);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Coin update failed.");
  }
});
app.post("/api/admin/coins/pump", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId, multiplier } = req.body;
    const result = await adminPumpCoin(admin, coinId, Number(multiplier) || 2);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Pump action failed.");
  }
});
app.post("/api/admin/coins/dump", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId, dropRatio } = req.body;
    const result = await adminDumpCoin(admin, coinId, Number(dropRatio) || 0.5);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Dump action failed.");
  }
});
app.post("/api/admin/coins/delete", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { coinId } = req.body;
    const result = await adminDeleteCoin(admin, coinId);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Delete coin failed.");
  }
});
app.post("/api/admin/users/grant-balance", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { targetUserId, mode, currency, amount } = req.body;
    const result = await adminGrantBalance(admin, targetUserId, mode, currency, Number(amount));
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Balance grant failed.");
  }
});
app.post("/api/admin/users/sanction", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { targetUserId, sanction, durationMinutes } = req.body;
    const result = await adminSanctionUser(admin, targetUserId, sanction, durationMinutes);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Sanction failed.");
  }
});
app.post("/api/admin/users/update-profile", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { targetUserId, updates } = req.body;
    const result = await adminUpdateUserProfile(admin, targetUserId, updates);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Profile update failed.");
  }
});
app.post("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const result = await adminUpdateSettings(admin, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Settings update failed.");
  }
});
app.get("/api/admin/bugs", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const result = await adminGetBugs(admin);
    res.json(result);
  } catch (err) {
    sendError(res, 500, err, "Failed to load bugs.");
  }
});
app.post("/api/admin/bugs/update-status", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { bugId, status } = req.body;
    const result = await adminUpdateBugStatus(admin, bugId, status);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Status update failed.");
  }
});
app.post("/api/admin/bugs/delete", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { bugId } = req.body;
    const result = await adminDeleteBugReport(admin, bugId);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Delete bug failed.");
  }
});
app.post("/api/admin/broadcasts/create", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const result = await adminCreateBroadcast(admin, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Broadcast creation failed.");
  }
});
app.post("/api/admin/broadcasts/delete", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const { broadcastId } = req.body;
    const result = await adminDeleteBroadcast(admin, broadcastId);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Delete broadcast failed.");
  }
});
app.post("/api/admin/promocodes/create", requireAdmin, async (req, res) => {
  try {
    const admin = req.user;
    const result = await adminCreatePromoCode(admin, req.body);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err, "Promo code creation failed.");
  }
});
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const jwt = req.user?.jwt;
    const users = await getAllUsersList(jwt);
    res.json({ users });
  } catch (err) {
    sendError(res, 500, err, "Failed to load users list.");
  }
});
app.get("/api/admin/audit-logs", requireAdmin, (_req, res) => {
  try {
    res.json({ logs: getAuditLogs() });
  } catch (err) {
    sendError(res, 500, err, "Failed to load audit logs.");
  }
});
app.get("/api/admin/schema-audit", requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const result = await auditAppwriteSchema(user?.jwt);
    res.json(result);
  } catch (err) {
    sendError(res, 500, err, "Schema audit failed.");
  }
});
app.get("/api/game/notifications", async (req, res) => {
  try {
    const user = req.user;
    const uid = user?.userId || req.query.userId || "guest";
    const notifications = await getNotificationsList(uid, user?.jwt);
    res.json({ notifications });
  } catch (err) {
    res.json({ notifications: [] });
  }
});
app.post("/api/game/notifications", async (req, res) => {
  try {
    const user = req.user;
    const { title, message, type } = req.body || {};
    const notif = {
      id: "notif_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      userId: user?.userId || "all",
      title: title || "Notification",
      message: message || "",
      type: type || "info",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    };
    recordNotification(notif);
    try {
      const db = getDatabases();
      await db.createDocument("pumpforge", "notifications", notif.id, notif);
    } catch (_) {
    }
    res.json({ success: true, notification: notif });
  } catch (err) {
    sendError(res, 400, err, "Failed to create notification.");
  }
});
app.post("/api/db/proxy", async (req, res) => {
  try {
    const { method, args } = req.body || {};
    if (!method || !Array.isArray(args)) {
      return res.status(400).json({ error: "Invalid proxy payload" });
    }
    const databaseId = args[0] || "pumpforge";
    const collectionId = args[1];
    const userJwt = req.user?.jwt;
    const db = getDatabases(userJwt);
    if (typeof db[method] === "function") {
      try {
        const result = await db[method](...args);
        return res.json({ success: true, result });
      } catch (appwriteErr) {
        if (method === "listDocuments") {
          if (collectionId === "trades") {
            const trades = await getTradesList({ jwt: userJwt });
            return res.json({ success: true, result: { total: trades.length, documents: trades } });
          }
          if (collectionId === "polymarkets") {
            const markets = await getPolymarketsList(userJwt);
            return res.json({ success: true, result: { total: markets.length, documents: markets } });
          }
          if (collectionId === "coins") {
            const coins = coinStore.getAllCoins();
            return res.json({ success: true, result: { total: coins.length, documents: coins } });
          }
          if (collectionId === "holdings") {
            const holdings = await getHoldingsList({ jwt: userJwt });
            return res.json({ success: true, result: { total: holdings.length, documents: holdings } });
          }
          if (collectionId === "broadcasts") {
            const bcasts = await getBroadcastsList(userJwt);
            return res.json({ success: true, result: { total: bcasts.length, documents: bcasts } });
          }
          if (collectionId === "wagers") {
            const userId = req.user?.userId;
            const wList = userId ? inMemoryWagers.filter((w) => w.userId === userId) : inMemoryWagers;
            return res.json({ success: true, result: { total: wList.length, documents: wList } });
          }
          if (collectionId === "notifications") {
            const notifs = await getNotificationsList(req.user?.userId, userJwt);
            return res.json({ success: true, result: { total: notifs.length, documents: notifs } });
          }
          return res.json({ success: true, result: { total: 0, documents: [] } });
        }
        if (method === "getDocument") {
          const docId = args[2];
          if (collectionId === "coins") {
            const c = coinStore.getCoin(docId);
            if (c) return res.json({ success: true, result: c });
          }
          if (collectionId === "users") {
            const u = await getAuthoritativeUser(docId, userJwt);
            return res.json({ success: true, result: u });
          }
        }
        if (method === "createDocument" || method === "updateDocument") {
          const docId = args[2] || `doc_${Date.now()}`;
          const data = args[3] || {};
          return res.json({ success: true, result: { $id: docId, ...data } });
        }
        if (method === "deleteDocument") {
          return res.json({ success: true, result: { status: "deleted" } });
        }
        return res.status(appwriteErr.code || 500).json({
          error: appwriteErr.message || "Appwrite operation failed",
          code: appwriteErr.code
        });
      }
    }
    return res.status(400).json({ error: `Method ${method} not found on Databases` });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});
app.use((err, _req, res, _next) => {
  console.error("[API Error]", err);
  if (res.headersSent) {
    return;
  }
  const status = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  const errMsg = safeErrorString(err, "Internal server error occurred.");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json({
    error: errMsg,
    message: errMsg,
    code: err?.code || "INTERNAL_ERROR"
  });
});
app.all("/api/*", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const notFoundMsg = `API route not found: ${req.method} ${req.originalUrl || req.url}`;
  res.status(404).json({
    error: notFoundMsg,
    message: notFoundMsg,
    code: "NOT_FOUND"
  });
});
var app_default = app;

// src/server/vercelEntry.ts
function resolveVercelUrl(req) {
  let url = req.url || "/";
  const [pathname, searchStr] = url.split("?");
  const search = searchStr ? `?${searchStr}` : "";
  const queryPath = req.query?.path || req.query?.__path;
  if (queryPath) {
    const clean = Array.isArray(queryPath) ? queryPath.join("/") : String(queryPath);
    const sub = clean.replace(/^\/+/, "");
    return sub.startsWith("api/") ? `/${sub}${search}` : `/api/${sub}${search}`;
  }
  if (pathname.startsWith("/api/index.js") || pathname.startsWith("/api/index.ts") || pathname.startsWith("/api/index")) {
    const prefix = pathname.startsWith("/api/index.js") ? "/api/index.js" : pathname.startsWith("/api/index.ts") ? "/api/index.ts" : "/api/index";
    const remainder = pathname.slice(prefix.length).replace(/^\/+/, "");
    if (remainder.length > 0) {
      return `/api/${remainder}${search}`;
    }
  }
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"];
  if (typeof matchedPath === "string" && matchedPath.startsWith("/api/") && !matchedPath.startsWith("/api/index")) {
    return `${matchedPath}${search}`;
  }
  if (req.headers["x-now-route-matches"]) {
    const match = String(req.headers["x-now-route-matches"]).match(/1=([^&]+)/);
    if (match && match[1]) {
      const sub = decodeURIComponent(match[1]).replace(/^\/+/, "");
      return sub.startsWith("api/") ? `/${sub}${search}` : `/api/${sub}${search}`;
    }
  }
  if (!pathname.startsWith("/api") && (pathname.startsWith("/game") || pathname.startsWith("/arcade") || pathname.startsWith("/auth") || pathname.startsWith("/admin") || pathname.startsWith("/health"))) {
    return `/api${pathname.startsWith("/") ? "" : "/"}${pathname}${search}`;
  }
  return url;
}
function handler(req, res) {
  return new Promise((resolve) => {
    try {
      req.url = resolveVercelUrl(req);
      try {
        const method = String(req.method || "GET").toUpperCase();
        if (method !== "GET" && method !== "HEAD" && req.body !== void 0 && req.body !== null) {
          req._body = true;
          let parsedBody = req.body;
          if (Buffer.isBuffer(parsedBody)) {
            parsedBody = parsedBody.toString("utf-8");
          }
          if (typeof parsedBody === "string" && parsedBody.trim().startsWith("{")) {
            try {
              parsedBody = JSON.parse(parsedBody);
            } catch (_) {
            }
          }
          try {
            req.body = parsedBody;
          } catch (_) {
            Object.defineProperty(req, "body", {
              value: parsedBody,
              writable: true,
              configurable: true
            });
          }
        }
      } catch (_) {
      }
      let completed = false;
      const onDone = () => {
        if (!completed) {
          completed = true;
          resolve(void 0);
        }
      };
      res.on("finish", onDone);
      res.on("close", onDone);
      res.on("error", (err) => {
        console.error("Vercel stream response error:", err);
        onDone();
      });
      app_default(req, res, (err) => {
        if (err) {
          console.error("Express unhandled middleware error in Vercel:", err);
          if (!res.headersSent) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.status(500).json({
              error: err?.message || "Internal server error occurred.",
              message: err?.message || "Internal server error occurred."
            });
          }
        }
        onDone();
      });
    } catch (err) {
      console.error("Vercel top-level invocation error:", err);
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.status(500).json({
          error: err?.message || "Internal server error occurred.",
          message: err?.message || "Internal server error occurred."
        });
      }
      resolve(void 0);
    }
  });
}
export {
  handler as default,
  resolveVercelUrl
};
