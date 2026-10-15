import crypto from "crypto";

/**
 * Zero-dependency, ESM-safe Appwrite Server SDK implementation using Node.js native fetch.
 * Drop-in replacement for `node-appwrite` so Vercel Serverless Functions never fail with
 * CJS/ESM named-export SyntaxErrors or missing lockfile module errors.
 */

export class Client {
  public endpoint: string = "https://sgp.cloud.appwrite.io/v1";
  public project: string = "6a1416eb001f50cdb902";
  public apiKey: string = "";
  public jwt: string = "";

  setEndpoint(endpoint: string): this {
    if (endpoint) this.endpoint = endpoint.trim().replace(/\/+$/, "");
    return this;
  }

  setProject(project: string): this {
    if (project) this.project = project.trim();
    return this;
  }

  setKey(key: string): this {
    if (key) this.apiKey = key.trim();
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
    };
    if (this.apiKey) {
      headers["X-Appwrite-Key"] = this.apiKey;
    } else if (this.jwt && this.jwt.split(".").length === 3) {
      headers["X-Appwrite-JWT"] = this.jwt;
    }
    return headers;
  }
}

export const ID = {
  unique(): string {
    return crypto.randomBytes(10).toString("hex");
  },
  custom(id: string): string {
    return id;
  },
};

export const Role = {
  any(): string {
    return "any";
  },
  user(id: string, status: string = ""): string {
    return status ? `user:${id}/${status}` : `user:${id}`;
  },
  users(status: string = ""): string {
    return status ? `users/${status}` : "users";
  },
  guests(): string {
    return "guests";
  },
};

export const Permission = {
  read(role: string): string {
    return `read("${role}")`;
  },
  write(role: string): string {
    return `write("${role}")`;
  },
  create(role: string): string {
    return `create("${role}")`;
  },
  update(role: string): string {
    return `update("${role}")`;
  },
  delete(role: string): string {
    return `delete("${role}")`;
  },
};

export const Query = {
  equal(attribute: string, value: any): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "equal", attribute, values });
  },
  notEqual(attribute: string, value: any): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "notEqual", attribute, values });
  },
  lessThan(attribute: string, value: any): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "lessThan", attribute, values });
  },
  lessThanEqual(attribute: string, value: any): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "lessThanEqual", attribute, values });
  },
  greaterThan(attribute: string, value: any): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "greaterThan", attribute, values });
  },
  greaterThanEqual(attribute: string, value: any): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "greaterThanEqual", attribute, values });
  },
  search(attribute: string, value: string): string {
    return JSON.stringify({ method: "search", attribute, values: [value] });
  },
  orderDesc(attribute: string): string {
    return JSON.stringify({ method: "orderDesc", attribute });
  },
  orderAsc(attribute: string): string {
    return JSON.stringify({ method: "orderAsc", attribute });
  },
  limit(limit: number): string {
    return JSON.stringify({ method: "limit", values: [Number(limit)] });
  },
  offset(offset: number): string {
    return JSON.stringify({ method: "offset", values: [Number(offset)] });
  },
};

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

  async listDocuments(databaseId: string, collectionId: string, queries: string[] = []): Promise<{ total: number; documents: any[] }> {
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
    const res = await this.request(path, { method: "GET" });
    return {
      total: typeof res.total === "number" ? res.total : (res.documents?.length || 0),
      documents: Array.isArray(res.documents) ? res.documents : [],
    };
  }

  async getDocument(databaseId: string, collectionId: string, documentId: string, queries: string[] = []): Promise<any> {
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
    const finalDocId = !documentId || documentId === "unique()" ? ID.unique() : documentId;
    const cleanData: Record<string, any> = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith("$") && v !== undefined) {
          cleanData[k] = v;
        }
      }
    }
    const body: Record<string, any> = {
      documentId: finalDocId,
      data: cleanData,
    };
    if (Array.isArray(permissions) && permissions.length > 0) {
      body.permissions = permissions;
    }
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`;
    return this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data?: Record<string, any>,
    permissions?: string[]
  ): Promise<any> {
    const cleanData: Record<string, any> = {};
    if (data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith("$") && v !== undefined) {
          cleanData[k] = v;
        }
      }
    }
    const body: Record<string, any> = {
      data: cleanData,
    };
    if (Array.isArray(permissions) && permissions.length > 0) {
      body.permissions = permissions;
    }
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
    return this.request(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteDocument(databaseId: string, collectionId: string, documentId: string): Promise<any> {
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
    return this.request(path, { method: "DELETE" });
  }
}
