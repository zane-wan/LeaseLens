"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAppDispatch } from "@/store"
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
      {role === "ADMIN"
        ? " (Admin)"
        : role === "OWNER"
          ? " (Owner)"
          : ` (${name || email})`}
    </Button>
  )
}
