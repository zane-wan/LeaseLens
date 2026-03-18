import { AccountSettings } from "@/features/auth/components/AccountAdminPanels"

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const paymentStatus = typeof params.payment === "string" ? params.payment : undefined
  const subscriptionStatus = typeof params.subscription === "string" ? params.subscription : undefined
  
  const status = paymentStatus || subscriptionStatus

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AccountSettings initialStatus={status} />
    </main>
  )
}
