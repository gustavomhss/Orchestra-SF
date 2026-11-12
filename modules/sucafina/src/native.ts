import type { ModuleServices } from "../Sucafinav1/index.ts"

/** Same transactional business boundary, with JSON for the native Orchestra client. No listener. */
export function createNativeGateway(mount: string, _services: ModuleServices) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(mount)) throw new Error("Invalid module mount")
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return undefined
    return new Response("Native Sucafina gateway is awaiting integration.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }
}
