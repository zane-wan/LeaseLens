"use server"

import { z } from "zod"
import { redirect } from "next/navigation"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type LoginState = {
  errors?: {
    email?: string[]
    password?: string[]
    general?: string[]
  }
}

export async function loginWithCredentials(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { email, password } = parsed.data

  // TODO: replace with your auth library call, e.g. Better Auth:
  //
  //   const result = await auth.signIn.email({ email, password })
  //   if (result.error) return { errors: { general: [result.error.message] } }
  //
  // Or NextAuth:
  //
  //   const result = await signIn("credentials", { email, password, redirect: false })
  //   if (result?.error) return { errors: { general: ["Invalid credentials"] } }

  void email
  void password

  redirect("/dashboard")
}

export async function loginWithGoogle() {
  // TODO: trigger Google OAuth, e.g. Better Auth:
  //   redirect(await auth.signIn.social({ provider: "google", callbackURL: "/dashboard" }))
  //
  // Or NextAuth:
  //   await signIn("google", { redirectTo: "/dashboard" })

  redirect("/dashboard")
}
