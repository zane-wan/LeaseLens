"use server"

import { z } from "zod"
import { redirect } from "next/navigation"

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignupState = {
  errors?: {
    name?: string[]
    email?: string[]
    password?: string[]
    confirmPassword?: string[]
    general?: string[]
  }
}

export async function signupWithCredentials(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { name, email, password } = parsed.data

  // TODO: replace with your auth library call, e.g. Better Auth:
  //
  //   const result = await auth.signUp.email({ name, email, password })
  //   if (result.error) return { errors: { general: [result.error.message] } }
  //
  // Or NextAuth with a custom adapter:
  //
  //   await createUser({ name, email, password: await hashPassword(password) })

  void name
  void email
  void password

  redirect("/dashboard")
}

export async function signupWithGoogle() {
  // TODO: trigger Google OAuth, e.g. Better Auth:
  //   redirect(await auth.signIn.social({ provider: "google", callbackURL: "/dashboard" }))
  //
  // Or NextAuth:
  //   await signIn("google", { redirectTo: "/dashboard" })

  redirect("/dashboard")
}
