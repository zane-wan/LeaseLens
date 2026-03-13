# LeaseLens

AI-powered Ontario residential lease compliance analyzer — upload a lease, get clause-by-clause legal analysis against the Residential Tenancies Act (RTA).

## Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Framework  | Next.js 15 (App Router)              |
| UI         | React 19, Tailwind CSS v4, shadcn/ui |
| State      | Redux Toolkit                        |
| Database   | PostgreSQL + Prisma ORM              |
| Auth       | Better Auth + Google OAuth           |
| AI         | Vercel AI SDK + OpenAI GPT-4o        |
| Validation | Zod                                  |
| Storage    | AWS S3 (lease PDFs)                  |
| Hosting    | AWS EC2                              |

## Getting Started

```bash
git clone https://github.com/zane-wan/LeaseLens.git
cd LeaseLens
npm install
```

Create a `.env.local` file in the project root:

```env
# OpenAI
OPENAI_API_KEY=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/leaselens

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=

# Google OAuth (Better Auth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_SECRET=
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                                  # Next.js App Router
│   ├── (auth)/                           # Public auth pages
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/                      # Protected app pages
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── agreements/[id]/page.tsx
│   │   ├── account/page.tsx
│   │   ├── admin/users/page.tsx
│   │   └── support/page.tsx
│   ├── api/                              # Merged action/segment API routes
│   │   ├── auth/[action]/route.ts
│   │   ├── auth/google/route.ts
│   │   ├── auth/google/callback/route.ts
│   │   ├── auth/password-reset/[action]/route.ts
│   │   ├── admin/users/[[...segments]]/route.ts
│   │   ├── agreements/[[...segments]]/route.ts
│   │   ├── analyses/[id]/route.ts
│   │   ├── chats/sessions/[[...segments]]/route.ts
│   │   ├── support/threads/[[...segments]]/route.ts
│   │   └── upload/presigned/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── auth/LogoutButton.tsx
│   └── ui/                              # Shared UI primitives (includes sonner.tsx)
├── features/
│   ├── auth/components/
│   │   ├── AuthForms.tsx               # Login/signup/forgot-password UI
│   │   └── AccountAdminPanels.tsx      # Account settings + admin user panel
│   ├── analysis/pipeline/orchestrator.ts # RAG + LLM orchestration placeholder
│   ├── upload/components/
│   │   ├── DropZone.tsx
│   │   └── AgreementList.tsx
│   ├── upload/hooks/useUpload.ts
│   ├── support/components/SupportInbox.tsx
│   ├── agreements/                      # Placeholder folders for future modules
│   └── analysis/                        # Placeholder folders for future modules
├── config/llm.ts                        # LLM provider/model settings
├── lib/
│   ├── auth.ts
│   ├── auth-service.ts
│   ├── rbac.ts
│   ├── rate-limit.ts
│   ├── password.ts
│   ├── email.ts
│   ├── llm.ts
│   ├── rag.ts
│   ├── pdf.ts
│   ├── prisma.ts
│   └── utils.ts
└── store/slices/                        # Placeholder for Redux slices
```

## Task Breakdown

| ID  | Sub-task                                                         | Assignee | Dependencies |
| --- | ---------------------------------------------------------------- | -------- | ------------ |
| T1a | Google OAuth setup (Better Auth + provider config)               | Zihan    | None         |
| T1b | Login/signup pages                                               | Ruiwu    | T1a          |
| T2a | S3 presigned URL backend                                         | Zihan    | None         |
| T2b | Drag-drop upload UI + PDF parsing                                | Yiyang   | T2a          |
| T3  | Database schema + Prisma models (agreements, analyses, users)    | yiyang   | None         |
| T4  | Dashboard UI (agreement list, status badges, detail view)        | Ruiwu    | T1, T3       |
| T5a | RAG retrieval + LLM orchestration                                | Zihan    | T3           |
| T5b | Analysis results storage                                         | Yiyang   | T5a, T3      |
| T6  | Analysis results UI (clause cards, compliance badges, citations) | TBD      | T4, T5       |
| T7a | AWS EC2 deploy                                                   | Zihan    | T6           |
| T7b | Error handling + loading states                                  | TBD      | T6           |

