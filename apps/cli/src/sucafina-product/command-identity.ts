import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"

/** Identity follows admitted command semantics; this supplies no authorization or grant. */
export function sfUiCommandIdentity(request: Request, operation: string, input: {
  origin: string
  mount: string
  readOperations: ReadonlyMap<string, string>
  createId: () => string
}): string | undefined {
  if (request.method === "GET" || request.method === "HEAD") return input.createId()
  const key = request.headers.get("Idempotency-Key")
  if (key !== null) return /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
  if (request.method !== "POST" || request.signal.aborted || request.headers.get("origin") !== input.origin ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return undefined
  const url = new URL(request.url)
  const query = [...url.searchParams]
  if (url.origin !== input.origin || url.hash || query.length !== 1 || query[0]?.[0] !== "sf" ||
    !["dashboard", "planner", "procurement"].some((surface) => url.pathname === `${input.mount}/${surface}`)) return undefined
  const mode = query[0][1]
  const reviewRead = operation === "sf_review_prepare" && mode === "review-thread-context" && url.pathname === `${input.mount}/dashboard`
  return reviewRead || input.readOperations.get(mode) === operation ? input.createId() : undefined
}
