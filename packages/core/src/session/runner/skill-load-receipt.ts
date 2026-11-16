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

const receipts = new WeakMap<object, { host: Interface; facts: SkillLoadFacts }>()

export function consumeSkillLoad(receipt: unknown, host: Interface): SkillLoadFacts | undefined {
  if (typeof receipt !== "object" || receipt === null) return undefined
  const entry = receipts.get(receipt)
  if (!entry || entry.host !== host) return undefined
  receipts.delete(receipt)
  return entry.facts
}

// Internal to Core: the package exports only consumeSkillLoad and the opaque types.
export function notifySkillLoad(host: Interface, facts: SkillLoadFacts) {
  return Effect.suspend(() => {
    if (!host.observeSkillLoad) return Effect.void
    const receipt = Object.freeze({ toJSON: () => { throw new Error("Skill load receipts cannot be serialized") } }) as SkillLoadReceipt
    receipts.set(receipt, { host, facts: Object.freeze({ ...facts, source: Object.freeze({ ...facts.source }) }) })
    return Effect.suspend(() => host.observeSkillLoad!(receipt)).pipe(
      Effect.ensuring(Effect.sync(() => { receipts.delete(receipt) })),
    )
  })
}
