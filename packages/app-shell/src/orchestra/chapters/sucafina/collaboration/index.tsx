import { For, Show, createEffect, createSignal, createUniqueId } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_S05_COPY } from "@/i18n/orchestra-chapters/sf-s05"
import type { SfMessage, SfText, SfUiState, SfRelationsProps, SfThreadProps, SfQuestionProps, SfConfirmationProps } from "./types"
import "./collaboration.css"
import "../../kit.css"

// The only domain authority is the current F01/U44 consumer. These components
// neither fetch nor construct a request/receipt or create a second thread/case.
// Missing/denied public props are not reconstructed from names or stale caches.
export type {
  SfCopyKey, SfMessage, SfText, SfUiState, SfCoverage, SfRelation, SfRelationTarget,
  SfRelationsProps, SfThreadMessage, SfThreadProps, SfQuestionDraft, SfQuestionProps,
  SfConfirmationProps,
} from "./types"

type SfSharedCopyKey =
  | "sf.common.loading" | "sf.common.empty" | "sf.common.partial"
  | "sf.common.noAccess" | "sf.common.removed" | "sf.common.stale"
  | "sf.common.unavailable" | "sf.common.conflict" | "sf.common.operationUnknown"
  | "sf.common.pending" | "sf.common.loginAgain" | "sf.common.invalidLink"
  | "sf.common.filterEmpty"

function useCopy() {
  const language = useLanguage()
  type Key = Parameters<typeof language.t>[0]
  // I00 combines the S05 and F03 dictionaries into the typed global registry.
  // No local English fallback is used for copy; absent registration remains an
  // integration blocker rather than an invented text source.
  const key = (value: keyof typeof SF_S05_COPY | SfSharedCopyKey) => language.t(value as Key)
  const message = (value: SfMessage) => language.t(value.key as Key, value.params)
  const text = (value: SfText) => value.kind === "data" ? value.text : message(value.message)
  return { key, message, text }
}

function mayDisplay(state: SfUiState) {
  return state !== "loading" && state !== "denied" && state !== "session-expired" &&
    state !== "invalid" && state !== "not-found"
}

function mayEdit(state: SfUiState) {
  return state === "ready" || state === "empty"
}

function revoked(state: SfUiState) {
  return state === "denied" || state === "session-expired"
}

const stateCopy: Partial<Record<SfUiState, SfSharedCopyKey>> = {
  loading: "sf.common.loading",
  empty: "sf.common.empty",
  "filtered-empty": "sf.common.filterEmpty",
  partial: "sf.common.partial",
  invalid: "sf.common.invalidLink",
  "not-found": "sf.common.removed",
  stale: "sf.common.stale",
  conflict: "sf.common.conflict",
  unavailable: "sf.common.unavailable",
  denied: "sf.common.noAccess",
  "session-expired": "sf.common.loginAgain",
  "outcome-unknown": "sf.common.operationUnknown",
}

function SfNotice(props: { state: SfUiState }) {
  const copy = useCopy()
  const label = () => stateCopy[props.state]
  return (
    <Show when={label()}>
      {(value) => (
        <p
          class="sf-collab-notice"
          classList={{ "sf-collab-notice-alert": props.state === "denied" || props.state === "session-expired" ||
            props.state === "invalid" || props.state === "conflict" || props.state === "outcome-unknown" }}
          role={props.state === "denied" || props.state === "session-expired" || props.state === "invalid" ||
            props.state === "outcome-unknown" ? "alert" : "status"}
        >
          {copy.key(value())}
        </p>
      )}
    </Show>
  )
}

