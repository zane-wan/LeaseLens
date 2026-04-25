import nodemailer from "nodemailer"
import { ChannelsEnum, Pingram, type PingramConfig } from "pingram"

interface EmailPayload {
  from?: string
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

type EmailMode = "console" | "smtp" | "pingram"

let transporter: nodemailer.Transporter | null = null
let pingramClient: Pingram | null = null

function getEmailMode(): EmailMode {
  const mode = (process.env.EMAIL_MODE ?? "console").trim().toLowerCase()
  if (mode === "smtp" || mode === "ses") return "smtp"
  if (mode === "pingram") return "pingram"
  return "console"
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

function getPingramNotificationType() {
  return process.env.PINGRAM_NOTIFICATION_TYPE?.trim() || "leaselens_transactional_email"
}

function getPingramClient() {
  if (pingramClient) return pingramClient

  const apiKey = process.env.PINGRAM_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("Pingram configuration is incomplete. Set PINGRAM_API_KEY.")
  }

  const config: PingramConfig = { apiKey }
  const region = process.env.PINGRAM_REGION?.trim().toLowerCase()
  if (region === "us" || region === "eu" || region === "ca") {
    config.region = region
  }
  const baseUrl = process.env.PINGRAM_BASE_URL?.trim()
  if (baseUrl) {
    config.baseUrl = baseUrl
  }

  pingramClient = new Pingram(config)
  return pingramClient
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function textToHtml(text: string) {
  return `<p>${escapeHtml(text)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")}</p>`
}

function parseSenderAddress(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (!match) {
    return {
      senderEmail: from.trim(),
    }
  }

  const senderName = match[1].trim().replace(/^["']|["']$/g, "")
  return {
    senderName: senderName || undefined,
    senderEmail: match[2].trim(),
  }
}

async function sendPingramEmail(payload: EmailPayload, from: string) {
  const sender = parseSenderAddress(from)
  const emailOptions = {
    fromAddress: sender.senderEmail,
    fromName: sender.senderName,
    replyToAddresses: payload.replyTo ? [payload.replyTo] : undefined,
  }

  const response = await getPingramClient().send({
    type: getPingramNotificationType(),
    to: {
      id: payload.to,
      email: payload.to,
    },
    forceChannels: [ChannelsEnum.EMAIL],
    email: {
      subject: payload.subject,
      html: payload.html ?? textToHtml(payload.text),
      senderName: sender.senderName,
      senderEmail: sender.senderEmail,
    },
    options: {
      email: emailOptions,
    },
  })

  return {
    delivered: true,
    mode: "pingram" as const,
    trackingId: response.trackingId,
  }
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

  if (mode === "pingram") {
    return sendPingramEmail(payload, from)
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
