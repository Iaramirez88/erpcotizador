import VerifyForm from "./verify-form"

type SearchParams = {
  email?: string | string[]
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined
  const rawEmail = resolved?.email
  const initialEmail = typeof rawEmail === "string" ? rawEmail : ""
  return <VerifyForm initialEmail={initialEmail} />
}