export function SfRelations(props: SfRelationsProps) {
  const copy = useCopy()
  const uid = createUniqueId()
  // Selection is presentation-only; it carries the source ref as a fence so a
  // changed source cannot silently reuse a previous target or relation kind.
  const [selection, setSelection] = createStore({
    sourceRef: props.sourceRef,
    query: "",
    targetRef: "",
    kind: "",
  })
  const [createFence, setCreateFence] = createSignal<{ sourceRef: string; targetRef: string; kind: string }>()
  const [removeFences, setRemoveFences] = createSignal<readonly Readonly<{ ref: string; version: string | number }>[]>([])
  createEffect(() => {
    if (!revoked(props.state)) return
    setSelection({ sourceRef: props.sourceRef, query: "", targetRef: "", kind: "" })
    setCreateFence(undefined)
    setRemoveFences([])
  })
  const selectedTarget = () => selection.sourceRef === props.sourceRef
    ? props.candidates.find((target) => target.ref === selection.targetRef)
    : undefined
  const allowedKind = () => selectedTarget()?.allowedRelationKinds.find((kind) => kind.id === selection.kind)
  const linked = () => props.relations.some((relation) => relation.sourceRef === props.sourceRef &&
    relation.targetRef === selectedTarget()?.ref && relation.kind === allowedKind()?.id)
  const createPending = () => {
    const fence = createFence()
    return !!fence && fence.sourceRef === props.sourceRef && fence.targetRef === selectedTarget()?.ref &&
      fence.kind === allowedKind()?.id && !linked()
  }
  const canCreate = () => mayEdit(props.state) && !!selectedTarget() && !!allowedKind() && !linked() && !createPending()
  const updateQuery = (value: string) => {
    setSelection({ sourceRef: props.sourceRef, query: value, targetRef: "", kind: "" })
    props.onSearchTargets(value) // user input only; never on render, route load or refetch
  }
  const create = () => {
    const target = selectedTarget()
    const kind = allowedKind()
    if (!canCreate() || !target || !kind) return
    setCreateFence({ sourceRef: props.sourceRef, targetRef: target.ref, kind: kind.id })
    // caseRef is truly optional; S05 never invents or infers a decision case.
    props.onCreate({ sourceRef: props.sourceRef, targetRef: target.ref, kind: kind.id })
  }
  const remove = (relation: SfRelationsProps["relations"][number]) => {
    if (!mayEdit(props.state) || !relation.canRemove || relation.sourceRef !== props.sourceRef) return
    if (removeFences().some((fence) => fence.ref === relation.ref && fence.version === relation.version)) return
    setRemoveFences((current) => [...current, { ref: relation.ref, version: relation.version }])
    // The U44 owner performs any required confirmation, transaction and CAS.
    props.onRemove({ relationRef: relation.ref, expectedVersion: relation.version })
  }
  return (
    <section class="sf-collab sf-collab-relations" aria-labelledby={uid + "-title"} data-sf-component="relations">
      <header class="sf-collab-heading">
        <h2 id={uid + "-title"}>{copy.key("sf.ui51.title")}</h2>
      </header>
      <SfNotice state={props.state} />
      <Show when={mayDisplay(props.state)}>
        <div class="sf-collab-form">
          <label class="sf-collab-field" for={uid + "-search"}>
            <span>{copy.key("sf.s05.relations.search")}</span>
            <input
              class="mx-search"
              id={uid + "-search"}
              type="search"
              autocomplete="off"
              value={selection.sourceRef === props.sourceRef ? selection.query : ""}
              disabled={!mayEdit(props.state)}
              onInput={(event) => updateQuery(event.currentTarget.value)}
            />
          </label>
          <div class="sf-collab-fields">
            <label class="sf-collab-field" for={uid + "-target"}>
              <span>{copy.key("sf.s05.relations.target")}</span>
              <select
                id={uid + "-target"}
                value={selectedTarget()?.ref ?? ""}
                disabled={!mayEdit(props.state) || props.candidates.length === 0}
                onChange={(event) => {
                  const target = props.candidates.find((candidate) => candidate.ref === event.currentTarget.value)
                  setSelection({
                    sourceRef: props.sourceRef, query: selection.query,
                    targetRef: target?.ref ?? "", kind: "",
                  })
                }}
              >
                <option value="">{copy.key("sf.s05.relations.target")}</option>
                <For each={props.candidates}>
                  {(target) => <option value={target.ref}>{copy.text(target.label)}</option>}
                </For>
              </select>
            </label>
            <label class="sf-collab-field" for={uid + "-kind"}>
              <span>{copy.key("sf.s05.relations.kind")}</span>
              <select
                id={uid + "-kind"}
                value={allowedKind()?.id ?? ""}
                disabled={!mayEdit(props.state) || !selectedTarget()}
                onChange={(event) => {
                  const chosen = selectedTarget()?.allowedRelationKinds.find((kind) => kind.id === event.currentTarget.value)
                  setSelection("kind", chosen?.id ?? "")
                }}
              >
                <option value="">{copy.key("sf.s05.relations.kind")}</option>
                <For each={selectedTarget()?.allowedRelationKinds ?? []}>
                  {(kind) => <option value={kind.id}>{copy.message(kind.label)}</option>}
                </For>
              </select>
            </label>
          </div>
          <Show when={props.candidates.length === 0}>
            <p class="sf-collab-help">{copy.key("sf.s05.relations.noCandidates")}</p>
          </Show>
          <Show when={selectedTarget() && selectedTarget()!.allowedRelationKinds.length === 0}>
            <p class="sf-collab-help">{copy.key("sf.s05.relations.noKinds")}</p>
          </Show>
          <button class="mx-btn primary sf-collab-primary" type="button" disabled={!canCreate()} onClick={create}>
            {copy.key("sf.ui51.primary")}
          </button>
        </div>
        <h3 class="sf-collab-subheading">{copy.key("sf.s05.relations.current")}</h3>
        <Show when={props.relations.some((relation) => relation.sourceRef === props.sourceRef)}
          fallback={<p class="sf-collab-help">{copy.key("sf.common.empty")}</p>}>
          <ul class="sf-collab-items" aria-label={copy.key("sf.s05.relations.current")}>
            <For each={props.relations.filter((relation) => relation.sourceRef === props.sourceRef)}>
              {(relation) => {
                const pending = () => removeFences().some((fence) => fence.ref === relation.ref && fence.version === relation.version)
                return (
                  <li class="sf-collab-item">
                    <div class="sf-collab-item-content">
                      <span class="sf-collab-item-label">{copy.key("sf.s05.relations.item")}</span>
                      <div class="sf-collab-pair">
                        <span>{copy.text(relation.sourceLabel)}</span>
                        <span aria-hidden="true">→</span>
                        <span>{copy.text(relation.targetLabel)}</span>
                      </div>
                      <span class="sf-collab-kind">{relation.kind}</span>
                    </div>
                    <div class="sf-collab-actions">
                      <button class="mx-btn" type="button" disabled={!mayDisplay(props.state)}
                        onClick={() => props.onOpen(relation.targetRef)}>
                        {copy.key("sf.s05.relations.open")}
                      </button>
                      <Show when={relation.canRemove}>
                        <button class="mx-btn danger" type="button"
                          disabled={!mayEdit(props.state) || pending()} onClick={() => remove(relation)}>
                          {copy.key("sf.s05.relations.remove")}
                        </button>
                      </Show>
                    </div>
                  </li>
                )
              }}
            </For>
          </ul>
        </Show>
      </Show>
    </section>
  )
}

