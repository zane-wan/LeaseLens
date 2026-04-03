import type { Metadata } from "next"
import { LegalPageShell } from "@/components/legal-page-shell"

export const metadata: Metadata = {
  title: "Contact | LeaseLens",
  description: "Contact LeaseLens",
}

export default function ContactPage() {
  return (
    <LegalPageShell
      eyebrow="Contact"
      title="Contact"
      intro="Use this page if you need account help, have a support question, or want to reach the LeaseLens team."
    >
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Email</h2>
        <p>
          Contact LeaseLens at{" "}
          <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:devtest.io@yahoo.com">
            devtest.io@yahoo.com
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Support</h2>
        <p>
          Signed in users may also use the support area inside the app to open a
          thread and receive direct replies about account or product issues.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">What to include</h2>
        <p>
          When you contact us, include the email tied to your account and a
          short summary of the issue so we can help you more quickly.
        </p>
      </section>
    </LegalPageShell>
  )
}
