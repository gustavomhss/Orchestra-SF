import { A } from "@solidjs/router"
import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfCase, sfFailureUiState, sfOperationReady } from "../cases/model"
import { sfDecisionHref } from "../cases/route"
import { SfQuestionAnswer } from "./answer"
import { SfQuestionCycles } from "./cycles"
import { SfQuestionConsume } from "./consume"
import "../cases/n24.css"

type RecipientsEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.recipients"]["output"]>
type Recipient = Extract<RecipientsEnvelope, { status: "ok" }>["value"][number]
const k = (value: string) => value as SfCopyKey
type QuestionPhase = "editing" | "reviewing" | "preparing" | "prepared" | "unknown" | "invalid" | "unavailable" | "stale"

/** UI37: preparation is not a persisted thread; answers and cycles use A13. */
export function SfQuestionsView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const route = () => props.surfaceId === "UI37" ? props.route as SfSurfaceProps<"UI37">["route"] : undefined
  const caseRef = () => route() ? String(route()!.params.caseRef) : ""
  const caseData = useSfCase(caseRef)
  const [ui, setUi] = createStore<{
    text: string
    criterion: string
    recipient: string
    questionId: string
    recipients: readonly Recipient[]
    recipientState: SfUiState
    phase: QuestionPhase
    message: string
    proposal?: Readonly<{ caseRef: string; question: string; expectedCaseVersion: number; recipientRef?: string; criterionRef?: string; outputRef?: string }>
  }>({
    text: "", criterion: "", recipient: "", questionId: "",
    recipients: [], recipientState: "loading", phase: "editing", message: "",
  })
  const record = () => caseData.read.projection?.case
  const selectedQuestion = () => record()?.questions.find((question) => question.id === ui.questionId)
  let currentAction: AbortController | undefined
  onCleanup(() => currentAction?.abort())
  createEffect(() => {
    const active = caseData.owner.ready()
    const generation = caseData.owner.generation()
    const ref = caseRef()
    setUi({ recipients: [], recipientState: active ? "loading" : "unavailable",
      phase: "editing", proposal: undefined, text: "", criterion: "", recipient: "", questionId: "" })
    if (!active || !ref || !sfOperationReady(active.context, "collaboration.recipients")) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void createSfCollaborationClient(active.transport)["collaboration.recipients"](
      {}, { signal: controller.signal },
    ).then((result) => {
      if (controller.signal.aborted || caseData.owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setUi("recipientState", "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        setUi("recipientState", sfFailureUiState(result.body.status, result.status))
        return
      }
      setUi({ recipients: result.body.value, recipientState: "ready" })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      console.error("Sucafina recipient read failed", error)
      setUi("recipientState", "unavailable")
    })
  })
  const canPrepare = () => !!caseData.owner.ready() && !!record() &&
    sfOperationReady(caseData.owner.ready()!.context, "decisions.command.sf_question_prepare")
    && ui.phase !== "preparing" && ui.phase !== "unknown" && ui.phase !== "prepared"
  const preview = () => {
    if (!canPrepare()) return
    if (!ui.text.trim()) {
      setUi({ phase: "invalid", message: "sf.ui37.text" })
      return
    }
    // Do not silently substitute an unlisted recipient on a filtered read.
    if (ui.recipient && !ui.recipients.some((person) => person.id === ui.recipient)) {
      setUi({ phase: "invalid", message: "sf.ui37.noEligible" })
      return
    }
    if (ui.criterion && !record()?.criteria.some((criterion) => criterion.id === ui.criterion)) {
      setUi({ phase: "invalid", message: "sf.ui37.versionChanged" })
      return
    }
    setUi({ phase: "reviewing", message: "" })
  }
  const prepare = async () => {
    const active = caseData.owner.ready()
    const caseRecord = record()
    if (!active || !caseRecord || !canPrepare() || ui.phase !== "reviewing" || !!currentAction) return
    const original = caseRecord
    const currentGeneration = caseData.owner.generation()
    const request = {
      operation: "sf_question_prepare" as const,
      input: {
        caseRef: caseRef(),
        question: { text: ui.text.trim(), ...(ui.criterion ? { criterionRef: ui.criterion } : {}) },
        sourceRefs: [...original.sourceRefs],
        ...(ui.recipient ? { recipientRef: ui.recipient } : {}),
      },
    }
    const idempotencyKey = crypto.randomUUID()
    currentAction = new AbortController()
    const signal = currentAction.signal
    setUi({ phase: "preparing", message: "", proposal: undefined })
    try {
      const result = await createSfDecisionsClient(active.transport)["decisions.command.sf_question_prepare"](
        request, { signal, idempotencyKey },
      )
      if (signal.aborted || caseData.owner.generation() !== currentGeneration) return
      const latest = record()
      if (!latest || latest.version !== original.version || latest.incarnation !== original.incarnation) {
        setUi({ phase: "stale", message: "sf.ui37.versionChanged" })
        return
      }
      if (result.kind === "transport-error") {
        setUi({ phase: "unknown", message: "sf.ui37.pending" })
      } else if (result.body.status !== "ok") {
        const state = sfFailureUiState(result.body.status, result.status)
        setUi({ phase: state === "stale" || state === "conflict" ? "stale" : "unavailable", message: "sf.ui37.unavailable" })
      } else if (result.body.value.caseRef !== caseRef() ||
        result.body.value.expectedCaseVersion !== latest.version) {
        setUi({ phase: "stale", message: "sf.ui37.versionChanged" })
      } else {
        setUi({ phase: "prepared", message: "sf.ui37.proposal", proposal: {
          caseRef: result.body.value.caseRef,
          question: result.body.value.question,
          expectedCaseVersion: result.body.value.expectedCaseVersion,
          recipientRef: result.body.value.recipientRef,
          criterionRef: result.body.value.criterionRef,
          outputRef: result.body.outputRef,
        } })
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error("Sucafina question preparation outcome uncertain", error)
        setUi({ phase: "unknown", message: "sf.ui37.pending" })
      }
    } finally {
      currentAction = undefined
    }
  }

  return (
    <SfPageFrame
      titleKey={k("sf.ui37.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "answer-question", labelKey: k("sf.ui37.primary"), tone: "primary",
        disabled: !selectedQuestion()?.answerRef, busy: false,
        onInvoke: () => document.getElementById("sf-n24-answer-zone")?.focus(),
      }}
      secondaryActions={[{
        id: "refresh-questions", labelKey: k("sf.ui37.reload"), tone: "secondary",
        disabled: caseData.read.state === "loading", busy: false, onInvoke: () => caseData.reload(),
      }]}
    >
      <div class="sf-n24">
        <Show when={route()}>
          {(current) => <A class="mx-btn" href={sfDecisionHref(current(), "case", caseRef())}>{t("sf.ui35.return")}</A>}
        </Show>
        <Show when={caseData.read.state === "ready" && record()} fallback={
          <SfStatePanel state={caseData.read.state}
            messageKey={k(caseData.read.state === "loading" ? "sf.ui37.reading" : "sf.ui37.unavailable")}
            onRetryRead={() => caseData.reload()} />
        }>
          {(current) => <>
            <section class="mx-card sf-n24-section" aria-labelledby="sf-n24-questions-list">
              <h2 id="sf-n24-questions-list">{t("sf.ui37.question")}</h2>
              <Show when={current().questions.length} fallback={
                <SfStatePanel state="empty" messageKey={k("sf.ui37.noQuestions")} />
              }>
                <ul class="sf-n24-record-list">
                  <For each={current().questions}>
                    {(question) => <li class="sf-n24-review">
                      <div class="sf-n24-record">
                        <span><bdi>{question.text}</bdi></span>
                        <span><bdi>{question.state}</bdi></span>
                        <button type="button" class="mx-btn"
                          aria-pressed={ui.questionId === question.id}
                          onClick={() => setUi("questionId", question.id)}>{t("sf.ui37.primary")}</button>
                      </div>
                    </li>}
                  </For>
                </ul>
              </Show>
            </section>
            <section class="mx-card sf-n24-section" aria-labelledby="sf-n24-new-question">
              <h2 id="sf-n24-new-question">{t("sf.ui37.prepare")}</h2>
              <form onSubmit={(event) => {
                event.preventDefault()
                if (ui.phase === "reviewing") void prepare()
                else preview()
              }}>
                <div class="sf-n24-form-grid">
                  <label class="sf-n24-field sf-n24-span">
                    <span>{t("sf.ui37.text")}</span>
                    <textarea rows={4} required value={ui.text}
                      disabled={ui.phase === "preparing" || ui.phase === "unknown" || ui.phase === "prepared"}
                      onInput={(event) => setUi({ text: event.currentTarget.value, phase: "editing", message: "" })} />
                  </label>
                  <label class="sf-n24-field">
                    <span>{t("sf.ui37.criterion")}</span>
                    <select value={ui.criterion} onChange={(event) => setUi({ criterion: event.currentTarget.value, phase: "editing" })}
                      disabled={ui.phase === "preparing" || ui.phase === "unknown" || ui.phase === "prepared"}>
                      <option value="">{t("sf.ui37.noCriterion")}</option>
                      <For each={current().criteria}>{(criterion) =>
                        <option value={criterion.id}>{criterion.description}</option>}
                      </For>
                    </select>
                  </label>
                  <label class="sf-n24-field">
                    <span>{t("sf.ui37.recipient")}</span>
                    <select value={ui.recipient} onChange={(event) => setUi({ recipient: event.currentTarget.value, phase: "editing" })}
                      disabled={ui.recipientState !== "ready" || ui.phase === "preparing" || ui.phase === "unknown" || ui.phase === "prepared"}>
                      <option value="">{t("sf.ui37.noRecipient")}</option>
                      <For each={ui.recipients}>{(recipient) =>
                        <option value={recipient.id}>{recipient.name}</option>}
                      </For>
                    </select>
                  </label>
                </div>
                <section aria-labelledby="sf-n24-question-scope" class="sf-n24-review">
                  <h3 id="sf-n24-question-scope">{t("sf.ui37.scope")}</h3>
                  <p><bdi>{current().id}</bdi> · {t("sf.ui35.version")}: {current().version}</p>
                  <ul class="sf-n24-list"><For each={current().sourceRefs}>{(source) =>
                    <li><bdi>{source.refId}</bdi></li>}</For></ul>
                </section>
                <Show when={ui.phase === "reviewing"}>
                  <div class="sf-n24-review" role="group" aria-label={t("sf.ui37.confirm")}>
                    <p><bdi>{ui.text}</bdi></p>
                    <p>{t("sf.ui37.criterion")}: <bdi>{
                      current().criteria.find((item) => item.id === ui.criterion)?.description || ui.criterion || t("sf.ui37.noCriterion")
                    }</bdi></p>
                    <p>{t("sf.ui37.recipient")}: <bdi>{ui.recipient || t("sf.ui37.noRecipient")}</bdi></p>
                    <p>{t("sf.ui37.scope")}</p>
                    <ul class="sf-n24-list"><For each={current().sourceRefs}>{(source) =>
                      <li><bdi>{source.refId}</bdi></li>}</For></ul>
                  </div>
                </Show>
                <Show when={ui.message}><p role="status">{t(ui.message)}</p></Show>
                <Show when={ui.phase === "prepared" ? ui.proposal : undefined}>
                  {(proposal) => <div class="sf-n24-review" aria-live="polite">
                    <p>{t("sf.ui37.preparationOnly")}</p>
                    <p><bdi>{proposal().question}</bdi> · {proposal().expectedCaseVersion}</p>
                    <Show when={proposal().outputRef} fallback={<p>{t("sf.ui37.proposalScope")}</p>}>
                      {(outputRef) => <SfQuestionConsume owner={caseData.owner} caseRecord={current()} outputRef={outputRef()} onConsumed={() => caseData.reload()} />}
                    </Show>
                  </div>}
                </Show>
                <button type="submit" class="mx-btn primary" disabled={!canPrepare()}>
                  {t(ui.phase === "reviewing" ? "sf.ui37.confirm" : "sf.ui37.prepare")}
                </button>
              </form>
            </section>
            <Show when={selectedQuestion()}>
              {(question) => <div id="sf-n24-answer-zone" tabIndex={-1}>
                <SfQuestionAnswer owner={caseData.owner} question={question()} onConfirmed={() => caseData.reload()} />
              </div>}
            </Show>
            <SfQuestionCycles owner={caseData.owner} caseRef={caseRef()} />
          </>}
        </Show>
      </div>
    </SfPageFrame>
  )
}
