# AI Interaction Record

## Session 1: Structuring the Repository for Parallel Team Development

### Prompt (sent to AI)

We're building a Next.js 15 App Router project (TypeScript, Prisma, PostgreSQL) with 4 people. Each person owns a different feature area: authentication & account management, file upload & S3 storage, lease analysis & RAG pipeline, and admin/support. How should we organize the src/ directory so that we can all work on our features at the same time without constantly running into merge conflicts?

### AI Response (trimmed)

The AI recommended a feature-based directory layout:

```
src/
  features/
    auth/       → components/, hooks/, types/
    upload/     → components/, hooks/, types/, actions/
    analysis/   → components/, hooks/, types/, pipeline/, actions/
    agreements/ → components/, hooks/, types/, actions/
  lib/          → shared utilities (db client, s3, auth helpers, etc.)
  config/       → app-wide configuration
  store/        → Redux slices
  app/
    (auth)/     → login, signup (route group with auth layout)
    (dashboard)/ → dashboard, account, admin (route group with dashboard layout)
    api/        → backend routes mirroring feature domains
```

The AI also suggested:

1. Adopting a monorepo tool (Nx or Turborepo) for workspace management, build caching, and per-feature CI pipelines.
2. Centralizing all server-side business logic into a single `src/server/` directory instead of keeping API route handlers under `src/app/api/`.

### What the Team Did

- **Adopted the feature directory layout.** The structure was scaffolded in commit `1c63c06` with `.gitkeep` placeholders for `src/features/{agreements,analysis,auth,upload}/` each containing `actions/`, `components/`, `hooks/`, and `types/` subdirectories. `src/features/support/` was added later when the support ticket feature was built. This kept feature work isolated: changes to the upload hook (`src/features/upload/hooks/useUpload.ts`) never conflicted with analysis pipeline work (`src/features/analysis/pipeline/orchestrator.ts`).
- **Rejected the monorepo tooling suggestion.** This is a single Next.js application, not a multi-package workspace. Adding Nx or Turborepo would have introduced configuration overhead with no benefit, since the project has one build target and one deployment artifact.
- **Rejected centralizing API logic into `src/server/`.** The App Router convention is to colocate API route handlers under `src/app/api/`. Moving them into a separate `src/server/` directory would break the routing convention and require manual wiring. Instead, API routes under `src/app/api/` were organized to mirror the feature structure (`api/auth/`, `api/agreements/`, `api/analyses/`, `api/upload/`, `api/chats/`, `api/support/`, `api/admin/`, `api/stripe/`).
- **Verified** by observing that across 40+ pull requests, teammates rarely touched the same files. Most PRs were scoped entirely within one feature directory or one API route group.

---

## Session 2: Diagnosing Google OAuth redirect_uri_mismatch in Production

### Prompt (sent to AI)

Google OAuth login works fine on localhost:3000 but fails in production with a redirect_uri_mismatch error. The app runs in Docker on an EC2 instance behind a reverse proxy. Here is the current code in both OAuth routes:

```typescript
// src/app/api/auth/google/route.ts
const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`

// src/app/api/auth/google/callback/route.ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const redirectUri = `${appUrl}/api/auth/google/callback`
```

NEXT_PUBLIC_APP_URL is set to https://leaselens.website in .env.local on the EC2 host. The Google Cloud Console has the authorized redirect URI set to https://leaselens.website/api/auth/google/callback. But the token exchange still fails with redirect_uri_mismatch. What is going wrong?

### AI Response (trimmed)

The AI first suggested adding a dedicated `GOOGLE_REDIRECT_URI` environment variable:

> Set `GOOGLE_REDIRECT_URI=https://leaselens.website/api/auth/google/callback` in your production environment and read it directly in both routes. This way the redirect URI is always exactly what Google expects, regardless of how NEXT_PUBLIC_APP_URL resolves at runtime.

When this was pushed back on (it introduces a second source of truth that must be kept in sync with both the Google Console and the app URL), the AI revised its suggestion:

> The likely issue is that behind a reverse proxy, `NEXT_PUBLIC_APP_URL` may have a trailing slash or the env var is not loaded correctly in the server-side context. A more robust approach is to derive the URL from the incoming request headers. Reverse proxies typically set `x-forwarded-proto` and `x-forwarded-host` to reflect the original client request. You can build a utility that reads these headers, falls back to the Host header, and normalizes the result. Also wrap the callback handler in try-catch with logging so you can see exactly what URL is being constructed.

### What the Team Did

- **Rejected the hardcoded `GOOGLE_REDIRECT_URI` suggestion.** This would create a second env var that must exactly match the Google Cloud Console configuration and the app domain. Any URL or path change would require coordinated updates in three places (env var, Google Console, and code). This defeats the purpose of deriving the URL from the deployment context.
- **Built `src/lib/app-url.ts`** with a multi-source URL resolution strategy. The first fix (commit `9b10a9d`) created the utility using `req.nextUrl.origin`, but this was still insufficient because `nextUrl.origin` behind the reverse proxy resolved to an internal address. The second fix (commit `8d09160`) added full `x-forwarded-proto` / `x-forwarded-host` header parsing with a priority chain: forwarded headers > Host header with inferred protocol > `req.nextUrl.origin` > configured env var > localhost fallback. It also added `isLocalAppUrl()` detection and a smart fallback where, if the env var points to localhost but the request headers indicate a production domain, the request-derived URL is used instead.
- **Added a production safety guard** in `src/app/api/auth/google/route.ts`: if the resolved redirect URI is a localhost address while `NODE_ENV` is production, the route returns a 500 error with diagnostic details (host, forwarded headers, configured env var) instead of silently sending the user to Google with a broken redirect URI.
- **Verified** by testing the full OAuth flow (login initiation, Google consent screen, callback, session creation, dashboard redirect) on both `localhost:3000` and `https://leaselens.website`. Server logs confirmed that the redirect URI matched the Google Console configuration in both environments.
