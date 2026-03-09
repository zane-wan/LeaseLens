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
