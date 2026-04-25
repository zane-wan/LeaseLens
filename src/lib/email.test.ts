import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const sendMock = vi.hoisted(() => vi.fn())
const pingramConstructorMock = vi.hoisted(() =>
  vi.fn().mockImplementation(function PingramMock() {
    return {
      send: sendMock,
    }
  })
)

vi.mock("pingram", () => ({
  ChannelsEnum: {
    EMAIL: "EMAIL",
  },
  Pingram: pingramConstructorMock,
}))

import { sendEmail } from "./email"

const originalEnv = { ...process.env }

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EMAIL_MODE = "console"
    delete process.env.PINGRAM_API_KEY
    delete process.env.PINGRAM_NOTIFICATION_TYPE
    delete process.env.PINGRAM_REGION
    delete process.env.PINGRAM_BASE_URL
    delete process.env.SUPPORT_FROM_EMAIL
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("prints email payloads in console mode", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "LeaseLens password reset code",
        text: "Your reset code is 123456.",
      })
    ).resolves.toEqual({
      delivered: false,
      mode: "console",
    })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[email:console]",
      expect.objectContaining({
        from: "no-reply@leaselens.local",
        to: "user@example.com",
        subject: "LeaseLens password reset code",
      })
    )

    consoleLogSpy.mockRestore()
  })

  it("sends email through Pingram when EMAIL_MODE is pingram", async () => {
    process.env.EMAIL_MODE = "pingram"
    process.env.PINGRAM_API_KEY = "pingram_sk_test"
    process.env.PINGRAM_NOTIFICATION_TYPE = "lease_reset"
    process.env.PINGRAM_REGION = "ca"
    process.env.SUPPORT_FROM_EMAIL = "LeaseLens <no-reply@example.com>"
    sendMock.mockResolvedValue({ trackingId: "track_123", messages: [] })

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Reset code",
        text: "Line 1\nLine 2",
        replyTo: "support@example.com",
      })
    ).resolves.toEqual({
      delivered: true,
      mode: "pingram",
      trackingId: "track_123",
    })

    expect(pingramConstructorMock).toHaveBeenCalledWith({
      apiKey: "pingram_sk_test",
      region: "ca",
    })
    expect(sendMock).toHaveBeenCalledWith({
      type: "lease_reset",
      to: {
        id: "user@example.com",
        email: "user@example.com",
      },
      forceChannels: ["EMAIL"],
      email: {
        subject: "Reset code",
        html: "<p>Line 1<br>Line 2</p>",
        senderName: "LeaseLens",
        senderEmail: "no-reply@example.com",
      },
      options: {
        email: {
          fromAddress: "no-reply@example.com",
          fromName: "LeaseLens",
          replyToAddresses: ["support@example.com"],
        },
      },
    })
  })
})
