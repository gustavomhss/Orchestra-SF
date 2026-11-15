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
const METADATA: Readonly<Record<string, OperationMetadata>> = SfOperationRegistry
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const CONTROL = /[\x00-\x1f\x7f]/
const KEY = /^[A-Za-z0-9._:-]{8,128}$/
const allowedSurface = (v: unknown): v is "dashboard" | "planner" | "procurement" =>
  v === "dashboard" || v === "planner" || v === "procurement"

export type SfRequestPlan = Readonly<{
  url: string
  method: "GET" | "POST"
  mode: "json" | "bytes" | "empty"
  effect: OperationMetadata["effect"]
  body?: Uint8Array
  headers: Readonly<Record<string, string>>
  operationId: string
  codec: NonNullable<SfOperationBindings[keyof SfOperationBindings]>
}>
export type SfPlanResult = Readonly<{ status: "ok"; value: SfRequestPlan }> |
  Readonly<{ status: "contract-unavailable" | "invalid-response" }>

/** Transport URL is built exclusively from frozen registry metadata + decoded, validated input. */
export function planSfOperation(input: Readonly<{
  request: Extract<SfDesktopInvocation, { kind: "request" }>
  descriptor: SfInstallationDescriptor
  operations: SfOperationBindings
  principalRef?: string
}>): SfPlanResult {
  const meta = METADATA[input.request.operationId]
  const codec = input.operations[input.request.operationId]
  if (!meta || !codec || meta.responseMode === "navigation") return { status: "contract-unavailable" }
  const decoded = codec.decodeInput(input.request.input)
  if (decoded.status !== "ok") return { status: "invalid-response" }
  const data = decoded.value
  if (data !== undefined && !isRecord(data)) return { status: "invalid-response" }
  const parsed = data as Record<string, unknown> | undefined
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(meta.fixedQuery ?? {})) {
    if (!key || CONTROL.test(key) || CONTROL.test(value)) return { status: "contract-unavailable" }
    query.set(key, value)
  }
  const template = meta.pathTemplate.replaceAll("{mount}", input.descriptor.mount)
  const tokens = Array.from(template.matchAll(/\{([^{}]+)\}/g), (match) => match[1])
  const resolved = tokens.reduce<string | undefined>((path, token) => {
    if (path === undefined) return undefined
    const value = token === "surface" ? parsed?.surface : parsed?.[token]
    if (token === "surface" && !allowedSurface(value)) return undefined
    if (typeof value !== "string" || !value || value.length > 2048 || CONTROL.test(value)) return undefined
    return path.replace("{" + token + "}", encodeURIComponent(value))
  }, template)
  if (!resolved || /[{}?#\\]/.test(resolved) || !resolved.startsWith("/") || /(?:^|\/)\.\.(?:\/|$)/.test(resolved))
    return { status: "contract-unavailable" }
  const base = new URL(input.descriptor.publicOrigin)
  if (base.pathname !== "/" || base.search || base.hash || base.username || base.password) return { status: "contract-unavailable" }
  const target = new URL(resolved, base)
  if (target.origin !== base.origin || target.hash || target.username || target.password) return { status: "contract-unavailable" }

  // Only typed, schema-decoded query data is allowed. There is no caller-supplied URL/headers.
  const typedQuery = parsed?.query
  if (typedQuery !== undefined && !isRecord(typedQuery)) return { status: "invalid-response" }
  if (input.request.operationId === "ctx.installations") {
    if (!parsed || (parsed.select !== "ids" && parsed.select !== "location")) return { status: "invalid-response" }
    query.set("select", parsed.select)
    if (parsed.select === "ids") {
      if (typeof parsed.installationId !== "string" || typeof parsed.projectId !== "string") return { status: "invalid-response" }
      query.set("installationId", parsed.installationId)
      query.set("projectId", parsed.projectId)
    } else {
      if (!isRecord(parsed.location) || typeof parsed.location.directory !== "string") return { status: "invalid-response" }
      query.set("location[directory]", parsed.location.directory)
      if (typeof parsed.location.workspace === "string") query.set("location[workspace]", parsed.location.workspace)
    }
  } else if (input.request.operationId === "ctx.context") {
    for (const name of ["installationId", "projectId", "hostId"]) {
      if (typeof parsed?.[name] !== "string") return { status: "invalid-response" }
      query.set(name, parsed[name] as string)
    }
  } else {
    // Read-only source DTOs are explicitly query-only; writes use typed body plus optional typed query.
    const values = meta.method === "GET" ? (typedQuery ?? parsed) : typedQuery
    if (values && isRecord(values)) {
      for (const [key, value] of Object.entries(values)) {
        if (key === "surface" || tokens.includes(key) || key === "query" || key === "body") continue
        if (!key || CONTROL.test(key) || query.has(key) || !/^[A-Za-z0-9_.\[\]-]{1,128}$/.test(key))
          return { status: "invalid-response" }
        if ((typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
          || !String(value) || CONTROL.test(String(value))) return { status: "invalid-response" }
        query.set(key, String(value))
      }
    }
  }
  const search = query.toString()
  const url = target.href + (search ? "?" + search : "")
  if (url.length > 16_384) return { status: "invalid-response" }
  const headers: Record<string, string> = { Accept: meta.responseMode === "bytes" ? "application/octet-stream" : "application/json" }
  let bytes: Uint8Array | undefined
  if (meta.method === "POST") {
    const key = input.request.idempotencyKey ?? randomUUID()
    if (!KEY.test(key)) return { status: "invalid-response" }
    headers["Idempotency-Key"] = key
    headers.Origin = input.descriptor.publicOrigin
    if (meta.effect === "mutation" && /^domain\.command\./.test(input.request.operationId)) {
      if (!input.principalRef) return { status: "contract-unavailable" }
      const owner = {
        installationId: input.descriptor.installationId,
        hostId: input.descriptor.hostId,
        projectId: input.descriptor.projectId,
        principalRef: input.principalRef,
      }
      const nativeOwner = Buffer.from(JSON.stringify(owner), "utf8")
      if (nativeOwner.byteLength > 2048) return { status: "invalid-response" }
      headers["X-SF-Native-Owner"] = nativeOwner.toString("base64url")
    }
    const body = parsed?.body ?? data
    if (input.request.upload) {
      if (input.request.operationId !== "files.import-admit" && input.request.operationId !== "files.asset.upload")
        return { status: "contract-unavailable" }
      const upload = input.request.upload
      if (!upload || typeof upload.fileName !== "string" || typeof upload.mediaType !== "string"
        || /[\/\\\x00-\x1f]/.test(upload.fileName) || upload.fileName.length > 255
        || !(upload.bytes instanceof Uint8Array) || upload.bytes.byteLength < 1
        || upload.bytes.byteLength > (meta.maxRequestBytes ?? 16 * 1024 * 1024)) return { status: "invalid-response" }
      if (input.request.operationId === "files.import-admit") {
        const extension = upload.fileName.split(".").pop()?.toLowerCase()
        if (!extension || !["xlsx", "xls", "json"].includes(extension) || upload.bytes.byteLength > 16 * 1024 * 1024)
          return { status: "invalid-response" }
        const boundary = "sf-" + randomUUID().replaceAll("-", "")
        const fields = body && isRecord(body) ? body : undefined
        if (!fields || typeof fields.surface !== "string" || typeof fields.selectionRef !== "string") return { status: "invalid-response" }
        if (!allowedSurface(fields.surface) || !("options" in fields)) return { status: "invalid-response" }
        const encode = (v: string) => Buffer.from(v, "utf8")
        const pieces: Buffer[] = []
        for (const [key, value] of Object.entries(fields)) {
          if (!["surface", "selectionRef", "options"].includes(key)) return { status: "invalid-response" }
          pieces.push(encode("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + key + "\"\r\n\r\n" + (typeof value === "string" ? value : JSON.stringify(value)) + "\r\n"))
        }
        pieces.push(encode("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + upload.fileName.replaceAll('"', "_") + "\"\r\nContent-Type: " + upload.mediaType + "\r\n\r\n"))
        pieces.push(Buffer.from(upload.bytes))
        pieces.push(encode("\r\n--" + boundary + "--\r\n"))
        bytes = Buffer.concat(pieces)
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
        if (bytes.byteLength > 16 * 1024 * 1024 + 65536) return { status: "invalid-response" }
      } else {
        // Asset upload uses original approved binary media type, not a second untrusted URL/path.
        if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(upload.mediaType))
          return { status: "invalid-response" }
        bytes = upload.bytes
        headers["Content-Type"] = upload.mediaType
      }
    } else if (body !== undefined && meta.responseMode !== "empty") {
      bytes = Buffer.from(JSON.stringify({ ...((isRecord(body) ? body : {}) as Record<string, unknown>), ...(meta.fixedBodyDiscriminator ?? {}) }), "utf8")
      headers["Content-Type"] = "application/json"
    } else if (meta.fixedBodyDiscriminator) {
      bytes = Buffer.from(JSON.stringify(meta.fixedBodyDiscriminator), "utf8")
      headers["Content-Type"] = "application/json"
    }
    if (bytes && bytes.byteLength > (meta.maxRequestBytes ?? (input.request.upload ? 16 * 1024 * 1024 + 65536 : 2 * 1024 * 1024)))
      return { status: "invalid-response" }
  } else if (input.request.upload || input.request.idempotencyKey) return { status: "invalid-response" }
  return { status: "ok", value: {
    url, method: meta.method, mode: meta.responseMode, effect: meta.effect, body: bytes,
    headers, operationId: input.request.operationId, codec,
  } }
}

/** Only Schema-supplied codecs decode this body. A raw JSON parse is never product acceptance. */
export function decodeSfWireBody(plan: SfRequestPlan, bytes: Uint8Array) {
  if (plan.mode === "empty" && bytes.byteLength === 0) return plan.codec.decodeOutput(undefined)
  if (plan.mode !== "json" && plan.mode !== "empty") return { status: "invalid" as const }
  if (bytes.byteLength > 4 * 1024 * 1024) return { status: "invalid" as const }
  let value: SfJson
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as SfJson
  } catch {
    return { status: "invalid" as const }
  }
  return plan.codec.decodeOutput(value)
}
