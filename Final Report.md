# LeaseLens

## Table of Contents

- [Team Information](#team-information)
- [Video Demo](#video-demo)
- [Motivation](#motivation)
- [Objectives](#objectives)
- [Technical Stack](#technical-stack)
- [Individual Contributions](#individual-contributions)
---

## Team Information

| Name        | Student Number | Email                          |
| ----------- | -------------- | ------------------------------ |
| Yiyang Liu  | 1011770512     | yiyang.liu@mail.utoronto.ca    |
| Zihan Wan   | 1011617779     | zihanzane.wan@mail.utoronto.ca |
| Yiyang Liu  | 1011770512     | yiyang.liu@mail.utoronto.ca    |
| Zihan Wan   | 1011617779     | zihanzane.wan@mail.utoronto.ca |

---

## Video Demo

Watch the walkthrough here: [Demo]( )

---

## Motivation

  Ontario renters often sign lease agreements without knowing whether added clauses are actually
  enforceable under the Residential Tenancies Act (RTA). Many tenants only discover illegal fees,
  invalid pet restrictions, or unfair responsibilities after moving in, when the cost and stress
  of correcting the issue is much higher. At the same time, reviewing lease language manually is
  slow, inconsistent, and difficult for students, newcomers, and busy renters who need fast,
  understandable guidance.

  LeaseLens focuses on making lease review clearer, faster, and more trustworthy for three
  groups: renters who want to understand risks before signing, landlords or property managers who
  want to catch problematic terms before disputes arise, and support or admin staff who need
  visibility into uploaded agreements, users, and analysis activity. The product emphasizes
  clarity (upload → analyze → clause-by-clause results), legal grounding (RTA-based citations and
  compliance labels), and user ownership (account-based access to agreements, saved history, and
  follow-up chat/support flows). By turning dense legal text into structured, explainable
  analysis, LeaseLens helps users make better housing decisions without relying only on guesswork
  or expensive manual review.

---

  ## Objectives

  - Deliver a clear, web-first lease review flow (authentication → upload agreement → analysis
    status → clause-by-clause results → follow-up chat/support) that reduces confusion around
    Ontario residential lease terms.
  - Make compliance analysis more trustworthy with backend-driven document processing, clause
    extraction, RAG-assisted legal retrieval, and structured LLM outputs tied to RTA citations,
    risk scores, and compliance labels.
  - Empower users to self-serve: secure account-based access, per-user agreement history,
    analysis detail pages, and chat/support tools for follow-up questions after results are
    generated.
  - Give admins operational control with role-based access to user management and internal
    support workflows, so platform operations and customer-facing experiences stay aligned.
  - Provide secure authentication and authorization through email/password, JWT-backed sessions,
    and Google OAuth, with role separation across standard users, admins, and owners.
  - Align with the actual course implementation stack using Next.js App Router, TypeScript,
    Prisma, PostgreSQL, Redux Toolkit, AWS S3 storage, and OpenAI-powered analysis, with a
    deployable full-stack web application architecture.

---

  ## Technical Stack

  1. Frontend framework: Next.js 15 with App Router, React 19, and TypeScript for a multi-page
     web application covering authentication, dashboard, agreement detail, account, admin, chat,
     and support flows.
  2. UI and styling: Tailwind CSS v4, shadcn/ui, and reusable feature components for upload,
     analysis result cards, risk visualization, and account/admin panels.
  3. State management: Redux Toolkit for client-side app state, especially around authenticated
     user/session data and subscription-related state.
  4. Backend architecture: Next.js API routes serve as the application backend for auth,
     agreements, analyses, uploads, support threads, chat sessions, and Stripe billing flows.
  5. Database and ORM: PostgreSQL with Prisma ORM stores users, sessions, agreements, analyses,
     clause results, support threads, chat history, presets, and RTA retrieval chunks.
  6. Authentication and authorization: Email/password auth with JWT/session utilities, Google
     OAuth, and role-based access control for USER, ADMIN, and OWNER permissions.
  7. AI and legal analysis: Vercel AI SDK plus OpenAI models power clause evaluation, while
     custom RAG utilities and embedded RTA chunks ground outputs in Ontario tenancy law.
  8. Document handling and storage: Lease files are uploaded through presigned URLs and stored in
     AWS S3; PDF parsing and clause extraction utilities prepare agreement text for downstream
     analysis.
  9. Payments and subscriptions: Stripe checkout, customer portal, and webhook handlers support
     subscription-aware product logic.
  10. Validation and supporting libraries: Zod for request/data validation, along with utility
     modules for rate limiting, email flows, password reset, and shared server-side helpers.

---

 ## Individual Contributions

 ### Yiyang Liu

  - Designed and implemented the database schema and Prisma models for core entities, including users,
    agreements, analyses, and related data relationships
  - Implemented the drag-and-drop upload interface for lease documents
  - Built client-side PDF parsing support as part of the upload workflow
  - Contributed to the analysis results UI, including parts of the result display and user-facing
        analysis presentation
