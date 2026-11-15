import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js"
import { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { SF_U44_COPY } from "@/i18n/orchestra-chapters/sf-u44"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfCollaboration, SfConfirmationScope } from "@orchestra/schema/sucafina/collaboration"
import type { SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfConfirmation, type SfCoverage } from "../../collaboration"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel, type SfUiState } from "../../shared/states"
import "./confirmations.css"

type Scope = typeof SfConfirmationScope.Type
type Prepared = Extract<typeof SfCollaboration.operations["collaboration.confirmation-prepare"]["output"]["Type"], { status: "ok" }>["value"]
type Recorded = Extract<typeof SfCollaboration.operations["collaboration.confirmation-confirm"]["output"]["Type"], { status: "ok" }>["value"]
type Projection = Extract<typeof SfCollaboration.operations["collaboration.confirmation-project"]["output"]["Type"], { status: "ok" }>["value"]
type Snapshot = Readonly<{ transport: SfTransport; generation: number; ownerKey: string; accessRevision: string }>
function failure(result: { kind: string; reason?: string; status?: number; body?: unknown }): SfUiState {
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
export function SfConfirmationView(props: SfSurfaceProps<"UI53">) {
  const owner = useSfContext()
  const language = useLanguage()
  type Key = Parameters<typeof SfPageFrame>[0]["titleKey"]
  const key = (copy: keyof typeof SF_U44_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.conflict" |
    "sf.common.loginAgain" | "sf.common.operationUnknown" | "sf.common.invalidLink" |
    "sf.common.stale" | "sf.common.partial"): Key => copy as Key
  const t = (copy: keyof typeof SF_U44_COPY) => language.t(copy as Parameters<typeof language.t>[0])
  const selectedRef = () => String(props.route.params.selectionRef)
  const [scopeInput, setScopeInput] = createSignal("")
  const [scope, setScope] = createSignal<Scope>()
  const [prepared, setPrepared] = createSignal<Prepared>()
  const [sourceTextAtPrepare, setSourceTextAtPrepare] = createSignal("")
  const [storageVersion, setStorageVersion] = createSignal<number>()
  const [confirmed, setConfirmed] = createSignal<Recorded>()
  const [projection, setProjection] = createSignal<Projection>()
  const [confirmationId, setConfirmationId] = createSignal("")
  const [state, setState] = createSignal<SfUiState>("ready")
  const [busy, setBusy] = createSignal(false)
  const [pendingKey, setPendingKey] = createSignal<string>()
  const [error, setError] = createSignal<keyof typeof SF_U44_COPY>()
  let readAbort: AbortController | undefined
  let writeAbort: AbortController | undefined

  const snapshot = (): Snapshot | undefined => {
    const state = owner.state(), ready = owner.ready()
    return state.status === "ready" && ready ? {
      transport: ready.transport, generation: owner.generation(),
      ownerKey: state.ownerKey, accessRevision: state.context.stamp.accessRevision,
    } : undefined
  }
  const current = (s: Snapshot, signal: AbortSignal): boolean => {
    const state = owner.state(), ready = owner.ready()
    return !signal.aborted && state.status === "ready" && !!ready &&
      s.generation === owner.generation() && s.ownerKey === state.ownerKey &&
      s.accessRevision === state.context.stamp.accessRevision && s.transport === ready.transport
  }
  createEffect(on(() => {
    const state = owner.state()
    return (state.status === "ready" ? state.ownerKey + "|" + state.context.stamp.accessRevision : state.status) +
      "|" + owner.generation() + "|" + selectedRef()
  }, () => {
    readAbort?.abort(); writeAbort?.abort()
    setScopeInput(""); setScope(undefined); setPrepared(undefined); setSourceTextAtPrepare("")
    setStorageVersion(undefined); setConfirmed(undefined); setProjection(undefined)
    setConfirmationId(""); setBusy(false); setPendingKey(undefined); setError(undefined); setState("ready")
  }))
  onCleanup(() => { readAbort?.abort(); writeAbort?.abort() })
  const changeScope = (text: string) => {
    if (busy() || pendingKey()) return
    setScopeInput(text); setScope(undefined); setPrepared(undefined); setStorageVersion(undefined)
    setSourceTextAtPrepare(""); setError(undefined); setProjection(undefined)
  }
  const prepare = async () => {
    const s = snapshot()
    if (!s || busy() || pendingKey()) return
    let selected: Scope
    try {
      selected = Schema.decodeUnknownSync(SfConfirmationScope)(JSON.parse(scopeInput()))
      if (!selected.fields.length || !selected.fields.every((name) => name.trim()) ||
          !selected.scopeDefinitionVersion.trim() || !selected.sourceRef.id.trim() ||
          !selected.sourceRef.incarnation.trim()) throw Error("incomplete material scope")
    } catch {
      setState("invalid"); setError("sf.u44.scopeInvalid"); return
    }
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setPrepared(undefined); setScope(undefined); setStorageVersion(undefined)
    setConfirmed(undefined); setProjection(undefined); setError(undefined)
    setState("loading"); setBusy(true)
    try {
      const client = createSfCollaborationClient(s.transport)
      const prep = await client["collaboration.confirmation-prepare"]({ scope: selected }, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (prep.kind !== "response" || prep.body.status !== "ok") {
        setState(failure(prep)); return
      }
      const version = await client["collaboration.storage-version"]({ namespace: "confirmations" }, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setState(failure(version)); return
      }
      if (prep.body.value.incarnation !== selected.sourceRef.incarnation ||
          prep.body.value.evidence.target.incarnation !== selected.sourceRef.incarnation) {
        setState("stale"); return
      }
      setScope(selected); setPrepared(prep.body.value)
      setSourceTextAtPrepare(scopeInput()); setStorageVersion(version.body.value)
      setState("ready")
    } catch { if (current(s, abort.signal)) setState("unavailable") }
    finally { if (current(s, abort.signal)) setBusy(false) }
  }
  const project = async (id: string) => {
    const s = snapshot()
    if (!s || !id.trim() || busy()) return
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setProjection(undefined); setBusy(true); setState("loading")
    try {
      const result = await createSfCollaborationClient(s.transport)["collaboration.confirmation-project"](
        { id }, { signal: abort.signal },
      )
      if (!current(s, abort.signal) || confirmationId() !== id) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setState(failure(result)); return
      }
      if (result.body.value.confirmationId !== id) { setState("invalid"); return }
      setProjection(result.body.value)
      setState(result.body.value.state === "valid" ? "ready" :
        result.body.value.state === "stale" ? "stale" : "partial")
    } catch { if (current(s, abort.signal)) setState("unavailable") }
    finally { if (current(s, abort.signal)) setBusy(false) }
  }
  const confirm = async (request: { selectionRef: SfRef; materialVersion: SfVersion }) => {
    const s = snapshot(), selected = scope(), material = prepared(), version = storageVersion()
    if (!s || !selected || !material || version === undefined || busy() || pendingKey() ||
        request.selectionRef !== selectedRef() || request.materialVersion !== material.sourceVersion ||
        sourceTextAtPrepare() !== scopeInput() || state() !== "ready") return
    const abort = new AbortController()
    writeAbort = abort
    const idempotencyKey = crypto.randomUUID()
    setPendingKey(idempotencyKey); setBusy(true); setState("loading")
    // C06: exact displayed scope/version/fingerprint with current namespace CAS.
    // This is NOT financial approval and never writes original domain values.
    const result = await createSfCollaborationClient(s.transport)["collaboration.confirmation-confirm"]({
      scope: selected, observedSourceVersion: material.sourceVersion,
      expectedScopeFingerprint: material.scopeFingerprint,
      expectedStorageVersion: version, idempotencyKey,
    }, { signal: abort.signal, idempotencyKey }).catch(() => undefined)
    if (!current(s, abort.signal)) return
    setBusy(false)
    if (!result) { setState("outcome-unknown"); return }
    if (result.kind === "response" && result.body.status === "ok") {
      if (result.body.value.sourceRef.incarnation !== selected.sourceRef.incarnation ||
          result.body.value.observedSourceVersion !== material.sourceVersion ||
          result.body.value.observedScopeFingerprint !== material.scopeFingerprint) {
        setState("conflict"); return
      }
      setConfirmed(result.body.value); setConfirmationId(result.body.value.id)
      setPendingKey(undefined); setPrepared(undefined); setStorageVersion(undefined)
      void project(result.body.value.id)
      return
    }
    const outcome = failure(result)
    setState(outcome)
    if (outcome !== "outcome-unknown") setPendingKey(undefined)
  }
  const coverage = (): SfCoverage => ({
    state: prepared() && storageVersion() !== undefined ? "complete" : "unavailable",
    summary: { key: (prepared() ? "sf.u44.materialScopeReady" : "sf.u44.scopeRequired") as SfCoverage["summary"]["key"] },
    reasons: [],
    knownCount: prepared()?.projection.values.length ?? null,
    expectedCount: null,
  })
  const effectiveState = (): SfUiState => {
    const status = owner.state().status
    return status === "ready" ? state() : status === "denied" ? "denied" :
      status === "unauthenticated" ? "session-expired" : status === "resolving" ? "loading" : "unavailable"
  }
  const stateKey = (value: SfUiState): Key => key(value === "loading" ? "sf.common.loading" :
    value === "denied" ? "sf.common.noAccess" : value === "session-expired" ? "sf.common.loginAgain" :
    value === "invalid" ? "sf.common.invalidLink" : value === "stale" ? "sf.common.stale" :
    value === "conflict" ? "sf.common.conflict" : value === "outcome-unknown" ? "sf.common.operationUnknown" :
    value === "partial" ? "sf.common.partial" : "sf.common.unavailable")
  return (
    <SfPageFrame
      titleKey={key("sf.ui53.title")} subtitleKey={key("sf.u44.confirmSubtitle")}
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => undefined}
    >
      <section class="sf-u44-confirm" data-sf-surface="UI53">
        <p>{t("sf.u44.navigationSelection")}: <code data-sf-selection-ref>{selectedRef()}</code></p>
        <p>{t("sf.u44.scopeRequired")}</p>
        <Show when={owner.state().status === "ready" && !confirmed()}>
          <form class="sf-u44-scope-form" onSubmit={(event) => { event.preventDefault(); void prepare() }}>
            <label>{t("sf.u44.scopeJson")}
              <textarea data-sf-confirm-scope rows={9} required value={scopeInput()}
                disabled={busy() || !!pendingKey()} onInput={(event) => changeScope(event.currentTarget.value)} />
            </label>
            <button type="submit" class="mx-btn" disabled={busy() || !!pendingKey()}>
              {t("sf.u44.prepareMaterial")}
            </button>
          </form>
        </Show>
        <Show when={error()}>{(message) => <p role="alert">{t(message())}</p>}</Show>
        <SfStatePanel state={effectiveState()} messageKey={stateKey(effectiveState())}
          onRetryRead={() => {
            if (pendingKey()) return
            if (confirmed()) void project(confirmed()!.id)
            else void prepare()
          }}>
          <Show when={scope() && prepared() && !confirmed()}>
            <section class="sf-u44-material" data-sf-confirm-material>
              <h2>{t("sf.u44.materialReview")}</h2>
              <dl>
                <div><dt>{t("sf.u44.sourceRef")}</dt><dd><code>{scope()!.sourceRef.id}</code></dd></div>
                <div><dt>{t("sf.u44.incarnation")}</dt><dd><code>{scope()!.sourceRef.incarnation}</code></dd></div>
                <div><dt>{t("sf.u44.period")}</dt><dd>{scope()!.period.start} – {scope()!.period.end}</dd></div>
                <div><dt>{t("sf.u44.observedVersion")}</dt><dd>{prepared()!.sourceVersion}</dd></div>
                <div><dt>{t("sf.u44.fields")}</dt><dd>{scope()!.fields.join(", ")}</dd></div>
                <div><dt>{t("sf.u44.dependencies")}</dt><dd>{scope()!.materialDependencies.length}</dd></div>
              </dl>
              <h3>{t("sf.u44.materialValues")}</h3>
              <ul><For each={prepared()!.projection.values}>
                {(entry) => <li><strong>{entry.id}</strong> — {entry.value === null ? t("sf.u44.missing") : String(entry.value)}
                  <small> ({entry.evidenceState}, {entry.period.start} – {entry.period.end})</small>
                </li>}
              </For></ul>
              <Show when={prepared()!.projection.missing.length}>
                <ul><For each={prepared()!.projection.missing}>
                  {(value) => <li>{value.field}: {value.reason}</li>}
                </For></ul>
              </Show>
              <SfConfirmation
                selectionRef={selectedRef() as SfRef}
                materialVersion={prepared()!.sourceVersion as SfVersion}
                status="current"
                coverage={coverage()}
                state={effectiveState()}
                onConfirm={(request) => void confirm(request)}
                onRevalidate={() => void prepare()}
              />
            </section>
          </Show>
          <Show when={confirmed()}>
            {(record) => (
              <section class="sf-u44-receipt" data-sf-confirm-receipt>
                <h2>{t("sf.u44.recorded")}</h2>
                <dl>
                  <div><dt>{t("sf.u44.confirmationId")}</dt><dd><code>{record().id}</code></dd></div>
                  <div><dt>{t("sf.u44.auditRef")}</dt><dd><code>{record().auditRef}</code></dd></div>
                  <div><dt>{t("sf.u44.observedVersion")}</dt><dd>{record().observedSourceVersion}</dd></div>
                  <div><dt>{t("sf.u44.status")}</dt><dd>{projection()?.state ?? t("sf.u44.checking")}</dd></div>
                </dl>
                <button type="button" class="mx-btn" disabled={busy()} onClick={() => void project(record().id)}>
                  {t("sf.u44.revalidateMaterial")}
                </button>
              </section>
            )}
          </Show>
          <Show when={projection() && !confirmed()}>
            {(observed) => <p role="status">{t("sf.u44.status")}: {observed().state} ({observed().reason})</p>}
          </Show>
        </SfStatePanel>
        <Show when={owner.state().status === "ready" && !confirmed() && !prepared() && !pendingKey()}>
          <form class="sf-u44-project-form" onSubmit={(event) => { event.preventDefault(); void project(confirmationId()) }}>
            <label>{t("sf.u44.confirmationId")}
              <input data-sf-confirm-lookup required value={confirmationId()}
                onInput={(event) => setConfirmationId(event.currentTarget.value)} />
            </label>
            <button class="mx-btn" type="submit" disabled={busy()}>{t("sf.u44.revalidateMaterial")}</button>
          </form>
        </Show>
        <Show when={pendingKey()}>
          {(id) => <p role="alert" data-sf-confirm-pending>{t("sf.u44.unknownReceipt")} <code>{id()}</code></p>}
        </Show>
      </section>
    </SfPageFrame>
  )
}
