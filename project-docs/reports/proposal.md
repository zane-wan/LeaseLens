# ECE1724 Proposal

# Motivation

Ontario, which is the most populous province in Canada, no wonder that it has the highest number of renters in Canada. In the era when legal documents are getting more and more completed, it may be too complex for people who have limited experience in law. Therefore, to help renters and landlords (our target users) better understand the relevant laws and their rights, we are eager to build a full stack project that allows people to check the legal validity of lease agreement clauses. Users can upload their lease, and the system will automatically analyze which custom clauses conflict with Ontario's residential tenancy laws. 

# **Objective and Key Features**

## **Objective**

Build a web application that allows renters to upload lease agreements and receive an AI-assisted review that highlights potential risks, potentially unfair terms, and possible legal non-compliance.

The system will use a Retrieval-Augmented Generation (RAG) pipeline to ground the analysis in (1) the uploaded contract text and (2) relevant legal references. Outputs will prioritize clarity and actionability by providing explanations, cited supporting excerpts, and practical next-step recommendations.

## **Key Features**

### Modern Full-Stack Web Application

- Next.js full-Stack architecture. Leverage React Server Components (RSC) to reduce client-side JavaScript bundle sizes and improve initial page load speeds.
- Frontend UI/UX with Tailwind CSS and shadcn/ui for consistent styling and component reuse. Potential dark mode and theming support will be included.

### Data Storage

- PostgreSQL for application data with Prisma for type-safe database queries, schema migrations, and relational mapping.
- Amazon S3 for cloud file storage, enable client uploads and secure downloads.

### Secure Deployment (AWS)

- Dockerize the Next.js application and background workers.
- Secure baseline configuration including network firewalling and WAF protections with strict IAM policies.
- Store database credentials, LLM API keys, and OAuth secrets in AWS Secrets Manager

### Authentication and Authorization

- Implement Better Auth as the core authentication framework, with plug in support frictionless login via Google
- Robust session management and secure token handling with HTTP-only, secure cookies for session management

### File Upload, Processing, and Lifecycle Management

