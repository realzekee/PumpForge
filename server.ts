import express from "express";
import path from "path";
import app from "./src/server/app.ts";

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware not loaded:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PumpForge authoritative game server running on http://localhost:${PORT}`);
  });
}

export default app;

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NETLIFY
);

const scriptPath = process.argv[1] || "";
const isMain =
  scriptPath.endsWith("server.ts") ||
  scriptPath.endsWith("server.js") ||
  scriptPath.endsWith("server.cjs");

if (!isServerless && isMain && typeof process.send !== "function" && process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("PumpForge startup error:", err);
  });
}
