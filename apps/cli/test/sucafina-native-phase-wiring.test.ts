import { expect, test } from "bun:test"
import path from "node:path"
import { Effect } from "effect"
import { ToolFailure } from "@orchestra/llm"
import type { SessionPrompt } from "@orchestra/core/host/session-prompt"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { sfNativePhaseBeforePrompt } from "../src/sucafina-product/host-native-phase-prompt.ts"

const parent = {
  session: { id: "ses_sfphase_test" } as SessionSchema.Info,
  messageID: "msg_phase_test",
  prompt: { text: "Exact original command" },
  delivery: "steer",
} as Parameters<SessionPrompt.Observer>[0]

test("native phase prompt refuses an unleased parent before durable admission", async () => {
  let called = false
  await expect(Effect.runPromise(sfNativePhaseBeforePrompt({
    beforeTurn: () => Effect.fail(new ToolFailure({ message: "SF_NATIVE_PHASE_ORIGINAL_SOURCE_REQUIRED" })),
    verifiedGovernedLoad: async () => true,
  }, parent, () => Effect.sync(() => { called = true })))).rejects.toThrow("SF_NATIVE_PHASE_ORIGINAL_SOURCE_REQUIRED")
  expect(called).toBe(false)
})

test("native phase prompt refuses a parent with no authentic governed skill witness", async () => {
  let called = false
  await expect(Effect.runPromise(sfNativePhaseBeforePrompt({
    beforeTurn: () => Effect.void,
    verifiedGovernedLoad: async () => false,
  }, parent, () => Effect.sync(() => { called = true })))).rejects.toThrow("SF_NATIVE_PHASE_GOVERNED_PLAYBOOK_RECEIPT_REQUIRED")
  expect(called).toBe(false)
})

test("native phase prompt forwards the exact original prompt, message id and delivery", async () => {
  const observed: unknown[] = []
  await Effect.runPromise(sfNativePhaseBeforePrompt({
    beforeTurn: () => Effect.void,
    verifiedGovernedLoad: async () => true,
  }, parent, (event) => Effect.sync(() => { observed.push(event) })))
  expect(observed).toEqual([parent])
  expect(observed[0]).toBe(parent)
})

test("unrelated prompts retain the original observer and require no phase skill", async () => {
  const unrelated = { ...parent, session: { id: "ses_normal" } as SessionSchema.Info }
  let receiptsRequested = 0
  await Effect.runPromise(sfNativePhaseBeforePrompt({
    beforeTurn: () => Effect.void,
    verifiedGovernedLoad: async () => { receiptsRequested++; return false },
  }, unrelated, (event) => Effect.sync(() => { expect(event).toBe(unrelated) })))
  expect(receiptsRequested).toBe(0)
})

const src = (name: string) => Bun.file(path.resolve(import.meta.dir, "../src/sucafina-product", name)).text()

test("host composes original contributions with the native phase services and owner hook", async () => {
  const host = await src("host-context.ts")
  expect(host).toContain("ownerHook: () => ({ run: nativePhases.phase.withInvocation })")
  expect(host).toContain("nativePhases.contribution, nativePhasePrompt")
  expect(host).toContain("const installed = nativePhases.services.descriptors")
  expect(host).toContain("...nativePhases.routines")
  expect(host).toContain("routines: nativePhases.routines")
  expect(host).toContain("routineRuns: nativePhases.services.routineRuns")
  expect(host).not.toContain('context.kind !== "ui" || !nativeRoutineProducer')
})

test("native catalog and prepare retain consumed Request and refuse new run without human", async () => {
  const host = await src("host-context.ts")
  const bridge = await src("routine-native-phase-composition.ts")
  expect(host).toContain("requestFor: authority.host.requestFor")
  expect(host).toContain("authorize: authority.authority.revalidateDomainContext")
  expect(host).toContain("authorizeRun: authorizeNativeHumanRun")
  expect(bridge).toContain('planning(context, { operation: "catalog", purpose }')
  expect(bridge).toContain('planning(context, { operation: "prepare", request }')
  expect(bridge).toContain("native-human-run-continuation-required")
})

test("native history must provide an original verified run/admission reference", async () => {
  const bridge = await src("routine-native-phase-composition.ts")
  const registry = await src("routine-native-registry.ts")
  expect(bridge).toContain('operation: "read-run", reference')
  expect(bridge).toContain('operation: "read-admission", reference')
  expect(bridge).toContain("if (!intent) return undefined")
  expect(registry).toContain('context.kind === "native"')
  expect(registry).toContain("context.binding.nativeSessionId")
})

test("generation, Request abort and dispose close native phase alongside original admission hooks", async () => {
  const host = await src("host-context.ts")
  expect(host).toContain("nativePhases.phase.invalidateGeneration(generation)")
  expect(host).toContain("routineOwners.invalidateGeneration(generation)")
  expect(host).toContain("nativePhases.phase.revoke(request.request)")
  expect(host).toContain("routineOwners.revoke(request.request)")
  expect(host).toContain("nativePhases.phase.dispose(); nativePhases.admission.dispose(); routineOwners.dispose()")
})
