import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { Period } from "../contracts/context.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import type { createSfImportHost } from "../imports/host.ts"
import type { ImportTarget } from "../imports/staged-files.ts"
import { renderSfImportWorkbench } from "../imports/workbench.ts"

type ImportHost = Pick<ReturnType<typeof createSfImportHost>, "admit" | "readPreviewReference" | "detail" | "apply">
export type ImportService = {
  discover: (surface: "planner" | "dashboard", context: TrustedDomainContext, period?: Period) => Promise<PortResult<readonly { label: string; surface: "planner" | "dashboard"; selectionRef: string; formats: string[]; sheet?: string; period?: Period }[]>>
  imports: ImportHost
  prepareTarget: (selection: { surface: "planner" | "dashboard"; selectionRef: string; options: ImportTarget["options"] }, context: TrustedDomainContext) => Promise<PortResult<ImportTarget>>
  dispatch: (payload: unknown, context: TrustedDomainContext) => Promise<CapabilityResult>
}
export type ImportHttpLimits = {
  maxConcurrentIntakes?: number
  intakeTimeoutMs?: number
  maxMultipartParts?: number
  maxSelectionRefLength?: number
  maxFileNameLength?: number
}

const importFileLimit = 16 * 1024 * 1024
const importEnvelopeLimit = importFileLimit + 64 * 1024
const defaultImportHttpLimits = Object.freeze({
  maxConcurrentIntakes: 2,
  intakeTimeoutMs: 60_000,
  maxMultipartParts: 8,
  maxSelectionRefLength: 2_048,
  maxFileNameLength: 255,
})

