import nodemailer from "nodemailer"

interface EmailPayload {
  from?: string
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

type EmailMode = "console" | "smtp"

let transporter: nodemailer.Transporter | null = null

function getEmailMode(): EmailMode {
  const mode = (process.env.EMAIL_MODE ?? "console").trim().toLowerCase()
  return mode === "smtp" || mode === "ses" ? "smtp" : "console"
}

function getDefaultFromAddress() {
  return process.env.SUPPORT_FROM_EMAIL?.trim() || "no-reply@leaselens.local"
}

function getSmtpHost() {
  if (process.env.SMTP_HOST?.trim()) {
    return process.env.SMTP_HOST.trim()
  }

  const region = process.env.AWS_REGION?.trim()
  if (region) {
    return `email-smtp.${region}.amazonaws.com`
  }

  return null
}

function getSmtpTransporter() {
  if (transporter) return transporter

  const host = getSmtpHost()
  const port = Number(process.env.SMTP_PORT ?? "465")
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()

  if (!host || !user || !pass || Number.isNaN(port)) {
    throw new Error(
      "SMTP configuration is incomplete. Set SMTP_HOST (or AWS_REGION), SMTP_PORT, SMTP_USER, and SMTP_PASS."
    )
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: (process.env.SMTP_SECURE ?? "").trim()
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: {
      user,
      pass,
    },
  })

  return transporter
}

export async function sendEmail(payload: EmailPayload) {
  const from = payload.from ?? getDefaultFromAddress()
  const mode = getEmailMode()

  if (mode === "console") {
    console.log("[email:console]", {
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      replyTo: payload.replyTo,
    })

    return {
      delivered: false,
      mode: "console" as const,
    }
  }

  const info = await getSmtpTransporter().sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo,
  })

  return {
    delivered: true,
    mode: "smtp" as const,
    messageId: info.messageId,
  }
}
