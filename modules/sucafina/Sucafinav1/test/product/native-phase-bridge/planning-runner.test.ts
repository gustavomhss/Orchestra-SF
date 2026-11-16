import { expect, test } from "bun:test"
import path from "node:path"
import { readFile, writeFile } from "node:fs/promises"
import { AgentV2 } from "@orchestra/core/agent"
import { Host } from "@orchestra/core/host"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Cause, Deferred, Effect, Exit, Fiber } from "effect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfRoutinePhaseOrigin } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-origin.ts"
import { SF_ROUTINE_PHASE_SCOPE } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-scope.ts"
import { withPhaseFixture } from "./fixture.ts"

const posix = test.skipIf(process.platform === "win32")
posix("component: consumed POST -> narrowed parent -> original core Task; stale public drains/generate/compact/fork are fenced", () => withPhaseFixture((f) => Effect.gen(function* () {
  expect(() => Host.merge([f.bridge.contribution])).not.toThrow()
  yield* Effect.promise(() => f.state.request.text())
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "plan only" })
  expect(Exit.isFailure(yield* f.bridge.withPlanning({ ...source }, () => Effect.void).pipe(Effect.exit))).toBe(true)
  const root = yield* f.bridge.withPlanning(source, (lease) => Effect.gen(function* () {
    expect((yield* f.resources.store.scope(lease.authoritySessionID))?.scope).toEqual(SF_ROUTINE_PHASE_SCOPE)
    expect((yield* f.sessions.messages({ sessionID: lease.authoritySessionID })).some((message) => message.type === "synthetic" && message.text.startsWith("<skill_content name=\"maestro-run-governed\">"))).toBe(true)
    const children = (yield* f.sessions.list()).filter((session) => session.parentID === lease.authoritySessionID)
    expect(children).toHaveLength(1)
    expect<string | undefined>(children[0]?.agent).toBe("archie")
    expect(f.trace.issuers).toEqual(["core"])
    return lease.authoritySessionID
  }))
  const before = f.trace.requests.length
  expect(Exit.isFailure(yield* f.sessions.resume(root).pipe(Effect.exit))).toBe(true)
  expect(Exit.isFailure(yield* f.sessions.generate({ sessionID: root, prompt: "must not consume history" }).pipe(Effect.exit))).toBe(true)
  expect(Exit.isFailure(yield* f.sessions.compact({ sessionID: root }).pipe(Effect.exit))).toBe(true)
  const copied = yield* f.sessions.fork({ sessionID: root })
  expect(Exit.isFailure(yield* f.sessions.generate({ sessionID: copied.id, prompt: "copied history must stay fenced" }).pipe(Effect.exit))).toBe(true)
  const child = (yield* f.sessions.list()).find((session) => session.parentID === root)!
  const copiedChild = yield* f.sessions.fork({ sessionID: child.id })
  expect(Exit.isFailure(yield* f.sessions.resume(copiedChild.id).pipe(Effect.exit))).toBe(true)
  expect(f.trace.requests.length).toBe(before)
  const unrelated = yield* f.sessions.create({ location: f.resources.identity.location, agent: AgentV2.defaultID })
  expect(yield* f.sessions.generate({ sessionID: unrelated.id, prompt: "unrelated control" })).toBe("component answer")
})), 30_000)

posix("component: case/job/provider epochs isolate parents; stable by-Session proof preserves ORIGINAL host across rotation", () => withPhaseFixture((f) => Effect.gen(function* () {
  const roots: SessionSchema.ID[] = []
  for (const purpose of ["first job", "second job", "second job", "second job"]) {
    if (roots.length === 2) f.state.caseRef = { id: "other-case", incarnation: "other-incarnation", version: 1 }
    if (roots.length === 3) f.state.generation++
    f.state.request = new Request("https://phase-fixture.invalid/catalog", { method: "POST", body: "decoded" }); f.state.context = f.ui()
    const source = yield* f.bridge.issue(f.state.context, { operation: "catalog", purpose })
    roots.push(yield* f.bridge.withPlanning(source, (lease) => Effect.succeed(lease.authoritySessionID)))
  }
  expect(new Set(roots).size).toBe(4)
  const origin = createSfRoutinePhaseOrigin(f.input.originDirectory)
  const proof = yield* Effect.promise(() => origin.readSession(f.resources, f.state.context!, roots[0]!))
  expect(proof?.hostId).toBe("phase-host")
  const next = { ...f.resources, identity: { ...f.resources.identity, hostId: "different-process-host" } }
  expect((yield* Effect.promise(() => origin.readSession(next, f.state.context!, roots[0]!)))?.hostId).toBe("phase-host")
  expect(yield* Effect.promise(() => origin.read(next, f.state.context!, proof!.scope))).toBeUndefined()
  // Storage/Session proof is not a history grant: a canonical admission/run locator and fresh case/source rights are required.
  expect(Exit.isFailure(yield* f.bridge.issue(f.state.context!, { operation: "read-run", reference: "ses_unbound" }).pipe(Effect.exit))).toBe(true)
  const file = path.join(f.input.originDirectory, `session-${digestSfValue({ installationId: proof!.installationId,
    projectId: proof!.projectId, locationId: proof!.locationId, principalRef: proof!.principalRef, sessionID: roots[0] })}.json`)
  const text = yield* Effect.promise(() => readFile(file, "utf8"))
  yield* Effect.promise(() => writeFile(file, text.replace("phase-principal", "forged-principal")))
  expect(Exit.isFailure(yield* Effect.tryPromise(() => origin.readSession(next, f.state.context!, roots[0]!)).pipe(Effect.exit))).toBe(true)
})), 30_000)

posix("component: Request revoke interrupts only its owned original runner and Task child", () => withPhaseFixture((f) => Effect.gen(function* () {
  f.trace.holdChild = true
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "plan only" })
  const running = yield* Effect.forkDetach(f.bridge.withPlanning(source, () => Effect.void).pipe(Effect.exit))
  yield* Deferred.await(f.trace.childStarted)
  f.bridge.revoke(f.state.request)
  const exit = yield* Fiber.join(running)
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.hasInterrupts(exit.cause)).toBe(true)
  expect(yield* f.execution.active).toEqual(new Set())
})), 30_000)

posix("component: scoped Claude parent reports the missing genuine governed-load observer BEFORE business prompt/provider work", () => withPhaseFixture((f) => Effect.gen(function* () {
  yield* f.resources.agents.transform((editor) => editor.update(AgentV2.defaultID, (agent) => { agent.engine = "claude-code" }))
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "blocked engine" })
  const exit = yield* f.bridge.withPlanning(source, () => Effect.void).pipe(Effect.exit)
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.pretty(exit.cause)).toContain("SF_NATIVE_PHASE_GOVERNED_HOST_RECEIPT_API_REQUIRED")
  expect(f.trace.requests).toEqual([])
  expect((yield* f.sessions.list()).filter((session) => session.id.startsWith("ses_sfphase_")).length).toBe(1)
  const root = (yield* f.sessions.list()).find((session) => session.id.startsWith("ses_sfphase_"))!
  expect((yield* f.sessions.messages({ sessionID: root.id })).some((message) => message.type === "user")).toBe(false)
})), 30_000)
