"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Progress } from "@/components/ui/progress"
import { UploadState } from "../types"

interface DropZoneProps {
  uploadState: UploadState
  onFilesDrop: (files: File[]) => void
  onReset: () => void
  multiple?: boolean
  maxFiles?: number
}

export function DropZone({
  uploadState,
  onFilesDrop,
  onReset,
  multiple = true,
  maxFiles = 10,
}: DropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onFilesDrop(acceptedFiles)
    },
    [onFilesDrop]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    disabled: uploadState.status === "uploading",
    multiple,
    maxFiles,
    maxSize: 20 * 1024 * 1024, // 20 MB
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
          <div className="text-muted-foreground">
            <p>{isDragActive ? "Release to upload" : `Drag and drop PDF file${multiple ? "s" : ""}, or click to select`}</p>
            <p className="text-xs mt-1">
              Up to {maxFiles} file{maxFiles !== 1 ? "s" : ""}, max 20 MB each
            </p>
          </div>
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
          Upload more files
        </button>
      )}
    </div>
  )
}