/** Human transport only: selection identifiers are resolved under the current actor before file admission. */
export function createSfImportHttp(input: {
  origin: string
  mount: string
  runtime: () => { ui: ReturnType<typeof createSfUiAuthority>; human: ReturnType<typeof createSfHumanAuthority>; service: ImportService } | undefined
  limits?: ImportHttpLimits
}) {
  const limits = {
    maxConcurrentIntakes: input.limits?.maxConcurrentIntakes ?? defaultImportHttpLimits.maxConcurrentIntakes,
    intakeTimeoutMs: input.limits?.intakeTimeoutMs ?? defaultImportHttpLimits.intakeTimeoutMs,
    maxMultipartParts: input.limits?.maxMultipartParts ?? defaultImportHttpLimits.maxMultipartParts,
    maxSelectionRefLength: input.limits?.maxSelectionRefLength ?? defaultImportHttpLimits.maxSelectionRefLength,
    maxFileNameLength: input.limits?.maxFileNameLength ?? defaultImportHttpLimits.maxFileNameLength,
  }
  if (!Object.values(limits).every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Invalid import HTTP limits")
  let activeIntakes = 0

  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!mode || !["imports", "import-reference", "import-targets", "import-admit", "import-preview", "import-detail", "import-apply"].includes(mode)) return undefined
    const reply = (value: unknown, status: number, headers: Record<string, string> = {}) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } })
    if (url.origin !== input.origin || !["dashboard", "planner", "procurement"].includes(surface) || url.pathname !== `${input.mount}/${surface}`) return reply({ status: "denied" }, 403)
    const read = mode === "imports" || mode === "import-reference" || mode === "import-detail" || mode === "import-targets"
    if (request.method !== (read ? "GET" : "POST")) return reply({ status: "denied" }, 405)
    if (!read && (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site")) return reply({ status: "denied" }, 403)
    const keys = mode === "imports" || mode === "import-reference" ? ["sf", "importPreviewRef"] : mode === "import-detail" ? ["sf", "manifestId", "version"] : mode === "import-targets" ? ["sf", "surface", "start", "end"] : ["sf"]
    if ([...url.searchParams.keys()].some((key) => !keys.includes(key) || url.searchParams.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable" }, 503)
    const status = (result: { status: string }) => result.status === "denied" ? 403 : result.status === "stale" || result.status === "conflict" ? 409 : result.status === "needs-input" ? 400 : 503
    if (mode === "import-reference") {
      const ref = url.searchParams.get("importPreviewRef")
      if (!ref?.trim() || ref.length > 512) return reply({ status: "invalid" }, 400)
      const digest = digestSfValue({ importPreviewRef: ref })
      const admitted = await runtime.ui.admit(request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_import_preview", digest)) return reply({ status: "denied" }, 403)
        const result = await runtime.service.imports.readPreviewReference(ref, admitted.value)
        return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status }, status(result))
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "imports") {
      if (surface !== "planner" && surface !== "dashboard") return reply({ status: "denied" }, 403)
      const digest = digestSfValue({ purpose: "import-workbench", surface })
      const admitted = await runtime.ui.admit(request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_import_preview", digest) || !await runtime.ui.revalidate(admitted.value)) return reply({ status: "denied" }, 403)
        return renderSfImportWorkbench(surface)
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "import-targets") {
      const selected = url.searchParams.get("surface"), start = url.searchParams.get("start"), end = url.searchParams.get("end")
      const period = start && end ? { start, end } : undefined
      if ((selected !== "planner" && selected !== "dashboard") || (!!start !== !!end) || (period && !isSfPeriod(period))) return reply({ status: "invalid" }, 400)
      const digest = digestSfValue({ surface: selected, ...(period ? { period } : {}) })
      const admitted = await runtime.ui.admit(request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_import_preview", digest)) return reply({ status: "denied" }, 403)
        const result = await runtime.service.discover(selected, admitted.value, period)
        return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status }, status(result))
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (mode === "import-admit") {
      const contentType = request.headers.get("content-type")
      if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) return reply({ status: "invalid" }, 400)
      const intake = { purpose: "import-admit-intake", surface }
      const intakeAdmission = await runtime.human.admit(request, "imports.admit", intake)
      if (intakeAdmission.status !== "ok") return reply({ status: intakeAdmission.status }, 403)
      try {
        if (!await runtime.human.authorize(intakeAdmission.value, "imports.admit", intake)) return reply({ status: "denied" }, 403)
      } finally { runtime.human.finish(intakeAdmission.value) }

      if (activeIntakes >= limits.maxConcurrentIntakes) return reply({ status: "unavailable", reason: "import-intake-busy" }, 503, { "Retry-After": "1" })
      activeIntakes += 1
      try {
        const parsedForm = await readImportForm(request, contentType, limits.intakeTimeoutMs, limits.maxMultipartParts)
        if (parsedForm.status === "too-large") return reply({ status: "invalid" }, 413)
        if (parsedForm.status === "timeout") return reply({ status: "timeout" }, 408)
        if (parsedForm.status !== "ok") return reply({ status: "invalid" }, 400)
        const form = parsedForm.form
        if ([...form.keys()].some((key) => !["file", "surface", "selectionRef", "options"].includes(key) || form.getAll(key).length !== 1)) return reply({ status: "invalid" }, 400)
        const file = form.get("file"), targetSurface = form.get("surface"), selectionRef = form.get("selectionRef"), rawOptions = form.get("options")
        if (!(file instanceof File) || !file.size || file.size > importFileLimit || !file.name || file.name.length > limits.maxFileNameLength ||
          (targetSurface !== "planner" && targetSurface !== "dashboard") || typeof selectionRef !== "string" || !selectionRef.trim() || selectionRef.length > limits.maxSelectionRefLength ||
          typeof rawOptions !== "string" || rawOptions.length > 4096) return reply({ status: "invalid" }, 400)
        const format = /\.xlsx$/i.test(file.name) ? "xlsx" : /\.xls$/i.test(file.name) ? "xls" : /\.json$/i.test(file.name) ? "json" : undefined
        const options = parseImportOptions(rawOptions)
        if (!format || !options) return reply({ status: "invalid" }, 400)
        const selection: Pick<ImportTarget, "surface" | "selectionRef" | "options"> = { surface: targetSurface, selectionRef, options }
        const selectionDigest = digestSfValue(selection)
        const admitted = await runtime.ui.admit(request, "sf_import_preview", selectionDigest)
        if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
        const target = await (async () => {
          try {
            if (!await runtime.ui.validate(admitted.value, "sf_import_preview", selectionDigest)) return { status: "denied" as const, reason: "authority-unavailable" }
            return await runtime.service.prepareTarget(selection, admitted.value)
          } finally { runtime.ui.finish(admitted.value) }
        })()
        if (target.status !== "ok") return reply({ status: target.status }, status(target))
        const fileBytes = new Uint8Array(await file.arrayBuffer())
        const payload = { target: target.value, format, digest: new Bun.CryptoHasher("sha256").update(fileBytes).digest("hex") }
        const human = await runtime.human.admit(request, "imports.admit", payload)
        if (human.status !== "ok") return reply({ status: human.status }, 403)
        try {
          const result = await runtime.service.imports.admit({ target: target.value, format, bytes: fileBytes }, human.value)
          return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status }, status(result))
        } finally { runtime.human.finish(human.value) }
      } finally { activeIntakes -= 1 }
    }
    if (read) {
      const id = url.searchParams.get("manifestId"), version = Number(url.searchParams.get("version"))
      if (!id || !Number.isSafeInteger(version) || version < 1) return reply({ status: "invalid" }, 400)
      const payload = { manifestId: id, version }
      const digest = digestSfValue(payload)
      const admitted = await runtime.ui.admit(request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_import_preview", digest)) return reply({ status: "denied" }, 403)
        const result = await runtime.service.imports.detail(payload, admitted.value)
        return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status }, status(result))
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "invalid" }, 400)
    const body = await bounded(request, 65536)
    if (body.status === "too-large") return reply({ status: "invalid" }, 413)
    if (body.status !== "ok") return reply({ status: "invalid" }, 400)
    const payload: unknown = await Promise.resolve().then(() => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body.bytes))).catch(() => undefined)
    if (mode === "import-preview") {
      const parsed = decodeSfOperationInput("sf_import_preview", payload)
      if (!parsed.ok) return reply({ status: "invalid" }, 400)
      const digest = digestSfValue(parsed.value)
      const admitted = await runtime.ui.admit(request, "sf_import_preview", digest)
      if (admitted.status !== "ok") return reply({ status: admitted.status }, 403)
      try {
        const result = await runtime.service.dispatch(parsed.value, admitted.value)
        return result.status === "ok" ? reply({ status: "ok", value: result.result, receipt: result.receipt }, 200) : reply({ status: result.status }, status(result))
      } finally { runtime.ui.finish(admitted.value) }
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !["manifestId", "version"].includes(key)) || !("manifestId" in payload) || typeof payload.manifestId !== "string" || !payload.manifestId || !("version" in payload) || !Number.isSafeInteger(payload.version) || Number(payload.version) < 1) return reply({ status: "invalid" }, 400)
    const apply = { manifestId: payload.manifestId, version: Number(payload.version) }
    const human = await runtime.human.admit(request, "imports.apply", apply)
    if (human.status !== "ok") return reply({ status: human.status }, 403)
    try {
      const result = await runtime.service.imports.apply(apply, human.value)
      return result.status === "ok" ? reply({ status: "ok", value: result.value }, 200) : reply({ status: result.status }, status(result))
    } finally { runtime.human.finish(human.value) }
  }
}

