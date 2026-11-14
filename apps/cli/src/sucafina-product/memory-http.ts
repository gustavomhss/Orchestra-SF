import type { Application } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfMemoryServices } from "./memory-services.ts"
import { memoryCaseRef, memoryOutcomeSelection, memorySignalSelection } from "./memory-selection.ts"

/** Private human HTTP operations. These selections are never resident capabilities. */
export function createSfMemoryHttp(input: {
  origin: string
  mount?: string
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "ui" | "human" | "host">
  memory: ReturnType<typeof createSfMemoryServices>
  withCase: ReturnType<typeof createSfBusinessServices>["withCase"]
}): NonNullable<Application["product"]> {
  return async (request, surface) => {
    const url = new URL(request.url)
    const route = url.searchParams.get("sf")
    if (surface !== "dashboard" || url.pathname !== `${input.mount ?? ""}/dashboard` || !route || !["memory-catalog", "memory-conditions", "memory-signals", "memory-materiality", "memory-outcome", "memory-condition", "memory-outcome-selection"].includes(route)) return undefined
    if (url.origin !== input.origin || (request.headers.has("origin") && request.headers.get("origin") !== input.origin) ||
      request.headers.get("sec-fetch-site") === "cross-site") return respond({ status: "denied", reason: "memory-authority-unavailable" })
    try {
      if (route === "memory-condition" || route === "memory-outcome-selection") {
        if (request.method !== "POST" || url.searchParams.getAll("sf").length !== 1 || [...url.searchParams.keys()].some((key) => key !== "sf")) return respond({ status: "needs-input", reason: "invalid-memory-command" })
        if (request.headers.get("origin") !== input.origin) return respond({ status: "denied", reason: "memory-authority-unavailable" })
        if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return respond({ status: "needs-input", reason: "memory-json-required" })
        const body = await boundedBody(request)
        if (!body) return respond({ status: "needs-input", reason: "invalid-memory-command" })
        const payload: unknown = JSON.parse(body)
        const selection = route === "memory-condition" ? memorySignalSelection(payload) : memoryOutcomeSelection(payload)
        if (!selection) return respond({ status: "needs-input", reason: "invalid-memory-selection" })
        const action = route === "memory-condition" ? "decisions.condition.record" : "decisions.outcome.select"
        const admitted = await input.authority.human.admit(request, action, payload)
        if (admitted.status !== "ok") return respond(admitted)
        try {
          const signal = route === "memory-condition" ? memorySignalSelection(payload) : undefined
          const outcome = route === "memory-outcome-selection" ? memoryOutcomeSelection(payload) : undefined
          const scoped = await input.withCase(admitted.value, selection.caseRef, {}, async () => ({ status: "ok" as const,
            value: signal ? await input.memory.registry.register(signal, admitted.value) : outcome ? await input.memory.outcomeSelections.register(outcome, admitted.value) : undefined }))
          if (scoped.status !== "ok") return respond(scoped)
          const saved = scoped.value
          if (!saved || !await input.authority.human.authorize(admitted.value, action, payload)) return respond({ status: "denied", reason: "memory-authority-unavailable" })
          return respond(saved.status === "ok" ? saved : { status: "unavailable", reason: "memory-selection-source-unavailable" })
        } finally { input.authority.human.finish(admitted.value) }
      }
      if (request.method !== "GET") return respond({ status: "needs-input", reason: "invalid-memory-read" })
      const keys = route === "memory-catalog" ? ["sf"] : ["sf", "caseId", "incarnation", "version", ...(route === "memory-materiality" ? ["conditionId"] : []), ...(route === "memory-outcome" ? ["choiceId"] : [])]
      if (keys.some((key) => url.searchParams.getAll(key).length !== 1) || [...url.searchParams.keys()].some((key) => !keys.includes(key)))
        return respond({ status: "needs-input", reason: "invalid-memory-read" })
      const caseRef = memoryCaseRef({ id: url.searchParams.get("caseId"), incarnation: url.searchParams.get("incarnation"), version: Number(url.searchParams.get("version")) })
      if (route !== "memory-catalog" && !caseRef) return respond({ status: "needs-input", reason: "invalid-memory-case" })
      const payload = Object.fromEntries(url.searchParams)
      const operation = "sf-human:analysis.read"
      const digest = digestSfValue(payload)
      const admitted = await input.authority.ui.admit(request, operation, digest)
      if (admitted.status !== "ok") return respond(admitted)
      try {
        if (!await input.authority.ui.validate(admitted.value, operation, digest)) return respond({ status: "denied", reason: "memory-authority-unavailable" })
        const read = async () => ({ status: "ok" as const, value: route === "memory-conditions" ? await input.memory.conditions(caseRef!, admitted.value)
          : route === "memory-signals" ? await input.memory.signals(caseRef!, admitted.value)
          : route === "memory-materiality" ? await input.memory.materiality(caseRef!, url.searchParams.get("conditionId")!, admitted.value)
          : await input.memory.outcomes({ caseRef: caseRef!, choiceId: url.searchParams.get("choiceId")! }, admitted.value) })
        const scoped = route === "memory-catalog" ? { status: "ok" as const, value: { status: "ok", value: input.memory.catalog } }
          : await input.withCase(admitted.value, caseRef!, {}, read)
        const result = scoped.status === "ok" ? scoped.value : scoped
        return await input.authority.host.revalidate(admitted.value) ? respond(result) : respond({ status: "denied", reason: "memory-authority-unavailable" })
      } finally { input.authority.ui.finish(admitted.value) }
    } catch { return respond({ status: "unavailable", reason: "memory-request-unavailable" }) }
  }
}

async function boundedBody(request: Request) {
  const length = request.headers.get("content-length")
  if (!request.body || request.signal.aborted) return undefined
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65_536)) {
    void request.body.cancel().catch(() => undefined)
    return undefined
  }
  const reader = request.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const parts: string[] = []
  let bytes = 0
  request.signal.addEventListener("abort", cancel, { once: true })
  try {
    while (!request.signal.aborted) {
      const chunk = await reader.read()
      if (request.signal.aborted) return undefined
      if (chunk.done) return parts.join("") + decoder.decode()
      bytes += chunk.value.byteLength
      if (bytes > 65_536) { cancel(); return undefined }
      parts.push(decoder.decode(chunk.value, { stream: true }))
    }
    cancel()
    return undefined
  } catch {
    cancel()
    return undefined
  } finally {
    request.signal.removeEventListener("abort", cancel)
    reader.releaseLock()
  }
}

function respond(result: unknown) {
  const status = object(result).status
  return Response.json(result, { status: status === "ok" || status === "comparable" ? 200 : status === "denied" ? 403 : status === "needs-input" ? 422 :
    status === "stale" || status === "conflict" ? 409 : 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } })
}
