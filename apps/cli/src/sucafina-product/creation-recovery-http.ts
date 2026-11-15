import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfUiAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"

/**
 * The authorized outcome from the original C08 case-creation transaction.
 * The case-port producer (mission96) owns the SQLite correlation, case reader,
 * incarnation checks and two durable observations. HTTP does not reimplement it.
 */
export type SfCreationRecovery = 
  | { state: "missing" }
  | { state: "committed"; caseRef: string; receipt: {
      commandDigest: string
      storageVersion: number
      aggregateRevision: number
      incarnation: string
    } }

export type SfCreationRecoveryRuntime = {
  ui: Pick<ReturnType<typeof createSfUiAuthority>, "admit" | "validate" | "revalidate" | "finish">
  recoverCreation: (key: string, context: TrustedUiContext) => Promise<PortResult<SfCreationRecovery>>
}

const creationKey = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const scopeDigest = /^[a-f0-9]{64}$/
const surfaces = ["dashboard", "planner", "procurement"] as const

/**
 * Private same-origin GET, mounted before the generic Workbench router.
 * The opaque key is supplied only in a header; neither query nor persistence
 * ever contains a command body, caseRef or session credential.
 */
export function createSfCreationRecoveryHttp(input: {
  origin: string
  mount: string
  runtime: () => SfCreationRecoveryRuntime | undefined
}) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "workbench-create-recover") return undefined
    const reply = (body: unknown, status: number) => Response.json(body, { status, headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
    } })

    if (url.origin !== input.origin || !surfaces.some((value) => value === surface) ||
      url.pathname !== input.mount.replace(/\/$/, "") + "/" + surface ||
      (request.headers.has("origin") && request.headers.get("origin") !== input.origin) ||
      (request.headers.has("sec-fetch-site") &&
        !["same-origin", "none"].includes(request.headers.get("sec-fetch-site") ?? "")))
      return reply({ status: "denied", reason: "creation-recovery-access-unavailable" }, 403)
    if (request.method !== "GET")
      return reply({ status: "denied", reason: "creation-recovery-method-unavailable" }, 405)
    if (url.searchParams.getAll("sf").length !== 1 ||
      [...url.searchParams.keys()].some((name) => name !== "sf"))
      return reply({ status: "needs-input", reason: "invalid-creation-recovery-query" }, 400)

    const key = request.headers.get("Idempotency-Key") ?? ""
    const suppliedScope = request.headers.get("X-SF-Creation-Scope") ?? ""
    if (!creationKey.test(key) || !scopeDigest.test(suppliedScope))
      return reply({ status: "needs-input", reason: "invalid-creation-recovery-correlation" }, 400)
    if (request.signal.aborted)
      return reply({ status: "denied", reason: "creation-recovery-access-unavailable" }, 403)
    const runtime = input.runtime()
    if (!runtime)
      return reply({ status: "unavailable", reason: "creation-recovery-not-mounted" }, 503)

    const digest = digestSfValue({ purpose: "case-creation-recovery", key })
    try {
      const admitted = await runtime.ui.admit(request, "sf_case_read", digest)
      if (admitted.status !== "ok")
        return reply({ status: admitted.status === "denied" ? "denied" : "unavailable",
          reason: "creation-recovery-access-unavailable" }, admitted.status === "denied" ? 403 : 503)
      try {
        if (!await runtime.ui.validate(admitted.value, "sf_case_read", digest))
          return reply({ status: "denied", reason: "creation-recovery-access-unavailable" }, 403)

        // Scope is a non-authorizing browser partition, recomputed solely from
        // the admitted host binding. The client cannot choose an actor/tenant.
        const binding = admitted.value.binding
        const expectedScope = digestSfValue({
          installationId: binding.installationId,
          projectId: binding.projectId,
          principalRef: binding.principalRef,
          policyVersion: binding.policyVersion,
        })
        if (suppliedScope !== expectedScope || request.signal.aborted)
          return reply({ status: "denied", reason: "creation-recovery-access-unavailable" }, 403)

        const recovered = await runtime.recoverCreation(key, admitted.value)
        if (!await runtime.ui.revalidate(admitted.value) || request.signal.aborted)
          return reply({ status: "denied", reason: "creation-recovery-access-unavailable" }, 403)
        if (recovered.status !== "ok")
          return reply({ status: recovered.status, reason: "creation-recovery-unavailable" },
            recovered.status === "denied" ? 403 :
            recovered.status === "stale" || recovered.status === "conflict" ? 409 :
            recovered.status === "needs-input" ? 400 : 503)
        if (recovered.value.state === "missing") {
          // Inconclusive: the original POST may still commit. The 96 browser
          // contract consumes 200/not-found and must never auto-redispatch.
          return reply({ status: "ok", state: "not-found" }, 200)
        }
        if (recovered.value.state !== "committed" ||
          !parseCaseRef(recovered.value.caseRef) ||
          !scopeDigest.test(recovered.value.receipt.commandDigest) ||
          !Number.isSafeInteger(recovered.value.receipt.storageVersion) ||
          !Number.isSafeInteger(recovered.value.receipt.aggregateRevision) ||
          !recovered.value.receipt.incarnation)
          return reply({ status: "unavailable", reason: "creation-recovery-invalid-receipt" }, 503)
        return reply({ status: "ok", state: "committed",
          outputRef: recovered.value.caseRef, receipt: recovered.value.receipt }, 200)
      } finally {
        runtime.ui.finish(admitted.value)
      }
    } catch {
      return reply({ status: "unavailable", reason: "creation-recovery-unavailable" }, 503)
    }
  }
}