function parseImportOptions(raw: string): ImportTarget["options"] | undefined {
  const value: unknown = (() => { try { return JSON.parse(raw) } catch { return undefined } })()
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["newVersion", "removeMissing", "preview"].includes(key)) || !("newVersion" in value) || typeof value.newVersion !== "boolean" || !("removeMissing" in value) || typeof value.removeMissing !== "boolean" || !("preview" in value) || !value.preview || typeof value.preview !== "object" || Array.isArray(value.preview) || Object.keys(value.preview).some((key) => !["sheet", "replace", "headerRow"].includes(key))) return undefined
  const preview = value.preview
  const sheet = "sheet" in preview ? preview.sheet : undefined
  const replace = "replace" in preview ? preview.replace : undefined
  const headerRow = "headerRow" in preview ? preview.headerRow : undefined
  if ((sheet !== undefined && typeof sheet !== "string") || (replace !== undefined && typeof replace !== "boolean") || (headerRow !== undefined && (typeof headerRow !== "number" || !Number.isSafeInteger(headerRow) || headerRow !== 1))) return undefined
  return {
    newVersion: value.newVersion,
    removeMissing: value.removeMissing,
    preview: {
      ...(sheet !== undefined ? { sheet } : {}),
      ...(replace !== undefined ? { replace } : {}),
      ...(headerRow !== undefined ? { headerRow } : {}),
    },
  }
}

type ImportFormResult = { status: "ok"; form: FormData } | { status: "invalid" } | { status: "too-large" } | { status: "timeout" }

async function readImportForm(request: Request, contentType: string, timeoutMs: number, maxParts: number): Promise<ImportFormResult> {
  const body = await bounded(request, importEnvelopeLimit, timeoutMs)
  if (body.status !== "ok") return body
  const boundary = multipartBoundary(contentType)
  if (!boundary || !withinMultipartPartLimit(body.bytes, boundary, maxParts)) return { status: "invalid" }
  const requestBody = new ArrayBuffer(body.bytes.byteLength)
  new Uint8Array(requestBody).set(body.bytes)
  const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: requestBody }).formData().catch(() => undefined)
  return form ? { status: "ok", form } : { status: "invalid" }
}

