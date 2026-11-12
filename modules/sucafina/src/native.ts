import { createModule, type ModuleServices } from "../Sucafinav1/index.ts"

/** Same transactional business boundary, with JSON for the native Orchestra client. No listener. */
export function createNativeGateway(mount: string, services: ModuleServices) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(mount)) throw new Error("Invalid module mount")
  const business = createModule(mount, { ...services, presentation: "native" })
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return undefined
    const route = /^(dashboard|planner|procurement)\/(state|commands)$/.exec(url.pathname.slice(mount.length + 1))
    const surface = route?.[1]
    const action = route?.[2]
    if (!surface || (action !== "state" && action !== "commands")) return refused("Not found", 404)
    if (action === "state" && request.method !== "GET") return refused("Method not allowed", 405, { Allow: "GET" })
    if (action === "commands" && request.method !== "POST")
      return refused("Method not allowed", 405, { Allow: "POST" })
    // Legacy file transports are not native state or commands. Refuse before the business handler sees them.
    if (["download", "upload", "asset", "asset-link"].some((key) => url.searchParams.has(key)))
      return refused("Not found", 404)
    // Canonical /{surface} request. The body stream stays unread for the business transaction.
    const canonical = new URL(request.url)
    canonical.pathname = `${mount}/${surface}`
    const body = action === "commands" ? request.body : null
    return business(
      new Request(canonical.href, {
        method: request.method,
        headers: request.headers,
        body,
        signal: request.signal,
        ...(body ? { duplex: "half" as const } : {}),
      }),
    )
  }
}

function refused(body: string, status: number, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
  })
}
