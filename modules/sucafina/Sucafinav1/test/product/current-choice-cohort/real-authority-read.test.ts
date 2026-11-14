import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { currentChoiceAuthorityFixture } from "./real-authority-fixture.ts"

for (const revocation of ["ui.finish", "expired lease", "unrelated renewed lease", "request abort", "request headers"] as const) {
  test(`current-choice real final provider authorization suppresses output after ${revocation}`, async () => {
    const fixture = await currentChoiceAuthorityFixture()
    try {
      expect(await fixture.preview.read(fixture.promotion, fixture.context)).toEqual({ status: "ok", value: fixture.binding })
      const before = await fixture.snapshot()
      fixture.hooks.afterFinalCapture = async () => {
        fixture.events.applied += 1
        if (revocation === "expired lease") fixture.clock.now += 300_001
        if (revocation === "request abort") fixture.controller.abort()
        if (revocation === "request headers") fixture.request.headers.set("x-command", "substituted-command")
        if (revocation === "ui.finish" || revocation === "unrelated renewed lease") fixture.product.ui.finish(fixture.context)
        if (revocation === "unrelated renewed lease") {
          const renewed = await fixture.renew()
          expect(fixture.product.ui.requestFor(renewed.context)).toBe(renewed.request)
          expect(renewed.request).not.toBe(fixture.request)
          expect(renewed.context.lease).not.toBe(fixture.context.lease)
          expect(await fixture.product.ui.revalidate(renewed.context)).toBe(true)
        }
      }
      const read = await fixture.preview.read(fixture.promotion, fixture.context)
      expect(fixture.events.applied).toBe(1)
      expect(fixture.events.finalAuthorization).toBe(1)
      expect(read.status).not.toBe("ok")
      expect(read).not.toHaveProperty("value")
      expect(fixture.product.ui.requestFor(fixture.context)).toBe(revocation === "request headers" ? fixture.request : undefined)
      expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(before))
      expect(fixture.events.producerCalls).toBe(0)
    } finally { await fixture.cleanup() }
  })
}

test("current-choice cannot substitute a serialized context, lease or binding even while its real admission remains active", async () => {
  const fixture = await currentChoiceAuthorityFixture()
  try {
    expect(await fixture.preview.read(fixture.promotion, fixture.context)).toEqual({ status: "ok", value: fixture.binding })
    const before = await fixture.snapshot()
    const candidates: TrustedUiContext[] = [
      structuredClone(fixture.context),
      { ...fixture.context },
      { ...fixture.context, lease: {} as TrustedUiContext["lease"] },
      ...["installationId", "projectId", "principalRef", "policyVersion", "accessRevision", "requestId"].map((field) => ({ ...fixture.context, binding: { ...fixture.context.binding, [field]: "substituted" } })),
    ]
    for (const candidate of candidates) {
      expect(fixture.product.ui.requestFor(candidate)).toBeUndefined()
      const read = await fixture.preview.read(fixture.promotion, candidate)
      expect(read.status).not.toBe("ok")
      expect(read).not.toHaveProperty("value")
    }
    expect(await fixture.product.ui.revalidate(fixture.context)).toBe(true)
    expect(fixture.product.ui.requestFor(fixture.context)).toBe(fixture.request)
    expect(await fixture.preview.read(fixture.promotion, fixture.context)).toEqual({ status: "ok", value: fixture.binding })
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(before))
    expect(fixture.events.producerCalls).toBe(0)
  } finally { await fixture.cleanup() }
})

for (const changed of ["principal", "authentication revocation", "policy", "installation", "project", "host"] as const) {
  test(`current-choice real authorization refuses ${changed} changes at final provider egress`, async () => {
    const fixture = await currentChoiceAuthorityFixture()
    try {
      expect((await fixture.preview.read(fixture.promotion, fixture.context)).status).toBe("ok")
      const before = await fixture.snapshot()
      fixture.hooks.afterFinalCapture = async () => {
        fixture.events.applied += 1
        if (changed === "principal") fixture.authenticated.principal = "another-person"
        if (changed === "authentication revocation") fixture.authenticated.active = false
        if (changed === "policy") fixture.changePolicy()
        if (changed === "installation") fixture.identity.installationId = "other-installation"
        if (changed === "project") fixture.identity.projectId = "other-project"
        if (changed === "host") fixture.identity.hostId = "other-host"
      }
      const read = await fixture.preview.read(fixture.promotion, fixture.context)
      expect(fixture.events.applied).toBe(1)
      expect(fixture.events.finalAuthorization).toBe(1)
      expect(read.status).not.toBe("ok")
      expect(read).not.toHaveProperty("value")
      expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(before))
      expect(fixture.events.producerCalls).toBe(0)
    } finally { await fixture.cleanup() }
  })
}

for (const changed of ["source", "case"] as const) {
  test(`current-choice joint fence observes a real ${changed} commit after source verification`, async () => {
    const fixture = await currentChoiceAuthorityFixture()
    try {
      expect((await fixture.preview.read(fixture.promotion, fixture.context)).status).toBe("ok")
      const originalChoice = digestSfValue(fixture.choice)
      fixture.hooks.afterSources = async () => {
        fixture.events.applied += 1
        if (changed === "source") await fixture.changeSource()
        if (changed === "case") await fixture.changeCase()
      }
      const read = await fixture.preview.read(fixture.promotion, fixture.context)
      expect(fixture.events.applied).toBe(1)
      expect(read.status).not.toBe("ok")
      expect(read).not.toHaveProperty("value")
      expect(await fixture.product.ui.revalidate(fixture.context)).toBe(true)
      const after = await fixture.outside.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
      expect(after.status).toBe("ok")
      if (after.status !== "ok" || !after.value) throw new Error("Current case unavailable after real race")
      expect(after.value.version).toBe(changed === "case" ? 3 : 2)
      expect(digestSfValue(after.value.choices[0])).toBe(originalChoice)
      expect(after.value.preparedChanges).toEqual([])
      expect(after.value.receipts).toEqual([])
      expect(fixture.events.producerCalls).toBe(0)
    } finally { await fixture.cleanup() }
  })
}
