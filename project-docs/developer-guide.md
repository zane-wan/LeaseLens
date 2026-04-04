# LeaseLens

AI-powered Ontario residential lease compliance analyzer — upload a lease, get clause-by-clause legal analysis against the Residential Tenancies Act (RTA).

## Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Framework  | Next.js 15 (App Router)              |
| UI         | React 19, Tailwind CSS v4, shadcn/ui |
| State      | Redux Toolkit                        |
| Database   | PostgreSQL + Prisma ORM              |
| Auth       | JWT + Google OAuth                   |
| AI         | Vercel AI SDK + OpenAI GPT-4o        |
| Validation | Zod                                  |
| Storage    | AWS S3 (lease PDFs)                  |
| Hosting    | AWS EC2                              |

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/zane-wan/LeaseLens.git
cd LeaseLens
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# OpenAI
OPENAI_API_KEY=

# PostgreSQL (use shared RDS — ask team for credentials)
DATABASE_URL=postgresql://postgres:PASSWORD@leaselens-dev.xxxxx.ca-central-1.rds.amazonaws.com:5432/leaselens?sslmode=no-verify

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=

# Auth
JWT_SECRET=       # generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up PostgreSQL

**Option A: Use the shared AWS RDS database (recommended)**

Get the `DATABASE_URL` from the team (Slack DM). The shared database already has all tables and RTA embeddings pre-loaded — no local Postgres needed.

```bash
npx prisma generate     # generate Prisma client
```

**Option B: Local PostgreSQL (standalone development)**

```bash
# macOS (Homebrew)
brew install postgresql@17
brew services start postgresql@17

# Create the database
createdb leaselens
npx prisma db push      # create tables
npx prisma generate     # generate Prisma client
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Test auth API (optional)

Import `postman/LeaseLens-Auth.postman_collection.json` into Postman to test signup/login/logout endpoints.

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

| ID  | Sub-task                                                         | Assignee      | Dependencies |
| --- | ---------------------------------------------------------------- | ------------- | ------------ |
| T1a | Google OAuth setup (Better Auth + provider config)               | Zihan         | None         |
| T1b | Login/signup pages                                               | Ruiwu         | T1a          |
| T2a | S3 presigned URL backend                                         | Zihan         | None         |
| T2b | Drag-drop upload UI + PDF parsing                                | Yiyang        | T2a          |
| T3  | Database schema + Prisma models (agreements, analyses, users)    | yiyang        | None         |
| T4  | Dashboard UI (agreement list, status badges, detail view)        | Ruiwu, Kaiwei | T1, T3       |
| T5a | RAG retrieval + LLM orchestration                                | Zihan         | T3           |
| T5b | Analysis results storage                                         | Yiyang        | T5a, T3      |
| T6  | Analysis results UI (clause cards, compliance badges, citations) | Ruiwu, Kaiwei | T4, T5       |
| T7a | AWS EC2 deploy                                                   | Zihan         | T6           |
| T7b | Error handling + loading states                                  | TBD           | T6           |

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
