# T2b: Drag-drop Upload UI + PDF Parsing — Design Doc

Date: 2026-03-07  
Assignee: Yiyang  
Dependencies: T2a (S3 presigned URL backend)

---

## Scope

Build the lease upload experience and server-side PDF text extraction utility.  
Chat/Q&A over documents is out of scope (deferred to T6+).

---

## User Flow

1. User lands on `/dashboard`
2. Drag a PDF onto the upload zone (or click to select)
3. Frontend validates: PDF only, max 20MB
4. Call `GET /api/upload/presigned` to get an S3 presigned URL
5. `PUT` file directly to S3 (client → S3, no server relay)
6. Call `POST /api/agreements` to create a DB record with status `PENDING`
7. New agreement appears in the list below the upload zone
8. User manually clicks "开始分析" to trigger analysis (T5)

---

## Page Layout

```
/dashboard
┌─────────────────────────────────────┐
│  Upload Zone (top of page)           │
│  Drag PDF here or click to browse    │
│  Progress bar shown during upload    │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Agreement List                      │
│  [Name]  [Status badge]  [Date]  [CTA button] │
└─────────────────────────────────────┘
```

CTA button states:
- `PENDING` → "开始分析"
- `PROCESSING` → "分析中…" (disabled)
- `COMPLETED` → "查看结果" (links to /agreements/[id])
- `FAILED` → "重试"

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       └── page.tsx              # Dashboard page
│   └── api/
│       ├── upload/
│       │   └── presigned/route.ts    # Mock presigned URL (T2a replaces)
│       └── agreements/
│           └── route.ts              # POST: create Agreement record
├── features/
│   └── upload/
│       ├── components/
│       │   ├── DropZone.tsx          # Drag-drop UI
│       │   └── AgreementList.tsx     # Agreement list
│       ├── hooks/
│       │   └── useUpload.ts          # Upload state machine
│       └── types.ts                  # UploadState, AgreementItem types
└── lib/
    └── pdf.ts                        # Server-side PDF text extraction
```

---

## Data Flow

```
DropZone
  └── useUpload hook
        ├── GET /api/upload/presigned  → { url, key }
        ├── PUT <presigned-url>        → S3 direct upload
        └── POST /api/agreements       → { id, fileName, s3Key, status }
              └── dispatch to Redux store → AgreementList re-renders
```

---

## PDF Parsing

- Library: `pdf-parse` (server-side Node.js)
- **Not triggered at upload time** — called lazily by T5 analysis pipeline
- Location: `src/lib/pdf.ts`
- Interface:

```ts
export async function extractPdfText(s3Key: string): Promise<string>
```

Fetches the PDF buffer from S3, passes it to `pdf-parse`, returns plain text.  
Limitation: does not support scanned (image-only) PDFs. Acceptable for Ontario standard lease forms which are digital.

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| Non-PDF file dropped | Reject immediately, show "只支持 PDF 文件" |
| File > 20MB | Reject immediately, show size limit message |
| S3 upload fails | Show error toast, allow retry, do NOT create DB record |
| POST /api/agreements fails | Show error toast; file exists in S3 but no DB record (acceptable orphan) |
| Presigned URL mock (pre-T2a) | Upload appears to succeed, DB record created, real S3 upload skipped |

---

## Dependencies & Packages

```bash
npm i react-dropzone pdf-parse
npm i -D @types/pdf-parse
```

shadcn/ui components used: `Button`, `Badge`, `Progress`, `Card`  
(to be added via `npx shadcn@latest add ...` during implementation)
