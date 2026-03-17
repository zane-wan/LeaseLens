import type { Metadata } from "next"
import "./globals.css"
import { Geist } from "next/font/google"
import { PublicNavbar } from "@/components/public-navbar"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getAuthUserFromServer } from "@/lib/auth"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "LeaseLens",
  description:
    "AI-powered lease agreement analysis for Ontario residential tenancy law",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getAuthUserFromServer()

  return (
    <html
      lang="en"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PublicNavbar isAuthenticated={Boolean(user)} />
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
