import { createEffect, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfContextHandle } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

type AnswerEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-read"]["output"]>
type AnswerValue = Extract<AnswerEnvelope, { status: "ok" }>["value"]
type PreparationEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-prepare"]["output"]>
type Preparation = Extract<PreparationEnvelope, { status: "ok" }>["value"]

/** Existing answer is read with recipient authorization; reuse requires a fresh CAS receipt. */
export function SfQuestionAnswer(props: Readonly<{
  owner: SfContextHandle
  question: SfCaseRecord["questions"][number]
  onConfirmed: () => void
}>) {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore<{
    answer?: AnswerValue
    prepared?: Preparation
    storageVersion?: number
    readState: SfUiState
    reviewState: SfUiState
  }>({ readState: "loading", reviewState: "empty" })
  let commandInFlight: AbortController | undefined
  onCleanup(() => commandInFlight?.abort())
  createEffect(() => {
    const active = props.owner.ready()
    const generation = props.owner.generation()
    const question = props.question
    setUi({ answer: undefined, prepared: undefined, storageVersion: undefined,
      readState: "loading", reviewState: "empty" })
    if (!question.answerRef) {
      setUi("readState", "empty")
      return
    }
    if (!active || !sfOperationReady(active.context, "collaboration.answer-read")) {
      setUi("readState", "unavailable")
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void createSfCollaborationClient(active.transport)["collaboration.answer-read"](
      { questionId: question.id }, { signal: controller.signal },
    ).then((response) => {
      if (controller.signal.aborted || props.owner.generation() !== generation) return
      if (response.kind === "transport-error") {
        setUi("readState", "unavailable")
        return
      }
      if (response.body.status !== "ok") {
        setUi("readState", sfFailureUiState(response.body.status, response.status))
        return
      }
      // Question and answer must still belong to the SAME source identity.
      if (response.body.value.answerRef !== question.answerRef) {
        setUi("readState", "stale")
        return
      }
      setUi({ answer: response.body.value, readState: "ready" })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      console.error("Sucafina answer read failed", error)
      setUi("readState", "unavailable")
    })
  })
  const mayReview = () => !!ui.answer && !!props.question.answerRef && !!props.owner.ready() &&
    sfOperationReady(props.owner.ready()!.context, "collaboration.answer-prepare") &&
    sfOperationReady(props.owner.ready()!.context, "collaboration.storage-version")
  const review = async () => {
    const active = props.owner.ready()
    const answerRef = props.question.answerRef
    if (!active || !answerRef || !mayReview() || !!commandInFlight) return
    const generation = props.owner.generation()
    const questionId = props.question.id
    commandInFlight = new AbortController()
    const signal = commandInFlight.signal
    setUi({ reviewState: "loading", prepared: undefined, storageVersion: undefined })
    try {
      const client = createSfCollaborationClient(active.transport)
      const preparation = await client["collaboration.answer-prepare"](
        { questionId, answerRef }, { signal },
      )
      if (signal.aborted || props.owner.generation() !== generation) return
      if (preparation.kind === "transport-error") {
        setUi("reviewState", "unavailable")
        return
      }
      if (preparation.body.status !== "ok") {
        setUi("reviewState", sfFailureUiState(preparation.body.status, preparation.status))
        return
      }
      if (preparation.body.value.answerRef !== answerRef || props.question.answerRef !== answerRef) {
        setUi("reviewState", "stale")
        return
      }
      const storage = await client["collaboration.storage-version"](
        { namespace: "threads" }, { signal },
      )
      if (signal.aborted || props.owner.generation() !== generation) return
      if (storage.kind === "transport-error") {
        setUi("reviewState", "unavailable")
      } else if (storage.body.status !== "ok") {
        setUi("reviewState", sfFailureUiState(storage.body.status, storage.status))
      } else {
        setUi({ prepared: preparation.body.value, storageVersion: storage.body.value, reviewState: "ready" })
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error("Sucafina answer preparation failed", error)
        setUi("reviewState", "unavailable")
      }
    } finally {
      commandInFlight = undefined
    }
  }
  const canConfirmReuse = () => {
    const ready = props.owner.ready()
    return !!ready && sfOperationReady(ready.context, "collaboration.answer-confirm")
  }
  const confirm = async () => {
    const active = props.owner.ready()
    const preparation = ui.prepared
    const storageVersion = ui.storageVersion
    if (!active || !preparation || storageVersion === undefined || ui.reviewState !== "ready" || !!commandInFlight ||
      !sfOperationReady(active.context, "collaboration.answer-confirm")) return
    const generation = props.owner.generation()
    const answerRef = props.question.answerRef
    if (answerRef !== preparation.answerRef) {
      setUi("reviewState", "stale")
      return
    }
    const idempotencyKey = crypto.randomUUID()
    commandInFlight = new AbortController()
    const signal = commandInFlight.signal
    setUi("reviewState", "loading")
    try {
      const result = await createSfCollaborationClient(active.transport)["collaboration.answer-confirm"](
        {
          questionId: props.question.id, answerRef: preparation.answerRef,
          mutation: {
            expectedStorageVersion: storageVersion,
            idempotencyKey,
            observationRef: preparation.observationRef,
            observedSourceVersion: preparation.observedSourceVersion,
            expectedScopeFingerprint: preparation.expectedScopeFingerprint,
          },
        },
        { signal, idempotencyKey },
      )
      if (signal.aborted || props.owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setUi("reviewState", "outcome-unknown")
      } else if (result.body.status !== "ok") {
        setUi("reviewState", sfFailureUiState(result.body.status, result.status))
      } else if (result.body.value.answerRef !== preparation.answerRef) {
        setUi("reviewState", "conflict")
      } else {
        setUi({ reviewState: "ready", prepared: undefined, storageVersion: undefined })
        props.onConfirmed()
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error("Sucafina answer confirmation outcome uncertain", error)
        setUi("reviewState", "outcome-unknown")
      }
    } finally {
      commandInFlight = undefined
    }
  }
  return (
    <section class="mx-card sf-n24-section" aria-label={t("sf.ui37.answer")}>
      <h3>{t("sf.ui37.answer")}</h3>
      <Show when={ui.reviewState !== "denied" && ui.reviewState !== "session-expired" && ui.readState === "ready" && ui.answer} fallback={
        ui.reviewState === "denied" || ui.reviewState === "session-expired" ? null :
        <SfStatePanel state={ui.readState}
          messageKey={"sf.ui37.noAnswers" as import("../../shared/frame").SfCopyKey} />
      }>
        {(answer) => <>
          <p><bdi>{answer().answer}</bdi></p>
          <p>{t("sf.ui37.recorded")}: <bdi>{answer().authorRef}</bdi> · {answer().observedVersion}</p>
          <button type="button" class="mx-btn"
            disabled={!mayReview() || ui.reviewState === "loading" || ui.reviewState === "outcome-unknown"}
            onClick={() => void review()}>{t("sf.ui37.answerPrepare")}</button>
        </>}
      </Show>
      <Show when={ui.reviewState === "ready" ? ui.prepared : undefined}>
        {(prepared) => <section class="sf-n24-review" role="group" aria-label={t("sf.ui37.answerSelected")}>
          <p><bdi>{prepared().answer}</bdi></p>
          <p><bdi>{prepared().authorRef}</bdi> · {prepared().observedSourceVersion}</p>
          <button class="mx-btn primary" type="button"
            disabled={!canConfirmReuse()}
            onClick={() => void confirm()}>{t("sf.ui37.answerConfirm")}</button>
        </section>}
      </Show>
      <Show when={ui.reviewState === "denied" || ui.reviewState === "session-expired"}>
        <SfStatePanel
          state={ui.reviewState}
          messageKey={(ui.reviewState === "session-expired" ? "sf.common.loginAgain" : "sf.common.noAccess") as import("../../shared/frame").SfCopyKey}
        />
      </Show>
      <Show when={ui.reviewState === "outcome-unknown" || ui.reviewState === "conflict" || ui.reviewState === "stale"}>
        <SfStatePanel state={ui.reviewState} messageKey={"sf.ui37.answerUnknown" as import("../../shared/frame").SfCopyKey} />
      </Show>
    </section>
  )
}
