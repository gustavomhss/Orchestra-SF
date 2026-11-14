import { expect, test } from "bun:test"
import { createSfRoutineProduct } from "../../../product/routines/factory.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

const run = { documentId: "recipe", publishedVersion: "v1", principalRef: "person", projectId: "project", admission: "admitted", admissionRef: "admission", admissionVersion: 1, runRef: "run", correlationId: "correlation", sourceRefs: [], pending: [] } as const

test("run discovery reads C08, deduplicates references and suppresses revoked output", async () => {
  const request = new Request("https://example.test/routines")
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "install", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" }), commandIdentity: async () => "command", createId: () => "request", now: () => 1000 })
  const digest = digestSfValue({ purpose: "routine-discovery" })
  const admission = await ui.admit(request, "sf_routine_status", digest)
  if (admission.status !== "ok") throw new Error(admission.reason)
  expect(await ui.validate(admission.value, "sf_routine_status", digest)).toBe(true)
  const context = admission.value
  let allowed = true
  let inconsistent = false
  const product = createSfRoutineProduct({
    publication: {} as Parameters<typeof createSfRoutineProduct>[0]["publication"],
    routines: {
      prepareAdmission: async () => ({ status: "unavailable", reason: "unused" }),
      readAdmission: async () => ({ status: "unavailable", reason: "unused" }),
      run: async () => ({ status: "unavailable", reason: "unused" }),
      readRun: async (ref) => ref === "run" ? { status: "ok", value: inconsistent ? { ...run, runRef: "other" } : run } : { status: "denied", reason: "private" },
    },
    capabilities: {
      resolveRecipe: async () => ({ status: "unavailable", reason: "unused" }),
      resolveCase: async () => ({ status: "unavailable", reason: "unused" }),
      prepareWatch: async () => ({ status: "unavailable", reason: "unused" }),
      authority: { revalidateDomainContext: async (candidate) => candidate.kind === "ui" && await ui.revalidate(candidate), receiptFor: (candidate, operation, inputDigest, resultDigest) => candidate.kind === "ui" ? ui.receiptFor(candidate, operation, inputDigest, resultDigest) : undefined },
      revalidateOutput: async () => true,
      requiredAuthority: { sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [], sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [] },
    },
    discovery: { listRunRefs: async () => ({ status: "ok", value: ["run", "run", "private"] }), revalidate: async () => allowed },
  })
  expect(await product.discoverRuns(context)).toEqual({ status: "ok", value: [run] })
  inconsistent = true
  expect(await product.discoverRuns(context)).toEqual({ status: "unavailable", reason: "routine-index-unavailable" })
  allowed = false
  expect(await product.discoverRuns(context)).toEqual({ status: "denied", reason: "routine-access-unavailable" })
})

