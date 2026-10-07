import app from "../../server.ts";

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
  return new Promise((resolve) => {
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

      // Track completion so Vercel keeps the lambda alive until response flushes
      let completed = false;
      const onDone = () => {
        if (!completed) {
          completed = true;
          resolve(undefined);
        }
      };

      res.on("finish", onDone);
      res.on("close", onDone);
      res.on("error", (err: any) => {
        console.error("Vercel stream response error:", err);
        onDone();
      });

      app(req, res, (err: any) => {
        if (err) {
          console.error("Express unhandled middleware error in Vercel:", err);
          if (!res.headersSent) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.status(500).json({
              error: err?.message || "Internal server error occurred.",
              message: err?.message || "Internal server error occurred.",
            });
          }
        }
        onDone();
      });
    } catch (err: any) {
      console.error("Vercel top-level invocation error:", err);
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.status(500).json({
          error: err?.message || "Internal server error occurred.",
          message: err?.message || "Internal server error occurred.",
        });
      }
      resolve(undefined);
    }
  });
}
