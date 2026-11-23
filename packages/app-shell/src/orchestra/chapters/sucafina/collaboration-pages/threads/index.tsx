import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { useLanguage } from "@/context/language"
import { SF_U44_COPY } from "@/i18n/orchestra-chapters/sf-u44"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfThread, type SfThreadMessage } from "../../collaboration"
import { operationGranted } from "../../collaboration/grant"
import { SfPeriodText } from "../../collaboration/labels"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel, type SfUiState } from "../../shared/states"
import "../presentation.css"
import "../../reviews/workflows.css"
import "./threads.css"

type Thread = Extract<typeof SfCollaboration.operations["collaboration.thread-read"]["output"]["Type"], { status: "ok" }>["value"]
type Snapshot = Readonly<{
  transport: SfTransport; generation: number; ownerKey: string; accessRevision: string;
}>
type PendingReply = Readonly<{ key: string; threadRef: string; incarnation: string; version: number; text: string; status: "writing" | "unknown" }>
function failure(result: { kind: string; status?: number; reason?: string; body?: unknown }): SfUiState {
  if (result.kind === "transport-error") return result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable"
  if (result.status === 401) return "session-expired"
  if (result.status === 403) return "denied"
  const status = (result.body as { status?: string } | undefined)?.status
  if (status === "denied") return "denied"
  if (status === "conflict") return "conflict"
  if (status === "stale") return "stale"
  if (status === "invalid" || status === "needs-input") return "invalid"
  return "unavailable"
}

