import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfOperationIds } from "@orchestra/schema/sucafina/common"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { sfAllowedByteMime, sfIsByteOperation, SF_FILE_ASSET_LIMIT } from "@orchestra/client/sucafina/transport"
import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { mountSfFilesOriginalRoutes } from "../../../../../apps/cli/src/sucafina-product/native-ui/files-routing"
import { planSfOperation } from "../../../../../apps/desktop/src/main/sucafina/protocol"

test("members export has a closed dashboard-only source contract", () => {
  const operation = Reflect.get(SfFiles.operations, "files.export.members")
  expect(operation).toBeDefined()
  expect(operation.operationId).toBe("files.export.members")
  expect(SfOperationIds).toContain("files.export.members")
  expect(Reflect.get(SfNativeOperationBindings, "files.export.members")).toBeDefined()
  expect(sfIsByteOperation("files.export.members" as never)).toBe(true)
  expect(sfAllowedByteMime("files.export.members" as never,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true)
  expect(sfAllowedByteMime("files.export.members" as never, "text/html")).toBe(false)
  expect(Reflect.get(SfOperationRegistry, "files.export.members")).toEqual({
    method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
    responseMode: "bytes", fixedQuery: { download: "members" },
  })
  const decode = Schema.decodeUnknownOption(Schema.toType(operation.input), { onExcessProperty: "error" })
  expect(Option.isSome(decode({ surface: "dashboard" }))).toBe(true)
  expect(Option.isNone(decode({ surface: "planner" }))).toBe(true)
  expect(Option.isNone(decode({ surface: "dashboard", download: "json" }))).toBe(true)
})

test("client admits only dashboard members and delegates the original GET", async () => {
  const seen: string[] = []
  const transport: SfTransport = {
    async execute(operation) {
      seen.push(operation.operationId)
      return { kind: "transport-error", reason: "contract-unavailable" }
    },
  }
  const client = createSfFilesClient(transport)
  const options = { signal: new AbortController().signal }
  await client["files.export.members"]({ surface: "dashboard" }, options)
  expect(seen).toEqual(["files.export.members"])
  expect(await client["files.export.members"]({ surface: "planner" } as never, options)).toEqual({
    kind: "transport-error", reason: "contract-mismatch",
  })
  expect(await client["files.export.members"]({ surface: "dashboard", url: "https://evil.invalid" } as never, options)).toEqual({
    kind: "transport-error", reason: "contract-mismatch",
  })
  expect(seen).toEqual(["files.export.members"])

  const requests: Request[] = []
  const routes = mountSfFilesOriginalRoutes({
    origin: "https://installation.example", mount: "/sucafina",
    sources: { application: async (request) => { requests.push(request); return new Response("original") } },
  })
  const request = new Request("https://installation.example/sucafina/dashboard?download=members")
  expect(await (await routes(request))?.text()).toBe("original")
  expect(requests).toEqual([request])
})

test("desktop plans only the exact members source route through the installed codec", () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const request = {
    kind: "request" as const, requestId: "request-1", bindingHandle: "binding-1", generation: 1,
    operationId: "files.export.members" as const, input: { surface: "dashboard" },
  }
  const input = { request, descriptor, operations: SfNativeOperationBindings, principalRef: "person" }
  const plan = planSfOperation(input)
  expect(plan.status).toBe("ok")
  if (plan.status !== "ok") throw new Error("Members route unavailable")
  expect(plan.value.url).toBe("https://installation.example/sucafina/dashboard?download=members")
  expect(plan.value.method).toBe("GET")
  expect(plan.value.mode).toBe("bytes")
  expect(planSfOperation({ ...input, request: { ...request, input: { surface: "planner" } } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...input, request: { ...request, input: { surface: "dashboard", url: "https://evil.invalid" } } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...input, principalRef: undefined }).status).toBe("contract-unavailable")
})

test("desktop plans validated import metadata and file as separate multipart parts", async () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const options = { newVersion: false, removeMissing: false, preview: {} }
  const mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  const request = {
    kind: "request" as const, requestId: "request-1", bindingHandle: "binding-1", generation: 1,
    operationId: "files.import-admit" as const, idempotencyKey: "request-1234",
    input: { surface: "planner", selectionRef: "selection-1", options, fileName: "budget.xlsx", mediaType },
    upload: { fileName: "budget.xlsx", mediaType, bytes: new Uint8Array([1, 2, 3]) },
  }
  const input = { request, descriptor, operations: SfNativeOperationBindings, principalRef: "person" }
  const plan = planSfOperation(input)
  expect(plan.status).toBe("ok")
  if (plan.status !== "ok" || !plan.value.body) throw new Error("Import route unavailable")
  expect(plan.value.url).toBe("https://installation.example/sucafina/planner?sf=import-admit")
  expect(plan.value.method).toBe("POST")
  const form = await new Request(plan.value.url, { method: "POST", headers: plan.value.headers, body: new Uint8Array(plan.value.body) }).formData()
  expect([...form.keys()].sort()).toEqual(["file", "options", "selectionRef", "surface"])
  expect(form.get("surface")).toBe("planner")
  expect(form.get("selectionRef")).toBe("selection-1")
  expect(JSON.parse(String(form.get("options")))).toEqual(options)
  const file = form.get("file")
  if (!(file instanceof File)) throw new Error("Missing file part")
  expect(file.name).toBe("budget.xlsx")
  expect(file.type).toBe(mediaType)
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(request.upload.bytes)
  expect(planSfOperation({ ...input, request: { ...request, upload: undefined } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...input, request: { ...request, upload: { ...request.upload, fileName: "other.xlsx" } } }).status).toBe("invalid-response")
})

