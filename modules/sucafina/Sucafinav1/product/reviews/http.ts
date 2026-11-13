import { dispatchSfCapability } from "../host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { CapabilityDescriptor } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createReviewDownloadHandler } from "../reports/download.ts"
import type { createSfHumanAuthority } from "../integration/human-authority.ts"
import type { createReviewClosurePort, ReviewActionHandoff } from "./closure-action.ts"
import type { createReviewHumanPort } from "./human.ts"
import type { createReviewAgendaSelection, ReviewAgendaItem } from "./selection.ts"
import type { createReviewPort } from "./port.ts"

/** Mount in the existing authenticated application; starts no listener or storage. */
export function createReviewHttp(input: {
  origin: string
  ui: ReturnType<typeof createSfUiAuthority>
  human: ReturnType<typeof createReviewHumanPort>
  humanAuthority?: ReturnType<typeof createSfHumanAuthority>
  closure?: ReturnType<typeof createReviewClosurePort>
  authority: SfDomainValidation
  descriptors: readonly CapabilityDescriptor[]
  reviews: ReturnType<typeof createReviewPort>
  agenda?: ReturnType<typeof createReviewAgendaSelection>
  download: ReturnType<typeof createReviewDownloadHandler>
  maxBodyBytes: number
}) {
  if (!URL.canParse(input.origin) || new URL(input.origin).origin !== input.origin || !Number.isSafeInteger(input.maxBodyBytes) || input.maxBodyBytes <= 0) throw new Error("SF_REVIEW_HTTP_CONFIG_INVALID")
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (mode !== "review-read" && mode !== "review-preserve" && mode !== "review-agenda" && mode !== "review-close" && mode !== "review-closure" && mode !== "review-report" && mode !== "review-download") return undefined
    const json = (value: unknown, status: number) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || url.origin !== input.origin || request.signal.aborted || url.searchParams.getAll("sf").length !== 1) return json({ status: "denied", reason: "review-unavailable" }, 403)
    if (mode === "review-download") {
      if ([...url.searchParams.keys()].some((key) => !["sf", "artifactRef"].includes(key)) || url.searchParams.getAll("artifactRef").length !== 1) return json({ status: "needs-input", reason: "invalid-reference" }, 400)
      return input.download(request, url.searchParams.get("artifactRef") ?? "")
    }
    if (mode === "review-preserve" || mode === "review-agenda" || mode === "review-close" || mode === "review-report") {
      if (request.method !== "POST") return json({ status: "denied", reason: "method-unavailable" }, 405)
      if (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site") return json({ status: "denied", reason: "review-unavailable" }, 403)
      if ([...url.searchParams.keys()].some((key) => key !== "sf") || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ status: "needs-input", reason: "invalid-request" }, 400)
      const length = request.headers.get("content-length")
      if (length && (!/^\d+$/.test(length) || Number(length) > input.maxBodyBytes)) return json({ status: "needs-input", reason: "request-too-large" }, 413)
      const reader = request.body?.getReader()
      if (!reader) return json({ status: "needs-input", reason: "invalid-request" }, 400)
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const next = await reader.read()
        if (next.done) break
        size += next.value.byteLength
        if (size > input.maxBodyBytes) { await reader.cancel(); return json({ status: "needs-input", reason: "request-too-large" }, 413) }
        chunks.push(next.value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.length })
      const payload = await new Response(bytes).json().catch(() => undefined)
      if (payload === undefined) return json({ status: "needs-input", reason: "invalid-request" }, 400)
      if (mode === "review-close") {
        if (!input.closure || !input.humanAuthority) return json({ status: "unavailable", reason: "handoff-producer-unavailable" }, 503)
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !["reviewRef", "handoff"].includes(key)) || typeof payload.reviewRef !== "string" || !payload.reviewRef.trim() || !payload.handoff || typeof payload.handoff !== "object" || Array.isArray(payload.handoff)) return json({ status: "needs-input", reason: "invalid-handoff" }, 400)
        const reviewRef: string = payload.reviewRef
        const handoff = payload.handoff as ReviewActionHandoff
        const digest = digestSfValue({ reviewRef })
        const reviewAdmission = await input.ui.admit(request, "sf_review_prepare", digest)
        if (reviewAdmission.status !== "ok") return json({ status: "denied", reason: "review-unavailable" }, 403)
        try {
          if (!await input.ui.validate(reviewAdmission.value, "sf_review_prepare", digest)) return json({ status: "denied", reason: "review-unavailable" }, 403)
          const admission = await input.humanAuthority.admit(request, "collaboration.handoff.confirm", handoff)
          if (admission.status !== "ok") return json({ status: "denied", reason: "handoff-unavailable" }, 403)
          try {
            const result = await input.closure.confirm(reviewRef, handoff, reviewAdmission.value, admission.value)
            return json(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : result.status === "conflict" || result.status === "stale" ? 409 : 503)
          } finally { input.humanAuthority.finish(admission.value) }
        } finally { input.ui.finish(reviewAdmission.value) }
      }
      if (mode === "review-agenda") {
        if (!input.agenda) return json({ status: "unavailable", reason: "agenda-producer-unavailable" }, 503)
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Object.hasOwn(payload, "items") || Object.keys(payload).some((key) => key !== "items") || !Array.isArray(payload.items)) return json({ status: "needs-input", reason: "invalid-agenda" }, 400)
        const digest = digestSfValue(payload)
        const admitted = await input.ui.admit(request, "sf_review_prepare", digest)
        if (admitted.status !== "ok") return json({ status: "denied", reason: "agenda-unavailable" }, 403)
        try {
          if (!await input.ui.validate(admitted.value, "sf_review_prepare", digest) || input.ui.requestFor(admitted.value) !== request || !await input.ui.revalidate(admitted.value)) return json({ status: "denied", reason: "agenda-unavailable" }, 403)
          const result = await input.agenda.create(payload.items as ReviewAgendaItem[], admitted.value)
          if (!await input.ui.revalidate(admitted.value)) return json({ status: "denied", reason: "agenda-unavailable" }, 403)
          return json(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : 503)
        } finally { input.ui.finish(admitted.value) }
      }
      if (mode === "review-preserve") {
        const result = await input.human.preserve(request, payload)
        return json(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : result.status === "conflict" || result.status === "stale" ? 409 : 503)
      }
      const parsed = decodeSfOperationInput("sf_report_prepare", payload)
      if (!parsed.ok) return json({ status: "needs-input", reason: "invalid-request" }, 400)
      const admitted = await input.ui.admit(request, "sf_report_prepare", digestSfValue(parsed.value))
      if (admitted.status !== "ok") return json({ status: "denied", reason: "review-unavailable" }, 403)
      try {
        const result = await dispatchSfCapability({ operation: "sf_report_prepare", payload: parsed.value, context: admitted.value, descriptors: input.descriptors, authority: input.authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_report_prepare", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_report_prepare", value.result).ok })
        return json(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : result.status === "stale" ? 409 : 503)
      } finally {
        input.ui.finish(admitted.value)
      }
    }
    if (mode === "review-closure") {
      if (request.method !== "GET") return json({ status: "denied", reason: "method-unavailable" }, 405)
      if (!input.closure) return json({ status: "unavailable", reason: "handoff-producer-unavailable" }, 503)
      if ([...url.searchParams.keys()].some((key) => !["sf", "closureRef"].includes(key)) || url.searchParams.getAll("closureRef").length !== 1) return json({ status: "needs-input", reason: "invalid-reference" }, 400)
      const closureRef = url.searchParams.get("closureRef") ?? ""
      if (!/^review-closure:[a-f0-9]{64}$/.test(closureRef)) return json({ status: "needs-input", reason: "invalid-reference" }, 400)
      const digest = digestSfValue({ closureRef })
      const admitted = await input.ui.admit(request, "sf_review_prepare", digest)
      if (admitted.status !== "ok") return json({ status: "denied", reason: "closure-unavailable" }, 403)
      try {
        if (!await input.ui.validate(admitted.value, "sf_review_prepare", digest) || input.ui.requestFor(admitted.value) !== request) return json({ status: "denied", reason: "closure-unavailable" }, 403)
        const result = await input.closure.read(closureRef, admitted.value)
        if (result.status !== "ok" || !await input.ui.revalidate(admitted.value)) return json({ status: "denied", reason: "closure-unavailable" }, 403)
        return json(result, 200)
      } finally { input.ui.finish(admitted.value) }
    }
    if (request.method !== "GET") return json({ status: "denied", reason: "method-unavailable" }, 405)
    if ([...url.searchParams.keys()].some((key) => !["sf", "reviewRef"].includes(key)) || url.searchParams.getAll("reviewRef").length !== 1) return json({ status: "needs-input", reason: "invalid-reference" }, 400)
    const reviewRef = url.searchParams.get("reviewRef") ?? ""
    if (!reviewRef.trim() || reviewRef.length > 2048) return json({ status: "needs-input", reason: "invalid-reference" }, 400)
    const digest = digestSfValue({ reviewRef })
    const admitted = await input.ui.admit(request, "sf_review_prepare", digest)
    if (admitted.status !== "ok") return json({ status: "denied", reason: "review-unavailable" }, 403)
    try {
      if (!await input.ui.validate(admitted.value, "sf_review_prepare", digest) || input.ui.requestFor(admitted.value) !== request || !await input.ui.revalidate(admitted.value)) return json({ status: "denied", reason: "review-unavailable" }, 403)
      const result = await input.reviews.read(reviewRef, admitted.value)
      if (result.status !== "ok" || !await input.ui.revalidate(admitted.value)) return json({ status: "unavailable", reason: "review-unavailable" }, 403)
      return json(result, 200)
    } finally {
      input.ui.finish(admitted.value)
    }
  }
}
