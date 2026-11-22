import { SfFileRoutes } from "@orchestra/schema/sucafina/files/routes"
import { createSfFilesHostBindings, type SfFilesHostSources } from "./bindings.ts"
import { readSfApplicationSource, type Application } from "../application.ts"

const applicationSources = new WeakMap<object, () => {
  producer: NonNullable<SfFilesHostSources["application"]>
  application: Application
  origin: string
  mount: string
} | undefined>()

/** Only the original mounted route can identify its current application delegate. */
export function readSfFilesApplicationSource(route: object) {
  return applicationSources.get(route)?.()
}

function fail(request: Request, status: number, headers?: Record<string, string>) {
  const init = { status, headers: { "Cache-Control": "no-store", ...headers } }
  return request.method === "HEAD" ? new Response(null, init) : Response.json({ status: "invalid" }, init)
}

export function mountSfFilesOriginalRoutes(input: Readonly<{
  origin: string
  mount: string
  sources: SfFilesHostSources
}>): (request: Request) => Promise<Response | undefined> {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(input.mount) ||
      new URL(input.origin).origin !== input.origin) throw new Error("SF_A06_HOST_ROUTE_INVALID")

  const sources = input.sources
  const bound = createSfFilesHostBindings(sources)
  const fixed = new Map(Object.keys(bound).flatMap((key) => {
    const operation = key as keyof typeof bound
    const metadata = SfFileRoutes[operation]
    return "fixedQuery" in metadata
      ? Object.entries(metadata.fixedQuery).map(([name, value]) => [name + "=" + value, operation] as const)
      : []
  }))

  const route = async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.origin !== input.origin || !url.pathname.startsWith(input.mount + "/")) return undefined
    const surface = url.pathname.slice(input.mount.length + 1)
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return undefined

    const query = url.searchParams
    const selected = ["sf", "download", "asset", "asset-link", "upload"].filter((key) => query.has(key))
    const selector = selected[0]
    if (!selector) return undefined
    if (selected.length !== 1 || query.getAll(selector).length !== 1) return fail(request, 400)
    const value = query.get(selector)
    const operation = selector === "asset" ? "files.asset.download"
      : selector === "asset-link" ? "files.asset.link"
      : selector === "upload" && value && ["contract", "quote", "signed-po", "supplier"].includes(value)
        ? "files.asset.upload"
        : fixed.get(selector + "=" + value)
    if (!operation) return undefined

    const metadata = SfFileRoutes[operation]
    if (metadata.pathTemplate !== "{mount}/{surface}") return fail(request, 503)
    // The existing application handles HEAD for its GET assets and exports.
    if (request.method === "HEAD" && metadata.method === "GET" &&
      (selector === "asset" || selector === "asset-link" || selector === "download")) return undefined
    if (metadata.method !== request.method) return fail(request, 405, { Allow: metadata.method })
    // Original producers keep ownership of access, redaction, streamed byte caps and revalidation.
    return bound[operation](request, surface)
  }
  applicationSources.set(route, () => {
    const producer = sources.application
    const application = producer && readSfApplicationSource(producer)
    return input.sources === sources && producer && application
      ? { producer, application, origin: input.origin, mount: input.mount } : undefined
  })
  return route
}
