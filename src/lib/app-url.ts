import { NextRequest } from "next/server"

const DEFAULT_APP_URL = "http://localhost:3000"
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"])

export function normalizeAppUrl(value?: string | null) {
  const candidate = value?.trim() || DEFAULT_APP_URL
  return candidate.replace(/\/+$/, "")
}

export function isLocalAppUrl(value?: string | null) {
  if (!value) return false

  try {
    return LOCAL_HOSTNAMES.has(new URL(normalizeAppUrl(value)).hostname)
  } catch {
    return false
  }
}

function getRequestAppUrl(req?: NextRequest) {
  if (!req) return null

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const hostHeader = req.headers.get("host")?.split(",")[0]?.trim()

  if (forwardedProto && forwardedHost) {
    return normalizeAppUrl(`${forwardedProto}://${forwardedHost}`)
  }

  if (hostHeader) {
    const hostName = hostHeader.split(":")[0] ?? hostHeader
    const isLocalHostHeader = LOCAL_HOSTNAMES.has(hostName)
    const inferredProto =
      forwardedProto ??
      (process.env.NODE_ENV === "production" && !isLocalHostHeader ? "https" : "http")

    return normalizeAppUrl(`${inferredProto}://${hostHeader}`)
  }

  const requestOrigin = req.nextUrl.origin
  if (requestOrigin && requestOrigin !== "null") {
    return normalizeAppUrl(requestOrigin)
  }

  return null
}

export function getAppUrl(req?: NextRequest) {
  const configuredAppUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  const requestAppUrl = getRequestAppUrl(req)

  if (configuredAppUrl) {
    if (isLocalAppUrl(configuredAppUrl) && requestAppUrl && !isLocalAppUrl(requestAppUrl)) {
      return requestAppUrl
    }

    return normalizeAppUrl(configuredAppUrl)
  }

  return requestAppUrl ?? DEFAULT_APP_URL
}

export function buildAppUrl(path: string, req?: NextRequest) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getAppUrl(req)}${normalizedPath}`
}
