import { randomUUID } from "node:crypto"
import { createWp06Runtime } from "../runtime-fixture.ts"
import { createSfImportServices } from "../../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfImportHttp } from "../../../../product/interface/import-http.ts"
import type { ImportManifest, Period } from "../../../../product/contracts/context.ts"
import type { ImportPreviewRequest } from "../../../../product/contracts/operations.ts"
import type { ImportTarget } from "../../../../product/imports/staged-files.ts"
import type { ImportDetail, ImportReceiptSummary } from "../../../../product/imports/store.ts"

export type ImportHttpChoice = { label: string; surface: "planner" | "dashboard"; selectionRef: string; formats: string[]; sheet?: string; period?: Period }

/** All operations cross the real CLI service, HTTP dispatcher and persisted authority. */
export async function createImportHttpFixture(surface: "planner" | "dashboard") {
  const app = await createWp06Runtime()
  const service = createSfImportServices({ runtime: app.runtime, authority: app.authority })
  if (!service) throw new Error("Import service not composed")
  const http = createSfImportHttp({ origin: app.origin, mount: "/sucafina", runtime: () => ({ ui: app.authority.ui, human: app.authority.human, service }) })
  const call = async (mode: string, payload?: unknown, query: Record<string, string> = {}, key = randomUUID(), cookie = app.cookie) => {
    const url = new URL(`${app.origin}/sucafina/${surface}`)
    url.searchParams.set("sf", mode)
    Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value))
    const response = await http(new Request(url, payload === undefined ? { headers: { cookie } } : {
      method: "POST", headers: { cookie, origin: app.origin, "Idempotency-Key": key, ...(payload instanceof FormData ? {} : { "Content-Type": "application/json" }) },
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    }), surface)
    if (!response) throw new Error("Import route missing")
    return response
  }
  const read = async <T>(response: Response): Promise<T> => {
    const result = await response.json() as { status: string; value: T; reason?: string }
    if (!response.ok || result.status !== "ok") throw new Error(`Import response ${response.status}: ${result.status} ${result.reason ?? ""}`)
    return result.value
  }
  const discover = async (period?: Period) => read<ImportHttpChoice[]>(await call("import-targets", undefined, { surface, ...(period ? { start: period.start, end: period.end } : {}) }))
  const admit = async (choice: ImportHttpChoice, bytes: Uint8Array, options: ImportTarget["options"], format: "xlsx" | "xls" | "json" = "xlsx", key = randomUUID()): Promise<ImportPreviewRequest> => {
    const form = new FormData()
    form.set("file", new File([new Uint8Array(bytes)], `import.${format}`))
    form.set("surface", choice.surface); form.set("selectionRef", choice.selectionRef)
    form.set("options", JSON.stringify(options))
    const file = await read<{ ref: string }>(await call("import-admit", form, {}, key))
    return { admittedFileRef: file.ref, format, options: structuredClone(options.preview) }
  }
  const preview = async (selection: ImportPreviewRequest, key = randomUUID()) => read<ImportManifest>(await call("import-preview", selection, {}, key))
  const detail = async (manifest: Pick<ImportManifest, "id" | "version">) => read<{ detail: ImportDetail; digest: string; receipt?: ImportReceiptSummary }>(await call("import-detail", undefined, { manifestId: manifest.id, version: String(manifest.version) }))
  const apply = async (manifest: Pick<ImportManifest, "id" | "version">, key = randomUUID()) => read<ImportManifest>(await call("import-apply", { manifestId: manifest.id, version: manifest.version }, {}, key))
  return { ...app, service, http, call, discover, admit, preview, detail, apply }
}
