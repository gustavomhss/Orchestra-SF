import { randomUUID } from "node:crypto"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfOperationBindings, SfJson } from "@orchestra/schema/sucafina/common"
import type { SfDesktopInvocation } from "@orchestra/client/sucafina/transport"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"

type OperationMetadata = Readonly<{
  method: "GET" | "POST"
  pathTemplate: string
  fixedQuery?: Readonly<Record<string, string>>
  fixedBodyDiscriminator?: Readonly<Record<string, string>>
  effect: "read" | "preview" | "prepare" | "mutation" | "authentication"
  responseMode: "json" | "bytes" | "empty" | "navigation"
  maxRequestBytes?: number
}>
const METADATA = SfOperationRegistry as Readonly<Record<string, OperationMetadata>>
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const CONTROL = /[\x00-\x1f\x7f]/
const KEY = /^[A-Za-z0-9._:-]{8,128}$/
const SURFACES = new Set(["dashboard", "planner", "procurement"])
const queryKey = (value: string) => /^[A-Za-z][A-Za-z0-9._\[\]-]*$/.test(value)
const jsonContentType = (value: string | undefined) => !!value && /^application\/json(?:\s*;[^\r\n]*)?$/i.test(value)

export type SfRequestPlan = Readonly<{
  url: string
  method: "GET" | "POST"
  mode: "json" | "bytes" | "empty"
  effect: OperationMetadata["effect"]
  mutating: boolean
  body?: Uint8Array
  headers: Readonly<Record<string, string>>
  operationId: string
  codec: NonNullable<SfOperationBindings[keyof SfOperationBindings]>
}>
export type SfPlanResult = Readonly<{ status: "ok"; value: SfRequestPlan }> |
  Readonly<{ status: "contract-unavailable" | "invalid-response" }>

