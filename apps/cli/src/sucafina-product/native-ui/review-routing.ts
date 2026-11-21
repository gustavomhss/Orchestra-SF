import { SfReviewRoutes } from "@orchestra/schema/sucafina/reviews/routes"

type ReviewProjection = Readonly<{
  operationId: "projection.review"
  handle: (request: Request) => Promise<Response>
}>

const rejection = (status: number, reason: string, allow?: string) =>
  Response.json({ status: status === 503 ? "unavailable" : "invalid", reason }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(allow ? { Allow: allow } : {}),
    },
  })

/** Compose after installation ingress and identity preparation. Producers own admission and egress. */
export function mountSfReviewProjection(input: Readonly<{
  origin: string
  mount: string
  readProjection: () => ReviewProjection | undefined
}>): (request: Request) => Promise<Response | undefined> {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(input.mount) ||
      new URL(input.origin).origin !== input.origin) throw new Error("SF_REVIEW_MOUNT_INVALID")

  const projection = SfReviewRoutes["projection.review"]
  const projectionPath = projection.pathTemplate.replace("{mount}", input.mount)

  return async (request) => {
    const url = new URL(request.url)
    if (url.origin !== input.origin || url.pathname !== projectionPath) return undefined
    if (request.method !== projection.method) return rejection(405, "read-method-required", projection.method)
    const contentLength = request.headers.get("content-length")
    if (request.signal.aborted || url.username || url.password || url.hash || url.search.length > 4096 ||
        request.body || request.headers.has("transfer-encoding") || (contentLength !== null && contentLength !== "0") ||
        [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1))
      return rejection(400, "invalid-review-request")
    const producer = input.readProjection()
    if (producer?.operationId !== "projection.review") return rejection(503, "review-producer-unavailable")
    return producer.handle(request)
  }
}
