import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfDashboardDashboardHotTopicDraft } from "@orchestra/schema/sucafina/domain"
import { object, sourceDraft } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/private-draft-model.ts"
import type { CaseRef, Source } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/private-draft-model.ts"

/** Runs inside the real browser bundle; Node's Solid store export has no Proxy. */
export function proveNativePrivateDraft(source: Source, caseRef: CaseRef) {
  const raw = sourceDraft(source, caseRef)
  const [store] = createStore({ source, caseRef })
  const proxiedSource = store.source, proxiedCase = store.caseRef
  const proxyDraft = object(proxiedSource.draft), target = object(proxyDraft?.target)
  const proxied = sourceDraft(proxiedSource, proxiedCase)
  const strictProxy = Schema.decodeUnknownOption(SfDashboardDashboardHotTopicDraft.input, { onExcessProperty: "error" })({
    caseRef: proxiedCase, target: proxyDraft?.target, targetEvidence: proxyDraft?.targetEvidence, fields: proxyDraft?.fields,
    sourceRefs: [proxyDraft?.targetEvidence], expectedVersion: 0,
  })
  const extraSource = { ...source, draft: { ...object(source.draft),
    target: { ...object(object(source.draft)?.target), unexpectedJsonField: true } } }
  const extra = sourceDraft(extraSource, caseRef)
  const [extraStore] = createStore({ source: extraSource, caseRef })
  const extraProxy = sourceDraft(extraStore.source, extraStore.caseRef)
  return {
    browserProxy: proxiedSource !== source && proxiedCase !== caseRef,
    storeSymbols: !!target && Reflect.ownKeys(target).some((key) => typeof key === "symbol"),
    originalAccepted: !!raw,
    strictProxyRejected: Option.isNone(strictProxy),
    proxiedAccepted: !!proxied,
    sameJson: !!raw && !!proxied && JSON.stringify(raw) === JSON.stringify(proxied),
    extraJsonRejected: extra === undefined,
    extraProxyJsonRejected: extraProxy === undefined,
  }
}
