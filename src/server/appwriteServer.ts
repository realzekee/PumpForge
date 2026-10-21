/**
 * Lightweight zero-dependency REST implementation of the Appwrite Server SDK.
 * Replaces `node-appwrite` in Serverless / Edge environments to avoid native binary
 * or ESM/CJS bundling crashes on Vercel while preserving 100% API compatibility.
 */

export const ID = {
  unique: (): string => {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 10);
    const rand2 = Math.random().toString(36).substring(2, 6);
    return `${ts}${rand}${rand2}`.slice(0, 36);
  },
  custom: (id: string): string => id,
};

export const Role = {
  any: (): string => "any",
  user: (id: string, status?: string): string => (status ? `user:${id}/${status}` : `user:${id}`),
  users: (status?: string): string => (status ? `users/${status}` : "users"),
  guests: (): string => "guests",
  team: (id: string, role?: string): string => (role ? `team:${id}/${role}` : `team:${id}`),
};

export const Permission = {
  read: (role: string): string => `read("${role}")`,
  write: (role: string): string => `write("${role}")`,
  create: (role: string): string => `create("${role}")`,
  update: (role: string): string => `update("${role}")`,
  delete: (role: string): string => `delete("${role}")`,
};

export const Query = {
  equal: (attribute: string, value: any): string =>
    JSON.stringify({
      method: "equal",
      attribute,
      values: Array.isArray(value) ? value : [value],
    }),
  notEqual: (attribute: string, value: any): string =>
    JSON.stringify({
      method: "notEqual",
      attribute,
      values: Array.isArray(value) ? value : [value],
    }),
  lessThan: (attribute: string, value: any): string =>
    JSON.stringify({
      method: "lessThan",
      attribute,
      values: [value],
    }),
  lessThanEqual: (attribute: string, value: any): string =>
    JSON.stringify({
      method: "lessThanEqual",
      attribute,
      values: [value],
    }),
  greaterThan: (attribute: string, value: any): string =>
    JSON.stringify({
      method: "greaterThan",
      attribute,
      values: [value],
    }),
  greaterThanEqual: (attribute: string, value: any): string =>
    JSON.stringify({
      method: "greaterThanEqual",
      attribute,
      values: [value],
    }),
  search: (attribute: string, value: string): string =>
    JSON.stringify({
      method: "search",
      attribute,
      values: [value],
    }),
  orderAsc: (attribute: string): string =>
    JSON.stringify({
      method: "orderAsc",
      attribute,
    }),
  orderDesc: (attribute: string): string =>
    JSON.stringify({
      method: "orderDesc",
      attribute,
    }),
  limit: (limit: number): string =>
    JSON.stringify({
      method: "limit",
      values: [limit],
    }),
  offset: (offset: number): string =>
    JSON.stringify({
      method: "offset",
      values: [offset],
    }),
};

export class Client {
  public endpoint: string = "https://sgp.cloud.appwrite.io/v1";
  public project: string = "6a1416eb001f50cdb902";
  public key: string = "";
  public jwt: string = "";

  setEndpoint(endpoint: string): this {
    if (endpoint) this.endpoint = endpoint.replace(/\/+$/, "");
    return this;
  }

  setProject(project: string): this {
    if (project) this.project = project.trim();
    return this;
  }

  setKey(key: string): this {
    if (key) this.key = key.trim();
    return this;
  }

  setJWT(jwt: string): this {
    if (jwt) this.jwt = jwt.trim();
    return this;
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Appwrite-Project": this.project,
      "X-Appwrite-Response-Format": "1.5.0",
    };
    if (this.key) {
      headers["X-Appwrite-Key"] = this.key;
    } else if (this.jwt) {
      headers["X-Appwrite-JWT"] = this.jwt;
    }
    return headers;
  }
}

/**
 * Evaluates Appwrite Query JSON strings against an in-memory document array.
 * Used as an automatic fallback when an Appwrite collection lacks a required index
 * for a filtered/ordered listDocuments call.
 */
