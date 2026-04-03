import type { Metadata } from "next"
import "./globals.css"
import { Geist } from "next/font/google"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { StoreProvider } from "@/components/StoreProvider"
import { Navbar } from "@/components/navbar"
import { PublicFooter } from "@/components/public-footer"
import { Toaster } from "@/components/ui/sonner"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "LeaseLens",
  description:
    "AI-powered lease agreement analysis for Ontario residential tenancy law",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <StoreProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Navbar />
            {children}
            <PublicFooter />
            <Toaster position="top-right" />
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  )
}
