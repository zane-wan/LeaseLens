"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAppDispatch, useAppSelector } from "@/store"
import { clearUser } from "@/store/slices/authSlice"

export function LogoutButton({
  name,
  email,
  role,
}: {
  name: string | null
  email: string
  role: string
}) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const storeUser = useAppSelector((state) => state.auth.user)

  const displayName = storeUser?.name ?? name
  const displayEmail = storeUser?.email ?? email
  const displayRole = storeUser?.role ?? role

  async function onLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    })
    dispatch(clearUser())
    router.replace("/login")
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout}>
      Sign out
      {displayRole === "ADMIN"
        ? " (Admin)"
        : displayRole === "OWNER"
          ? " (Owner)"
          : ` (${displayName || displayEmail})`}
    </Button>
  )
}
