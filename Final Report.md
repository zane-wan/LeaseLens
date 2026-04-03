# LeaseLens

## Table of Contents

- [Team Information](#team-information)
- [Video Demo](#video-demo)
- [Motivation](#motivation)
- [Objectives](#objectives)
- [Technical Stack](#technical-stack)
- [Features](#features)
- [User Guide](#user-guide)
- [Development Guide](#development-guide)
- [Deployment Information](#deployment-information)
- [Lessons Learned and Concluding Remarks](#lessons-learned-and-concluding-remarks)
- [AI Assistance & Verification (Summary)](#ai-assistance--verification-summary)
- [Individual Contributions](#individual-contributions)

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

### Ⅰ. Application Features

#### Authentication and Account Management

**Email/Password and Google OAuth Authentication**: Users can register and sign in with email/password credentials or use Google OAuth for single click authentication. JWT backed session management keeps users securely authenticated across requests, and all protected pages automatically redirect unauthenticated visitors to the login page.

**Password Reset with Email Verification**: A code based password reset flow allows users to recover their accounts by entering their email, receiving a verification code (sent via AWS SES), and setting a new password, all without needing to contact support.

**Role Based Access Control (RBAC)**: Three distinct roles (USER, ADMIN, and OWNER) govern what each person can see and do. Standard users manage their own agreements and chat sessions, admins gain access to user management and support oversight, and owners have full platform control. The dashboard navigation adapts to reflect the current user's role.

**Account Settings and Self Service Profile Management**: Users can update their display name, email, and password from a dedicated account page. A clearly marked "Danger Zone" section allows permanent account deletion, requiring password confirmation and a typed "DELETE" safeguard before proceeding.

#### Lease Upload and Document Management

**Drag and Drop Multi File Upload**: The dashboard provides a drag and drop zone (with a click to select fallback) that accepts multiple PDF lease files per session, up to 20 files and 20 MB each. Files are uploaded to AWS S3 through presigned URLs with server side file size enforcement and rate limiting.

**Session Based Organization**: Every upload belongs to a named session. Users can create new sessions, rename them, switch between past sessions from a dropdown menu, and delete sessions along with all associated files and analysis results. This keeps multiple lease reviews organized and easy to revisit.

**Per File Status Tracking**: Each uploaded agreement displays a real time status badge (PENDING, PROCESSING, COMPLETED, or FAILED) so users always know where their documents stand in the analysis pipeline.

#### AI Powered Lease Analysis

**Clause Extraction and Compliance Evaluation**: After upload, users can trigger analysis on individual files or use "Analyze All" to batch process every pending document in the session. The backend extracts clauses from the PDF text, evaluates each clause against the Ontario Residential Tenancies Act (RTA) using a RAG retrieval pipeline with pgvector embeddings, and returns structured results through OpenAI powered LLM orchestration.

**Risk Score Visualization**: A circular risk score ring (0 to 100) provides an at a glance severity indicator, color coded green (low, 0 to 30), amber (medium, 31 to 60), or red (high, 61 to 100), so users can immediately gauge the overall compliance health of their lease.

**Clause by Clause Result Cards**: Each extracted clause is displayed in an expandable card showing its compliance status (Compliant, Non Compliant, or Needs Review), severity level, and three tabbed detail views: an overview with the clause text and AI explanation, a details tab with RTA citations and legal basis, and a suggestion tab with recommended actions.

**Compliance Summary**: Aggregate counts of compliant, non compliant, and needs review clauses are shown alongside the overall AI generated summary, giving users a quick compliance snapshot before diving into individual clauses.

#### Conversational Followup (Chat)

**Session Scoped Streaming Chat**: Within any session, users can ask freeform questions about their uploaded leases. The AI assistant responds in real time using streaming, with answers grounded in the session's agreement content and RAG retrieved RTA context. Chat history persists across page reloads.

**Suggested Questions**: Quick select prompts such as "Is the no pets clause enforceable?", "Can my landlord increase rent mid lease?", and "What are my rights regarding entry notice?" help users start meaningful conversations immediately.

#### Admin and Support

**Admin User Management Panel**: Admins and owners can view all registered users, see their verification status, change user roles (with role hierarchy constraints), and remove accounts from the platform.

**Support Ticket System**: Users can open support threads with a subject and message body. Admins and owners see all threads across the platform and can reply, while standard users see only their own. Threads track status (open/closed), message direction, and timestamps.

#### Subscription and Billing

**Stripe Integrated Pro Subscription**: Users can upgrade to a Pro tier through Stripe Checkout directly from the account page. Active subscribers see a "Pro" badge throughout the interface and can manage billing (update payment method, cancel) through the Stripe customer portal.

#### Landing Page and Theme

**Auth Aware Landing Page**: The public landing page presents the product value proposition with feature showcase sections and mockup images. Authenticated users see a "Go to Dashboard" call to action, while guests see "Get Started" linking to registration.

**Dark/Light Theme Toggle**: A theme switcher is available on both public and dashboard navigation bars, allowing users to choose their preferred visual mode.

### Ⅱ. How Features Fulfill Course Project Requirements

#### Core Technical Requirements

**1. TypeScript**
All frontend and backend code is written in TypeScript, including React components, Next.js API routes, Prisma queries, utility modules, and Zod validation schemas.

**2. React / Next.js (App Router)**
The application uses Next.js 15 with the App Router. Server Components handle data fetching and protected layout rendering, API Routes serve as the backend for auth, agreements, analyses, chat, support, and billing, and client components manage interactive UI such as the upload zone, chat panel, and analysis cards.

**3. Tailwind CSS and shadcn/ui**
All styling is implemented with Tailwind CSS v4. UI primitives (buttons, cards, inputs, badges, dropdowns, tabs, collapsibles, and toast notifications) come from shadcn/ui, ensuring a consistent and responsive design across the application.

**4. PostgreSQL with Prisma ORM**
PostgreSQL stores all persistent data: users, sessions, agreements, analyses, clause results, support threads, chat messages, RTA embedding chunks, and subscription records. Prisma ORM manages the schema, migrations, and type safe queries. The pgvector extension enables vector similarity search for RAG retrieval.

**5. Cloud Storage (AWS S3)**
Uploaded lease PDFs are stored in a private AWS S3 bucket. The backend generates presigned upload URLs so files go directly from the browser to S3, and presigned download URLs for server side PDF text extraction during analysis.

#### Advanced Features

**1. User Authentication and Authorization**
Email/password registration, Google OAuth, JWT backed session management, password reset with email verification codes, and three tier role based access control (USER, ADMIN, OWNER) with protected routes and per user data isolation.

**2. File Handling and Processing**
Lease PDFs undergo nontrivial server side processing: the backend retrieves the file from S3, extracts full text using pdf parse, identifies and segments individual clauses through pattern based extraction logic tailored to Ontario standard lease forms, then feeds each clause through the RAG + LLM analysis pipeline. This goes well beyond simple upload and download.

**3. Advanced State Management (Redux Toolkit)**
Redux Toolkit manages global client side state for authenticated user and session data, enabling consistent auth aware rendering across the dashboard, navigation, and account components.

**4. Integration with External APIs and Services**
The application integrates with OpenAI (GPT 4o for clause analysis and chat, text embedding ada 002 for RAG embeddings), AWS S3 (file storage via presigned URLs), AWS SES (password reset verification emails), Stripe (checkout, subscription management, and webhook handling), and Google OAuth (external authentication provider).

### Ⅲ. How Features Achieve Project Objectives

**Clear, web first lease review flow**: The application delivers a linear user journey (authenticate, upload lease PDFs, trigger analysis, view clause by clause results, and ask follow up questions via chat) all within a single dashboard page, reducing friction and confusion around Ontario residential lease terms.

**Trustworthy compliance analysis**: Backend driven document processing, clause extraction, RAG assisted retrieval against embedded RTA statute text, and structured LLM outputs produce clause results with explicit RTA citations, compliance labels, severity ratings, and risk scores, making the analysis grounded and verifiable rather than opaque.

**User self service**: Secure account based access gives each user their own agreement history organized by sessions, detailed analysis pages for every uploaded lease, and persistent chat threads for follow up questions, all accessible without requiring admin intervention.

**Admin operational control**: Role based access provides admins and owners with a user management panel and full visibility into all support threads, keeping platform operations and customer facing experiences aligned.

**Secure authentication and authorization**: Email/password credentials, JWT backed sessions, Google OAuth, and three tier role separation (USER, ADMIN, OWNER) collectively ensure that every route, API endpoint, and database query is scoped to the authenticated user's identity and permissions.

**Alignment with course implementation stack**: The entire application is built on Next.js 15 App Router, TypeScript, Prisma, PostgreSQL, Redux Toolkit, AWS S3, and OpenAI, directly matching the required course technologies, and is deployed as a containerized full-stack web application on AWS EC2.

---

## User Guide

> **Quick Test:**
>
> - To test the app without local setup, visit the live deployment at [https://leaselens.website/](https://leaselens.website/).
> - For local development, follow the setup instructions in [Development Guide](#development-guide).

### Registration and Login

LeaseLens supports both email/password registration and Google OAuth sign in. After creating an account or logging in, you are redirected to the dashboard. If you already have an account, use your credentials or click the Google sign in button. New users can sign up with an email, display name, and a password (12 to 64 characters).

<!-- TODO: replace with actual GIF -->
![Registration and Login](placeholder-registration-login.gif)

---

### Forgot Password

If you forget your password, click "Forgot password?" on the login page. Enter your registered email to receive a verification code via email, then enter the code and set a new password.

<!-- TODO: replace with actual GIF -->
![Forgot Password Flow](placeholder-forgot-password.gif)

---

### Dashboard Overview

The dashboard is the main workspace where all lease review activity takes place. It is organized around **sessions**. Each session groups uploaded lease files, their analysis results, and a follow up chat conversation.

- Use the **"New Session"** button to start a fresh review
- Use the **"Past Sessions"** dropdown to switch between previous sessions
- Rename a session by editing its title at the top of the page
- Delete a session using the trash icon (this removes all associated files and results)

<!-- TODO: replace with actual GIF -->
![Dashboard Overview](placeholder-dashboard-overview.gif)

---

### Uploading Lease Documents

Within an active session, drag and drop one or more PDF lease files into the upload zone, or click to open a file picker. Each session supports up to 20 files, with a maximum size of 20 MB per file. After upload, files appear in the agreement list with a PENDING status badge.

<!-- TODO: replace with actual GIF -->
![Upload Lease Documents](placeholder-upload-lease.gif)

---

### Running AI Analysis

Once files are uploaded, you can:

- Click **"Analyze All"** to analyze every pending or failed file in the session at once
- Use the per file dropdown menu to start, retry, or cancel analysis on individual files

Analysis status updates automatically every few seconds. When processing completes, the results appear directly below the agreement list.

<!-- TODO: replace with actual GIF -->
![Running Analysis](placeholder-running-analysis.gif)

---

### Viewing Analysis Results

After analysis completes, the dashboard displays:

- **Risk Score Ring**: A circular gauge (0 to 100) showing the overall risk level, color coded from green (low) to red (high)
- **Compliance Summary**: Counts of compliant, non compliant, and needs review clauses
- **Overall Summary**: An AI generated paragraph summarizing the lease's compliance posture
- **Clause Cards**: Expandable cards for each extracted clause, showing:
  - Compliance badge and severity level
  - **Overview** tab: clause text and AI explanation
  - **Details** tab: RTA citations and legal basis
  - **Suggestion** tab: recommended actions

Click on any clause card to expand it and view the full analysis.

<!-- TODO: replace with actual GIF -->
![Analysis Results](placeholder-analysis-results.gif)

---

### Agreement Detail Page

Click **"View Results"** in the per file dropdown menu to open a dedicated detail page for a single agreement. This page provides the same risk score, compliance summary, and clause by clause cards in a full page layout, along with the file name, upload timestamp, and current status.

<!-- TODO: replace with actual GIF -->
![Agreement Detail Page](placeholder-agreement-detail.gif)

---

### Chat with AI Assistant

At the bottom of the dashboard, a chat panel lets you ask follow up questions about your uploaded leases. The AI assistant uses the session's agreement content and Ontario RTA legal references to provide grounded answers.

- Type a question in the input field and press Send
- Or select one of the **suggested questions** (e.g., "Is the no pets clause enforceable?")
- Chat history is saved and persists when you revisit the session

<!-- TODO: replace with actual GIF -->
![Chat with AI](placeholder-chat-ai.gif)

---

### Account Settings

Access your account settings from the navigation bar. From this page you can:

- **Update profile**: Change your display name or email
- **Change password**: Enter your current password and set a new one
- **Manage subscription**: Upgrade to Pro via Stripe Checkout, or manage an existing subscription through the Stripe billing portal
- **Delete account**: Permanently remove your account by confirming your password and typing "DELETE"

<!-- TODO: replace with actual GIF -->
![Account Settings](placeholder-account-settings.gif)

---

### Support (All Users)

Click the **Support** link in the navigation bar to open the support inbox. From here you can:

- Create a new support thread by entering a subject and message
- View your existing threads and their current status (Open or Closed)
- Select a thread to see the full message history and send replies

<!-- TODO: replace with actual GIF -->
![Support Inbox](placeholder-support-inbox.gif)

---

### Admin Features (Admin and Owner Only)

Admin and Owner users see an additional **Admin** link in the navigation bar, which opens the user management panel.

#### User Management

Admins can view all registered users along with their email verification status and current role. Available actions include:

- **Change Role**: Promote or demote users between USER, ADMIN, and OWNER (subject to role hierarchy)
- **Delete User**: Remove a user account from the platform (with confirmation)

<!-- TODO: replace with actual GIF -->
![Admin User Management](placeholder-admin-users.gif)

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

### Zihan Wan

- Implemented JWT/bcrypt authentication, signup/login/logout API routes, and Google OAuth with account linking
- Integrated AWS S3 for lease file storage with presigned URLs, upload rate limiting, and server side validation
- Built the RTA ingestion pipeline that parses statute text into pgvector embeddings stored in PostgreSQL as a vector database for RAG retrieval
- Implemented the clause extraction, RAG retrieval, and LLM analysis orchestration pipeline with structured compliance results and RTA citations
- Added streaming chat with RAG context grounding and unified the dashboard into a single page flow combining upload, batch analysis, results, and chat
- Set up AWS RDS as the shared team database, evolved the Prisma schema across migrations, and implemented Redux Toolkit for global auth state
- Created the Docker containerization, GitHub Actions CI/CD pipeline, and automated EC2 deployment with environment secret management

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
