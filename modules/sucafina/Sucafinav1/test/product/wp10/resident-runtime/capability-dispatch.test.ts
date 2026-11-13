import { expect, test } from "bun:test"
import { createSfProductContribution } from "../../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { loadSfSkill } from "../../../../product/host-binding/skill-loader.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { CapabilityDescriptor, CapabilityResult } from "../../../../product/contracts/sf-execution.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { dispatchSfCapability } from "../../../../product/host-binding/capability-dispatch.ts"

test("UI dispatch consumes real private authority once and rejects a changed receipt", async () => {
  expect(typeof createSfProductContribution).toBe("function")
  expect(typeof loadSfSkill).toBe("function")
  const ui = createSfUiAuthority({
    authorize: async () => ({ installationId: "installation", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" }),
    commandIdentity: async () => "command-1", createId: () => "request-1", now: Date.now,
  })
  const payload = { selectionRef: "ref" }
  const digest = digestSfValue(payload)
  const admitted = await ui.admit(new Request("https://example.test/"), "sf_dashboard_read", digest)
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") return
  const authority = {
    validateDomainContext: async (context: typeof admitted.value, operation: string, inputDigest: string) => ui.validate(context, operation, inputDigest),
    revalidateDomainContext: async (context: typeof admitted.value) => ui.revalidate(context),
    receiptFor: (context: typeof admitted.value, operation: string, inputDigest: string, resultDigest?: string) => ui.receiptFor(context, operation, inputDigest, resultDigest),
  }
  const descriptor: CapabilityDescriptor = {
    id: "sf_dashboard_read", pack: "performance", mode: "read", inputSchema: {}, outputSchema: {},
    handlerExport: "readDashboard", producerTask: "WP02.T01", grantProfiles: [], requiredAuthority: [],
    handler: async (_input, context) => {
      if (context.kind !== "ui") throw new Error("unexpected native context")
      const receipt = ui.receiptFor(context, "sf_dashboard_read", digest, digestSfValue({ value: 1 }))!
      return { status: "ok", result: { value: 1 }, receipt: { ...receipt, callId: "forged" } } as CapabilityResult
    },
  }
  const result = await dispatchSfCapability({
    operation: descriptor.id, payload, context: admitted.value, descriptors: [descriptor],
    authority: {
      validateDomainContext: (context, operation, inputDigest) => context.kind === "ui" ? authority.validateDomainContext(context, operation, inputDigest) : Promise.resolve(false),
      revalidateDomainContext: (context) => context.kind === "ui" ? authority.revalidateDomainContext(context) : Promise.resolve(false),
      receiptFor: (context, operation, inputDigest, resultDigest) => context.kind === "ui" ? authority.receiptFor(context, operation, inputDigest, resultDigest) : undefined,
    }, validateInput: () => true, validateOutput: () => true,
  })
  expect(result.status).toBe("unavailable")
  expect(result.receipt.kind).toBe("unbound")
  expect(await ui.validate(admitted.value, descriptor.id, digest)).toBe(false)
})
