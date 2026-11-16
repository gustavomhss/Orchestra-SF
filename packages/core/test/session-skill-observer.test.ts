import { expect } from "bun:test"
import { LLMClient, LLMEvent } from "@orchestra/llm"
import { AgentV2 } from "@orchestra/core/agent"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { ExecutionHost } from "@orchestra/core/session/runner"
import { SessionRunnerModel } from "@orchestra/core/session/runner/model"
import { SkillV2 } from "@orchestra/core/skill"
import { SkillGuidance } from "@orchestra/core/skill/guidance"
import { SystemContext } from "@orchestra/core/system-context"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { Deferred, Effect, Layer, Stream } from "effect"
import { Harness, sessionID } from "./session-runner-harness"

let started: Deferred.Deferred<void> | undefined
let attempts = 0
// This harness is the only registered host for its Location, so it stands in for the
// selectable engine id the agent schema accepts; it refuses load observation.
const host: ExecutionHost.Interface = {
  id: "claude-code",
  stateKey: "refusing",
  observeSkillLoad: () => Effect.sync(() => { attempts++ }).pipe(Effect.andThen(Effect.die("observer refused"))),
  observedSkillLoad: () => Effect.succeed(undefined),
  stream: () => Stream.unwrap(Effect.gen(function* () {
    if (started) yield* Deferred.succeed(started, undefined)
    return Stream.make(LLMEvent.stepStart({ index: 0 }), LLMEvent.stepFinish({ index: 0, reason: "stop" }))
  })),
}
const it = Harness.make({
  client: Layer.succeed(LLMClient.Service, LLMClient.Service.of({
    prepare: () => Effect.die("unused"), stream: () => Stream.die("unused"), generate: () => Effect.die("unused"),
  })),
  models: SessionRunnerModel.layerWith(() => Effect.die("unused")),
  echo: Layer.effectDiscard(ToolRegistry.Service.use(() => Effect.void)),
  systemContext: Harness.systemContextLayer,
  skillGuidance: Layer.mock(SkillGuidance.Service, { load: () => Effect.succeed(SystemContext.empty) }),
  hosts: Layer.succeed(ExecutionHost.Service, ExecutionHost.of([host])),
  nodes: [SkillV2.node],
})

it.live("SessionV2.skill succeeds and resumes after delivery even if the host refuses observation", () => Effect.gen(function* () {
  yield* Harness.setup
  attempts = 0
  const resumed = yield* Deferred.make<void>()
  started = resumed
  const agents = yield* AgentV2.Service
  yield* agents.transform((draft) => draft.update(AgentV2.defaultID, (agent) => {
    agent.engine = host.id
    agent.mode = "primary"
  }))
  const skills = yield* SkillV2.Service
  yield* skills.transform((draft) => draft.source({ type: "embedded", skill: SkillV2.Info.make({
    name: "maestro-run-governed", location: AbsolutePath.make("/bundled.md"), content: "actual instructions",
  }) }, { reserved: true }))
  const session = yield* SessionV2.Service
  yield* session.skill({ sessionID, skill: "maestro-run-governed", resume: false })
  expect(attempts).toBe(1)
  expect((yield* session.messages({ sessionID })).some((message) => message.type === "synthetic" && message.text.includes("actual instructions"))).toBe(true)
  expect(yield* host.observedSkillLoad!({ sessionID, skillName: "maestro-run-governed" })).toBeUndefined()
  const missing = yield* Effect.exit(session.skill({ sessionID, skill: "missing", resume: false }))
  expect(missing._tag).toBe("Failure")
  yield* session.skill({ sessionID, skill: "maestro-run-governed" })
  yield* Deferred.await(resumed).pipe(Effect.timeout("10 seconds"))
  expect(attempts).toBe(2)
  expect(yield* host.observedSkillLoad!({ sessionID, skillName: "maestro-run-governed" })).toBeUndefined()
}))
