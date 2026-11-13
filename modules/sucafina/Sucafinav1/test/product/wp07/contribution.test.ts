import { expect, test } from "bun:test"
import { createSfContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfRunStore } from "../../../product/ai/run-store.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createReviewContributionConsumer } from "../../../product/reviews/contribution.ts"
import type { ReviewContributionRequest } from "../../../product/reviews/contribution.ts"
import { testPersistence } from "../../fixture/persistence.ts"

test("review consumer uses the production C11 reader and never opens material for an absent native output", async () => {
  const storage = testPersistence()
  const access = { allowed: true, calls: 0 }
  const ui = createSfUiAuthority({ authorize: async () => access.allowed ? { installationId: "installation", projectId: "project", principalRef: "reader", accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => "read-contribution", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const admitted = await ui.admit(new Request("https://example.test/review"), "sf_review_prepare", digestSfValue({ outputRef: "absent" }))
  if (admitted.status !== "ok") throw new Error("UI authority unavailable")
  expect(await ui.validate(admitted.value, "sf_review_prepare", digestSfValue({ outputRef: "absent" }))).toBe(true)
  const requestFor = (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined
  const revalidate = async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context)
  const state = createSfProductState({ persistence: storage.persistence, authorize: async () => access.allowed ? { principalRef: "reader", accessRevision: "access", policyVersion: "policy" } : undefined, createId: () => "state", resolveTarget: async () => undefined })
  const runs = createSfRunStore({ state, requestFor, revalidate, preflight: async () => ({ status: "unavailable", reason: "native-run-not-executed" }), revalidateForCommit: async () => ({ status: "denied", reason: "native-run-not-executed" }), now: () => "2026-11-13T00:00:00Z" })
  const contributions = createSfContributionReader({ state, runs, requestFor, revalidate, verify: async () => ({ status: "unavailable", reason: "native-run-not-executed" }) })
  const consume = createReviewContributionConsumer({ contributions, revalidate, reviews: { read: async () => { access.calls++; return { status: "unavailable", reason: "unselected" } } }, artifacts: { read: async () => { access.calls++; return { status: "unavailable", reason: "unselected" } } } })
  const request: ReviewContributionRequest = { outputRef: "absent", caseRef: { id: "case", incarnation: "case-inc", version: 1 } }
  const result = await consume(request, admitted.value)
  expect(result.status).toBe("unavailable")
  expect("value" in result).toBe(false)
  expect(access.calls).toBe(0)
  expect((await consume({ ...request, actor: "other" } as ReviewContributionRequest, admitted.value)).status).toBe("needs-input")
  expect((await consume({ ...request, expectedOutputDigest: "forged" }, admitted.value)).status).toBe("needs-input")
  access.allowed = false
  const revoked = await consume(request, admitted.value)
  expect(revoked.status).toBe("denied")
  expect("value" in revoked).toBe(false)
  expect(access.calls).toBe(0)
  ui.finish(admitted.value)
})
