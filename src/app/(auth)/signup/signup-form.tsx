"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { signupWithCredentials, signupWithGoogle, type SignupState } from "./actions"

const initialState: SignupState = {}

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupWithCredentials, initialState)

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="pt-2 pb-4 space-y-4">
          {/* General error */}
          {state.errors?.general && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.errors.general[0]}
            </p>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Jane Doe"
              autoComplete="name"
              aria-invalid={!!state.errors?.name}
            />
            {state.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!state.errors?.email}
            />
            {state.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!state.errors?.password}
            />
            {state.errors?.password && (
              <p className="text-xs text-destructive">{state.errors.password[0]}</p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!state.errors?.confirmPassword}
            />
            {state.errors?.confirmPassword && (
              <p className="text-xs text-destructive">{state.errors.confirmPassword[0]}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {/* Credentials submit */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
          </Button>

          {/* Divider */}
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google OAuth */}
          <Button type="submit" formAction={signupWithGoogle} variant="outline" className="w-full">
            <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
