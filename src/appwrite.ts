import { Client, Account, Databases } from "appwrite";

// Fix BigInt JSON serialization globally
if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

/**
 * Recursively converts any BigInt values to regular JavaScript numbers
 * to prevent "TypeError: Cannot mix BigInt and other types" errors across the app.
 */
export function sanitizeBigInts<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "bigint") {
    return Number(data) as any;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeBigInts(item)) as any;
  }
  if (typeof data === "object" && !(data instanceof Date) && !(data instanceof RegExp)) {
    const copy: any = {};
    for (const key of Object.keys(data)) {
      copy[key] = sanitizeBigInts((data as any)[key]);
    }
    return copy;
  }
  return data;
}

const rawClient = new Client()
  .setEndpoint("https://sgp.cloud.appwrite.io/v1")
  .setProject("6a1416eb001f50cdb902");

// Wrap client.subscribe so realtime payloads never contain BigInts
const origSubscribe = rawClient.subscribe.bind(rawClient);
rawClient.subscribe = function (channels: any, callback: any) {
  return origSubscribe(channels, (response: any) => {
    if (response) {
      if (response.payload) {
        response.payload = sanitizeBigInts(response.payload);
      }
      response = sanitizeBigInts(response);
    }
    return callback(response);
  });
};

const rawAccount = new Account(rawClient);
const rawDatabases = new Databases(rawClient);

export const account = new Proxy(rawAccount, {
  get(target, prop, receiver) {
    const orig = (target as any)[prop];
    if (typeof orig === "function") {
      return async (...args: any[]) => {
        const result = await orig.apply(target, args);
        return sanitizeBigInts(result);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

export const databases = new Proxy(rawDatabases, {
  get(target, prop, receiver) {
    const orig = (target as any)[prop];
    if (typeof orig === "function") {
      return async (...args: any[]) => {
        const result = await orig.apply(target, args);
        return sanitizeBigInts(result);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

export { rawClient as client };