### Execution Order

```
Wave 1 (parallel):  T1a  T2a  T3
                     │    │    │
Wave 2 (parallel):  T1b  T2b  │
                     │    │    │
Wave 3 (parallel):   └─T4─┘  T5a
                     │    └─T5b─┘
                     │      │
Wave 4:              └──T6──┘
                        │
Wave 5 (parallel):  T7a  T7b
```

- **Wave 1** — T1a, T2a, T3 can all start immediately in parallel (no deps)
- **Wave 2** — T1b needs T1a; T2b needs T2a
- **Wave 3** — T4 needs T1+T3; T5a needs T3
- **Wave 4** — T6 needs T4+T5
- **Wave 5** — T7a and T7b need T6

## Development Workflow

### Branch naming

```
<your-initials>/feature-name
```

Use your initials as prefix (e.g. `zw/`, `jl/`).

### Commit messages

Follow conventional commit prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — tooling, deps, config
- `doc:` — documentation

Examples:

```
feat: add lease upload drag-drop UI
fix: handle expired presigned URL gracefully
chore: add Prisma schema for agreements table
doc: add README with project structure
```

### PR process

1. Create a feature branch from `main`
2. Make commits with conventional prefixes
3. Push and open a PR against `main`
4. Get at least one review before merging
5. Squash-merge to keep history clean

## Ruiwu Edits

### Edit Overview 2026.3.11
Recompared against manager `main` snapshot, kept shared main logic where applicable, and consolidated T1b/T6 with email-required auth, Google OAuth, RBAC, per-user isolation, plus duplication/bug cleanup (stale placeholders removed, verified-email OAuth guard, direct `jose` dependency, and safer in-memory throttling cleanup).

### Edited Scripts 2026.3.11
- `README.md`: Synced this section with the latest main-branch comparison, cleanup pass, and current merge guidance for T1b/T6 dependents.
- `package.json`: Added `jose` as a direct runtime dependency because JWT auth imports it directly.
- `package-lock.json`: Refreshed lock metadata to keep dependency resolution consistent with the root dependency manifest.
- `prisma/schema.prisma`: Extended RBAC/support/chat/memory models and finalized required unique email identity with password-reset persistence.
- `src/app/(dashboard)/dashboard/page.tsx`: Added explicit error handling for agreement fetch/analyze/delete requests.
- `src/app/api/auth/google/route.ts`: Kept manager-main Google authorization redirect flow while fitting current style and routing.
- `src/app/api/auth/google/callback/route.ts`: Kept manager-main callback flow and added normalized-email handling, first-user owner assignment, and verified-email guard before session issuance.
- `src/app/api/upload/presigned/route.ts`: Added auth guard and user-scoped object-key generation for upload isolation.
- `src/app/page.tsx`: Added auth-aware landing navigation for signed-in versus guest users.
- `src/features/upload/hooks/useUpload.ts`: Improved backend error surfacing for presigned-url and agreement-create failures.
- `src/lib/auth.ts`: Aligned JWT-cookie auth utilities with manager-main behavior while keeping shared helper interfaces used by merged routes/components.

