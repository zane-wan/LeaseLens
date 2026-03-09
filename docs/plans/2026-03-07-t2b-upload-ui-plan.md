# T2b: Upload UI + PDF Parsing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the drag-drop lease upload UI on the Dashboard, wire it to S3 (via mock presigned URL), create Agreement DB records, and provide a server-side PDF text extraction utility.

**Architecture:** Dashboard page embeds a `DropZone` component at the top. Upload logic lives in a `useUpload` hook that calls a mock presigned URL API, PUTs directly to S3, then POSTs to create an Agreement record in the DB. PDF parsing is a standalone server utility called lazily by the analysis pipeline (T5), not at upload time.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, shadcn/ui, react-dropzone, pdf-parse, Prisma (PostgreSQL), Redux Toolkit, Zod

---

## Prerequisites

Install dependencies first:

```bash
cd /Users/yiyang/Documents/Code/LeaseLens
npm i react-dropzone pdf-parse
npm i -D @types/pdf-parse
npx shadcn@latest init   # if not already done
npx shadcn@latest add button badge progress card toast
```

---

## Task 1: Upload types

**Files:**
- Create: `src/features/upload/types.ts`

**Step 1: Create the file**

```ts
export type UploadStatus = "idle" | "uploading" | "success" | "error"

export interface UploadState {
  status: UploadStatus
  progress: number       // 0–100
  errorMessage: string | null
}

export interface AgreementItem {
  id: string
  fileName: string
  s3Key: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  uploadedAt: string
}
```

**Step 2: Commit**

```bash
git add src/features/upload/types.ts
git commit -m "feat: add upload types"
```

---

## Task 2: Mock presigned URL API route

**Files:**
- Create: `src/app/api/upload/presigned/route.ts`

**Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = schema.safeParse({
    fileName: searchParams.get("fileName"),
    contentType: searchParams.get("contentType"),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const key = `uploads/${Date.now()}-${parsed.data.fileName}`

  // TODO: replace with real S3 presigned URL when T2a is merged
  return NextResponse.json({
    url: "https://mock-s3.example.com/upload",
    key,
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/upload/presigned/route.ts
git commit -m "feat: add mock presigned URL API route"
```

---

## Task 3: Agreements API route

**Files:**
- Create: `src/app/api/agreements/route.ts`
- Read first: `src/lib/prisma.ts` (create if missing — see Step 1)

**Step 1: Create Prisma client singleton if it doesn't exist**

Check if `src/lib/prisma.ts` exists. If not, create it:

```ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

**Step 2: Create the agreements route**

```ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const schema = z.object({
  fileName: z.string().min(1),
  s3Key: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  // Hardcode userId for now; replace with real auth session in T1
  const userId = "dev-user"

  // Ensure dev user exists (remove after T1 auth is wired)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: "dev@leaselens.dev",
      name: "Dev User",
    },
  })

  const agreement = await prisma.agreement.create({
    data: {
      userId,
      fileName: parsed.data.fileName,
      s3Key: parsed.data.s3Key,
    },
  })

  return NextResponse.json(agreement, { status: 201 })
}

export async function GET() {
  const userId = "dev-user"
  const agreements = await prisma.agreement.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
  })
  return NextResponse.json(agreements)
}
```

**Step 3: Commit**

```bash
git add src/lib/prisma.ts src/app/api/agreements/route.ts
git commit -m "feat: add agreements API route (POST + GET)"
```

---

## Task 4: useUpload hook

**Files:**
- Create: `src/features/upload/hooks/useUpload.ts`

**Step 1: Create the hook**

```ts
"use client"

import { useState, useCallback } from "react"
import { UploadState } from "../types"

interface UseUploadReturn {
  uploadState: UploadState
  upload: (file: File) => Promise<{ id: string; s3Key: string } | null>
  reset: () => void
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20MB

export function useUpload(): UseUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    errorMessage: null,
  })

  const reset = useCallback(() => {
    setUploadState({ status: "idle", progress: 0, errorMessage: null })
  }, [])

  const upload = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setUploadState({ status: "error", progress: 0, errorMessage: "只支持 PDF 文件" })
      return null
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadState({ status: "error", progress: 0, errorMessage: "文件不能超过 20MB" })
      return null
    }

    setUploadState({ status: "uploading", progress: 10, errorMessage: null })

    try {
      // 1. Get presigned URL
      const presignedRes = await fetch(
        `/api/upload/presigned?fileName=${encodeURIComponent(file.name)}&contentType=application/pdf`
      )
      if (!presignedRes.ok) throw new Error("获取上传链接失败")
      const { url, key } = await presignedRes.json()

      setUploadState({ status: "uploading", progress: 30, errorMessage: null })

      // 2. Upload to S3
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      })
      // Mock will return non-OK; treat it as success in dev
      if (!uploadRes.ok && url !== "https://mock-s3.example.com/upload") {
        throw new Error("上传文件失败")
      }

      setUploadState({ status: "uploading", progress: 80, errorMessage: null })

      // 3. Create agreement record
      const agreementRes = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, s3Key: key }),
      })
      if (!agreementRes.ok) throw new Error("创建记录失败")
      const agreement = await agreementRes.json()

      setUploadState({ status: "success", progress: 100, errorMessage: null })
      return { id: agreement.id, s3Key: key }
    } catch (err) {
      const message = err instanceof Error ? err.message : "上传失败，请重试"
      setUploadState({ status: "error", progress: 0, errorMessage: message })
      return null
    }
  }, [])

  return { uploadState, upload, reset }
}
```

**Step 2: Commit**

```bash
git add src/features/upload/hooks/useUpload.ts
git commit -m "feat: add useUpload hook"
```

---

## Task 5: DropZone component

**Files:**
- Create: `src/features/upload/components/DropZone.tsx`

**Step 1: Create the component**

```tsx
"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Progress } from "@/components/ui/progress"
import { UploadState } from "../types"

interface DropZoneProps {
  uploadState: UploadState
  onFileDrop: (file: File) => void
  onReset: () => void
}

export function DropZone({ uploadState, onFileDrop, onReset }: DropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) onFileDrop(acceptedFiles[0])
    },
    [onFileDrop]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploadState.status === "uploading",
  })

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60"}
          ${uploadState.status === "uploading" ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        {uploadState.status === "idle" && (
          <p className="text-muted-foreground">
            {isDragActive ? "松开以上传" : "拖入 PDF 文件，或点击选择"}
          </p>
        )}
        {uploadState.status === "uploading" && (
          <p className="text-muted-foreground">上传中…</p>
        )}
        {uploadState.status === "success" && (
          <p className="text-green-600">上传成功 ✓</p>
        )}
        {uploadState.status === "error" && (
          <p className="text-destructive">{uploadState.errorMessage}</p>
        )}
      </div>

      {uploadState.status === "uploading" && (
        <Progress value={uploadState.progress} className="mt-3" />
      )}

      {(uploadState.status === "success" || uploadState.status === "error") && (
        <button
          onClick={onReset}
          className="mt-2 text-sm text-muted-foreground underline"
        >
          再上传一个
        </button>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/features/upload/components/DropZone.tsx
git commit -m "feat: add DropZone component"
```

---

## Task 6: AgreementList component

**Files:**
- Create: `src/features/upload/components/AgreementList.tsx`

**Step 1: Create the component**

```tsx
"use client"

import { AgreementItem } from "../types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface AgreementListProps {
  agreements: AgreementItem[]
  onAnalyze: (id: string) => void
}

const statusLabel: Record<AgreementItem["status"], string> = {
  PENDING: "待分析",
  PROCESSING: "分析中",
  COMPLETED: "已完成",
  FAILED: "失败",
}

const statusVariant: Record<AgreementItem["status"], "secondary" | "default" | "outline" | "destructive"> = {
  PENDING: "secondary",
  PROCESSING: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
}

export function AgreementList({ agreements, onAnalyze }: AgreementListProps) {
  if (agreements.length === 0) {
    return <p className="text-muted-foreground text-sm mt-6">还没有上传的协议</p>
  }

  return (
    <ul className="mt-6 space-y-3">
      {agreements.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between rounded-lg border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium truncate max-w-xs">{a.fileName}</span>
            <Badge variant={statusVariant[a.status]}>{statusLabel[a.status]}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{new Date(a.uploadedAt).toLocaleDateString("zh-CN")}</span>
            {a.status === "PENDING" && (
              <Button size="sm" onClick={() => onAnalyze(a.id)}>
                开始分析
              </Button>
            )}
            {a.status === "PROCESSING" && (
              <Button size="sm" disabled>
                分析中…
              </Button>
            )}
            {a.status === "COMPLETED" && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/agreements/${a.id}`}>查看结果</a>
              </Button>
            )}
            {a.status === "FAILED" && (
              <Button size="sm" variant="destructive" onClick={() => onAnalyze(a.id)}>
                重试
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
```

**Step 2: Commit**

```bash
git add src/features/upload/components/AgreementList.tsx
git commit -m "feat: add AgreementList component"
```

---

## Task 7: Dashboard page

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create the page**

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { DropZone } from "@/features/upload/components/DropZone"
import { AgreementList } from "@/features/upload/components/AgreementList"
import { useUpload } from "@/features/upload/hooks/useUpload"
import { AgreementItem } from "@/features/upload/types"

export default function DashboardPage() {
  const { uploadState, upload, reset } = useUpload()
  const [agreements, setAgreements] = useState<AgreementItem[]>([])

  const fetchAgreements = useCallback(async () => {
    const res = await fetch("/api/agreements")
    if (res.ok) setAgreements(await res.json())
  }, [])

  useEffect(() => {
    fetchAgreements()
  }, [fetchAgreements])

  const handleFileDrop = async (file: File) => {
    const result = await upload(file)
    if (result) fetchAgreements()
  }

  const handleAnalyze = async (id: string) => {
    // Triggers analysis — T5 will implement /api/agreements/[id]/analyze
    await fetch(`/api/agreements/${id}/analyze`, { method: "POST" })
    fetchAgreements()
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">我的协议</h1>
      <DropZone
        uploadState={uploadState}
        onFileDrop={handleFileDrop}
        onReset={reset}
      />
      <AgreementList agreements={agreements} onAnalyze={handleAnalyze} />
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: add dashboard page with upload zone and agreement list"
```

---

## Task 8: PDF text extraction utility

**Files:**
- Create: `src/lib/pdf.ts`

**Step 1: Create the utility**

```ts
import pdfParse from "pdf-parse"

/**
 * Fetch a PDF from S3 by key and extract plain text.
 * Called by the analysis pipeline (T5), not at upload time.
 */
export async function extractPdfText(s3Key: string): Promise<string> {
  const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
  const res = await fetch(s3Url)
  if (!res.ok) throw new Error(`Failed to fetch PDF from S3: ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const data = await pdfParse(buffer)
  return data.text
}
```

**Step 2: Commit**

```bash
git add src/lib/pdf.ts
git commit -m "feat: add PDF text extraction utility"
```

---

## Task 9: Smoke test end-to-end

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Navigate to http://localhost:3000/dashboard**

Expected: Dashboard renders with upload zone and empty agreement list.

**Step 3: Drop a PDF file onto the upload zone**

Expected:
- Progress bar appears, reaches 100%
- "上传成功 ✓" shown
- Agreement appears in list with status badge "待分析"

**Step 4: Click "开始分析"**

Expected: Button briefly shows "分析中…" then goes back (no analyze route yet, will 404 — that's OK, T5 handles it).

**Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

---

## Done

T2b is complete when:
- [ ] Dashboard renders at `/dashboard`
- [ ] Drag-drop zone accepts PDF, rejects non-PDF and >20MB
- [ ] Upload flow runs to completion (mock S3 OK)
- [ ] New agreements appear in list with correct status badge
- [ ] `src/lib/pdf.ts` exports `extractPdfText` for T5 to use
