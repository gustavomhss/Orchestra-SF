import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionMessage } from "@orchestra/core/session/message"
import type { ToolRegistry } from "@orchestra/core/tool/registry"
import { Effect } from "effect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { plannerFixture, plannerPeriod } from "../../wp03/planner-fixture.ts"
import { withSkillHost } from "../../workbench-mcp-closure/skill-host-fixture.ts"
import type { SfVerifiedCallObserver } from "../../../product/host-binding/verified-call.ts"

// This executes the actual public Host.Contribution, SessionV2 skill loading,
// ToolRegistry, MCP bridge, Planner producer and SQLite persistence. The Planner
// fixture's Request principals are deterministic test authorities, NOT corporate
// installation grants, model turns, an installed process restart or AM03 PASS.
test("AM03 public discovery cannot authorize a revoked actor; another same-profile session survives, old generation cannot revive", async () => {
  const fixture = await plannerFixture()
  const verified: Parameters<SfVerifiedCallObserver>[] = []
  try {
    const descriptor = createPlannerCapabilities(fixture.planner, fixture.authority.receiptFor)
      .find((item) => item.id === "sf_forecast_compare")
    if (!descriptor) throw new Error("Real Planner forecast capability unavailable")
    const payloads = await Promise.all((["finance", "admin"] as const).map(async (principal, index) => {
      const read = await fixture.admit("sf-human:planner.read", {}, principal, true)
      try {
        const sources = await Promise.all(["v0", index === 0 ? "v1" : "v2"].map((id) => fixture.issueSource(id, read)))
        if (sources.some((item) => item.status !== "ok")) throw new Error("Actual actor-scoped Planner sources unavailable")
        if (sources[0]!.status !== "ok" || sources[1]!.status !== "ok") throw new Error("Source admission missing")
        return { baseRef: sources[0].value.evidence.refId, candidateRef: sources[1].value.evidence.refId,
          period: plannerPeriod, currency: "USD" }
      } finally { fixture.ui.finish(read) }
    }))
    expect(payloads[0]!.baseRef).not.toBe(payloads[1]!.baseRef)
    const official = (await fixture.readSnapshot()).data.versions
    const evidence = await withSkillHost((host) => Effect.gen(function* () {
      const parent = host.bundle.selected.find((item) => item.profile.id === "sf_finance")
      const skill = parent?.skills.find((item) => item.id === "sf-explicar-forecast")
      if (!parent || !skill) throw new Error("Original resident profile and distributed skill missing")
      const selected = { ...parent, skills: [skill], operationIds: [descriptor.id] }
      const agent = yield* host.agents.get(AgentV2.ID.make(parent.profile.id))
      if (!agent) throw new Error("Original resident agent not registered")
      const tools = yield* host.tools.materialize(agent.permissions)
      expect(tools.definitions.some((item) => item.name === descriptor.id)).toBe(true)
      const settle = (input: ToolRegistry.ExecuteInput) => tools.settle(input)
        .pipe(Effect.provide(host.locations.get(host.location)))
      const register = (principal: "finance" | "admin", suffix: string, payload: typeof payloads[number]) => Effect.gen(function* () {
        const created = yield* host.session.create({ location: host.location, agent: agent.id })
        const loaded = yield* loadSfSkill({ session: host.session, skills: host.skills,
          sourceCapability: host.sourceCapability, selected, sessionID: created.id, profile: selected.profile,
          skill, runId: "am03-functional-" + suffix, manifestDigest: selected.manifestDigest })
        const request = new Request("https://example.test/am03/public-tool", { headers: { authorization: principal } })
        const admission = yield* Effect.promise(() => fixture.registry.bind({
          request, selected, sessionID: created.id, runId: loaded.runId,
          caseRef: { id: "am03-case-" + suffix, incarnation: "am03-inc-" + suffix, version: 1 },
          profile: selected.profile, manifestDigest: selected.manifestDigest,
          skillReceipts: [loaded], entryMode: "interactive",
        }))
        if (admission.status !== "ok") throw new Error("Real fixture admission denied: " + admission.reason)
        const input: ToolRegistry.ExecuteInput = { sessionID: created.id, agent: agent.id,
          assistantMessageID: SessionMessage.ID.create(),
          call: { type: "tool-call", id: "am03-tool-" + suffix, name: descriptor.id, input: payload } }
        return { created, loaded, request, binding: admission.value, input }
      })
      const first = yield* register("finance", "first", payloads[0]!)
      const second = yield* register("admin", "second", payloads[1]!)
      expect(first.binding.profileId).toBe(second.binding.profileId)
      expect(first.binding.nativeSessionId).not.toBe(second.binding.nativeSessionId)
      expect(first.binding.principalRef).not.toBe(second.binding.principalRef)
      expect(first.binding.caseId).not.toBe(second.binding.caseId)
      expect(first.loaded.loadedMessageId).not.toBe(second.loaded.loadedMessageId)

      // Probe genuine unconsumed registry lease identity, not a forged grant.
      const digest = digestSfValue(payloads[1])
      const probe = yield* Effect.promise(() => fixture.registry.lease({
        sessionID: second.created.id, agent: agent.id, assistantMessageID: SessionMessage.ID.create(),
        toolCallID: "am03-original-lease-probe",
      }, descriptor.id, digest))
      if (probe.status !== "ok") throw new Error("Unconsumed native call lease unavailable")
      for (const field of ["caseId", "caseIncarnation", "installationId", "hostId",
        "projectId", "locationId", "principalRef", "nativeSessionId", "runId",
        "policyVersion", "accessRevision", "manifestDigest"] as const) {
        const forged = { ...probe.value, binding: { ...probe.value.binding, [field]: "foreign-am03-" + field } }
        expect(yield* Effect.promise(() => fixture.registry.revalidate(forged))).toBe(false)
        expect(fixture.registry.consume(forged, descriptor.id, digest)).toBe(false)
        expect(fixture.registry.requestFor(forged)).toBeUndefined()
      }
      for (const binding of [
        { ...probe.value.binding, caseVersion: 9999 },
        { ...probe.value.binding, providerGeneration: 9999 },
        { ...probe.value.binding, profileId: "sf_reviewer" as const },
        { ...probe.value.binding, profileVersion: "forged" },
      ]) {
        const forged = { ...probe.value, binding }
        expect(yield* Effect.promise(() => fixture.registry.revalidate(forged))).toBe(false)
        expect(fixture.registry.consume(forged, descriptor.id, digest)).toBe(false)
      }
      expect((yield* Effect.promise(() => fixture.registry.lease({
        sessionID: second.created.id, agent: AgentV2.ID.make("sf_reviewer"),
        assistantMessageID: SessionMessage.ID.create(), toolCallID: "am03-forged-role",
      }, descriptor.id, digest)))).toMatchObject({ status: "denied" })
      expect((yield* Effect.promise(() => fixture.registry.lease({
        sessionID: second.created.id, agent: agent.id,
        assistantMessageID: SessionMessage.ID.create(), toolCallID: "am03-forged-grant",
      }, "sf_routine_run", digest)))).toMatchObject({ status: "denied", reason: "operation-not-granted" })
      expect(yield* Effect.promise(() => fixture.registry.revalidate(probe.value))).toBe(true)
      fixture.registry.finish(probe.value)

      // Discovery preceded revocation; the first actual public tool execution
      // has never been dispatched. The other actor's binding is independent.
      fixture.registry.revoke(first.binding)
      const revoked = yield* settle(first.input)
      expect(revoked.output?.structured).toMatchObject({ status: "denied", receipt: { kind: "unbound" } })
      expect(Object.hasOwn(revoked.output?.structured ?? {}, "result")).toBe(false)
      expect(verified).toHaveLength(0)
      const survivor = yield* settle(second.input)
      expect(survivor.output?.structured).toMatchObject({ status: "ok",
        result: { knownDifference: 6000 }, receipt: { principalRef: "admin", nativeSessionId: second.created.id } })
      expect(verified).toHaveLength(1)

      // A changed provider generation rejects another public invocation even
      // though the Session, skill, tool listing and previous result still exist.
      fixture.access.generation = 2
      fixture.access.revision = "2"
      fixture.registry.invalidateGeneration(1)
      const old = yield* settle({ ...second.input,
        call: { ...second.input.call, id: "am03-old-generation-direct" } })
      expect(old.output?.structured).toMatchObject({ status: "denied", receipt: { kind: "unbound" } })
      expect(Object.hasOwn(old.output?.structured ?? {}, "result")).toBe(false)
      expect(verified).toHaveLength(1)
      fixture.access.generation = 1
      expect(yield* Effect.promise(() => fixture.registry.lease({
        sessionID: second.created.id, agent: agent.id,
        assistantMessageID: SessionMessage.ID.create(), toolCallID: "am03-generation-rollback",
      }, descriptor.id, digest))).toMatchObject({ status: "denied" })
      fixture.access.generation = 2

      const read = yield* Effect.promise(() => fixture.admit("sf-human:planner.read", {}, "admin", true))
      const updated = yield* Effect.promise(() => Promise.all(["v0", "v2"].map((id) => fixture.issueSource(id, read))))
      fixture.ui.finish(read)
      if (updated[0]?.status !== "ok" || updated[1]?.status !== "ok") throw new Error("New revision sources unavailable")
      const refreshed = { ...payloads[1]!, baseRef: updated[0].value.evidence.refId,
        candidateRef: updated[1].value.evidence.refId }
      const replacement = yield* register("admin", "fresh-after-generation", refreshed)
      expect(replacement.request).not.toBe(second.request)
      expect(replacement.created.id).not.toBe(second.created.id)
      expect(replacement.binding.providerGeneration).toBe(2)
      expect(replacement.binding.accessRevision).toBe("2")
      const answer = yield* settle(replacement.input)
      expect(answer.output?.structured).toMatchObject({ status: "ok",
        result: { knownDifference: 6000 }, receipt: { principalRef: "admin", providerGeneration: 2 } })
      expect(verified).toHaveLength(2)
      expect(yield* host.session.active).toEqual(new Set())
      return { independentSessions: 3, sameProfile: true, loadedSkillMessages: 3,
        publicDomainSuccesses: 2, revokedBeforeFirstDispatch: true, staleGenerationRefused: true,
        freshRequestAndSession: true, modelTurn: "NOT_RUN", installedRestart: "NOT_RUN" }
    }), { registry: fixture.registry, authority: fixture.authority,
      descriptors: [descriptor], onVerifiedCall: (...entry) => { verified.push(entry); return true } })
    expect((await fixture.readSnapshot()).data.versions).toEqual(official)
    console.info("SF_AM03_PUBLIC_REVOCATION_COMPONENT", JSON.stringify(evidence))
  } finally { await fixture.close() }
}, 90_000)

