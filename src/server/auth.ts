import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "./types";

const APPWRITE_ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = process.env.VITE_APPWRITE_PROJECT || "6a1416eb001f50cdb902";

// Server-authoritative admin emails list
const DEFAULT_ADMIN_EMAILS = ["realzekeee@gmail.com"];
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
  .concat(DEFAULT_ADMIN_EMAILS);

// Cache verified JWTs briefly (60 seconds) to reduce remote latency
interface CachedAuth {
  user: AuthenticatedUser;
  expiresAt: number;
}
const jwtCache = new Map<string, CachedAuth>();

/**
 * Verifies an Appwrite JWT or Bearer token cryptographically with Appwrite Cloud.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization || "";
  const jwtHeader = (req.headers["x-appwrite-jwt"] as string) || "";
  let jwt = "";

  if (authHeader.startsWith("Bearer ")) {
    jwt = authHeader.substring(7).trim();
  } else if (jwtHeader) {
    jwt = jwtHeader.trim();
  }

  if (!jwt) {
    // Guest or unauthenticated fallback
    const guestId = (req.headers["x-guest-id"] as string) || "guest_player";
    return {
      userId: guestId,
      email: "",
      name: "Guest Player",
      isAdmin: false,
      isGuest: true,
    };
  }

  // Check in-memory cache
  const cached = jwtCache.get(jwt);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  try {
    // Verify token with Appwrite Cloud API
    const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      method: "GET",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT,
        "X-Appwrite-JWT": jwt,
      },
    });

    if (!res.ok) {
      // Invalid or expired JWT
      return {
        userId: "guest_player",
        email: "",
        name: "Guest Player",
        isAdmin: false,
        isGuest: true,
      };
    }

    const appwriteAccount = await res.json();
    const verifiedEmail = (appwriteAccount.email || "").toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.includes(verifiedEmail);

    const authenticatedUser: AuthenticatedUser = {
      userId: appwriteAccount.$id,
      email: verifiedEmail,
      name: appwriteAccount.name || "Trader",
      isAdmin,
      isGuest: false,
      jwt,
    };

    // Cache for 60 seconds
    jwtCache.set(jwt, {
      user: authenticatedUser,
      expiresAt: Date.now() + 60000,
    });

    return authenticatedUser;
  } catch (err) {
    console.error("Authentication verification error with Appwrite:", err);
    return {
      userId: "guest_player",
      email: "",
      name: "Guest Player",
      isAdmin: false,
      isGuest: true,
    };
  }
}

/**
 * Express middleware that attaches authenticated user to request
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
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
