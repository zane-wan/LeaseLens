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
