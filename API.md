# LeaseLens API Reference

## Analysis Pipeline (T5a)

The analysis pipeline extracts custom clauses from uploaded lease PDFs, retrieves relevant RTA sections via hybrid search, and produces compliance assessments using GPT-4o.

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

### Poll Analysis Status & Results

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

### Field Reference

| Field | Type | Values |
|-------|------|--------|
| `compliance` | enum | `COMPLIANT`, `NON_COMPLIANT`, `NEEDS_REVIEW` |
| `severity` | enum or null | `LOW`, `MEDIUM`, `HIGH` (null if compliant) |
| `riskScore` | int | 0–100 (higher = more risky) |
| `clauseResults` | array | Ordered by `clauseIndex` |

### Integration Pattern

```
Upload PDF → POST /api/agreements (create record)
           → POST /api/agreements/:id/analyze (trigger)
           → Poll GET /api/agreements/:id/status
             until analysis.status === "COMPLETED" or "FAILED"
```

---

## Chat Sessions

A chat session groups one or more uploaded agreements and a conversation thread. After analysis, users can chat with the LLM about their lease. The LLM has context of all agreements in the session + their analysis results + RAG-retrieved RTA sections.

### Create Session

```
POST /api/chats/sessions
```

**Body**
```json
{
  "title": "My lease review",
  "agreementIds": ["clx...", "clx..."]
}
```

`agreementIds` is optional. Can link agreements later.

**Response** `201`
```json
{
  "id": "clx...",
  "title": "My lease review",
  "agreements": [{ "id": "clx...", "fileName": "lease.pdf" }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

### List Sessions

```
GET /api/chats/sessions
```

Returns all sessions for the authenticated user, most recent first.

### Get Latest Session (session restore)

```
GET /api/chats/sessions/latest
```

Returns the most recent session with full data: agreements (with analysis + clause results) and all chat messages. Used on page load to restore the user's last session.

### Send Chat Message (streaming)

```
POST /api/chats/sessions/:id/chat
```

**Body**
```json
{ "message": "Can my landlord enforce the no-pets clause?" }
```

**Response**: Server-Sent Events (SSE) stream in AI SDK data format. Use the `useChat` hook from `ai/react` on the frontend, or read the stream manually.

The backend:
1. Loads all agreements + analysis results in the session
2. RAG-retrieves relevant RTA sections for the question
3. Sends conversation history + context to GPT-4o
4. Streams the response
5. Persists both user and assistant messages on completion

### List Messages

```
GET /api/chats/sessions/:id/messages
```

Returns all messages in a session, ordered chronologically.

### Store Message (manual)

```
POST /api/chats/sessions/:id/messages
```

**Body**
```json
{
  "role": "USER",
  "content": "...",
  "citations": []
}
```

For manually storing messages (e.g., system messages). The streaming chat endpoint (`/chat`) handles persistence automatically.

### Full User Flow

```
1. Upload PDFs  → POST /api/agreements (×N, one per file)
2. Create session → POST /api/chats/sessions { title, agreementIds: [...] }
3. Analyze        → POST /api/agreements/:id/analyze (per agreement)
4. Poll           → GET /api/agreements/:id/status (until COMPLETED)
5. Chat           → POST /api/chats/sessions/:id/chat { message }
6. Resume         → GET /api/chats/sessions/latest (on re-login)
```
