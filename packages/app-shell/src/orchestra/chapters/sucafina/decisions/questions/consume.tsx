import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { snapshotDecisionRequest } from "../intent/request"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfContextHandle } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

type OutputEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.question-output"]["output"]>
type Contribution = Extract<OutputEnvelope, { status: "ok" }>["value"]
type ConsumptionEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.question-consume"]["output"]>
type Consumed = Extract<ConsumptionEnvelope, { status: "ok" }>["value"]

/**
 * U17 question proposal confirmation. Only A13 reads the original workbench
 * output and persists the question thread. A resultRef is never a receipt and
 * does not imply consumption. Source and storage versions are revalidated.
 */
export function SfQuestionConsume(props: Readonly<{
  owner: SfContextHandle
  caseRecord: SfCaseRecord
  outputRef: string
  onConsumed: () => void
}>) {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore<{
    state: SfUiState
    contribution?: Contribution
    sourceRef: string
    expectedStorageVersion?: number
    consumed?: Consumed
    submitting: boolean
  }>({ state: "loading", sourceRef: "", submitting: false })
  let commandAbort: AbortController | undefined
  onCleanup(() => commandAbort?.abort())
  createEffect(() => {
    const ready = props.owner.ready()
    const current = props.caseRecord
    const ref = props.outputRef
    const generation = props.owner.generation()
    setUi({ state: "loading", contribution: undefined, expectedStorageVersion: undefined,
      sourceRef: "", consumed: undefined, submitting: false })
    commandAbort?.abort()
    if (!ready || !ref || !sfOperationReady(ready.context, "collaboration.question-output")
      || !sfOperationReady(ready.context, "collaboration.storage-version")) {
      setUi("state", "unavailable")
      return
    }
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    const client = createSfCollaborationClient(ready.transport)
    const caseRef = { id: current.id, incarnation: current.incarnation, version: current.version }
    void (async () => {
      const output = await client["collaboration.question-output"]({ outputRef: ref, caseRef }, { signal: abort.signal })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (output.kind === "transport-error") { setUi("state", "unavailable"); return }
      if (output.body.status !== "ok") { setUi("state", sfFailureUiState(output.body.status, output.status)); return }
      const entry = output.body.value
      if (entry.kind !== "contribution" || entry.outputRef !== ref ||
          entry.caseRef.id !== current.id || entry.caseRef.incarnation !== current.incarnation ||
          entry.caseRef.version !== current.version || entry.result.expectedCaseVersion !== current.version) {
        setUi("state", "stale")
        return
      }
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (version.kind === "transport-error") { setUi("state", "unavailable"); return }
      if (version.body.status !== "ok") { setUi("state", sfFailureUiState(version.body.status, version.status)); return }
      setUi({
        state: "ready", contribution: entry, expectedStorageVersion: version.body.value,
        sourceRef: current.sourceRefs[0]?.refId ?? "",
      })
    })().catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina prepared question output read failed", error)
      setUi("state", "unavailable")
    })
  })
  const canConsume = () => {
    const ready = props.owner.ready()
    return !!ready && ui.state === "ready" && !!ui.contribution &&
      ui.expectedStorageVersion !== undefined && !!ui.sourceRef &&
      props.caseRecord.sourceRefs.some((source) => source.refId === ui.sourceRef) &&
      sfOperationReady(ready.context, "collaboration.question-consume") && !ui.submitting
  }
  const confirm = async () => {
    const ready = props.owner.ready()
    const contribution = ui.contribution
    const storageVersion = ui.expectedStorageVersion
    if (!ready || !contribution || storageVersion === undefined || !canConsume() || !!commandAbort) return
    const generation = props.owner.generation()
    const version = props.caseRecord.version
    const sourceRef = ui.sourceRef
    const idempotencyKey = crypto.randomUUID()
    const controller = new AbortController()
    commandAbort = controller
    setUi({ state: "loading", submitting: true })
    try {
      const result = await createSfCollaborationClient(ready.transport)["collaboration.question-consume"](snapshotDecisionRequest({
        proposal: contribution,
        sourceRef,
        period: props.caseRecord.horizon,
        mutation: { expectedStorageVersion: storageVersion, idempotencyKey },
      }), { signal: controller.signal, idempotencyKey })
      if (controller.signal.aborted || generation !== props.owner.generation()) return
      if (props.caseRecord.version !== version || !props.caseRecord.sourceRefs.some((source) => source.refId === sourceRef)) {
        setUi({ state: "stale", submitting: false })
        return
      }
      if (result.kind === "transport-error") {
        setUi({ state: "outcome-unknown", submitting: false })
        return
      }
      if (result.status === 401 || result.status === 403 || result.body.status !== "ok" || result.status !== 200) {
        setUi({ state: result.status === 401 ? "session-expired" : sfFailureUiState(result.body.status, result.status), submitting: false })
        return
      }
      setUi({ state: "ready", consumed: result.body.value, contribution: undefined,
        expectedStorageVersion: undefined, submitting: false })
      props.onConsumed()
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Sucafina question confirmation outcome unknown", error)
        setUi({ state: "outcome-unknown", submitting: false })
      }
    } finally {
      if (commandAbort === controller) commandAbort = undefined
    }
  }
  return (
    <section class="sf-n24-review" aria-label={t("sf.ui37.confirmation")}>
      <Show when={ui.consumed} fallback={
        <Show when={ui.state === "ready" && ui.contribution} fallback={
          <SfStatePanel
            state={ui.state}
            messageKey={(ui.state === "session-expired" ? "sf.common.loginAgain" : ui.state === "denied" ? "sf.common.noAccess" : ui.state === "conflict" || ui.state === "stale" ? "sf.ui37.versionChanged" : "sf.ui37.unavailable") as import("../../shared/frame").SfCopyKey} />
        }>
          {(contribution) => <>
            <p>{t("sf.ui37.proposalScope")}</p>
            <p><bdi>{contribution().result.question}</bdi></p>
            <p>{t("sf.ui35.version")}: {contribution().caseRef.version}</p>
            <p>{t("sf.ui35.horizon")}: {props.caseRecord.horizon.start} – {props.caseRecord.horizon.end}</p>
            <label class="sf-n24-field">
              <span>{t("sf.ui37.scope")}</span>
              <select value={ui.sourceRef} onChange={(event) => setUi("sourceRef", event.currentTarget.value)}
                disabled={ui.submitting}>
                <option value="">{t("sf.ui37.noEligible")}</option>
                <For each={props.caseRecord.sourceRefs}>
                  {(source) => <option value={source.refId}>{source.refId}</option>}
                </For>
              </select>
            </label>
            <button type="button" class="mx-btn primary" disabled={!canConsume()}
              onClick={() => void confirm()}>{t("sf.ui37.recordQuestion")}</button>
          </>}
        </Show>
      }>
        {(consumed) => <p role="status">{t("sf.ui37.recorded")}: <bdi>{consumed().id}</bdi></p>}
      </Show>
    </section>
  )
}
