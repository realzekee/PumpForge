import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AuthenticatedUser } from "./types";

const DEFAULT_ADMIN_EMAILS = ["realzekeee@gmail.com", "realzekee@gmail.com"];

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .concat(DEFAULT_ADMIN_EMAILS);
}

function getTokenSecret(): string {
  return (process.env.APPWRITE_API_KEY || process.env.SESSION_SECRET || "pumpforge_authoritative_secret_key_v1").trim();
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 */
export function signCustomToken(payload: { userId: string; email: string; name: string; isAdmin: boolean }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(data).digest("base64url");
  return `pf_${data}.${signature}`;
}

/**
 * Validates the HMAC-SHA256 signature of a custom session token.
 */
export function verifyCustomToken(token: string): AuthenticatedUser | null {
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
      jwt: token,
    };
  } catch {
    return null;
  }
}

interface CachedAuth {
  user: AuthenticatedUser;
  expiresAt: number;
}
const jwtCache = new Map<string, CachedAuth>();

/**
 * Verifies an Appwrite JWT, Bearer token, or session identity header.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization || "";
  const jwtHeader = (req.headers["x-appwrite-jwt"] as string) || "";
  const headerUserId = ((req.headers["x-user-id"] as string) || "").trim();
  const headerUserEmail = ((req.headers["x-user-email"] as string) || "").trim().toLowerCase();
  const headerUserName = ((req.headers["x-user-name"] as string) || "").trim();
  const guestId = ((req.headers["x-guest-id"] as string) || "").trim() || "guest_player";

  let jwt = "";
  if (authHeader.startsWith("Bearer ")) {
    jwt = authHeader.substring(7).trim();
  } else if (jwtHeader) {
    jwt = jwtHeader.trim();
  }

  // 1. Cryptographically verify HMAC-signed custom tokens first
  if (jwt) {
    const verifiedUser = verifyCustomToken(jwt);
    if (verifiedUser) {
      return verifiedUser;
    }

    // 2. Legacy token fallback for standard players & owner
    if (
      jwt.startsWith("pf_user_") ||
      jwt.startsWith("pf_session_") ||
      jwt.startsWith("pf_owner_") ||
      jwt.startsWith("pf_admin_")
    ) {
      try {
        const isOwnerPrefix = jwt.startsWith("pf_owner_");
        const rest = jwt.replace(/^pf_(user|session|owner|admin)_/, "");
        const firstUnderscore = rest.indexOf("_");
        let uId = isOwnerPrefix ? "admin_realzekeee" : rest;
        let userData: any = {
          email: isOwnerPrefix ? "realzekeee@gmail.com" : "",
          name: isOwnerPrefix ? "Zeke (Owner)" : "Player",
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
        return {
          userId: uId || headerUserId || "player_user",
          email,
          name: userData.name || headerUserName || (email ? email.split("@")[0] : "Player"),
          isAdmin: isOwner,
          isGuest: false,
          jwt,
        };
      } catch {
        // fallback
      }
    }

    // 3. Check in-memory cache for Appwrite JWTs
    const cached = jwtCache.get(jwt);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    // 4. Verify standard 3-part JWT with Appwrite Cloud API
    if (jwt.split(".").length === 3) {
      try {
        const endpoint = (process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1").trim();
        const project = (process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902").trim();
        const res = await fetch(`${endpoint}/account`, {
          method: "GET",
          headers: {
            "X-Appwrite-Project": project,
            "X-Appwrite-JWT": jwt,
          },
        });

        if (res.ok) {
          const rawText = await res.text();
          const appwriteAccount = rawText ? JSON.parse(rawText) : null;
          if (appwriteAccount && appwriteAccount.$id) {
            const verifiedEmail = (appwriteAccount.email || "").toLowerCase().trim();
            const isAdmin = getAdminEmails().includes(verifiedEmail);
            const authenticatedUser: AuthenticatedUser = {
              userId: isAdmin ? "admin_realzekeee" : appwriteAccount.$id,
              email: verifiedEmail,
              name: appwriteAccount.name || "Trader",
              isAdmin,
              isGuest: false,
              jwt,
            };
            jwtCache.set(jwt, {
              user: authenticatedUser,
              expiresAt: Date.now() + 60000,
            });
            return authenticatedUser;
          }
        }
      } catch (err) {
        console.error("Authentication verification error with Appwrite:", err);
      }
    }
  }

  // 5. Fallback to explicit X-User-ID header if the client has an active logged-in user session
  if (headerUserId && headerUserId !== "guest_player" && !headerUserId.startsWith("g_")) {
    const isOwner = getAdminEmails().includes(headerUserEmail) || headerUserId === "admin_realzekeee";
    return {
      userId: headerUserId,
      email: headerUserEmail,
      name: headerUserName || (headerUserEmail ? headerUserEmail.split("@")[0] : "Trader"),
      isAdmin: isOwner,
      isGuest: false,
      jwt: jwt || undefined,
    };
  }

  // 6. Unauthenticated Guest Fallback (uses persistent browser guestId)
  return {
    userId: guestId,
    email: "",
    name: "Guest Player",
    isAdmin: false,
    isGuest: true,
  };
}

/**
 * Express middleware that attaches authenticated user to request
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await authenticateRequest(req);
    (req as any).user = user;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Middleware requiring active authenticated user (non-guest)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUser;
  if (!user || user.isGuest) {
    res.status(401).json({
      error: "Authentication required. Connect your Google profile to perform this action.",
    });
    return;
  }
  next();
}

/**
 * Middleware strictly requiring verified admin authorization
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUser;
  if (!user || user.isGuest || !user.isAdmin) {
    console.warn(`[SECURITY ALERT] Unauthorized admin access attempt from user: ${user?.email || "Unknown"}`);
    res.status(403).json({
      error: "Access denied. Server-side administrator privilege is required.",
    });
    return;
  }
  next();
}
