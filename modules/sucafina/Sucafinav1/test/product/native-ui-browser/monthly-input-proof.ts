import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfPlannerMonthlyApply } from "@orchestra/schema/sucafina/planner"
import { snapshotSfPlannerMonthlyDraft, type SfPlannerMonthlyDraftInput } from "@orchestra/client/sucafina/planner/monthly"

/** Exercise the real browser store and the exact input decoded before HTTP. */
export function proveNativeMonthlyDraft(input: SfPlannerMonthlyDraftInput) {
  const strict = (input: unknown) => Schema.decodeUnknownOption(SfPlannerMonthlyApply.input, { onExcessProperty: "error" })({ action: "apply", input })
  const originalAccepted = Option.isSome(strict(input)), originalJson = JSON.stringify(input)
  const raw = snapshotSfPlannerMonthlyDraft(input)
  const [store] = createStore({ input })
  const candidate = { ...store.input, drafts: store.input.drafts.filter(() => true) }
  const snapshot = snapshotSfPlannerMonthlyDraft(candidate)
  const plain: SfPlannerMonthlyDraftInput = JSON.parse(originalJson)
  const extra = { ...plain, drafts: plain.drafts.map((row) => ({ ...row, unexpectedJsonField: true })) }
  const [extraStore] = createStore({ input: extra })
  return {
    browserProxy: store.input !== input && store.input.drafts[0] !== input.drafts[0],
    storeSymbols: Reflect.ownKeys(store.input.drafts[0]!).some((key) => typeof key === "symbol"),
    originalAccepted,
    strictProxyRejected: Option.isNone(strict(candidate)),
    snapshotAccepted: !!snapshot && Option.isSome(strict(snapshot)),
    sameJson: !!raw && !!snapshot && JSON.stringify(raw) === JSON.stringify(snapshot) && JSON.stringify(raw) === originalJson,
    extraJsonRejected: snapshotSfPlannerMonthlyDraft(extra) === undefined,
    extraProxyJsonRejected: snapshotSfPlannerMonthlyDraft(extraStore.input) === undefined,
  }
}
