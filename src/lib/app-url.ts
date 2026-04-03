import { NextRequest } from "next/server"

const DEFAULT_APP_URL = "http://localhost:3000"

export function normalizeAppUrl(value?: string | null) {
  const candidate = value?.trim() || DEFAULT_APP_URL
  return candidate.replace(/\/+$/, "")
}

export function getAppUrl(req?: NextRequest) {
  const requestOrigin = req?.nextUrl.origin

  if (requestOrigin && requestOrigin !== "null") {
    return normalizeAppUrl(requestOrigin)
  }

  return normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)
}

export function buildAppUrl(path: string, req?: NextRequest) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getAppUrl(req)}${normalizedPath}`
}
