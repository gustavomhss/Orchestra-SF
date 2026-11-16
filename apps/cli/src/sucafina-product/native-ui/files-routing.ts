import type { SfFilesOperationId } from "@orchestra/schema/sucafina/files"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { createSfFilesHostBindings, type SfFilesHostSources, type SfFilesSurface } from "./files"

/**
 * I00 only: dispatch to ORIGINAL sources with the untouched authenticated Request.
 * No new HTTP path, no rewritten URL, no generic upload/download proxy.
 * Factories inject the actual producer callbacks from the installed product.
 */
const sfModes: Readonly<Record<string, SfFilesOperationId>> = Object.freeze({
  "import-targets": "files.import-targets",
  "import-reference": "files.import-reference",
  "import-detail": "files.import-detail",
  "import-admit": "files.import-admit",
  "import-preview": "files.import-preview",
  "import-apply": "files.import-apply",
  "document-requests": "files.document-requests",
  "document-search": "files.document-search",
  "document-open": "files.document-open",
  "document-schemas": "files.document-schemas",
  "document-schema": "files.document-schema",
  "document-sources": "files.document-sources",
  "document-admit": "files.document-admit",
  "document-extract": "files.document-extract",
  "document-confirm": "files.document-confirm",
  "document-candidates": "files.document-candidates",
  "document-scenario-targets": "files.document-scenario-targets",
  "document-scenario-preview": "files.document-scenario-preview",
})
const downloads: Readonly<Record<string, SfFilesOperationId>> = Object.freeze({
  xlsx: "files.export.xlsx", suppliers: "files.export.suppliers",
  register: "files.export.register", json: "files.export.json",
  members: "files.export.members",
})
const fail = (status: number) => Response.json({ status: "invalid" },
  { status, headers: { "Cache-Control": "no-store" } })

export function mountSfFilesOriginalRoutes(input: Readonly<{
  origin: string
  mount: string
  sources: SfFilesHostSources
}>): (request: Request) => Promise<Response | undefined> {
  const bound = createSfFilesHostBindings(input.sources)
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(input.mount) ||
      new URL(input.origin).origin !== input.origin) throw new Error("SF_A06_HOST_ROUTE_INVALID")
  return async (request) => {
    const url = new URL(request.url)
    const surface = url.pathname.slice(input.mount.length + 1)
    if (url.origin !== input.origin || url.pathname !== input.mount + "/" + surface ||
        !["dashboard", "planner", "procurement"].includes(surface)) return undefined
    const selector = url.searchParams
    const keys = ["sf", "download", "asset", "asset-link", "upload"]
    const picked = keys.filter((key) => selector.has(key))
    if (picked.length === 0) return undefined
    if (picked.length !== 1 || selector.getAll(picked[0]!).length !== 1)
      return fail(400)
    let operation: SfFilesOperationId | undefined
    if (picked[0] === "sf") operation = sfModes[selector.get("sf") ?? ""]
    if (picked[0] === "download") operation = downloads[selector.get("download") ?? ""]
    if (picked[0] === "asset") operation = "files.asset.download"
    if (picked[0] === "asset-link") operation = "files.asset.link"
    if (picked[0] === "upload") {
      operation = ["contract", "quote", "signed-po", "supplier"].includes(selector.get("upload") ?? "")
        ? "files.asset.upload" : undefined
    }
    if (!operation) return undefined
    const metadata = SfOperationRegistry[operation]
    if (!metadata || metadata.pathTemplate !== "{mount}/{surface}") return fail(503)
    if (metadata.method !== request.method) return fail(405)
    // Original source remains authoritative for owner, role, field, version,
    // MIME, signed ref, limited body and post-revocation egress checks.
    return bound[operation](request, surface as SfFilesSurface)
  }
}
