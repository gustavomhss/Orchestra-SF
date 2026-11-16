export * as SessionPrompt from "./session-prompt"

import { Context, Effect, Layer } from "effect"
import type { PromptInput } from "@orchestra/schema/prompt-input"
import { makeGlobalNode } from "../effect/app-node"
import type { SessionInput } from "../session/input"
import type { SessionMessage } from "../session/message"
import type { SessionSchema } from "../session/schema"
import type { ToolSafety } from "../tool-safety"

/** Runs before a new prompt is admitted. Hosts may replace this node, but not SessionV2. */
export type Observer = (input: Readonly<{
  session: SessionSchema.Info
  messageID: SessionMessage.ID
  prompt: PromptInput.Prompt
  delivery: SessionInput.Delivery
}>) => Effect.Effect<void, ToolSafety.Denied>

export interface Interface {
  readonly beforePrompt: Observer
}

export class Service extends Context.Service<Service, Interface>()("@orchestra/host/SessionPrompt") {}

export const node = makeGlobalNode({
  service: Service,
  layer: Layer.succeed(Service, Service.of({ beforePrompt: () => Effect.void })),
  deps: [],
})
