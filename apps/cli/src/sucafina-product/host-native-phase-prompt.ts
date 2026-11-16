import { Effect, Layer } from "effect"
import type { ToolFailure } from "@orchestra/llm"
import type { Host } from "@orchestra/core/host"
import { SessionPrompt } from "@orchestra/core/host/session-prompt"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { SF_ROUTINE_PHASE_PARENT_PREFIX } from "./routine-native-phase-fence.ts"

type Guard = Readonly<{
  beforeTurn: (session: SessionSchema.Info) => Effect.Effect<void, ToolFailure>
  verifiedGovernedLoad: (session: SessionSchema.Info) => Promise<boolean>
}>

/** Deny BEFORE the Core's durable Session.prompt admission. Never rewrite human text, delivery or IDs. */
export function sfNativePhaseBeforePrompt(
  guard: Guard, event: Parameters<SessionPrompt.Observer>[0], original: SessionPrompt.Observer,
): Effect.Effect<void, ToolSafety.Denied> {
  return Effect.gen(function* () {
    yield* guard.beforeTurn(event.session).pipe(Effect.mapError((error) =>
      new ToolSafety.Denied({ reason: error.message })))
    if (event.session.id.startsWith(SF_ROUTINE_PHASE_PARENT_PREFIX)) {
      const verified = yield* Effect.tryPromise({
        try: () => guard.verifiedGovernedLoad(event.session),
        catch: () => new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_GOVERNED_PLAYBOOK_RECEIPT_REQUIRED" }),
      })
      if (!verified) return yield* new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_GOVERNED_PLAYBOOK_RECEIPT_REQUIRED" })
    }
    yield* original(event)
  })
}

/** Original SessionPrompt remains the sole admission observer; this only replaces its global node. */
export function createSfNativePhasePromptContribution(guard: Guard): Host.Contribution {
  const replacement = {
    ...SessionPrompt.node,
    implementation: Layer.effect(SessionPrompt.Service, Effect.gen(function* () {
      const original = yield* SessionPrompt.Service
      return SessionPrompt.Service.of({
        beforePrompt: (event) => sfNativePhaseBeforePrompt(guard, event, original.beforePrompt),
      })
    })).pipe(Layer.provide(SessionPrompt.node.implementation!)),
  }
  return { id: "sucafina/native-phase-prompt", replacements: [[SessionPrompt.node, replacement]] }
}
