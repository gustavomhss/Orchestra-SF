/**
 * W16/A04 — only two NEW read projections. All 19 existing HTTP operations
 * remain inside the original Workbench, Portfolio, DecisionDomain,
 * CurrentChoice and Procurement producers; F02 transports them unchanged.
 * This module cannot create, approve, apply or recover any decision.
 */
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { sfCaseCandidatesForAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { observeSfCaseSource } from "./case-health.ts"
import { contextualCaseReturn } from "../../../../../modules/sucafina/Sucafinav1/product/interface/contextual-decision.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"

type Stamp = Readonly<{
  installationId: string
  projectId: string
  hostId: string
  principalRef: string
  policyVersion: string
  accessRevision: string
}>
type Binding = Readonly<{ installationId: string; projectId: string; principalRef: string; policyVersion: string; accessRevision: string }>
type CaseList = Readonly<{ caseRef: string; title: string; version: number }>

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const

function response(request: Request, status: number, body: object) {
  return request.method === "HEAD"
    ? new Response(null, { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } })
    : Response.json(body, { status, headers })
}

function failed(request: Request, status: string, reason?: string) {
  const code = status === "denied" ? 403 : status === "unauthenticated" ? 401
    : status === "stale" || status === "conflict" ? 409
    : status === "needs-input" || status === "invalid" ? 400 : 503
  return response(request, code, { status, ...(reason ? { reason } : {}) })
}
function matches(stamp: Stamp, binding: Binding) {
  return stamp.installationId === binding.installationId && stamp.projectId === binding.projectId &&
    stamp.principalRef === binding.principalRef && stamp.policyVersion === binding.policyVersion &&
    stamp.accessRevision === binding.accessRevision
}
function allowedRequest(request: Request, deps: SfNativeHostDependencies, pathname: string) {
  const url = new URL(request.url)
  return url.origin === deps.origin && url.pathname === `${deps.mount}/api/ui/projections/${pathname}` &&
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    !request.signal.aborted
}
function exactQuery(url: URL, required: readonly string[], optional: readonly string[] = []) {
  return required.every((key) => url.searchParams.getAll(key).length === 1) &&
    [...url.searchParams.keys()].every((key) => (required.includes(key) || optional.includes(key)) && url.searchParams.getAll(key).length === 1)
}
function validRef(value: string | null): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 16384
}

/** Read an existing case projection through the original admitted sf_case_read. */
async function readCase(request: Request, deps: SfNativeHostDependencies): Promise<Response> {
  if (!allowedRequest(request, deps, "case")) return failed(request, "denied", "native-decision-request-unavailable")
  const url = new URL(request.url)
  if (!exactQuery(url, ["caseRef"], ["returnTo"])) return failed(request, "needs-input", "invalid-case-selector")
  const caseRef = url.searchParams.get("caseRef")
  const rawReturn = url.searchParams.get("returnTo")
  if (!validRef(caseRef) || rawReturn !== null && !validRef(rawReturn)) return failed(request, "needs-input", "invalid-case-selector")
  const parsed = decodeSfOperationInput("sf_case_read", { caseRef })
  if (!parsed.ok) return failed(request, "needs-input", "invalid-case-selector")
  const runtime = deps.runtime()
  if (!runtime) return failed(request, "unavailable", "decision-host-unavailable")
  const identity = await deps.readContext(request)
  if (identity.status !== "ok") return failed(request, identity.status)
  const stamp = identity.value.stamp
  const operationDigest = digestSfValue(parsed.value)
  const admitted = await runtime.ui.admit(request, "sf_case_read", operationDigest)
  if (admitted.status !== "ok") return failed(request, admitted.status)
  try {
    if (!matches(stamp, admitted.value.binding) || !await runtime.ui.revalidate(admitted.value))
      return failed(request, "denied", "case-access-changed")
    const result = await runtime.dispatch("sf_case_read", parsed.value, admitted.value)
    if (result.status !== "ok") return failed(request, result.status, result.reason)
    const projection = decodeSfOperationOutput("sf_case_read", result.result)
    if (!projection.ok) return failed(request, "unavailable", "case-projection-invalid")
    const returnTo = rawReturn === null ? undefined : contextualCaseReturn({
      origin: deps.origin, mount: deps.mount, returnTo: rawReturn, sourceRefs: projection.value.case.sourceRefs,
    })
    if (rawReturn !== null && !returnTo) return failed(request, "needs-input", "contextual-return-unavailable")
    if (!await runtime.ui.revalidate(admitted.value)) return failed(request, "denied", "case-access-changed")
    const current = await deps.readContext(request)
    if (current.status !== "ok" || digestSfValue(current.value.stamp) !== digestSfValue(stamp))
      return failed(request, "stale", "case-context-changed")
    return response(request, 200, { status: "ok", context: stamp, value: { projection: projection.value, ...(returnTo ? { returnTo } : {}) } })
  } catch {
    return failed(request, "unavailable", "case-projection-unavailable")
  } finally {
    runtime.ui.finish(admitted.value)
  }
}

