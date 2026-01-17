import ResetForm from "./reset-form"

type SearchParams = {
  token?: string | string[]
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined
  const rawToken = resolved?.token
  const token = typeof rawToken === "string" ? rawToken : ""
  return <ResetForm token={token} />
}
