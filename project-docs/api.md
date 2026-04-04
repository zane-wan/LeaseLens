# LeaseLens API Reference

All endpoints are served from `/api`. Unless noted otherwise, every endpoint requires an authenticated session cookie. Request and response bodies use JSON. Errors follow the shape `{ "error": "message" }`.

---

## Authentication

### Email/Password

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create account (email, name, password) |
| POST | `/api/auth/login` | Sign in with email and password |
| POST | `/api/auth/logout` | Destroy session |
| GET | `/api/auth/me` | Return the current authenticated user |
| PATCH | `/api/auth/account` | Update display name, email, or password |
| DELETE | `/api/auth/account` | Delete account (requires password confirmation) |

### Password Reset

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/password-reset/start` | Initiate reset flow (sends verification code via email) |
| POST | `/api/auth/password-reset/send-code` | Resend verification code |
| POST | `/api/auth/password-reset/confirm` | Set new password using verification code |

### Google OAuth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/google` | Redirect to Google authorization screen |
| GET | `/api/auth/google/callback` | Handle OAuth callback, create/link account, set session |

---

## Agreements

Agreements represent uploaded lease PDF files.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agreements` | List agreements for the current user (supports `?sessionId=`) |
| POST | `/api/agreements` | Create an agreement record from a completed upload intent |
| DELETE | `/api/agreements/:id` | Delete agreement and its S3 object |

---

## Upload

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload/presigned` | Generate a presigned S3 upload URL with upload intent tracking |

**Body**
```json
{
  "fileName": "lease.pdf",
  "fileType": "application/pdf",
  "fileSize": 1048576,
  "sessionId": "clx..."
}
```

Enforces per session file cap (20 files) and per file size limit (20 MB).

---

## Analysis Pipeline

### Trigger Analysis

```
POST /api/agreements/:id/analyze
```

Starts the analysis pipeline in the background. Returns immediately.

**Response** `202`
```json
{
  "message": "Analysis started",
  "agreementId": "clx..."
}
```

**Errors**
- `404` — agreement not found
- `403` — not the owner
- `409` — analysis already in progress

### Cancel Analysis

```
POST /api/agreements/:id/cancel
```

Cancels an in progress analysis and resets the agreement status to PENDING.

### Poll Analysis Status and Results

```
GET /api/agreements/:id/status
```

Returns the current analysis state and results. Poll until `analysis.status` is `COMPLETED` or `FAILED`.

**Response** `200`
```json
{
  "agreementId": "clx...",
  "agreementStatus": "PENDING | PROCESSING | COMPLETED | FAILED",
  "analysis": {
    "id": "clx...",
    "status": "QUEUED | PROCESSING | COMPLETED | FAILED",
    "overallSummary": "Analyzed 5 clauses. 2 are non-compliant with the Residential Tenancies Act.",
    "riskScore": 38,
    "errorMessage": null,
    "startedAt": "2026-03-16T...",
    "completedAt": "2026-03-16T...",
    "clauseResults": [
      {
        "clauseIndex": 0,
        "clauseTitle": "Pet Restriction",
        "clauseText": "No pets of any kind are allowed on the premises.",
        "compliance": "NON_COMPLIANT",
        "explanation": "Blanket pet bans are void under RTA s. 14.",
        "rtaCitations": ["RTA s. 14"],
        "severity": "HIGH",
        "issue": "Blanket no-pets clause",
        "legalBasis": "RTA s. 14 prohibits no-pet provisions in residential tenancy agreements.",
        "suggestion": "Remove the no-pets clause."
      }
    ]
  }
}
```

`analysis` is `null` if analysis has never been triggered.

### Get Analysis by ID

```
GET /api/analyses/:id
```

Returns detailed analysis results including clause level findings and agreement metadata.

### Field Reference

| Field | Type | Values |
|-------|------|--------|
| `compliance` | enum | `COMPLIANT`, `NON_COMPLIANT`, `NEEDS_REVIEW` |
| `severity` | enum or null | `LOW`, `MEDIUM`, `HIGH` (null if compliant) |
| `riskScore` | int | 0 to 100 (higher = more risky) |
| `clauseResults` | array | Ordered by `clauseIndex` |

### Integration Pattern

```
Upload PDF  → POST /api/upload/presigned (get S3 URL)
            → PUT to presigned URL (upload file)
            → POST /api/agreements (create record)
            → POST /api/agreements/:id/analyze (trigger)
            → Poll GET /api/agreements/:id/status
              until analysis.status === "COMPLETED" or "FAILED"
```

---

## Chat Sessions

A chat session groups uploaded agreements and a conversation thread. After analysis, users can ask follow up questions grounded in the session's agreement content and RAG retrieved RTA context.

### Session Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chats/sessions` | List all sessions for the current user |
| GET | `/api/chats/sessions/latest` | Get most recent session with agreements, analyses, and messages |
| GET | `/api/chats/sessions/:id` | Get a specific session |
| POST | `/api/chats/sessions` | Create a new session |
| PATCH | `/api/chats/sessions/:id` | Rename a session |
| DELETE | `/api/chats/sessions/:id` | Delete session and all associated agreements and files |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chats/sessions/:id/messages` | List all messages in a session |
| POST | `/api/chats/sessions/:id/messages` | Store a message manually |

### Streaming Chat

```
POST /api/chats/sessions/:id/chat
```

**Body**
```json
{ "message": "Can my landlord enforce the no-pets clause?" }
```

**Response**: Server Sent Events (SSE) stream in Vercel AI SDK data format. Use the `useChat` hook from `ai/react` on the frontend, or read the stream manually.

The backend loads all agreements and analysis results in the session, RAG retrieves relevant RTA sections for the question, streams the GPT-4o response, and persists both user and assistant messages on completion.

---

## Support

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/support/threads` | List threads (own threads for users, all threads for admins) |
| GET | `/api/support/threads/:id` | Get thread detail |
| POST | `/api/support/threads` | Create a new support thread with subject and message |
| PATCH | `/api/support/threads/:id` | Update thread status (OPEN / CLOSED) |
| DELETE | `/api/support/threads/:id` | Delete a thread (admin only) |
| GET | `/api/support/threads/:id/messages` | List messages in a thread |
| POST | `/api/support/threads/:id/messages` | Reply to a thread (sends email notification) |

---

## Admin

Requires ADMIN or OWNER role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all registered users with roles and verification status |
| PATCH | `/api/admin/users/:id` | Update a user's role (respects role hierarchy) |
| DELETE | `/api/admin/users/:id` | Remove a user account |

---

## Stripe Billing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stripe/checkout` | Create a Stripe Checkout session for Pro subscription |
| POST | `/api/stripe/portal` | Create a Stripe billing portal session for subscription management |
| POST | `/api/stripe/webhook` | Handle Stripe webhook events (no auth required, verified by signature) |

Webhook events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
