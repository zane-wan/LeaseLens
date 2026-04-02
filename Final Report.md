# LeaseLens

## Table of Contents

- [LeaseLens](#leaselens)
  - [Table of Contents](#table-of-contents)
  - [Team Information](#team-information)
  - [Video Demo](#video-demo)
  - [Motivation](#motivation)
  - [Objectives](#objectives)
  - [Technical Stack](#technical-stack)
  - [Features](#features)
  - [User Guide](#user-guide)
  - [Development Guide](#development-guide)
  - [Deployment Information](#deployment-information)
  - [Individual Contributions](#individual-contributions)
    - [Yiyang Liu](#yiyang-liu)
    - [Kaiwei Zhang](#kaiwei-zhang)
    - [Ruiwu Liu](#ruiwu-liu)

---

## Team Information

| Name         | Student Number | Email                          |
| ------------ | -------------- | ------------------------------ |
| Yiyang Liu   | 1011770512     | yiyang.liu@mail.utoronto.ca    |
| Zihan Wan    | 1011617779     | zihanzane.wan@mail.utoronto.ca |
| Kaiwei Zhang | 1007073872     | kwei.zhang@mail.utoronto.ca    |
| Ruiwu Liu    | 1011815332     | rev.liu@mail.utoronto.ca       |

---

## Video Demo

Watch the walkthrough here: [Demo]()

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

## Features

## User Guide

## Development Guide

LeaseLens is a Next.js 15 + TypeScript application backed by PostgreSQL/Prisma, AWS S3,
and OpenAI-based analysis services. Developers can get the project running locally by
installing dependencies, configuring environment variables, initializing the database, and
verifying the S3 upload and test workflows.

1.  Environment setup and configuration
    - Install the project prerequisites: Node.js 20+, npm, and PostgreSQL if a local database
      will be used instead of the shared team instance.
    - Clone the repository, enter the project folder, and install dependencies with `npm install`.
    - Copy `.env.example` to `.env.local`, since the application, Prisma config, Vitest setup,
      and ingestion scripts all load local configuration from `.env.local`.
    - Fill in the required variables:
      - `DATABASE_URL` for PostgreSQL
      - `OPENAI_API_KEY` for analysis and embedding generation
      - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, and `AWS_REGION` for file storage
      - `JWT_SECRET` for session/auth token signing
      - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_APP_URL` for Google OAuth
      - `STRIPE_*` values if subscription flows need to be tested locally

2.  Database initialization
    - The recommended option is to use the shared AWS RDS PostgreSQL instance maintained by the
      team, because it already contains the main schema and seeded legal retrieval data.
    - For a standalone local setup, create a PostgreSQL database and
      ensure the `vector` extension is available, because the `RtaChunk` table stores pgvector
      embeddings for RAG retrieval.
    - Run the Prisma setup commands after `DATABASE_URL` has been configured:
      - `npx prisma migrate dev` to apply the tracked migrations
      - `npx prisma generate` to generate the Prisma client
    - If the local database does not already contain RTA retrieval data, run the ingestion
      script with `npx tsx scripts/ingest-rta.ts`. This script parses the source statute text,
      generates OpenAI embeddings, and stores indexed `RtaChunk` records in PostgreSQL.

3.  Cloud storage configuration
    - Lease documents are uploaded through presigned URLs and stored in AWS S3, so a working
      bucket and IAM credentials are required for end-to-end upload testing.
    - Create or reuse an S3 bucket in the configured region, then provide the bucket name and
      credentials through `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and
      `AWS_SECRET_ACCESS_KEY`.
    - The IAM user or role should be allowed to perform object upload, download, and delete
      operations on the configured bucket, since the application generates presigned upload URLs
      and also reads/deletes stored agreements.
    - S3 connectivity can be validated with the existing `test-s3-upload.ts` script, which
      generates a presigned URL and performs a sample `PUT` upload request.

4.  Local development and testing
    - Start the application with `npm run dev`, then open `http://localhost:3000`.
    - Developers can test core authentication and dashboard flows in the browser once `.env.local`,
      the database, and S3 credentials are in place.
    - Use `npm run lint` to catch code-quality issues and `npm test` to run the Vitest suite.
    - Integration tests such as the RAG retrieval checks require live `DATABASE_URL` and
      `OPENAI_API_KEY` values, since they query the real database and embeddings pipeline rather
      than mocked data.
    - When upload behavior is being debugged, the S3 upload test script provides a focused way
      to confirm that presigned URL generation and object storage permissions are configured
      correctly before testing the full UI flow.

## Deployment Information

LeaseLens is designed for containerized deployment on AWS. The production application is built
from the repository `Dockerfile` as a multi-stage Next.js 15 standalone image, then started on
an AWS EC2 instance through `docker compose up -d --build` using the repository
`docker-compose.yml` file. The deployment keeps the web application itself stateless inside the
container and moves persistent services to managed infrastructure: PostgreSQL runs on a shared
AWS RDS instance accessed through Prisma, while uploaded lease PDFs are stored in a private AWS
S3 bucket and served through backend-generated presigned URLs. The production environment also
depends on externally configured Google OAuth credentials, SMTP/SES-backed email delivery, and
Stripe secrets for billing flows.

Deployment automation is implemented in `.github/workflows/deploy.yml`. On each push to `main`
, GitHub Actions authenticates to AWS, writes the production
environment variables from repository secrets into `.env.local` on the EC2 host, then uses AWS
Systems Manager (SSM) to pull the latest code and rebuild/restart the Dockerized application.
This keeps deployment reproducible without requiring direct SSH-based release steps in the
repository workflow. The public application base URL is configured externally through the
`NEXT_PUBLIC_APP_URL` environment variable. In the deployed environment, it is set to
`https://leaselens.website/`.

## Lessons Learned and Concluding Remarks

This project reinforced that a focused scope is more valuable than an overly broad feature list.
By limiting the legal domain to Ontario residential leases and building on a Next.js full-stack
architecture, we were able to keep frontend, backend, and database work integrated instead of
splitting effort across too many disconnected systems. That decision made it easier to move from
individual features to a coherent end-to-end product.

We also learned that the hardest parts of a full-stack project are usually at the integration
boundaries rather than inside isolated modules. Authentication, per-user file access, AWS S3
uploads, PostgreSQL persistence, LLM-based analysis, Stripe billing, and email delivery all worked
individually, but making them reliable together required careful debugging of routing, environment
variables, permissions, and deployment configuration. In particular, privacy-sensitive features
such as agreement access and support threads forced us to treat authorization as a server-side
concern throughout the application, not just a frontend convenience.

Another important lesson was that AI assistance was helpful but never sufficient on its own. AI
was useful for brainstorming architectures, debugging specific issues, and drafting technical
explanations, but many suggestions required correction or adaptation to fit our actual codebase and
course constraints. We had to verify outputs through manual testing, type checking, Prisma
validation, and end-to-end feature checks before accepting them.

Overall, LeaseLens gave us practical experience building a modern web application with real
tradeoffs in product scope, security, deployment, and team coordination. The final system is not
only a course deliverable but also a strong example of how AI-assisted features, cloud services,
and full-stack engineering can be combined into a usable application when the implementation is
kept grounded in clear requirements and continuous verification.

## AI Assistance & Verification (Summary)

### Login, role control and part of UI/Dashboard design (Ruiwu):

In this part, AI is used in the following ways:
- Code completion: Enabled by default on Microsoft VS Code IDE. The default settings are used for
  this utilization.
- UI/Dashboard template searching: I used GPT-5.4, and asked the agent to help me find out a set
  of UI/Dashboard templates that have high ratings or high forks or high stars. Then, I checked them
  manually one by one to find out the best fit. After that, I edited the templates manually to make them
  compatible with our project.
- Code commenting: As we are a group of 4, it's important to add comments for codes to enhance readability
  and therefore increase the efficiency of team collaborations. After finishing writing the code, I
  asked the AI to add or polish my comments so that they include all the details needed to understand the
  code that I wrote.

### Landing page

For the landing page, I designed the overall view and layout manually. The images used inside the
page were AI-generated, and I integrated and adjusted them so that the final landing page fit
LeaseLens and worked correctly in our project.

---

## Individual Contributions

### Yiyang Liu

- Designed and implemented the database schema and Prisma models for core entities, including users,
  agreements, analyses, and related data relationships
- Implemented the drag-and-drop upload interface for lease documents
- Built client-side PDF parsing support as part of the upload workflow
- Contributed to the analysis results UI, including parts of the result display and user-facing
  analysis presentation

### Kaiwei Zhang

- Designed the homepage UI and contributed to the overall landing-page user experience
- Integrated frontend and backend components to support complete user interface workflows and resolved API-related issues during development
- Implemented session management features that allow users to revisit and access past sessions
- Integrated Stripe-based payment and subscription functionality for billing-related workflows

### Ruiwu Liu

- Built login, signup, Google OAuth, and password reset flows with role-based account controls.
- Developed protected dashboard pages for agreements, sessions, support threads, and account management.
- Developed and implemented AWS SES email service for verification code sending in reset password service.
- Added per-user access isolation, admin and owner permissions, and session persistence workflows.
