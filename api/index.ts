import app from "../server";

export function resolveVercelUrl(req: any): string {
  let url = req.url || "/";
  const [pathname, searchStr] = url.split("?");
  const search = searchStr ? `?${searchStr}` : "";

  // 1. If path is provided via query parameter ?path= or ?__path= from rewrite
  const queryPath = req.query?.path || req.query?.__path;
  if (queryPath) {
    const clean = Array.isArray(queryPath) ? queryPath.join("/") : String(queryPath);
    const sub = clean.replace(/^\/+/, "");
    return sub.startsWith("api/") ? `/${sub}${search}` : `/api/${sub}${search}`;
  }

  // 2. Strip /api/index.js, /api/index.ts, /api/index prefix
  if (pathname.startsWith("/api/index.js") || pathname.startsWith("/api/index.ts") || pathname.startsWith("/api/index")) {
    const prefix = pathname.startsWith("/api/index.js")
      ? "/api/index.js"
      : pathname.startsWith("/api/index.ts")
      ? "/api/index.ts"
      : "/api/index";
    const remainder = pathname.slice(prefix.length).replace(/^\/+/, "");
    if (remainder.length > 0) {
      return `/api/${remainder}${search}`;
    }
  }

  // 3. Check Vercel routing headers
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

  // 4. Ensure /api prefix if targeting known endpoints
  if (
    !pathname.startsWith("/api") &&
    (pathname.startsWith("/game") ||
      pathname.startsWith("/arcade") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/health"))
  ) {
    return `/api${pathname.startsWith("/") ? "" : "/"}${pathname}${search}`;
  }

  return url;
}

export default function handler(req: any, res: any) {
  try {
    req.url = resolveVercelUrl(req);

    // Prevent body-parser from hanging on pre-consumed Vercel streams
    if (req.body !== undefined && req.body !== null) {
      req._body = true;
      if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
        try {
          req.body = JSON.parse(req.body);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error("Vercel URL resolution error:", err);
  }

  return app(req, res);
}
