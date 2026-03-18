import { redirect } from "next/navigation"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUserFromServer()
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="relative min-h-screen bg-muted/60 dark:bg-muted/30">
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] opacity-50"></div>
      <div className="relative z-10 mx-auto max-w-7xl min-h-screen bg-background shadow-sm border-x">
        {children}
      </div>
    </div>
  )
}
