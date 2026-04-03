import type { Metadata } from "next"
import { LegalPageShell } from "@/components/legal-page-shell"

export const metadata: Metadata = {
  title: "Privacy Policy | LeaseLens",
  description: "Privacy Policy for LeaseLens",
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="This page explains what information LeaseLens collects, why we collect it, and how we use it."
    >
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Information we collect</h2>
        <p>
          We collect the information you give us directly, such as your name,
          email address, account credentials, support messages, and any lease
          files or text you submit for review.
        </p>
        <p>
          We also collect basic service data such as sign in activity, device
          and browser details, error logs, and usage records that help us keep
          the service secure and reliable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">How we use information</h2>
        <p>
          We use personal information to create and manage accounts, send
          password reset codes, analyze lease content you submit, reply to
          support requests, prevent misuse, and improve the service.
        </p>
        <p>
          We do not use your account email for bulk marketing campaigns. Email
          sent by LeaseLens is intended for account access, service use, and
          direct support communication.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Service providers</h2>
        <p>
          LeaseLens uses third party providers to operate the service. These may
          include cloud hosting, data storage, payment processing, and language
          model providers that help analyze documents you choose to submit.
        </p>
        <p>
          We share information with providers only to the extent needed for
          them to perform services on our behalf.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Retention and security</h2>
        <p>
          We keep personal information for as long as needed to operate the
          service, comply with legal obligations, resolve disputes, and enforce
          our terms. We use reasonable administrative and technical safeguards
          to protect the information we store.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Your choices</h2>
        <p>
          You may contact us to ask for help with your account, request updates
          to your information, or ask questions about how your information is
          handled.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Contact</h2>
        <p>
          For privacy questions, email{" "}
          <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:devtest.io@yahoo.com">
            devtest.io@yahoo.com
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  )
}
