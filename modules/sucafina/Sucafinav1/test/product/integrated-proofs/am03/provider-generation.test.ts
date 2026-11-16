import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionMessage } from "@orchestra/core/session/message"
import { Effect } from "effect"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { loadSfSkill } from "../../../../product/host-binding/skill-loader.ts"
import { withSkillHost } from "../../workbench-mcp-closure/skill-host-fixture.ts"
import { plannerFixture } from "../../wp03/planner-fixture.ts"

// AM03 boundary counterproof. The registry, public Host.Contribution, SessionV2,
// distributed skill bytes and binding/lease implementation are real. The two
// principal grants are the existing Planner fixture's deterministic test admissions.
// This is NOT a process restart, installed identity, model invocation, scanner run,
// domain-call completion, exploit, or AM03 PASS. Those need hosted C evidence.
test("AM03: an invalidated provider generation cannot be revived; a new loaded session needs fresh Request authentication", async () => {
  const fixture = await plannerFixture()
  const priorSnapshot = await fixture.readSnapshot()
  try {
    const observation = await withSkillHost((host) => Effect.gen(function* () {
      const registered = host.bundle.selected.find((item) => item.profile.id === "sf_finance")
      const skill = registered?.skills.find((item) => item.id === "sf-explicar-forecast")
      if (!registered || !skill) throw new Error("The actual distributed finance skill is required")
      const selected = { ...registered, skills: [skill], operationIds: ["sf_forecast_compare"] }
      const digest = digestSfValue({ case: "am03-generation-counterproof" })
      const register = (principal: "finance" | "admin", suffix: string) => Effect.gen(function* () {
        const created = yield* host.session.create({ location: host.location, agent: AgentV2.ID.make(selected.profile.id) })
        const loaded = yield* loadSfSkill({
          session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
          selected, sessionID: created.id, profile: selected.profile, skill,
          runId: "am03-generation-" + suffix, manifestDigest: selected.manifestDigest,
        })
        const loadedMessages = yield* host.session.messages({ sessionID: created.id })
        expect(loadedMessages.some((message) => message.id === loaded.loadedMessageId)).toBe(true)
        const request = new Request("https://example.test/am03/authorization", { method: "POST", headers: { authorization: principal } })
        const bound = yield* Effect.promise(() => fixture.registry.bind({
          request, selected, sessionID: created.id, runId: loaded.runId,
          caseRef: { id: "am03-case-" + suffix, incarnation: "am03-inc-" + suffix, version: 1 },
          profile: selected.profile, manifestDigest: selected.manifestDigest,
          skillReceipts: [loaded], entryMode: "interactive",
        }))
        if (bound.status !== "ok") throw new Error("Existing fixture authentication refused: " + bound.reason)
        return {
          request, bound: bound.value, created, loaded,
          context: {
            sessionID: created.id, agent: AgentV2.ID.make(selected.profile.id),
            assistantMessageID: SessionMessage.ID.create(), toolCallID: "am03-call-" + suffix,
          },
        }
      })
      const [first, second] = yield* Effect.all([register("finance", "first"), register("admin", "second")], { concurrency: 2 })
      expect(first.bound.profileId).toBe(second.bound.profileId)
      expect(first.bound.nativeSessionId).not.toBe(second.bound.nativeSessionId)
      expect(first.bound.caseId).not.toBe(second.bound.caseId)
      expect(first.bound.principalRef).not.toBe(second.bound.principalRef)
      expect(first.loaded.loadedMessageId).not.toBe(second.loaded.loadedMessageId)
      expect(first.bound.providerGeneration).toBe(1)
      expect(second.bound.providerGeneration).toBe(1)

      const firstLease = yield* Effect.promise(() => fixture.registry.lease(first.context, "sf_forecast_compare", digest))
      const secondLease = yield* Effect.promise(() => fixture.registry.lease(second.context, "sf_forecast_compare", digest))
      if (firstLease.status !== "ok" || secondLease.status !== "ok")
        throw new Error("Real registry refused the existing fixture's two separate bindings")
      expect(fixture.registry.consume(firstLease.value, "sf_forecast_compare", digest)).toBe(true)
      expect(yield* Effect.promise(() => fixture.registry.revalidate(secondLease.value))).toBe(true)
      expect(fixture.registry.requestFor(firstLease.value)).toBe(first.request)
      expect(fixture.registry.requestFor(secondLease.value)).toBeUndefined()
      // Direct substitution after issuance cannot borrow a live opaque lease.
      for (const field of ["caseId", "caseIncarnation", "installationId", "projectId", "locationId", "principalRef"] as const) {
        const forged = { ...secondLease.value, binding: { ...secondLease.value.binding, [field]: "foreign-am03-" + field } }
        expect(yield* Effect.promise(() => fixture.registry.revalidate(forged))).toBe(false)
        expect(fixture.registry.consume(forged, "sf_forecast_compare", digest)).toBe(false)
        expect(fixture.registry.requestFor(forged)).toBeUndefined()
      }
      // The original unconsumed lease must still work after all forged attempts:
      // these denials are binding-identity failures, not replay failures.
      expect(yield* Effect.promise(() => fixture.registry.revalidate(secondLease.value))).toBe(true)
      expect(fixture.registry.consume(secondLease.value, "sf_forecast_compare", digest)).toBe(true)
      expect(fixture.registry.requestFor(secondLease.value)).toBe(second.request)
      expect((yield* Effect.promise(() => fixture.registry.lease({
        ...second.context, toolCallID: "am03-forbidden-direct",
      }, "sf_routine_run", digest)))).toMatchObject({ status: "denied", reason: "operation-not-granted" })
      expect((yield* Effect.promise(() => fixture.registry.lease({
        ...second.context, toolCallID: "am03-role-direct", agent: AgentV2.ID.make("sf_reviewer"),
      }, "sf_forecast_compare", digest)))).toMatchObject({ status: "denied" })

      // Real registry pin, not a simulated provider restart. The component
      // fixture's generation switch only proves a stale reference cannot revive.
      fixture.access.generation = 2
      fixture.access.revision = "2"
      fixture.registry.invalidateGeneration(1)
      for (const entry of [first, second]) {
        expect((yield* Effect.promise(() => fixture.registry.lease({
          ...entry.context, toolCallID: "am03-stale-" + entry.bound.principalRef,
        }, "sf_forecast_compare", digest)))).toMatchObject({ status: "denied" })
      }
      expect(yield* Effect.promise(() => fixture.registry.revalidate(firstLease.value))).toBe(false)
      expect(yield* Effect.promise(() => fixture.registry.revalidate(secondLease.value))).toBe(false)
      expect(fixture.registry.requestFor(firstLease.value)).toBeUndefined()
      expect(fixture.registry.requestFor(secondLease.value)).toBeUndefined()
      fixture.access.generation = 1
      expect(yield* Effect.promise(() => fixture.registry.revalidate(secondLease.value))).toBe(false)
      fixture.access.generation = 2

      // A different Request and freshly loaded native Session, not reusing a
      // stale binding, can be authenticated for the new provider generation.
      const replacement = yield* register("admin", "replacement")
      expect(replacement.request).not.toBe(second.request)
      expect(replacement.created.id).not.toBe(second.created.id)
      expect(replacement.bound.runId).not.toBe(second.bound.runId)
      expect(replacement.bound.providerGeneration).toBe(2)
      expect(replacement.bound.accessRevision).toBe("2")
      expect((yield* Effect.promise(() => fixture.registry.lease({
        ...second.context, toolCallID: "am03-old-session-reused",
      }, "sf_forecast_compare", digest)))).toMatchObject({ status: "denied" })
      const newLease = yield* Effect.promise(() => fixture.registry.lease(replacement.context, "sf_forecast_compare", digest))
      if (newLease.status !== "ok") throw new Error("New authenticated fixture binding was not admitted")
      expect(yield* Effect.promise(() => fixture.registry.revalidate(newLease.value))).toBe(true)
      expect(fixture.registry.consume(newLease.value, "sf_forecast_compare", digest)).toBe(true)
      expect(fixture.registry.requestFor(newLease.value)).toBe(replacement.request)
      fixture.registry.finish(newLease.value)
      expect(fixture.registry.requestFor(newLease.value)).toBeUndefined()
      fixture.registry.revoke(replacement.bound)
      expect(yield* Effect.promise(() => fixture.registry.revalidate(newLease.value))).toBe(false)
      expect((yield* host.session.active).size).toBe(0)
      return {
        result: "COMPONENT_BOUNDARY_ONLY",
        twoActorsSameProfile: true, nativeCoreSessions: 3,
        actualSkillLoading: 3, oldGeneration: 1, newGeneration: 2,
        freshRequestRequired: true, freshSessionRequired: true,
        negativeDirectFields: ["caseId", "caseIncarnation", "installationId", "projectId", "locationId", "principalRef"],
        outsideGrantWithoutDiscovery: true,
        excluded: ["installed host restart", "real corporate grants", "provider turn/model", "scanner",
          "domain handler/bridge correlation", "source/cache egress", "AM03 acceptance"],
      }
    }), { registry: fixture.registry, authority: fixture.authority })
    expect(await fixture.readSnapshot()).toEqual(priorSnapshot)
    console.info("SF_AM03_PROVIDER_GENERATION_COMPONENT", JSON.stringify(observation))
  } finally {
    await fixture.close()
  }
}, 30_000)
