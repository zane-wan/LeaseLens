# LeaseLens

AI-powered Ontario residential lease compliance analyzer — upload a lease, get clause-by-clause legal analysis against the Residential Tenancies Act (RTA).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| State | Redux Toolkit |
| Database | PostgreSQL + Prisma ORM |
| Auth | Better Auth + Google OAuth |
| AI | Vercel AI SDK + OpenAI GPT-4o |
| Validation | Zod |
| Storage | AWS S3 (lease PDFs) |
| Hosting | AWS EC2 |

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

| ID | Sub-task | Assignee | Dependencies |
|----|----------|----------|-------------|
| T1a | Google OAuth setup (Better Auth + provider config) | Zihan | None |
| T1b | Login/signup pages | TBD | T1a |
| T2a | S3 presigned URL backend | Zihan | None |
| T2b | Drag-drop upload UI + PDF parsing | TBD | T2a |
| T3 | Database schema + Prisma models (agreements, analyses, users) | TBD | None |
| T4 | Dashboard UI (agreement list, status badges, detail view) | TBD | T1, T3 |
| T5a | RAG retrieval + LLM orchestration | Zihan | T3 |
| T5b | Analysis results storage | TBD | T5a, T3 |
| T6 | Analysis results UI (clause cards, compliance badges, citations) | TBD | T4, T5 |
| T7a | AWS EC2 deploy | Zihan | T6 |
| T7b | Error handling + loading states | TBD | T6 |

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