test("desktop plans asset link and upload with source-bound selectors", () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const common = { descriptor, operations: SfNativeOperationBindings, principalRef: "person" }
  const base = { kind: "request" as const, requestId: "request-1", bindingHandle: "binding-1", generation: 1 }
  const link = planSfOperation({ ...common, request: { ...base, operationId: "files.asset.link", input: { surface: "dashboard", assetId: "asset-1" } } })
  expect(link.status).toBe("ok")
  if (link.status !== "ok") throw new Error("Asset link unavailable")
  expect(link.value.url).toBe("https://installation.example/sucafina/dashboard?asset-link=asset-1")
  expect(link.value.method).toBe("GET")
  const bytes = new Uint8Array([1, 2, 3])
  const request = {
    ...base, operationId: "files.asset.upload" as const, idempotencyKey: "request-1234",
    input: { surface: "dashboard", upload: "contract", record: "contract-1", recordVersion: 0, name: "evidence.pdf", page: "Vendor Contracts", mediaType: "application/pdf" },
    upload: { fileName: "evidence.pdf", mediaType: "application/pdf", bytes },
  }
  const upload = planSfOperation({ ...common, request })
  expect(upload.status).toBe("ok")
  if (upload.status !== "ok") throw new Error("Asset upload unavailable")
  expect(upload.value.url).toBe("https://installation.example/sucafina/dashboard?upload=contract&record=contract-1&recordVersion=0&name=evidence.pdf&page=Vendor+Contracts")
  expect(upload.value.method).toBe("POST")
  expect(upload.value.headers["Content-Type"]).toBe("application/pdf")
  expect(upload.value.body).toEqual(bytes)
  expect(planSfOperation({ ...common, request: { ...request, upload: undefined } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...common, request: { ...request, upload: { ...request.upload, fileName: "other.pdf" } } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...common, request: { ...request, upload: { ...request.upload, mediaType: "text/plain" } } }).status).toBe("invalid-response")
  const atLimit = planSfOperation({ ...common, request: { ...request, upload: { ...request.upload, bytes: new Uint8Array(SF_FILE_ASSET_LIMIT) } } })
  if (atLimit.status !== "ok") throw new Error("Contract attachment at the Files limit was refused")
  expect(atLimit.value.body?.byteLength).toBe(SF_FILE_ASSET_LIMIT)
  expect(planSfOperation({ ...common, request: { ...request, upload: { ...request.upload, bytes: new Uint8Array(SF_FILE_ASSET_LIMIT + 1) } } }).status).toBe("invalid-response")
})

test("desktop serializes each reviewed document action for its original handler", () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const ref = { schema: "sf-evidence-v1", kind: "document", refId: "ref",
    installationId: "installation", projectId: "project", refDigest: "digest", evidenceLevel: "claim",
    target: { documentId: "doc", incarnation: "inc", revision: 1,
      blobDigest: { algorithm: "sha256", value: "digest" },
      segment: { start: 0, end: 2, unit: "utf16", textDigest: { algorithm: "sha256", value: "digest" } },
      fieldCandidateId: "candidate", confirmationVersion: 1 } }
  const evidence = { id: "candidate", fileRef: "doc", version: 1, location: "page 1",
    textRange: { start: 0, end: 2, unit: "utf16" }, fieldCandidate: "amount", value: 42, status: "extracted", ref }
  const reject = { action: "reject", evidence, reason: "Incorrect value", page: 1 }
  const link = { action: "link", documentRef: ref, baseRef: "base", targetRef: "target:1",
    period: { start: "2026-01-01", end: "2026-12-31" } }
  for (const [fields, expected] of [[{ evidence }, evidence], [reject, reject], [link, link]] as const) {
    const plan = planSfOperation({ descriptor, operations: SfNativeOperationBindings, principalRef: "person", request: {
      kind: "request", requestId: "request-1", bindingHandle: "binding-1", generation: 1,
      operationId: "files.document-confirm", idempotencyKey: "request-1234", input: { surface: "dashboard", ...fields },
    } })
    if (plan.status !== "ok" || !plan.value.body) throw new Error("Missing document request plan")
    expect(plan.value.url).toBe("https://installation.example/sucafina/dashboard?sf=document-confirm")
    expect(JSON.parse(new TextDecoder().decode(plan.value.body))).toEqual(expected)
  }
})