- Secure PDF uploads with strict client-side and server-side validation for MIME types (`application/pdf`) and file size limits
- PDF text extraction using [pdf-parse](https://mehmet-kozan.github.io/pdf-parse/index.html)

### Frontend State Management

- Handle data fetching, caching, background refetching, and optimistic UI updates

### External Service Integrations

- LLM provider APIs for analysis, summarization, and structured extraction, use LangChain.js or Vercel AI SDK to manage prompts, streaming responses, and context windows.
- RAG pipeline to return exact page numbers or text snippets so users can verify the LLM's claims against the original PDF.
- OAuth provider integration

### Payments (Optional)

- Subscription billing via Stripe
- Optional donation support (e.g., ETH)

### Database Schema

![DB Schema](https://raw.githubusercontent.com/zane-wan/LeaseLens/main/DB_Schema.png)

## How Features Fulfill the Requirements

### Core Features

- **Frontend.** TypeScript throughout. Next.js App Router + React for UI, Tailwind CSS + shadcn/ui for styling, responsive design across all pages.
- **Data Storage.** TypeScript backend. PostgreSQL via Prisma for relational data. AWS S3 for lease PDF storage with presigned URLs, files associated with user records.
- **Architecture.** Option A: Next.js Full Stack. Server Components for backend logic, API Routes for data handling, Server Actions for mutations.

### Advanced Features

- **User Authentication and Authorization.** Better Auth + Google OAuth. Session based auth with secure cookies. Protected routes via middleware. Users can only access their own documents.
- **File Handling and Processing.** pdf-parse extracts lease text. Extracted content goes through a RAG enhanced LLM pipeline for clause level risk analysis against Ontario tenancy law, returning structured results with severity ratings and statute citations.
- **Integration with External APIs.** LLM APIs for legal analysis with structured output and RAG context management. Google OAuth as external identity provider. Optional Stripe for billing.

All the core features are fullfilled, with more than 2 advanced features planned to implement.

## Scope and Feasibility within the Timeframe

The project is scoped to Ontario tenancy law only, with a fixed statute knowledge base and digital PDFs only. This keeps the problem domain narrow and well defined.

Core infrastructure, database schema, auth, and S3 are established in Week 1. The full backend pipeline (presigned upload, pdf-parse extraction, LLM analysis with RAG, all API routes) is targeted for Week 2 and testable independently via Postman. Week 3 focuses on frontend integration: connecting upload UI, rendering analysis results, and verifying the end to end flow. Week 4 is reserved for hardening, error handling, and optional features.

# **Tentative Plan**

We split responsibilities by application layer and feature domain. Each member owns
clear deliverables with defined integration points. We follow Agile sprints with
weekly syncs and GitHub Projects for task tracking.

**Zihan Wan — Core Setup & Upload Flow**

- Project scaffold: Next.js App Router, Tailwind CSS, shadcn/ui component library
- Landing page
- Login page + Google sign-in button
- Route guards (redirect unauthenticated users to login)
- Upload page: drag-and-drop component, file type/size validation, progress bar
- Global state management with Redux toolkit

**Kevin Zhang — Results & Polish**

- Document list page (upload history + status badges)
- Analysis results page (risk list, clause citations, severity indicators, suggestions)
- Polling logic (query analysis status every 3s until done)
- Delete document functionality
- All loading and error state UI
- Responsive design + final QA pass

**Ruiwu Liu — Infrastructure, Auth & File Storage**

- Next.js backend initialization
- Prisma schema design + migrations (users, documents, analyses)
- NextAuth.js + Google OAuth integration
- File authorization middleware (users can only access their own documents)
- AWS S3 bucket setup + Presigned URL endpoint
- Per-user upload limit enforcement
- EC2 + Docker Compose + domain config + SSL (Let's Encrypt)

**Yiyang Liu — PDF Processing, LLM & API**

- PDF text extraction with pdf-parse
- Prompt engineering + LLM API integration (OpenAI / Claude)
- LLM JSON response parsing + writing results to analyses table
- Document status lifecycle management (pending → analyzing → done / failed)
- Analysis API routes: `POST /api/documents/:id/analyze`, `GET /api/documents/:id/analysis`
- Postman test collection + seed data

## **Week-by-Week Outline**

- **Week 1 — Setup & Foundations:** Monorepo, branching strategy, Next.js scaffold,
Prisma schema finalized, PostgreSQL running, Google OAuth end-to-end working,
S3 bucket created, EC2 baseline provisioned.
- **Week 2 — Core Pipeline:** Presigned URL upload flow complete, pdf-parse
extraction working, LLM prompt returning structured JSON, all backend API routes
implemented and testable via Postman.
- **Week 3 — Frontend Integration:** Upload UI connected to backend, analysis results
rendering correctly, document list page working, auth guards in place,
end-to-end happy path verified.
- **Week 4 — Hardening & Polish:** Docker + deployment finalized (SSL, domain),
upload limits enforced, error states handled in UI, optional features added
if time permits, final QA and demo preparation.

# **Initial Independent Reasoning**

## 1. Application structure and architecture

We decided to build this as a **Next.js full-stack app** instead of a separate frontend + backend. For our team size and course timeline, it’s simpler to move fast in one repo: shared TypeScript types, fewer integration points, and easier deployment.

On the backend side, we’ll use Next.js route handlers to support:

- auth-protected APIs (upload, list, analyze, fetch results)
- an async “analysis job” flow (store status in DB: pending → analyzing → done/failed)

For deployment, our baseline is Dockerized services on AWS (EC2 + Postgres, S3 for files). 

## 2. Data and state design

We want a privacy-first setup because leases are sensitive.

**Storage plan**

- **S3**: store the uploaded PDFs with private bucket and per-user access via backend-controlled presigned URLs.
- **PostgreSQL**: store metadata and results
    - `users` (from OAuth)
    - `documents` (ownerId, s3Key, fileSize, createdAt, status)
    - `analyses` (documentId, structured JSON output, citations)
- Vector Database: disigned for regulation content matching. When retriving a line in the lease document, we pick the regulation clauses that is the most related to it.

**State plan**

- Server-side: source of truth is Postgres (document status, results)
- Client-side: use **Redux toolkit** to manage UI state (upload progress, selected document, polling status, errors). This helps avoid messy prop passing once we have multiple pages.

## 3. Feature selection and scope decisions

We chose features based on a trade-off between “demo-able in 4 weeks” and “nice but risky”.

**Core features:**

- Google OAuth login and session handling
- strict authorization, a user can only see its own uploads and results
- PDF upload function, with validation and storage
- PDF text extraction and RAG enhanced LLM analysis
- results UI that shows risks and clause citations, with a report for suggested next steps

**Optional features: payment**

LLM calls cost money. If usage grows, a free-only app will not survive. So we may add a **Stripe subscription**:

- free tier with limited analyses per month
- paid tier with higher limits
- “buy us coffee” donation option: ETH or Bitcoin

We also decided to **start with Ontario only** to avoid building a multi-province legal system from day one. Ontario has an official standard lease form and guidance, so it’s a strong base.

## 4. Anticipated challenges

**Dataset is the biggest one.** There is no clean public dataset of real Canadian leases due to privacy. Our plan is:

- use Ontario’s standard lease as baseline inputs
- create a small controlled test set by adding common “problem clauses” and checking them against Ontario legal references

Other expected hard parts:

- **PDF parsing quality** (formatting noise, missing text, etc.)
- **citation correctnessl,** the model must point to the right clause instead of just giving a nice summary.
- **authentication and access control** around files
- **async pipeline reliability** (timeouts, retries, and making sure the UI doesn’t feel stuck)

## 5. Early collaboration plan

- **Member 1:** Set up the frontend, build the landing and login flow, protect routes, and deliver a smooth drag-and-drop upload experience with shared state management.
- **Member 2:** Build the document list and results pages, add reliable status updates and deletion, polish all loading and error states, and run responsive QA.
- **Member 3:** Own the backend foundation, database and authentication, enforce per-user access and upload limits, and handle cloud storage plus deployment with domain and SSL.
- **Member 4: I**mplement PDF processing and the LLM analysis pipeline, write analysis APIs, store results and status changes, and provide test coverage with seed data.

# AI Assistance Disclosure

## Motivation

AI was used to translate specific terms and phrases from Chinese to English.

AI was not used in writing or composing Motivation content.

## **Objective and Key Features**

AI was used to summarize the features to explain how will them fulfill the project requirements. 

AI was not used in selecting features.

AI was not used in choosing specific approaches or choosing tech stack.

**How human complemented AI output:**

AI suggested splitting the frontend and backend into separate React and Express services for clearer separation of concerns. We pushed back and went with Next.js full stack instead, since our project scope didn't justify managing two deployments and the React Server Components model already gave us leaner client bundles without a standalone API server.

## Tentative Plan

AI was used to help structure and articulate in this section, specifically to translate our rough task list into a clean breakdown by member, and to think through whether the workload was evenly distributed.

## Initial Independent Reasoning

AI was used to help us with a small part of information gathering, such as searching for open source lease contract datasets, finding websites where we can find lease documents. And also, we used AI to check the AWS documents, so that we know what services are provided by AWS in order to provide services to users when we publish our website online.