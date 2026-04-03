import type { Metadata } from "next"
import { LegalPageShell } from "@/components/legal-page-shell"

export const metadata: Metadata = {
  title: "Terms | LeaseLens",
  description: "Terms for LeaseLens",
}

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms"
      title="Terms"
      intro="These terms govern your use of LeaseLens and explain the basic rules for accounts, content, and service use."
    >
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Use of the service</h2>
        <p>
          LeaseLens provides tools that help users review lease content and
          manage related account activity. You may use the service only in a
          lawful manner and only for content you have the right to submit.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
        <p>
          You are responsible for keeping your account credentials secure and
          for activity that takes place through your account. You must provide
          accurate account information and keep it current.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">User content</h2>
        <p>
          You retain rights in the documents and messages you submit. By using
          the service, you allow LeaseLens to process that content as needed to
          provide analysis, account support, service security, and related
          operations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Important notice</h2>
        <p>
          LeaseLens is an informational tool. It does not provide legal advice,
          does not create a lawyer client relationship, and should not replace
          advice from a qualified legal professional.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Acceptable use</h2>
        <p>
          You may not use the service to violate law, interfere with system
          operation, attempt unauthorized access, or submit harmful or abusive
          content.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Changes and contact</h2>
        <p>
          LeaseLens may update the service and these terms from time to time.
          Questions about these terms may be sent to{" "}
          <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:devtest.io@yahoo.com">
            devtest.io@yahoo.com
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  )
}
