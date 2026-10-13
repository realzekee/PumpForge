# Production Serverless Stability & Clean API Router Architecture

Eliminates Vercel `FUNCTION_INVOCATION_FAILED` (500) errors across `/api/game/leaderboard` and `/api/game/daily-reward` by decoupling the authoritative Express game router from local development tooling (Vite), establishing edge-cached leaderboard retrieval against Appwrite Cloud, and packaging a self-contained, lightweight serverless bundle.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed and incorporated into this implementation plan:

- **Confirmed Decision 1 (Backend Architecture)**: Separate the pure Express API router into a dedicated, clean module (`src/server/app.ts`) that completely excludes dev-server tooling, Vite middlewares, and local static asset serving.
- **Confirmed Decision 2 (Leaderboard Retrieval)**: Query Appwrite Cloud directly with a 30-second edge cache (`Cache-Control: public, s-maxage=30, stale-while-revalidate=60`), ensuring instant leaderboard responses while protecting Appwrite from rate limits.
- **Confirmed Decision 3 (Local Development Integrity)**: Keep the local development command (`npm run dev`) identical: `server.ts` imports the clean router and mounts Vite middlewares for hot module reloading on `localhost:3000`.

---

### 1. Overview & Core Concept

- **What It Does**: Refactors the backend into a clean 2-tier architecture:
  1. **Core API Engine (`src/server/app.ts`)**: Pure Express router hosting all authenticated game endpoints (`/api/game/*`, `/api/arcade/*`, `/api/auth/*`, `/api/db/proxy`). Contains only business logic, zero-trust mutex locks, cryptographic session verification, and Appwrite client calls.
  2. **Production Serverless Entrypoint (`api/index.js` via `src/server/vercelEntry.ts`)**: Self-contained ES Module bundled by `esbuild` during `npm run build` that inlines all internal backend code and imports only standard node packages (`express`, `node-appwrite`, `crypto`). Contains zero references to `vite`, preventing AWS Lambda container initialization failures.
  3. **Local Dev Runner (`server.ts`)**: Imports the clean API router and attaches Vite middlewares when running locally on port 3000.
- **Key Value**: Completely resolves the Vercel `FUNCTION_INVOCATION_FAILED` crashes shown in DevTools, guarantees sub-100ms responses on leaderboard queries, and preserves instant local development.

---

### 2. User Experience & Visual Design

- **Leaderboard Tab (`/leaderboard`)**:
  - Renders top gainers, prestige holders, and coin creators instantly without 500 error toasts or blank fallback cards.
  - Smooth 30-second background revalidation keeps rankings fresh as global trades settle without slamming the database.
- **Daily Reward Modal & Header Widget**:
  - The "Claim $1,500" action executes with immediate visual feedback, updating cash and gems balances and advancing the daily streak badge without server error popups.
- **Resilient Error Boundaries**:
  - If a cold start or transient network timeout occurs against Appwrite Cloud, the router returns clean JSON error descriptions instead of killing the Node.js process.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Modular Router (`src/server/app.ts`) vs Monolithic `server.ts`**
  - *Chosen Approach*: Move all route definitions, middlewares, and CORS logic to `src/server/app.ts`. `server.ts` becomes a thin wrapper that starts Vite locally.
  - *Why*: In Vercel serverless execution, importing `server.ts` was pulling in `import("vite")` and `process.argv` checks, causing the Lambda runtime to fail during initialization.
  - *Alternatives Considered*: Retaining everything in `server.ts` with conditional checks was brittle and led to module resolution failures (`ERR_MODULE_NOT_FOUND`).
- **Decision 2: 30-Second Edge Caching for Leaderboards**
  - *Chosen Approach*: Add `s-maxage=30, stale-while-revalidate=60` HTTP headers to `/api/game/leaderboard`.
  - *Why*: Leaderboard queries compute ranks across active users. Edge caching lets Vercel's global CDN serve cached responses in <20ms while refreshing in the background.
  - *Alternatives Considered*: Live queries on every request risked hitting Appwrite Cloud rate limits when multiple players loaded the tab simultaneously.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       (Local Dev / 3000)             (Vercel Production)
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│          server.ts           │ │    api/index.js (Lambda)   │
│  - Mounts Vite Middleware    │ │  - Fully Bundled & Stand-  │
│  - Serves Local Port 3000    │ │    alone via esbuild       │
│  - Dev-only Hot Reloading    │ │  - Zero Vite / Dev Tools   │
└──────────────┬───────────────┘ └────────────┬───────────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 src/server/app.ts (Clean Router)            │
│  - CORS & Security Headers                                  │
│  - HMAC Session Verification (auth.ts)                      │
│  - Game & Arcade Endpoints (daily-reward, leaderboard, etc) │
│  - Per-User Mutex Locks (locks.ts)                          │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Appwrite Cloud (Singapore SGP)              │
│  - users, coins, trades, wagers, polymarkets collections    │
└─────────────────────────────────────────────────────────────┘
```

#### Planned Steps for Execution

1. **Extract Core Router (`src/server/app.ts`)**:
   - Extract Express app creation, middlewares, and all route definitions from `server.ts` into a clean, dedicated `src/server/app.ts`.
   - Ensure `src/server/app.ts` contains ZERO references to `vite`, `createServer`, or local port listening.
   - Attach edge caching headers (`s-maxage=30, stale-while-revalidate=60`) to `/api/game/leaderboard`.
2. **Refactor Local Dev Harness (`server.ts`)**:
   - Update `server.ts` to import `app` from `src/server/app.ts`.
   - Maintain the existing dev workflow (`vite.middlewares` on port 3000).
3. **Refactor Vercel Serverless Entrypoint (`src/server/vercelEntry.ts`)**:
   - Update `src/server/vercelEntry.ts` to import `app` from `src/server/app.ts`.
   - Retain the promise-based stream lifecycle (`res.on("finish")`) to keep lambdas alive during async Appwrite operations.
4. **Compile & Generate Bundled `api/index.js`**:
   - Execute `npm run build` to package `src/server/vercelEntry.ts` into a self-contained `api/index.js`.
   - Verify that `api/index.js` contains zero references to `vite` or `server.ts`.
5. **Verification**:
   - Run `tsc --noEmit` and `compile_applet` to guarantee 0 build or lint errors.
   - Test simulated requests to `/api/game/leaderboard` and `/api/game/daily-reward` locally.