function multipartBoundary(contentType: string) {
  const match = /(?:^|;)\s*boundary=(?:"([^"\r\n]{1,70})"|([^;\s\r\n]{1,70}))(?=\s*(?:;|$))/i.exec(contentType)
  const boundary = match?.[1] ?? match?.[2]
  return boundary && boundary.trim() === boundary && /^[\x21-\x7e]+$/.test(boundary) && !boundary.includes(";") ? boundary : undefined
}

function withinMultipartPartLimit(bytes: Uint8Array, boundary: string, maxParts: number) {
  const marker = new TextEncoder().encode(`--${boundary}`)
  const prefix = new Uint32Array(marker.length)
  for (let index = 1, matched = 0; index < marker.length; index++) {
    while (matched > 0 && marker[index] !== marker[matched]) matched = prefix[matched - 1]!
    if (marker[index] === marker[matched]) matched += 1
    prefix[index] = matched
  }
  let matched = 0, parts = 0, closed = false
  for (let index = 0; index < bytes.length; index++) {
    while (matched > 0 && bytes[index] !== marker[matched]) matched = prefix[matched - 1]!
    if (bytes[index] === marker[matched]) matched += 1
    if (matched !== marker.length) continue
    const start = index - marker.length + 1
    const lineStart = start === 0 || (start >= 2 && bytes[start - 2] === 13 && bytes[start - 1] === 10)
    if (lineStart) {
      const after = index + 1
      if (bytes[after] === 45 && bytes[after + 1] === 45) {
        closed = true
        break
      }
      if (bytes[after] === 13 && bytes[after + 1] === 10) {
        parts += 1
        if (parts > maxParts) return false
      }
    }
    matched = prefix[matched - 1]!
  }
  return closed && parts > 0
}

type BoundedBody = { status: "ok"; bytes: Uint8Array } | { status: "invalid" } | { status: "too-large" } | { status: "timeout" }
type BodyPart = { status: "ok"; value: ReadableStreamDefaultReadResult<Uint8Array> } | { status: "invalid" } | { status: "timeout" }

async function bounded(request: Request, limit: number, timeoutMs?: number): Promise<BoundedBody> {
  if (!request.body || request.signal.aborted) return { status: "invalid" }
  const declaredHeader = request.headers.get("content-length")
  const declared = declaredHeader === null ? undefined : /^\d+$/.test(declaredHeader) ? Number(declaredHeader) : NaN
  if (declared !== undefined && (!Number.isSafeInteger(declared) || declared < 0)) return { status: "invalid" }
  if (declared !== undefined && declared > limit) return { status: "too-large" }
  const reader = request.body.getReader()
  const allocated = declared === undefined ? undefined : new Uint8Array(declared)
  const chunks: Uint8Array[] = []
  const deadline = timeoutMs === undefined ? undefined : performance.now() + timeoutMs
  let length = 0
  for (;;) {
    const part = await readBodyPart(reader, request.signal, deadline)
    if (part.status !== "ok") {
      void reader.cancel().catch(() => undefined)
      return part
    }
    if (part.value.done) break
    if (length + part.value.value.byteLength > limit || (allocated && length + part.value.value.byteLength > allocated.byteLength)) {
      void reader.cancel().catch(() => undefined)
      return { status: "too-large" }
    }
    if (allocated) allocated.set(part.value.value, length)
    else chunks.push(part.value.value)
    length += part.value.value.byteLength
  }
  if (allocated) return length === allocated.byteLength ? { status: "ok", bytes: allocated } : { status: "invalid" }
  const bytes = new Uint8Array(length)
  chunks.reduce((offset, chunk) => { bytes.set(chunk, offset); return offset + chunk.byteLength }, 0)
  return { status: "ok", bytes }
}

function readBodyPart(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal, deadline?: number): Promise<BodyPart> {
  if (signal.aborted) return Promise.resolve({ status: "invalid" })
  const remaining = deadline === undefined ? undefined : deadline - performance.now()
  if (remaining !== undefined && remaining <= 0) return Promise.resolve({ status: "timeout" })
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: BodyPart) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      signal.removeEventListener("abort", abort)
      resolve(result)
    }
    const abort = () => finish({ status: "invalid" })
    const timer = remaining === undefined ? undefined : setTimeout(() => finish({ status: "timeout" }), Math.max(1, Math.ceil(remaining)))
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) { abort(); return }
    void reader.read().then((value) => finish({ status: "ok", value }), () => finish({ status: "invalid" }))
  })
}
