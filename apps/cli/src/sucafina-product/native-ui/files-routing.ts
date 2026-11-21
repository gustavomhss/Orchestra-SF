import { SfFileRoutes } from "@orchestra/schema/sucafina/files/routes"
import { createSfFilesHostBindings, type SfFilesHostSources } from "./files"

const fail = (status: number, headers?: Record<string, string>) =>
  Response.json({ status: "invalid" }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export function mountSfFilesOriginalRoutes(input: Readonly<{
  origin: string
  mount: string
  sources: SfFilesHostSources
}>): (request: Request) => Promise<Response | undefined> {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(input.mount) ||
      new URL(input.origin).origin !== input.origin) throw new Error("SF_A06_HOST_ROUTE_INVALID")

  const bound = createSfFilesHostBindings(input.sources)
  const fixed = new Map(Object.keys(bound).flatMap((key) => {
    const operation = key as keyof typeof bound
    const metadata = SfFileRoutes[operation]
    return "fixedQuery" in metadata
      ? Object.entries(metadata.fixedQuery).map(([name, value]) => [name + "=" + value, operation] as const)
      : []
  }))

  return async (request) => {
    const url = new URL(request.url)
    if (url.origin !== input.origin || !url.pathname.startsWith(input.mount + "/")) return undefined
    const surface = url.pathname.slice(input.mount.length + 1)
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return undefined

    const query = url.searchParams
    const selected = ["sf", "download", "asset", "asset-link", "upload"].filter((key) => query.has(key))
    const selector = selected[0]
    if (!selector) return undefined
    if (selected.length !== 1 || query.getAll(selector).length !== 1) return fail(400)
    const value = query.get(selector)
    const operation = selector === "asset" ? "files.asset.download"
      : selector === "asset-link" ? "files.asset.link"
      : selector === "upload" && value && ["contract", "quote", "signed-po", "supplier"].includes(value)
        ? "files.asset.upload"
        : fixed.get(selector + "=" + value)
    if (!operation) return undefined

    const metadata = SfFileRoutes[operation]
    if (metadata.method !== request.method) return fail(405, { Allow: metadata.method })
    // Original producers keep ownership of access, redaction, streamed byte caps and revalidation.
    return bound[operation](request, surface)
  }
}