### Added Scripts 2026.3.11
- `prisma/migrations/20260311190000_auth_rbac_memory/migration.sql`: Adds the migration for RBAC, support messaging, and user-scoped chat/memory tables.
- `prisma/migrations/20260312003000_username_optional_email_password_reset/migration.sql`: Adds the first password-reset persistence rollout migration.
- `prisma/migrations/20260313001000_email_required_drop_username/migration.sql`: Enforces required email identity, backfills any null emails, and removes the username column.
- `src/app/(auth)/login/page.tsx`: Provides the login route page and redirects authenticated users to dashboard.
- `src/app/(auth)/signup/page.tsx`: Provides the signup route page and redirects authenticated users to dashboard.
- `src/app/(auth)/forgot-password/page.tsx`: Provides the forgot-password route page for email-based verification and code-based password reset.
- `src/app/(dashboard)/account/page.tsx`: Hosts self-service account settings for the authenticated user.
- `src/app/(dashboard)/admin/users/page.tsx`: Hosts protected admin/owner user-management UI.
- `src/app/(dashboard)/agreements/[id]/page.tsx`: Implements T6 agreement analysis detail UI with status, summary cards, clause cards, and citations.
- `src/app/(dashboard)/layout.tsx`: Adds protected dashboard shell with role-aware navigation and email-aware sign-out label.
- `src/app/(dashboard)/support/page.tsx`: Hosts support inbox/thread UI for user inquiries and admin/owner replies.
- `src/app/api/analyses/[id]/route.ts`: Adds secured analysis detail endpoint scoped through agreement ownership.
- `src/app/api/auth/[action]/route.ts`: Merges auth and account actions (`signup`, `login`, `logout`, `me`, `account`) into one throttled action router.
- `src/app/api/auth/password-reset/[action]/route.ts`: Merges password-reset actions (`start`, `send-code`, `confirm`) into one throttled action router.
- `src/app/api/admin/users/[[...segments]]/route.ts`: Merges admin user listing and per-user updates into one role-constrained route.
- `src/app/api/agreements/[[...segments]]/route.ts`: Merges agreement list/create/delete plus status/analyze actions into one ownership-scoped route.
- `src/app/api/chats/sessions/[[...segments]]/route.ts`: Merges chat session and message endpoints into one per-user isolated route.
- `src/app/api/support/threads/[[...segments]]/route.ts`: Merges support thread and message endpoints into one role-aware route.
- `src/components/auth/LogoutButton.tsx`: Adds a shared logout action component with optional identity label.
- `src/features/auth/components/AuthForms.tsx`: Merges login/signup/forgot-password forms and centralizes shared form request/card logic.
- `src/features/auth/components/AccountAdminPanels.tsx`: Merges account settings and admin user-management panels in one auth UI module.
- `src/features/support/components/SupportInbox.tsx`: Adds support thread/message UI with nullable-email-safe rendering.
- `src/components/ui/sonner.tsx`: Restores manager-main shared toast primitive to keep UI foundation consistent with main branch.
- `src/config/llm.ts`: Restores manager-main LLM provider/model config module for proposal-consistent pipeline evolution.
- `src/features/analysis/pipeline/orchestrator.ts`: Restores manager-main analysis orchestration placeholder module.
- `src/lib/auth-service.ts`: Adds consolidated login/authority/account/password-reset business logic so auth routes stay thin.
- `src/lib/rate-limit.ts`: Adds reusable in-memory request throttling utilities with client identifier extraction plus periodic expired-bucket cleanup/overflow trimming.
- `src/lib/email.ts`: Adds independent development-safe email adapter abstraction for support and reset notifications.
- `src/lib/llm.ts`: Restores manager-main single-clause LLM analysis helper.
- `src/lib/pdf.ts`: Restores manager-main PDF extraction helper.
- `src/lib/rag.ts`: Restores manager-main RAG retrieval helper.
- `src/lib/rbac.ts`: Adds centralized role and account-management permission checks.

### Merge Instructions on Modules Based on T1b and T6
All modules that depend on T1b/T6 should pull this branch and run `npm install`, `npx prisma migrate dev`, and `npx prisma generate` first so the current auth/RBAC/chat/support schema and APIs are available locally.  
For auth integration, keep email as the required account identifier for credential login/signup, and keep Google OAuth as the alternate login path via `/api/auth/google` and `/api/auth/google/callback`.  
For shared logic consistency with manager main, reuse the centralized session helper module for request identity and keep upload/auth route behavior as implemented instead of reintroducing older parallel handlers.  
For ownership isolation, always scope agreements, analyses, chat sessions/messages, and memory data with the authenticated `user.id` in database filters.  
For account/admin flows, route permission and credential updates through the consolidated auth-service and RBAC modules and avoid duplicating those checks in feature-specific handlers.  
For password reset, use `/api/auth/password-reset/start`, `/send-code`, and `/confirm` with email payloads only and keep reset-code throttling enabled.  
For T6-dependent work, keep the analysis detail contract stable by writing `Analysis` + `ClauseResult` and exposing status via `/api/agreements/[id]/status` (from the merged segments route).  
