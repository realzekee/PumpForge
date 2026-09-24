import app from "../server";

export default function handler(req: any, res: any) {
  // Normalize URL for Vercel Serverless Function routing
  try {
    let targetUrl = req.url || "/";

    // 1. If path is provided via query parameter (?path= or ?__path= from vercel.json rewrite)
    const queryPath = req.query?.path || req.query?.__path;
    if (queryPath) {
      const clean = Array.isArray(queryPath) ? queryPath.join("/") : String(queryPath);
      targetUrl = clean.startsWith("api/") ? `/${clean}` : `/api/${clean.replace(/^\/+/, "")}`;
    } else {
      // 2. Check Vercel routing headers
      const matchedHeader =
        req.headers["x-matched-path"] ||
        req.headers["x-vercel-matched-path"] ||
        req.headers["x-invoke-path"];

      if (typeof matchedHeader === "string" && matchedHeader.startsWith("/api") && matchedHeader !== "/api" && matchedHeader !== "/api/") {
        targetUrl = matchedHeader;
      } else if (req.headers["x-now-route-matches"]) {
        const match = String(req.headers["x-now-route-matches"]).match(/1=([^&]+)/);
        if (match && match[1]) {
          const sub = decodeURIComponent(match[1]).replace(/^\/+/, "");
          targetUrl = sub.startsWith("api/") ? `/${sub}` : `/api/${sub}`;
        }
      }
    }

    // Strip /api/index.js or /api/index prefix
    if (targetUrl.startsWith("/api/index.js") || targetUrl.startsWith("/api/index.ts") || targetUrl.startsWith("/api/index")) {
      const prefix = targetUrl.startsWith("/api/index.js")
        ? "/api/index.js"
        : targetUrl.startsWith("/api/index.ts")
        ? "/api/index.ts"
        : "/api/index";
      const remainder = targetUrl.slice(prefix.length);
      targetUrl = remainder.startsWith("/") ? `/api${remainder}` : `/api/${remainder}`;
    }

    // Ensure URL has /api prefix if targeting known endpoints
    if (
      !targetUrl.startsWith("/api") &&
      (targetUrl.startsWith("/game") ||
        targetUrl.startsWith("/arcade") ||
        targetUrl.startsWith("/auth") ||
        targetUrl.startsWith("/admin") ||
        targetUrl.startsWith("/health"))
    ) {
      targetUrl = `/api${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
    }

    req.url = targetUrl;
  } catch (err) {
    console.error("Vercel API URL normalization error:", err);
  }

  return app(req, res);
}
