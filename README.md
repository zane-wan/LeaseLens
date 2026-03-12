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
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/                # Login page
│   │   └── signup/               # Signup page
│   ├── (dashboard)/              # Authenticated route group
│   │   ├── dashboard/            # Main dashboard
│   │   ├── upload/               # Lease upload page
│   │   └── agreements/[id]/      # Single agreement detail
│   ├── api/                      # API routes
│   │   ├── auth/[...all]/        # Better Auth catch-all
│   │   ├── upload/presigned/     # S3 presigned URL endpoint
│   │   ├── agreements/[id]/
│   │   │   ├── analyze/          # Trigger analysis
│   │   │   └── status/           # Poll analysis status
│   │   └── analyses/[id]/        # Fetch analysis results
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── layout/                   # Shell, sidebar, navbar
│   └── shared/                   # Reusable composed components
├── features/                     # Feature modules
│   ├── auth/                     # Auth components, hooks, types
│   ├── upload/                   # Upload components, hooks, types
│   ├── agreements/               # Agreement list/detail
│   └── analysis/                 # Analysis display + pipeline
│       └── pipeline/
│           └── orchestrator.ts   # Parallel RAG + LLM per clause
├── config/
│   └── llm.ts                    # OpenAI provider + model config
├── lib/
│   ├── llm.ts                    # Single-clause analysis service
│   └── rag.ts                    # RAG context retrieval (stub)
└── store/
    └── slices/                   # Redux Toolkit slices
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
Implemented T1b and T6 with username-first auth, role-based permissions, per-user isolation, forgot-password and self-delete flows, merged route/component modules, and dead-code cleanup.

### Edited Scripts 2026.3.11
- `README.md`: Added support-email environment variables and now documented this Ruiwu change log section for integration handoff.
- `prisma/schema.prisma`: Extended the data model with RBAC/support/chat/memory entities and later updated auth fields to required `username`, optional `email`, and `PasswordResetCode`.
- `src/app/(dashboard)/dashboard/page.tsx`: Added API error handling for fetch/analyze/delete operations while keeping the current dashboard flow.
- `src/app/api/upload/presigned/route.ts`: Added auth guard and changed upload key generation to user-scoped S3 paths.
- `src/app/page.tsx`: Added auth-aware entry navigation so signed-in users go to dashboard and guests go to login/signup.
- `src/features/upload/hooks/useUpload.ts`: Improved error propagation from backend APIs for clearer upload failure reporting.
- `src/components/auth/LogoutButton.tsx`: Added session logout action with user identifier display.
- `src/lib/auth.ts`: Added shared session-cookie auth helpers and normalized authenticated user shape.
- `src/lib/password.ts`: Added password hashing/verification, strong-password validation, and reset code generation.

### Added Scripts 2026.3.11
- `prisma/migrations/20260311190000_auth_rbac_memory/migration.sql`: Adds the migration for RBAC, support messaging, and user-scoped chat/memory tables.
- `prisma/migrations/20260312003000_username_optional_email_password_reset/migration.sql`: Adds the migration for username-first auth, optional email, and password-reset code persistence.
- `src/app/(auth)/login/page.tsx`: Provides the login route page and redirects authenticated users to dashboard.
- `src/app/(auth)/signup/page.tsx`: Provides the signup route page and redirects authenticated users to dashboard.
- `src/app/(auth)/forgot-password/page.tsx`: Provides the forgot-password route page for username/email verification and code-based password reset.
- `src/app/(dashboard)/account/page.tsx`: Hosts self-service account settings for the authenticated user.
- `src/app/(dashboard)/admin/users/page.tsx`: Hosts protected admin/owner user-management UI.
- `src/app/(dashboard)/agreements/[id]/page.tsx`: Implements T6 agreement analysis detail UI with status, summary cards, clause cards, and citations.
- `src/app/(dashboard)/layout.tsx`: Adds protected dashboard shell with role-aware navigation and username-aware sign-out label.
- `src/app/(dashboard)/support/page.tsx`: Hosts support inbox/thread UI for user inquiries and admin/owner replies.
- `src/app/api/analyses/[id]/route.ts`: Adds secured analysis detail endpoint scoped through agreement ownership.
- `src/app/api/auth/[action]/route.ts`: Merges auth and account actions (`signup`, `login`, `logout`, `me`, `account`) into one throttled action router.
- `src/app/api/auth/password-reset/[action]/route.ts`: Merges password-reset actions (`start`, `send-code`, `confirm`) into one throttled action router.
- `src/app/api/admin/users/[[...segments]]/route.ts`: Merges admin user listing and per-user updates into one role-constrained route.
- `src/app/api/agreements/[[...segments]]/route.ts`: Merges agreement list/create/delete plus status/analyze actions into one ownership-scoped route.
- `src/app/api/chats/sessions/[[...segments]]/route.ts`: Merges chat session and message endpoints into one per-user isolated route.
- `src/app/api/support/threads/[[...segments]]/route.ts`: Merges support thread and message endpoints into one role-aware route.
- `src/features/auth/components/AuthForms.tsx`: Merges login/signup/forgot-password forms and centralizes shared form request/card logic.
- `src/features/auth/components/AccountAdminPanels.tsx`: Merges account settings and admin user-management panels in one auth UI module.
- `src/features/support/components/SupportInbox.tsx`: Adds support thread/message UI with nullable-email-safe rendering.
- `src/lib/auth-service.ts`: Adds consolidated login/authority/account/password-reset business logic so auth routes stay thin.
- `src/lib/rate-limit.ts`: Adds reusable in-memory request throttling utilities and client identifier extraction.
- `src/lib/email.ts`: Adds independent development-safe email adapter abstraction for support and reset notifications.
- `src/lib/rbac.ts`: Adds centralized role and account-management permission checks.

### Merge Instructions on Modules Based on T1b and T6
All modules that depend on T1b/T6 should pull these changes and run `npm install`, `npx prisma migrate dev`, and `npx prisma generate` first so the new auth/RBAC/chat/support schema and APIs are available locally.  
For backend integrations, stop using hardcoded user ids, require authenticated session context, and enforce ownership (`where: { userId: sessionUser.id }`) on every user-owned resource, including agreements, analyses, chat sessions/messages, and future memory retrieval.  
For T5/T6-dependent work, keep the agreement detail page contract stable by populating `Analysis` + `ClauseResult` records in the existing schema and exposing status through `/api/agreements/[id]/status`; the URL contract is unchanged after route-file merging.  
For auth/collaboration safety, preserve current role rules (`OWNER > ADMIN > USER`), do not allow admin mutation of other admins/owners, and route any new admin-only features through centralized RBAC guards plus server-side checks in route handlers.
For collaborators integrating auth-dependent modules, switch credential assumptions from email-login to username-login and treat email as optional profile data that may be null for active users.  
For password-reset integrations, keep using `/api/auth/password-reset/start`, `/send-code`, and `/confirm`; these URLs are unchanged after action-route merging.  
For account/profile and admin-user features, keep business logic in the shared auth service layer and continue using merged action routers instead of reintroducing split route files.  
For security-sensitive endpoints, keep the existing throttle pattern and return `429` + `Retry-After` headers consistently when limits are exceeded.  
Keep email delivery concerns isolated in the email adapter layer and avoid coupling feature logic directly to provider-specific transport code.
