import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getAuthUserFromServer } from "@/lib/auth"

export default async function Home() {
  const user = await getAuthUserFromServer()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">LeaseLens</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        AI-powered lease agreement analysis for Ontario residential tenancy law
      </p>
      <div className="mt-8 flex gap-3">
        {user ? (
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        ) : (
          <>
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline">Create account</Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