/** Participant-filtered Workbench list, then canonical per-case authorized read. */
async function readCases(request: Request, deps: SfNativeHostDependencies): Promise<Response> {
  if (!allowedRequest(request, deps, "cases")) return failed(request, "denied", "native-decision-request-unavailable")
  if (!exactQuery(new URL(request.url), [])) return failed(request, "needs-input", "invalid-case-list-query")
  const runtime = deps.runtime()
  if (!runtime) return failed(request, "unavailable", "decision-host-unavailable")
  const identity = await deps.readContext(request)
  if (identity.status !== "ok") return failed(request, identity.status)
  const stamp = identity.value.stamp
  const operationDigest = digestSfValue({})
  const admitted = await runtime.ui.admit(request, "sf_case_read", operationDigest)
  if (admitted.status !== "ok") return failed(request, admitted.status)
  try {
    if (!matches(stamp, admitted.value.binding) || !await runtime.ui.validate(admitted.value, "sf_case_read", operationDigest))
      return failed(request, "denied", "case-list-access-changed")
    const identities = () => runtime.state.read(request, "cases", (state, authority) => {
      if (authority.principalRef !== admitted.value.binding.principalRef ||
        authority.policyVersion !== admitted.value.binding.policyVersion ||
        authority.accessRevision !== admitted.value.binding.accessRevision) return undefined
      return sfCaseCandidatesForAuthority(state, authority).map(encodeCaseRef)
    })
    const listed = await identities()
    const empty = listed.status === "unavailable" && listed.reason === "product-state-uninitialized"
    const refs = listed.status === "ok" ? listed.value : empty ? [] : undefined
    if (!refs || refs.length > 100)
      return failed(request, "unavailable", "case-list-source-unavailable")
    const cases: CaseList[] = []
    for (const caseRef of refs) {
      if (!validRef(caseRef)) return failed(request, "unavailable", "case-selector-invalid")
      const decoded = decodeSfOperationInput("sf_case_read", { caseRef })
      if (!decoded.ok) return failed(request, "unavailable", "case-selector-invalid")
      const itemDigest = digestSfValue(decoded.value)
      const access = await runtime.ui.admit(request, "sf_case_read", itemDigest)
      if (access.status !== "ok") return failed(request, access.status)
      try {
        // The shared dispatcher consumes this item lease exactly once. Consuming
        // it here would make every non-empty list fail at dispatch.
        if (!matches(stamp, access.value.binding) || !await runtime.ui.revalidate(access.value))
          return failed(request, "denied", "case-item-access-changed")
        const item = await runtime.dispatch("sf_case_read", decoded.value, access.value)
        if (item.status !== "ok") return failed(request, item.status, item.reason)
        const projection = decodeSfOperationOutput("sf_case_read", item.result)
        if (!projection.ok) return failed(request, "unavailable", "case-item-invalid")
        if (!await runtime.ui.revalidate(access.value)) return failed(request, "denied", "case-item-access-changed")
        cases.push({ caseRef, title: projection.value.case.objective, version: projection.value.case.version })
      } finally {
        runtime.ui.finish(access.value)
      }
    }
    const again = await identities()
    if (empty ? again.status !== "unavailable" || again.reason !== "product-state-uninitialized"
      : again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(refs))
      return failed(request, "stale", "case-list-changed")
    if (!await runtime.ui.revalidate(admitted.value)) return failed(request, "denied", "case-list-access-changed")
    const current = await deps.readContext(request)
    if (current.status !== "ok" || digestSfValue(current.value.stamp) !== digestSfValue(stamp))
      return failed(request, "stale", "case-context-changed")
    return response(request, 200, { status: "ok", context: stamp, value: { cases } })
  } catch {
    return failed(request, "unavailable", "case-list-unavailable")
  } finally {
    runtime.ui.finish(admitted.value)
  }
}

/** These handlers are mounted only by 114 through the F02 native router. */
export function createSfDecisionsProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return Object.freeze([
    { operationId: "projection.cases" as const, handle: (request: Request) => readCases(request, deps) },
    { operationId: "projection.case" as const, handle: (request: Request) => readCase(request, deps) },
  ])
}

/** Installed list infrastructure only, not per-case authorization or list completeness. */
export async function observeSfCases(deps: SfNativeHostDependencies, handlers: readonly SfProjectionHandler[], request: Request, stamp: SfContextStamp) {
  const ids = (["projection.cases", "projection.case"] as const).filter((id) => handlers.some((handler) => handler.operationId === id))
  if (!ids.length) return []
  const health = await observeSfCaseSource(deps.runtime(), request, stamp)
  return ids.filter((id) => health === "ready" || health === "empty" && id === "projection.cases")
    .map((operationId) => ({ operationId, state: "ready" as const, reason: null, operational: true as const }))
}