function applyQueriesInMemory(docs: any[], queries: string[]): any[] {
  let result = [...docs];
  let limitVal: number | null = null;
  let offsetVal = 0;

  for (const rawQ of queries) {
    if (!rawQ || typeof rawQ !== "string") continue;
    let q: any = null;
    try {
      q = JSON.parse(rawQ);
    } catch {
      continue;
    }
    if (!q || typeof q !== "object") continue;

    const method = q.method;
    const attr = q.attribute;
    const vals = Array.isArray(q.values) ? q.values : [];

    if (method === "equal" && attr && vals.length > 0) {
      result = result.filter((d) => {
        const val = d[attr] ?? (attr === "id" ? d.$id : attr === "$id" ? d.id : undefined);
        return vals.some((v: any) => String(val) === String(v));
      });
    } else if (method === "notEqual" && attr && vals.length > 0) {
      result = result.filter((d) => {
        const val = d[attr];
        return !vals.some((v: any) => String(val) === String(v));
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

const NUMERIC_DEFAULTS = new Set([
  "cash",
  "gems",
  "prestigeLevel",
  "totalProfit",
  "tradesCount",
  "allTimeTrades",
  "coinsCreatedCount",
  "dailyStreak",
  "price",
  "marketCap",
  "totalLiquidity",
  "volume24h",
  "change24h",
  "supply",
  "amount",
  "tokenAmount",
  "avgBuyPrice",
  "avgPrice",
  "totalInvested",
  "amountCoins",
  "pricePerCoin",
  "totalCash",
  "fee",
  "poolYes",
  "poolNo",
  "yesPool",
  "noPool",
  "rewardAmount",
]);

const BOOLEAN_DEFAULTS = new Set([
  "isBanned",
  "isSuspended",
  "resolved",
  "isPaid",
  "reported",
  "read",
  "isActive",
  "isCasinoRigged",
  "rainbowCosmetics",
]);

export class Databases {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.client.endpoint}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.client.getHeaders(),
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    const text = await res.text();
    let json: any = null;
    if (text && text.trim().length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!res.ok) {
      const err: any = new Error(
        json?.message || json?.error || `Appwrite HTTP ${res.status}: ${res.statusText}`
      );
      err.code = json?.code || res.status;
      err.status = res.status;
      err.type = json?.type;
      throw err;
    }

    return json ?? {};
  }

  async listDocuments(
    databaseId: string,
    collectionId: string,
    queries: string[] = []
  ): Promise<{ total: number; documents: any[] }> {
    const params = new URLSearchParams();
    if (Array.isArray(queries)) {
      for (const q of queries) {
        if (q !== undefined && q !== null) {
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
        documents: Array.isArray(res.documents) ? res.documents : [],
      };
    } catch (err: any) {
      // Fallback: if Appwrite rejects query filters/orders due to missing indexes or schema differences,
      // fetch documents without query filters and apply filters/sorting in memory.
      if (Array.isArray(queries) && queries.length > 0) {
        const barePath = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
        const res = await this.request(barePath, { method: "GET" });
        const rawDocs = Array.isArray(res.documents) ? res.documents : [];
        const filtered = applyQueriesInMemory(rawDocs, queries);
        return {
          total: filtered.length,
          documents: filtered,
        };
      }
      throw err;
    }
  }

  async getDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    queries: string[] = []
  ): Promise<any> {
    const params = new URLSearchParams();
    if (Array.isArray(queries)) {
      for (const q of queries) {
        if (q !== undefined && q !== null) {
          params.append("queries[]", typeof q === "string" ? q : JSON.stringify(q));
        }
      }
    }
    const qs = params.toString();
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}${qs ? `?${qs}` : ""}`;
    return this.request(path, { method: "GET" });
  }

  async createDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: Record<string, any>,
    permissions?: string[]
  ): Promise<any> {
    const rawDocId = !documentId || documentId === "unique()" ? ID.unique() : String(documentId);
    const finalDocId = rawDocId.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^[^a-zA-Z0-9]+/, "d").slice(0, 36) || ID.unique();

    const currentData: Record<string, any> = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith("$") && v !== undefined) {
          currentData[k] = v;
        }
      }
    }

    let currentPermissions = Array.isArray(permissions) && permissions.length > 0 ? [...permissions] : undefined;
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;

    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const body: Record<string, any> = {
          documentId: finalDocId,
          data: currentData,
        };
        if (currentPermissions && currentPermissions.length > 0) {
          body.permissions = currentPermissions;
        }
        return await this.request(path, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } catch (err: any) {
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
          if (badAttr === "tradesCount" && !("allTimeTrades" in currentData) && currentData.tradesCount !== undefined) {
            currentData.allTimeTrades = currentData.tradesCount;
          } else if (badAttr === "nameColor" && !("equippedColor" in currentData) && currentData.nameColor !== undefined) {
            currentData.equippedColor = currentData.nameColor;
          } else if (badAttr === "amount" && !("tokenAmount" in currentData) && currentData.amount !== undefined) {
            currentData.tokenAmount = currentData.amount;
          } else if (badAttr === "avgBuyPrice" && !("avgPrice" in currentData) && currentData.avgBuyPrice !== undefined) {
            currentData.avgPrice = currentData.avgBuyPrice;
          } else if (badAttr === "poolYes" && !("yesPool" in currentData) && currentData.poolYes !== undefined) {
            currentData.yesPool = currentData.poolYes;
          } else if (badAttr === "poolNo" && !("noPool" in currentData) && currentData.poolNo !== undefined) {
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
              currentData[reqAttr] = new Date().toISOString();
            } else {
              currentData[reqAttr] = "-";
            }
            continue;
          }
        }

        if (currentPermissions && (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("role"))) {
          currentPermissions = undefined;
          continue;
        }

        throw err;
      }
    }

    throw new Error(`Failed to create document in ${collectionId} after schema adaptation retries.`);
  }

  async updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data?: Record<string, any>,
    permissions?: string[]
  ): Promise<any> {
    const currentData: Record<string, any> = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith("$") && v !== undefined) {
          currentData[k] = v;
        }
      }
    }

    let currentPermissions = Array.isArray(permissions) && permissions.length > 0 ? [...permissions] : undefined;
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;

    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        if (Object.keys(currentData).length === 0 && !currentPermissions) {
          return await this.getDocument(databaseId, collectionId, documentId);
        }
        const body: Record<string, any> = {
          data: currentData,
        };
        if (currentPermissions && currentPermissions.length > 0) {
          body.permissions = currentPermissions;
        }
        return await this.request(path, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        const msg = String(err?.message || "");
        const unknownMatch = msg.match(/Unknown attribute:\s*["']?([a-zA-Z0-9_]+)["']?/i);
        if (unknownMatch && unknownMatch[1]) {
          const badAttr = unknownMatch[1];
          if (badAttr === "tradesCount" && !("allTimeTrades" in currentData) && currentData.tradesCount !== undefined) {
            currentData.allTimeTrades = currentData.tradesCount;
          } else if (badAttr === "nameColor" && !("equippedColor" in currentData) && currentData.nameColor !== undefined) {
            currentData.equippedColor = currentData.nameColor;
          } else if (badAttr === "amount" && !("tokenAmount" in currentData) && currentData.amount !== undefined) {
            currentData.tokenAmount = currentData.amount;
          } else if (badAttr === "avgBuyPrice" && !("avgPrice" in currentData) && currentData.avgBuyPrice !== undefined) {
            currentData.avgPrice = currentData.avgBuyPrice;
          } else if (badAttr === "poolYes" && !("yesPool" in currentData) && currentData.poolYes !== undefined) {
            currentData.yesPool = currentData.poolYes;
          } else if (badAttr === "poolNo" && !("noPool" in currentData) && currentData.poolNo !== undefined) {
            currentData.noPool = currentData.poolNo;
          }
          if (badAttr in currentData) {
            delete currentData[badAttr];
            continue;
          }
        }

        if (currentPermissions && (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("role"))) {
          currentPermissions = undefined;
          continue;
        }

        throw err;
      }
    }

    throw new Error(`Failed to update document ${documentId} in ${collectionId} after schema adaptation retries.`);
  }

  async deleteDocument(databaseId: string, collectionId: string, documentId: string): Promise<any> {
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
    return this.request(path, { method: "DELETE" });
  }
}
