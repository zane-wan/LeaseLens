"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAppDispatch } from "@/store"
import { clearUser } from "@/store/slices/authSlice"

export function LogoutButton({ identifier }: { identifier: string }) {
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
      Sign out ({identifier})
    </Button>
  )
}
