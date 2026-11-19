import type { HotTopicDraft } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft"
import type { DecisionCase } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"

export const initialCaseRef = { id: "private-case-identity", incarnation: "case-incarnation", version: 1 }
export type ProposalConfiguration = { directory: string; origin: string; installationId: string; controlKey: string }
export type ProposalReady = { actorId: string; cookie: string }
export type ProposalControlOperation = "observe" | "withdraw-write" | "withdraw-read" | "seed-choice"
export type ProposalObservation = {
  preferences: { status: string; value?: { keys: string[]; drafts: HotTopicDraft[] } }
  decision: { status: string; value?: DecisionCase }
  receipts: { status: string; value?: readonly unknown[] }
  record: Record<string, unknown>
  traffic: { mode: string | null; status: number; result: Record<string, unknown> }[]
}
