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
            {isDragActive ? "Release to upload" : "Drag and drop PDF file, or click to select"}
          </p>
        )}
        {uploadState.status === "uploading" && (
          <p className="text-muted-foreground">Uploading...</p>
        )}
        {uploadState.status === "success" && (
          <p className="text-green-600">Upload successful ✓</p>
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
          Upload another one
        </button>
      )}
    </div>
  )
}
