"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function LogoutButton({ email }: { email: string }) {
  const router = useRouter()

  async function onLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    })
    router.replace("/login")
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout}>
      Sign out ({email})
    </Button>
  )
}
