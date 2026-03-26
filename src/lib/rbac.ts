import { UserRole } from "@prisma/client"

export function isAdminLike(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER"
}

export function canManageAccount(
  actorRole: UserRole,
  actorId: string,
  targetRole: UserRole,
  targetId: string
): boolean {
  if (actorRole === "OWNER") return true

  if (actorRole === "ADMIN") {
    if (actorId === targetId) return true
    return targetRole === "USER"
  }

  return actorId === targetId
}

export function canAssignRole(actorRole: UserRole, nextRole: UserRole): boolean {
  if (actorRole === "OWNER") return true
  if (actorRole === "ADMIN") return nextRole === "USER"
  return false
}

export function canDeleteManagedAccount(
  actorRole: UserRole,
  actorId: string,
  targetRole: UserRole,
  targetId: string
): boolean {
  if (actorRole === "OWNER") {
    return actorId !== targetId
  }

  if (actorRole === "ADMIN") {
    return actorId !== targetId && targetRole === "USER"
  }

  return actorId === targetId
}