export function SfThreadView(props: SfSurfaceProps<"UI52">) {
  const owner = useSfContext()
  const language = useLanguage()
  type Key = Parameters<typeof SfPageFrame>[0]["titleKey"]
  const key = (value: keyof typeof SF_U44_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.noAccess" | "sf.common.unavailable" | "sf.common.stale" | "sf.common.invalidLink" |
    "sf.common.conflict" | "sf.common.loginAgain" | "sf.common.operationUnknown" | "sf.common.partial"): Key => value as Key
  const t = (value: keyof typeof SF_U44_COPY) => language.t(value as Parameters<typeof language.t>[0])
  const ref = () => String(props.route.params.threadRef)
  const [projection, setProjection] = createSignal<Thread>()
  const [storageVersion, setStorageVersion] = createSignal<number>()
  const [draft, setDraft] = createSignal("")
  const [state, setState] = createSignal<SfUiState>("loading")
  const [pending, setPending] = createSignal<PendingReply>()
  const [showOrigin, setShowOrigin] = createSignal(false)
  let readAbort: AbortController | undefined
  let writeAbort: AbortController | undefined
  const snapshot = (): Snapshot | undefined => {
    const state = owner.state(), ready = owner.ready()
    return state.status === "ready" && ready
      ? { transport: ready.transport, ownerKey: state.ownerKey, accessRevision: state.context.stamp.accessRevision, generation: owner.generation() }
      : undefined
  }
  const granted = (operationId: string) => operationGranted(owner.ready()?.context, operationId)
  const principal = () => {
    const state = owner.state()
    return state.status === "ready" ? state.context.stamp.principalRef : ""
  }
  const current = (snapshot: Snapshot, signal: AbortSignal) => {
    const now = owner.state(), ready = owner.ready()
    return !signal.aborted && now.status === "ready" && !!ready &&
      snapshot.generation === owner.generation() && snapshot.ownerKey === now.ownerKey &&
      snapshot.accessRevision === now.context.stamp.accessRevision && snapshot.transport === ready.transport
  }
  const load = async (expectedRef = ref()) => {
    const s = snapshot()
    if (!s || !expectedRef) return
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setState("loading")
    setProjection(undefined); setStorageVersion(undefined)
    try {
      const client = createSfCollaborationClient(s.transport)
      const read = await client["collaboration.thread-read"]({ id: expectedRef }, { signal: abort.signal })
      if (!current(s, abort.signal) || ref() !== expectedRef) return
      if (read.kind !== "response" || read.body.status !== "ok") {
        setState(failure(read)); return
      }
      if (read.body.value.id !== expectedRef) { setState("invalid"); return }
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (!current(s, abort.signal) || ref() !== expectedRef) return
      setProjection(read.body.value)
      if (version.kind !== "response" || version.body.status !== "ok") {
        setState("partial"); return
      }
      setStorageVersion(version.body.value)
      const previous = pending()
      if (previous?.status === "unknown") {
        const receipt = "mutationReceipt" in read.body.value ? read.body.value.mutationReceipt : undefined
        if (receipt?.kind === "recipient-thread-action-v1" && receipt.action === "reply" &&
            receipt.idempotencyKey === previous.key && receipt.threadId === previous.threadRef &&
            receipt.sourceIncarnation === previous.incarnation && receipt.principalRef === principal()) {
          setDraft(""); setPending(undefined)
        } else {
          setState("outcome-unknown"); return
        }
      }
      setState(read.body.value.state === "resolved" ? "stale" :
        read.body.value.messages.length ? "ready" : "empty")
    } catch {
      if (current(s, abort.signal)) setState("unavailable")
    }
  }
  createEffect(on(() => {
    const state = owner.state()
    const ownerId = state.status === "ready"
      ? String(state.ownerKey) + "|" + state.context.stamp.accessRevision
      : state.status
    return ownerId + "|" + owner.generation() + "|" + ref()
  }, () => {
    readAbort?.abort(); writeAbort?.abort()
    setProjection(undefined); setStorageVersion(undefined)
    setDraft(""); setPending(undefined); setShowOrigin(false)
    setState("loading")
    if (snapshot()) void load()
  }))
  onCleanup(() => { readAbort?.abort(); writeAbort?.abort() })
  const messages = createMemo<readonly SfThreadMessage[]>(() => {
    const source = projection()
    return source?.messages.map((message) => ({
      ref: message.id as SfRef, incarnation: message.incarnation, version: message.version,
      author: { kind: "data" as const, text: message.authorRef },
      createdAt: message.createdAt, text: message.body,
      sourceRefs: (message.sourceContext?.evidenceRefs ?? []).map((ref) => ref.refId as SfRef),
    })) ?? []
  })
  const write = async (request: { threadRef: SfRef; incarnation: string; expectedVersion: number; text: string }) => {
    const s = snapshot(), thread = projection(), version = storageVersion()
    if (!s || !thread || version === undefined || !!pending() || !granted("collaboration.thread-reply") ||
        state() !== "ready" && state() !== "empty" ||
        request.threadRef !== ref() || request.incarnation !== thread.sourceIncarnation ||
        request.expectedVersion !== version || !request.text.trim() || draft() !== request.text ||
        thread.state !== "open") return
    const abort = new AbortController()
    writeAbort = abort
    const idempotencyKey = crypto.randomUUID()
    const submission: PendingReply = { key: idempotencyKey, threadRef: ref(), incarnation: thread.sourceIncarnation,
      version, text: request.text, status: "writing" }
    setPending(submission); setState("loading")
    // Global threads namespace CAS is distinct from the observed domain version.
    const result = await createSfCollaborationClient(s.transport)["collaboration.thread-reply"]({
      id: ref(), body: request.text, mutation: { expectedStorageVersion: version, idempotencyKey },
    }, { signal: abort.signal, idempotencyKey }).catch(() => undefined)
    if (!current(s, abort.signal) || ref() !== request.threadRef) return
    if (!result) {
      setPending({ ...submission, status: "unknown" }); setState("outcome-unknown"); return
    }
    if (result.kind === "response" && result.body.status === "ok") {
      const response = result.body.value
      if (response.id !== ref()) { setState("invalid"); return }
      const receipt = "mutationReceipt" in response ? response.mutationReceipt : undefined
      const expectsReceipt = "current" in thread || "mutationReceipt" in thread ||
        "current" in response || "mutationReceipt" in response
      const proved = expectsReceipt
        ? !!receipt && receipt.action === "reply" && receipt.idempotencyKey === idempotencyKey &&
          receipt.threadId === ref() && receipt.sourceIncarnation === thread.sourceIncarnation &&
          receipt.principalRef === principal()
        : response.messages.some((message) => message.body === request.text && message.authorRef === principal())
      if (!proved) {
        setPending({ ...submission, status: "unknown" }); setState("outcome-unknown"); return
      }
      setDraft(""); setPending(undefined)
      void load(request.threadRef)
      return
    }
    const next = failure(result)
    setState(next)
    if (next === "outcome-unknown") setPending({ ...submission, status: "unknown" })
    else setPending(undefined)
  }
  const effectiveState = (): SfUiState => {
    const status = owner.state().status
    return status === "ready" ? state() : status === "denied" ? "denied" :
      status === "unauthenticated" ? "session-expired" : status === "resolving" ? "loading" : "unavailable"
  }
  const stateKey = (value: SfUiState): Key => key(value === "loading" ? "sf.common.loading" :
    value === "empty" ? "sf.common.empty" : value === "denied" ? "sf.common.noAccess" :
    value === "session-expired" ? "sf.common.loginAgain" : value === "stale" ? "sf.common.stale" :
    value === "invalid" ? "sf.common.invalidLink" : value === "conflict" ? "sf.common.conflict" :
    value === "outcome-unknown" ? "sf.common.operationUnknown" :
    value === "partial" ? "sf.common.partial" : "sf.common.unavailable")
  return (
    <SfPageFrame
      titleKey={key("sf.ui52.title")} subtitleKey={key("sf.u44.threadSubtitle")}
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => undefined}
    >
      <section class="sf-u44-thread sf-workflow" data-sf-surface="UI52" data-sf-wave="five" data-sf-thread-ref={ref()}>
        <SfStatePanel state={effectiveState()} messageKey={stateKey(effectiveState())}
          onRetryRead={() => void load()}>
          <Show when={projection()}>
            {(thread) => (
              <>
                <dl class="sf-u44-thread-summary">
                  <div><dt>{t("sf.u44.sourceRef")}</dt><dd><code>{thread().sourceRef}</code></dd></div>
                  <div><dt>{t("sf.u44.period")}</dt><dd><SfPeriodText start={thread().period.start} end={thread().period.end} /></dd></div>
                  <div><dt>{t("sf.u44.sourceMessages")}</dt><dd>{new Intl.NumberFormat(language.intl()).format(messages().length)}</dd></div>
                </dl>
                <SfThread
                  threadRef={ref() as SfRef}
                  incarnation={thread().sourceIncarnation}
                  version={storageVersion() ?? 0}
                  messages={messages()}
                  draft={draft()}
                  state={effectiveState()}
                  canWrite={granted("collaboration.thread-reply")}
                  onEditDraft={setDraft}
                  onPost={(request) => void write(request)}
                  onReconcileRead={(reference) => { if (reference === ref()) void load(reference) }}
                  onOpenOrigin={() => setShowOrigin((value) => !value)}
                />
                <Show when={thread().state === "resolved"}>
                  <p role="status">{t("sf.u44.threadResolved")}</p>
                </Show>
                <Show when={showOrigin()}>
                  <section data-sf-thread-origin class="sf-u44-origin" aria-label={t("sf.u44.originContext")}>
                    <h3>{t("sf.u44.originContext")}</h3>
                    <dl>
                      <div><dt>{t("sf.u44.sourceRef")}</dt><dd><code>{thread().sourceRef}</code></dd></div>
                      <div><dt>{t("sf.u44.incarnation")}</dt><dd><code>{thread().sourceIncarnation}</code></dd></div>
                      <div><dt>{t("sf.u44.observedVersion")}</dt><dd>{thread().observedVersion}</dd></div>
                      <div><dt>{t("sf.u44.period")}</dt><dd><SfPeriodText start={thread().period.start} end={thread().period.end} /></dd></div>
                    </dl>
                    <ul><For each={thread().evidenceRefs}>{(evidence) => <li><code>{evidence.refId}</code></li>}</For></ul>
                  </section>
                </Show>
                <Show when={pending()}>
                  {(value) => <div role="status" data-sf-thread-pending>
                    {t("sf.u44.pendingIdentity")}: <code>{value().key}</code>
                  </div>}
                </Show>
              </>
            )}
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
