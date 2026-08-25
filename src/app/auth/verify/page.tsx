import VerifyForm from "./verify-form"

type SearchParams = {
  email?: string | string[]
  callbackUrl?: string | string[]
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined
  const rawEmail = resolved?.email
  const rawCallbackUrl = resolved?.callbackUrl
  const initialEmail = typeof rawEmail === "string" ? rawEmail : ""
  const callbackUrl = typeof rawCallbackUrl === 'string' ? rawCallbackUrl : ''
  return <VerifyForm initialEmail={initialEmail} callbackUrl={callbackUrl} />
}