export function SfThread(props: SfThreadProps) {
  const copy = useCopy()
  const uid = createUniqueId()
  const [postFence, setPostFence] = createSignal<{ threadRef: string; incarnation: string; version: number }>()
  const locked = () => {
    const fence = postFence()
    return !!fence && fence.threadRef === props.threadRef &&
      fence.incarnation === props.incarnation && fence.version === props.version
  }
  const canPost = () => mayEdit(props.state) && props.draft.trim().length > 0 && !locked() &&
    props.incarnation.length > 0 && Number.isSafeInteger(props.version) && props.version >= 0
  const post = () => {
    if (!canPost()) return
    setPostFence({ threadRef: props.threadRef, incarnation: props.incarnation, version: props.version })
    props.onPost({
      threadRef: props.threadRef,
      incarnation: props.incarnation,
      expectedVersion: props.version,
      text: props.draft, // preserve exact entered content; no trimming/rewriting
    })
  }
  return (
    <section class="sf-collab sf-collab-thread" aria-labelledby={uid + "-title"} data-sf-component="thread">
      <header class="sf-collab-heading">
        <h2 id={uid + "-title"}>{copy.key("sf.ui52.title")}</h2>
        <Show when={mayDisplay(props.state)}>
          <button class="mx-btn" type="button" onClick={props.onOpenOrigin}>
            {copy.key("sf.s05.thread.origin")}
          </button>
        </Show>
      </header>
      <SfNotice state={props.state} />
      <Show when={props.state === "outcome-unknown"}>
        <button class="mx-btn" type="button" onClick={() => props.onReconcileRead(props.threadRef)}>
          {copy.key("sf.s05.thread.reconcile")}
        </button>
      </Show>
      <Show when={mayDisplay(props.state)}>
        <section aria-labelledby={uid + "-messages"}>
          <h3 id={uid + "-messages"} class="sf-collab-subheading">{copy.key("sf.s05.thread.messages")}</h3>
          <Show when={props.messages.length > 0}
            fallback={<p class="sf-collab-help">{copy.key("sf.s05.thread.messageEmpty")}</p>}>
            <ol class="sf-collab-items sf-collab-messages">
              <For each={props.messages}>
                {(entry) => (
                  <li class="sf-collab-item sf-collab-message">
                    <header class="sf-collab-message-meta">
                      <strong>{copy.text(entry.author)}</strong>
                      <time datetime={entry.createdAt}>{entry.createdAt}</time>
                    </header>
                    <p class="sf-collab-message-body">{entry.text}</p>
                    <Show when={entry.sourceRefs.length > 0}>
                      <span class="sf-collab-item-label">{copy.key("sf.s05.thread.source")}</span>
                      <ul class="sf-collab-source-refs">
                        <For each={entry.sourceRefs}>
                          {(ref) => <li><code dir="auto">{ref}</code></li>}
                        </For>
                      </ul>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </section>
        <form class="sf-collab-form" onSubmit={(event) => { event.preventDefault(); post() }}>
          <label class="sf-collab-field" for={uid + "-draft"}>
            <span>{copy.key("sf.s05.thread.compose")}</span>
            <textarea id={uid + "-draft"} rows={4} value={props.draft}
              disabled={!mayEdit(props.state)} onInput={(event) => props.onEditDraft(event.currentTarget.value)} />
          </label>
          <button class="mx-btn primary sf-collab-primary" type="submit" disabled={!canPost()}>
            {copy.key("sf.ui52.primary")}
          </button>
        </form>
      </Show>
    </section>
  )
}

export function SfQuestion(props: SfQuestionProps) {
  const copy = useCopy()
  const uid = createUniqueId()
  const [answerFence, setAnswerFence] = createSignal<{ questionRef: string; answerVersion: string | number | undefined }>()
  const [answerHasText, setAnswerHasText] = createSignal(false)
  let answerInput: HTMLTextAreaElement | undefined
  // Answer text is never copied into a second application store. Purge the
  // native input on owner/source switch or actual revocation, not on timeout.
  createEffect(() => {
    void props.questionRef
    void props.sourceRef
    if (answerInput) answerInput.value = ""
    setAnswerHasText(false)
  })
  createEffect(() => {
    if (!revoked(props.state)) return
    if (answerInput) answerInput.value = ""
    setAnswerHasText(false)
    setAnswerFence(undefined)
  })
  const recipients = () => props.recipientOptions.filter((option) => option.available)
  const selected = () => recipients().some((option) => option.ref === props.question.recipientRef)
  const editableQuestion = () => mayEdit(props.state) && !props.answer
  const canPrepare = () => editableQuestion() && props.question.text.trim().length > 0 && selected() &&
    props.question.sourceRefs.includes(props.sourceRef)
  const canAnswer = () => mayEdit(props.state) && !!props.questionRef && !props.answer &&
    !(answerFence()?.questionRef === props.questionRef)
  const prepare = () => {
    if (!canPrepare()) return
    props.onPrepare(props.question)
  }
  const answer = () => {
    const text = answerInput?.value
    if (!canAnswer() || !text?.trim() || !props.questionRef) return
    setAnswerFence({ questionRef: props.questionRef, answerVersion: props.answer?.version })
    setAnswerHasText(false)
    props.onAnswer({ questionRef: props.questionRef, text })
  }
  return (
    <section class="sf-collab sf-collab-question" aria-labelledby={uid + "-title"} data-sf-component="question">
      <header class="sf-collab-heading">
        <h2 id={uid + "-title"}>{copy.key("sf.s05.question.title")}</h2>
        <Show when={mayDisplay(props.state) && !!props.questionRef}>
          <button class="mx-btn" type="button" onClick={() => props.onOpen(props.questionRef!)}>
            {copy.key("sf.s05.question.open")}
          </button>
        </Show>
      </header>
      <SfNotice state={props.state} />
      <Show when={mayDisplay(props.state)}>
        <form class="sf-collab-form" onSubmit={(event) => { event.preventDefault(); prepare() }}>
          <label class="sf-collab-field" for={uid + "-recipient"}>
            <span>{copy.key("sf.s05.question.recipient")}</span>
            <select id={uid + "-recipient"} value={selected() ? props.question.recipientRef! : ""}
              disabled={!editableQuestion() || recipients().length === 0}
              onChange={(event) => {
                const found = recipients().find((value) => value.ref === event.currentTarget.value)
                if (!editableQuestion() || !found) return
                props.onEditQuestion({ ...props.question, recipientRef: found.ref })
              }}>
              <option value="">{copy.key("sf.s05.question.unselected")}</option>
              <For each={recipients()}>
                {(option) => <option value={option.ref}>{copy.text(option.label)}</option>}
              </For>
            </select>
          </label>
          <Show when={recipients().length === 0}>
            <p class="sf-collab-help">{copy.key("sf.s05.question.noRecipient")}</p>
          </Show>
          <label class="sf-collab-field" for={uid + "-text"}>
            <span>{copy.key("sf.s05.question.text")}</span>
            <textarea id={uid + "-text"} rows={4} value={props.question.text}
              disabled={!editableQuestion()}
              onInput={(event) => props.onEditQuestion({ ...props.question, text: event.currentTarget.value })} />
          </label>
          <div class="sf-collab-actions">
            <button class="mx-btn primary" type="submit" disabled={!canPrepare()}>
              {copy.key("sf.s05.question.prepare")}
            </button>
            {/* The owner validates an actual frozen prepared operation before submit.
                This callback takes no draft/ref precisely to prevent an invented producer ID. */}
            <button class="mx-btn" type="button" disabled={!editableQuestion() || !canPrepare()}
              onClick={() => props.onSubmit()}>
              {copy.key("sf.s05.question.submit")}
            </button>
          </div>
        </form>
        <Show when={props.answer}>
          {(recorded) => (
            <section class="sf-collab-recorded" aria-labelledby={uid + "-recorded"}>
              <h3 id={uid + "-recorded"} class="sf-collab-subheading">{copy.key("sf.s05.question.response")}</h3>
              <p class="sf-collab-message-body">{recorded().text}</p>
              <p class="sf-collab-item-label">{copy.text(recorded().author)}</p>
            </section>
          )}
        </Show>
        <Show when={props.questionRef && !props.answer}>
          <form class="sf-collab-form" onSubmit={(event) => { event.preventDefault(); answer() }}>
            <label class="sf-collab-field" for={uid + "-answer"}>
              <span>{copy.key("sf.s05.question.answer")}</span>
              <textarea id={uid + "-answer"} rows={3} ref={answerInput}
                disabled={!canAnswer()} onInput={(event) => setAnswerHasText(event.currentTarget.value.trim().length > 0)} />
            </label>
            <button type="submit" class="mx-btn primary" disabled={!canAnswer() || !answerHasText()}>
              {copy.key("sf.s05.question.answerSubmit")}
            </button>
          </form>
        </Show>
      </Show>
    </section>
  )
}

export function SfConfirmation(props: SfConfirmationProps) {
  const copy = useCopy()
  const uid = createUniqueId()
  const [confirmFence, setConfirmFence] = createSignal<{ selectionRef: string; materialVersion: string | number }>()
  const revoked = () => props.status === "revoked" || props.state === "denied" || props.state === "session-expired"
  const current = () => mayEdit(props.state) && props.status === "current" &&
    props.coverage.state === "complete" && props.coverage.reasons.length === 0
  const locked = () => confirmFence()?.selectionRef === props.selectionRef &&
    confirmFence()?.materialVersion === props.materialVersion
  const canConfirm = () => current() && !locked()
  const canRevalidate = () => props.state !== "loading" && !revoked() && props.status !== "not-found"
  const confirm = () => {
    if (!canConfirm()) return
    setConfirmFence({ selectionRef: props.selectionRef, materialVersion: props.materialVersion })
    // This is C06 material no-change only. Approval and financial decisions
    // remain distinct domain operations; never derive a new scope/digest here.
    props.onConfirm({ selectionRef: props.selectionRef, materialVersion: props.materialVersion })
  }
  return (
    <section class="sf-collab sf-collab-confirmation" aria-labelledby={uid + "-title"} data-sf-component="confirmation">
      <header class="sf-collab-heading">
        <h2 id={uid + "-title"}>{copy.key("sf.ui53.title")}</h2>
      </header>
      <SfNotice state={props.state} />
      <Show when={props.status === "revoked"}>
        <p class="sf-collab-notice sf-collab-notice-alert" role="alert">{copy.key("sf.s05.confirmation.revoked")}</p>
      </Show>
      <Show when={!revoked() && mayDisplay(props.state)}>
        <Show when={props.status === "stale"}>
          <p class="sf-collab-notice" role="status">{copy.key("sf.s05.confirmation.stale")}</p>
        </Show>
        <Show when={props.status !== "not-found" && props.status !== "unavailable"}>
          <dl class="sf-collab-facts">
            <div>
              <dt>{copy.key("sf.s05.confirmation.scope")}</dt>
              <dd><code dir="auto">{props.selectionRef}</code></dd>
            </div>
            <div>
              <dt>{copy.key("sf.s05.confirmation.version")}</dt>
              <dd><code>{String(props.materialVersion)}</code></dd>
            </div>
            <div>
              <dt>{copy.key("sf.s05.confirmation.coverage")}</dt>
              <dd>{copy.message(props.coverage.summary)}</dd>
            </div>
          </dl>
          <Show when={props.coverage.reasons.length > 0}>
            <ul class="sf-collab-reasons">
              <For each={props.coverage.reasons}>
                {(reason) => <li>{copy.message(reason)}</li>}
              </For>
            </ul>
          </Show>
        </Show>
        <div class="sf-collab-actions">
          <button type="button" class="mx-btn primary" disabled={!canConfirm()} onClick={confirm}>
            {copy.key("sf.ui53.primary")}
          </button>
          <button type="button" class="mx-btn" disabled={!canRevalidate()}
            onClick={() => props.onRevalidate(props.selectionRef)}>
            {copy.key("sf.s05.confirmation.revalidate")}
          </button>
        </div>
      </Show>
    </section>
  )
}
