interface EmailPayload {
  from?: string
  to: string
  subject: string
  text: string
}

// Development-safe email adapter:
// keeps the integration point explicit while external SMTP/SES is not wired.
export async function sendEmail(payload: EmailPayload) {
  const from = payload.from ?? process.env.SUPPORT_FROM_EMAIL ?? "no-reply@leaselens.local"
  const mode = process.env.EMAIL_MODE ?? "console"

  if (mode === "console") {
    console.log("[email:console]", {
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    })
    return { delivered: false, mode: "console" as const }
  }

  // Future extension for SES/SMTP provider integration.
  console.log("[email:stub]", {
    mode,
    from,
    to: payload.to,
    subject: payload.subject,
  })
  return { delivered: false, mode: "stub" as const }
}