test("AM03 a previously discovered Planner source cannot be read after revocation or across principals", async () => {
  const fixture = await plannerFixture()
  try {
    const first = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const second = await fixture.admit("sf-human:planner.read", {}, "admin", true)
    try {
      const a = await fixture.issueSource("v0", first)
      const b = await fixture.issueSource("v0", second)
      if (a.status !== "ok" || b.status !== "ok") throw new Error("Two actor-specific sources required")
      expect(a.value.evidence.refId).not.toBe(b.value.evidence.refId)
      const aRead = await fixture.sources.resolveForecastSource(a.value.evidence.refId, first)
      expect(aRead.status).toBe("ok")
      const cross = await fixture.sources.resolveForecastSource(a.value.evidence.refId, second)
      expect(cross.status).not.toBe("ok")
      expect(Object.hasOwn(cross, "value")).toBe(false)
      const before = (await fixture.readSnapshot()).data.versions
      fixture.access.allowed = false
      const revokedDetail = await fixture.sources.resolveForecastSource(a.value.evidence.refId, first)
      const revokedCounterpart = await fixture.sources.resolveForecastSource(b.value.evidence.refId, second)
      for (const result of [revokedDetail, revokedCounterpart]) {
        expect(result.status).not.toBe("ok")
        expect(Object.hasOwn(result, "value")).toBe(false)
      }
      expect((await fixture.readSnapshot()).data.versions).toEqual(before)
      console.info("SF_AM03_SOURCE_REVOKE_COMPONENT", JSON.stringify({
        previouslyAvailable: true, crossActorDenied: true, revokedBeforeDetail: true,
        principalSourceResult: "DENIED", installedAuthority: "NOT_RUN" }))
    } finally {
      fixture.ui.finish(first)
      fixture.ui.finish(second)
    }
  } finally { await fixture.close() }
}, 60_000)
