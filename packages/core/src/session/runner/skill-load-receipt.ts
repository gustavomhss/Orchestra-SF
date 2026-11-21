import { Effect } from "effect"
import type { SessionMessage } from "../message"
import type { SessionSchema } from "../schema"
import type { Interface } from "./execution-host"

declare const brand: unique symbol
export type SkillLoadReceipt = { readonly [brand]: never }
export type SkillLoadFacts = Readonly<{
  sessionID: SessionSchema.ID
  skillName: string
  loadedMessageID: SessionMessage.ID
  source: Readonly<{ key: string; reserved: boolean; location: string; contentDigest: string }>
}>

const receipts = new WeakMap<object, { host: Interface; facts: SkillLoadFacts; valid: () => boolean }>()

export function consumeSkillLoad(receipt: unknown, host: Interface): SkillLoadFacts | undefined {
  if (typeof receipt !== "object" || receipt === null) return undefined
  const entry = receipts.get(receipt)
  if (!entry || entry.host !== host) return undefined
  receipts.delete(receipt)
  if (!entry.valid()) return undefined
  return entry.facts
}

// Internal to Core: the package exports only consumeSkillLoad and the opaque types.
export function notifySkillLoad(host: Interface, facts: SkillLoadFacts, valid: () => boolean) {
  return Effect.suspend(() => {
    if (!host.observeSkillLoad || !valid()) return Effect.succeed(false)
    const receipt = Object.freeze({
      toJSON: () => { throw new Error("Skill load receipts cannot be serialized") },
    }) as SkillLoadReceipt & { readonly toJSON: () => never }
    receipts.set(receipt, { host, valid, facts: Object.freeze({ ...facts, source: Object.freeze({ ...facts.source }) }) })
    return Effect.suspend(() => host.observeSkillLoad!(receipt)).pipe(
      Effect.map(() => valid()),
      Effect.ensuring(Effect.sync(() => { receipts.delete(receipt) })),
    )
  })
}