/** Match F02's canonical operationUrl/operationBody decisions; all data first crosses a typed codec. */
export function planSfOperation(input: Readonly<{
  request: Extract<SfDesktopInvocation, { kind: "request" }>
  descriptor: SfInstallationDescriptor
  operations: SfOperationBindings
  principalRef?: string
}>): SfPlanResult {
  const operationId = input.request.operationId
  const meta = METADATA[operationId]
  const codec = input.operations[operationId]
  if (!meta || !codec || meta.effect === "authentication" || meta.responseMode === "navigation"
    || operationId === "ctx.installations") return { status: "contract-unavailable" }
  let decoded
  try { decoded = codec.decodeInput(input.request.input) } catch { return { status: "invalid-response" } }
  if (decoded.status !== "ok") return { status: "invalid-response" }
  if (decoded.value !== undefined && !isRecord(decoded.value)) return { status: "invalid-response" }
  const source = decoded.value as Record<string, unknown> | undefined
  if (operationId === "ctx.context" && (source === undefined
    || Object.keys(source).length !== 3 || source.installationId !== input.descriptor.installationId
    || source.projectId !== input.descriptor.projectId || source.hostId !== input.descriptor.hostId))
    return { status: "invalid-response" }

  if (!meta.pathTemplate.startsWith("/") && !meta.pathTemplate.startsWith("{mount}/"))
    return { status: "contract-unavailable" }
  const usesSurface = meta.pathTemplate.includes("{surface}")
  if (usesSurface && !SURFACES.has(String(source?.surface))) return { status: "invalid-response" }
  const path = meta.pathTemplate.replaceAll("{mount}", input.descriptor.mount)
    .replaceAll("{surface}", String(source?.surface ?? "__unbound__"))
  if (path.includes("{") || path.includes("}") || path.includes("__unbound__")
    || path.includes("//") || path.includes("..") || !path.startsWith(input.descriptor.mount + "/"))
    return { status: "contract-unavailable" }
  let target: URL
  try {
    target = new URL(path, input.descriptor.publicOrigin)
    if (target.origin !== input.descriptor.publicOrigin || target.pathname !== path || target.search || target.hash
      || target.username || target.password) return { status: "contract-unavailable" }
  } catch { return { status: "contract-unavailable" } }
  for (const [key, value] of Object.entries(meta.fixedQuery ?? {})) {
    if (!queryKey(key) || CONTROL.test(value)) return { status: "contract-unavailable" }
    target.searchParams.set(key, value)
  }
  if (meta.method === "GET" && source) {
    for (const [key, value] of Object.entries(source)) {
      if (usesSurface && key === "surface") continue
      if (!queryKey(key) || target.searchParams.has(key)) return { status: "invalid-response" }
      if (typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value))
        target.searchParams.set(key, String(value))
      else return { status: "invalid-response" }
    }
  }
  if (target.href.length > 16_384) return { status: "invalid-response" }

  const mutating = meta.method === "POST" && meta.effect !== "read" && meta.effect !== "preview"
  const headers: Record<string, string> = { Accept: meta.responseMode === "bytes" ? "application/octet-stream" : "application/json" }
  let body: Uint8Array | undefined
  const mode: "json" | "bytes" | "empty" = meta.responseMode
  if (meta.method === "POST") {
    // F02 owns creation and lifecycle of each key; broker never silently creates a retryable mutation.
    if (!input.request.idempotencyKey || !KEY.test(input.request.idempotencyKey))
      return { status: "invalid-response" }
    headers["Idempotency-Key"] = input.request.idempotencyKey
    headers.Origin = input.descriptor.publicOrigin
    const legacy = mutating && /\{surface\}|\/dashboard$|\/planner$|\/procurement$/.test(meta.pathTemplate)
    if (legacy) {
      if (!input.principalRef || CONTROL.test(input.principalRef)) return { status: "contract-unavailable" }
      const owner = Buffer.from(JSON.stringify({
        installationId: input.descriptor.installationId, hostId: input.descriptor.hostId,
        projectId: input.descriptor.projectId, principalRef: input.principalRef,
      }), "utf8")
      if (owner.byteLength > 2048) return { status: "invalid-response" }
      headers["X-SF-Native-Owner"] = owner.toString("base64url")
    }
    const original = source && usesSurface
      ? Object.fromEntries(Object.entries(source).filter(([key]) => key !== "surface"))
      : source
    const fixed = meta.fixedBodyDiscriminator ?? {}
    if (original && Object.entries(fixed).some(([key, value]) => key in original && original[key] !== value))
      return { status: "invalid-response" }
    const value: Record<string, unknown> = { ...(original ?? {}), ...fixed }
    const upload = input.request.upload
    if (upload) {
      if (operationId !== "files.import-admit" && operationId !== "files.asset.upload")
        return { status: "contract-unavailable" }
      if (typeof upload.fileName !== "string" || !upload.fileName || upload.fileName.length > 255
        || /[\/\\\x00-\x1f\x7f"]/.test(upload.fileName)
        || typeof upload.mediaType !== "string" || !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(upload.mediaType)
        || !(upload.bytes instanceof Uint8Array) || upload.bytes.byteLength === 0)
        return { status: "invalid-response" }
      const limit = meta.maxRequestBytes ?? 16 * 1024 * 1024
      if (upload.bytes.byteLength > limit) return { status: "invalid-response" }
      if (operationId === "files.import-admit") {
        const ext = upload.fileName.split(".").pop()?.toLowerCase()
        const formFields = { ...value, surface: source?.surface }
        if (!ext || !["xlsx", "xls", "json"].includes(ext) || upload.bytes.byteLength > 16 * 1024 * 1024
          || typeof formFields.surface !== "string" || !SURFACES.has(formFields.surface)
          || typeof formFields.selectionRef !== "string" || !("options" in formFields))
          return { status: "invalid-response" }
        const boundary = "sf-" + randomUUID().replaceAll("-", "")
        const pieces: Buffer[] = []
        for (const [name, field] of Object.entries(formFields)) {
          if (!["surface", "selectionRef", "options"].includes(name)) return { status: "invalid-response" }
          pieces.push(Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name
            + "\"\r\n\r\n" + (typeof field === "string" ? field : JSON.stringify(field)) + "\r\n"))
        }
        pieces.push(Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\""
          + upload.fileName + "\"\r\nContent-Type: " + upload.mediaType + "\r\n\r\n"))
        pieces.push(Buffer.from(upload.bytes))
        pieces.push(Buffer.from("\r\n--" + boundary + "--\r\n"))
        body = Buffer.concat(pieces)
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
        if (body.byteLength > 16 * 1024 * 1024 + 65_536) return { status: "invalid-response" }
      } else {
        body = upload.bytes
        headers["Content-Type"] = upload.mediaType
      }
    } else {
      body = Buffer.from(JSON.stringify(value), "utf8")
      headers["Content-Type"] = "application/json"
    }
    if (meta.maxRequestBytes !== undefined && body.byteLength > meta.maxRequestBytes)
      return { status: "invalid-response" }
    if (meta.maxRequestBytes === undefined && body.byteLength > (input.request.upload ? 16 * 1024 * 1024 + 65536 : 2 * 1024 * 1024))
      return { status: "invalid-response" }
  } else if (input.request.upload || input.request.idempotencyKey) return { status: "invalid-response" }
  return { status: "ok", value: {
    url: target.href, method: meta.method, mode, effect: meta.effect, mutating,
    body, headers, operationId, codec,
  } }
}

export function decodeSfWireBody(plan: SfRequestPlan, bytes: Uint8Array, contentType?: string) {
  if (plan.mode === "empty")
    return bytes.byteLength === 0 && contentType === undefined
      ? plan.codec.decodeOutput(undefined) : { status: "invalid" as const }
  if (plan.mode !== "json" || !jsonContentType(contentType) || bytes.byteLength === 0 || bytes.byteLength > 32 * 1024 * 1024)
    return { status: "invalid" as const }
  let value: SfJson
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as SfJson
  } catch { return { status: "invalid" as const } }
  try { return plan.codec.decodeOutput(value) } catch { return { status: "invalid" as const } }
}
