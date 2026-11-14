import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

/** Uses the real UI registry; it does not claim native binding, C07 admission or a loaded skill. */
export async function createRoutineUiFixture(projectId: string, principalRef: string) {
  const request = new Request("https://example.test/wp09/routines", { method: "POST" })
  const authority = createSfUiAuthority({
    authorize: async (incoming) => incoming === request ? { installationId: "wp09-install", projectId, principalRef, policyVersion: "policy-1", accessRevision: "access-1" } : undefined,
    commandIdentity: async () => "wp09-command",
    createId: () => "wp09-ui-request",
    now: () => Date.parse("2031-01-15T12:00:00Z"),
  })
  const operation = "sf_routine_catalog"
  const digest = digestSfValue({ purpose: "review" })
  const admitted = await authority.admit(request, operation, digest)
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  if (!await authority.validate(admitted.value, operation, digest)) throw new Error("UI fixture lease was not consumed")
  return { context: admitted.value, authority, request }
}
