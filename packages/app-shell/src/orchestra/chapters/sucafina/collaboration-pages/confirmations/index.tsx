import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js"
import { useNavigate } from "@solidjs/router"
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
import { operationGranted } from "../../collaboration/grant"
import { SfAmountText, SfEnumText, SfPeriodText, sfEnumKey } from "../../collaboration/labels"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel, type SfUiState } from "../../shared/states"
import { encodeSfRouteRef } from "../../navigation-state"
import "./confirmations.css"

type Scope = typeof SfConfirmationScope.Type
type Prepared = Extract<typeof SfCollaboration.operations["collaboration.confirmation-prepare"]["output"]["Type"], { status: "ok" }>["value"]
type Recorded = Extract<typeof SfCollaboration.operations["collaboration.confirmation-confirm"]["output"]["Type"], { status: "ok" }>["value"]
type Projection = Exclude<Extract<typeof SfCollaboration.operations["collaboration.confirmation-project"]["output"]["Type"], { status: "ok" }>["value"], { kind: "prepared-selection" }>
type BoundStamp = Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string }>
type StampedValidity = Readonly<{ value: Projection; recordId: string; stamp: BoundStamp }>
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
  const navigate = useNavigate()
  type Key = Parameters<typeof SfPageFrame>[0]["titleKey"]
  const key = (copy: keyof typeof SF_U44_COPY | "sf.common.loading" | "sf.common.empty" |
    "sf.common.unavailable" | "sf.common.noAccess" | "sf.common.conflict" |
    "sf.common.loginAgain" | "sf.common.operationUnknown" | "sf.common.invalidLink" |
    "sf.common.stale" | "sf.common.partial"): Key => copy as Key
  const t = (copy: keyof typeof SF_U44_COPY) => language.t(copy as Parameters<typeof language.t>[0])
  const selectedRef = () => String(props.route.params.selectionRef)
  const recordedRoute = () => !selectedRef().startsWith("confirmation-selection:")
  const [manualScope, setManualScope] = createSignal("")
  const [scope, setScope] = createSignal<Scope>()
  const [prepared, setPrepared] = createSignal<Prepared>()
  const [preparedFence, setPreparedFence] = createSignal("")
  const [storageVersion, setStorageVersion] = createSignal<number>()
  const [confirmed, setConfirmed] = createSignal<Recorded>()
  const [validity, setValidity] = createSignal<StampedValidity>()
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
  const granted = (operationId: string) => operationGranted(owner.ready()?.context, operationId)
  const stamp = (): BoundStamp | undefined => {
    const state = owner.state()
    return state.status === "ready" ? state.context.stamp : undefined
  }
  const sameStamp = (left: BoundStamp, right: BoundStamp) =>
    left.installationId === right.installationId && left.projectId === right.projectId &&
    left.hostId === right.hostId && left.principalRef === right.principalRef &&
    left.policyVersion === right.policyVersion && left.accessRevision === right.accessRevision
  const pageRecordId = () => confirmed()?.id ?? (recordedRoute() ? selectedRef() : undefined)
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
    setScope(undefined); setPrepared(undefined); setPreparedFence(""); setManualScope("")
    setStorageVersion(undefined); setConfirmed(undefined); setValidity(undefined)
    setBusy(false); setPendingKey(undefined); setError(undefined); setState("ready")
  }))
  onCleanup(() => { readAbort?.abort(); writeAbort?.abort() })
  const prepareManual = async () => {
    const s = snapshot()
    if (!s || busy() || pendingKey()) return
    const parsed = Schema.decodeUnknownOption(Schema.toType(SfConfirmationScope), { onExcessProperty: "error" })(
      (() => { try { return JSON.parse(manualScope()) as unknown } catch { return undefined } })(),
    )
    if (parsed._tag === "None") { setState("invalid"); setError("sf.u44.scopeInvalid"); return }
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setBusy(true); setState("loading"); setError(undefined)
    try {
      const result = await createSfCollaborationClient(s.transport)["collaboration.confirmation-prepare"]({ scope: parsed.value }, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (result.kind !== "response" || result.body.status !== "ok") { setState(failure(result)); return }
      const issued = result.body.value.selectionRef
      if (!issued || !/^confirmation-selection:[a-f0-9]{64}$/.test(issued) || result.body.value.incarnation !== parsed.value.sourceRef.incarnation) { setState("unavailable"); return }
      navigate("/orchestra/sf-work/confirmations/" + encodeSfRouteRef(issued))
    } catch { if (current(s, abort.signal)) setState("unavailable") }
    finally { if (current(s, abort.signal)) setBusy(false) }
  }
  const readSelection = async () => {
    const s = snapshot()
    if (!s || busy() || pendingKey()) return
    const reference = selectedRef()
    if (!/^confirmation-selection:[a-f0-9]{64}$/.test(reference)) { setState("invalid"); return }
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setPrepared(undefined); setScope(undefined); setPreparedFence(""); setStorageVersion(undefined)
    setConfirmed(undefined); setValidity(undefined); setError(undefined)
    setState("loading"); setBusy(true)
    try {
      const client = createSfCollaborationClient(s.transport)
      const prep = await client["collaboration.confirmation-project"]({ selectionRef: reference }, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (prep.kind !== "response" || prep.body.status !== "ok") {
        setState(failure(prep)); return
      }
      if (!("kind" in prep.body.value) || prep.body.value.kind !== "prepared-selection" || prep.body.value.selectionRef !== reference) {
        setState("invalid"); return
      }
      const selected = prep.body.value.scope
      const observed = prep.body.value.observation
      const version = await client["collaboration.storage-version"]({ namespace: "confirmations" }, { signal: abort.signal })
      if (!current(s, abort.signal)) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setState(failure(version)); return
      }
      const bound = stamp()
      const context = observed.projection.context
      if (!bound || selectedRef() !== reference || observed.incarnation !== selected.sourceRef.incarnation ||
          observed.evidence.target.incarnation !== selected.sourceRef.incarnation ||
          observed.evidence.installationId !== bound.installationId || observed.evidence.projectId !== bound.projectId ||
          context.installationId !== bound.installationId || context.projectId !== bound.projectId ||
          context.principalRef !== bound.principalRef || context.accessRevision !== bound.accessRevision ||
          context.policyVersion !== bound.policyVersion) {
        setState("stale"); return
      }
      const fixed = structuredClone(selected)
      Object.freeze(fixed.sourceRef); Object.freeze(fixed.fields); Object.freeze(fixed.period)
      fixed.materialDependencies.forEach((dependency) => {
        Object.freeze(dependency.fields); Object.freeze(dependency.period); Object.freeze(dependency)
      })
      Object.freeze(fixed.materialDependencies); Object.freeze(fixed)
      setScope(fixed); setPrepared(structuredClone(observed))
      setPreparedFence(JSON.stringify([fixed, observed.sourceVersion, observed.scopeFingerprint]))
      setStorageVersion(version.body.value)
      setState("ready")
    } catch { if (current(s, abort.signal)) setState("unavailable") }
    finally { if (current(s, abort.signal)) setBusy(false) }
  }
  const project = async (id: string) => {
    const s = snapshot(), bound = stamp()
    if (!s || !bound || !id.trim() || busy() || pageRecordId() !== id) return
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setValidity(undefined); setBusy(true); setState("loading")
    try {
      const result = await createSfCollaborationClient(s.transport)["collaboration.confirmation-project"](
        { id }, { signal: abort.signal },
      )
      const live = stamp()
      if (!current(s, abort.signal) || !live || !sameStamp(bound, live) || pageRecordId() !== id) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setState(failure(result)); return
      }
      if ("kind" in result.body.value || result.body.value.confirmationId !== id) { setState("invalid"); return }
      const record = confirmed()
      if (record && (record.id !== id || record.authorId !== live.principalRef)) { setState("denied"); return }
      setValidity({ value: result.body.value, recordId: id, stamp: live })
      setState(result.body.value.state === "valid" ? "ready" :
        result.body.value.state === "stale" ? "stale" : "partial")
    } catch { if (current(s, abort.signal)) setState("unavailable") }
    finally { if (current(s, abort.signal)) setBusy(false) }
  }
  // UI30 may open a *recorded* confirmation id. It is read-only and must
  // reproject by id at the original producer; it is never a prepared selection.
  createEffect(on(() => {
    const state = owner.state()
    return state.status === "ready" ? `${state.ownerKey}|${owner.generation()}|${selectedRef()}` : ""
  }, (value) => {
    if (!value) return
    if (recordedRoute()) void project(selectedRef())
    else void readSelection()
  }))
  const confirm = async (request: { selectionRef: SfRef; materialVersion: SfVersion }) => {
    const s = snapshot(), selected = scope(), material = prepared(), version = storageVersion()
    const bound = stamp()
    if (!s || !bound || !selected || !material || version === undefined || busy() || pendingKey() ||
        !granted("collaboration.confirmation-confirm") || material.projection.missing.length > 0 ||
        request.selectionRef !== selectedRef() || request.materialVersion !== material.sourceVersion ||
        preparedFence() !== JSON.stringify([selected, material.sourceVersion, material.scopeFingerprint]) || state() !== "ready") return
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
      const value = result.body.value
      const live = stamp()
      if (!live || !sameStamp(bound, live) || !value.id.trim() || !value.auditRef.trim() ||
          value.authorId !== live.principalRef ||
          value.sourceRef.incarnation !== selected.sourceRef.incarnation ||
          value.observedSourceVersion !== material.sourceVersion ||
          value.observedScopeFingerprint !== material.scopeFingerprint) {
        setState("outcome-unknown"); return
      }
      setConfirmed(value)
      setPendingKey(undefined); setPrepared(undefined); setStorageVersion(undefined)
      void project(value.id)
      return
    }
    const outcome = failure(result)
    setState(outcome)
    if (outcome !== "outcome-unknown") setPendingKey(undefined)
  }
  const coverage = (): SfCoverage => {
    const material = prepared()
    const missing = material?.projection.missing ?? []
    const known = material?.projection.values.length ?? null
    if (!material || storageVersion() === undefined) {
      return { state: "unavailable", summary: { key: "sf.u44.scopeRequired" as SfCoverage["summary"]["key"] }, reasons: [], knownCount: known, expectedCount: null }
    }
    if (missing.length > 0) {
      return {
        state: "partial",
        summary: { key: "sf.u44.materialGaps" as SfCoverage["summary"]["key"] },
        reasons: missing.map((gap) => ({ key: sfEnumKey(gap.reason) as SfCoverage["reasons"][number]["key"] })),
        knownCount: known,
        expectedCount: (known ?? 0) + missing.length,
      }
    }
    return {
      state: "complete",
      summary: { key: "sf.u44.materialScopeReady" as SfCoverage["summary"]["key"] },
      reasons: [],
      knownCount: known,
      expectedCount: known,
    }
  }
  const currentValidity = () => {
    const shown = validity(), bound = stamp(), recordId = pageRecordId()
    if (!shown || !bound || !recordId || !sameStamp(shown.stamp, bound) || shown.recordId !== recordId ||
        shown.value.confirmationId !== recordId) return
    const record = confirmed()
    if (record && (record.id !== recordId || record.authorId !== bound.principalRef)) return
    return shown.value
  }
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
        <p>{t(recordedRoute() ? "sf.u44.confirmationId" : "sf.u44.navigationSelection")}: <code data-sf-selection-ref>{selectedRef()}</code></p>
        <Show when={owner.state().status === "ready" && !confirmed() && !recordedRoute()}>
          <details><summary>{t("sf.u44.prepareMaterial")}</summary>
            <form class="sf-u44-scope-form" onSubmit={(event) => { event.preventDefault(); void prepareManual() }}>
              <label>{t("sf.u44.scopeJson")}<textarea data-sf-confirm-scope rows={9} required value={manualScope()}
                disabled={busy() || !!pendingKey()} onInput={(event) => setManualScope(event.currentTarget.value)} /></label>
              <button type="submit" class="mx-btn" disabled={busy() || !!pendingKey()}>{t("sf.u44.prepareMaterial")}</button>
            </form>
          </details>
        </Show>
        <Show when={error()}>{(message) => <p role="alert">{t(message())}</p>}</Show>
        <SfStatePanel state={effectiveState()} messageKey={stateKey(effectiveState())}
          onRetryRead={() => {
            if (pendingKey()) return
            if (confirmed()) void project(confirmed()!.id)
            else if (recordedRoute()) void project(selectedRef())
            else void readSelection()
          }}>
          <Show when={scope() && prepared() && !confirmed()}>
            <section class="sf-u44-material" data-sf-confirm-material>
              <h2>{t("sf.u44.materialReview")}</h2>
              <dl>
                <div><dt>{t("sf.u44.sourceRef")}</dt><dd><code>{scope()!.sourceRef.id}</code></dd></div>
                <div><dt>{t("sf.u44.incarnation")}</dt><dd><code>{scope()!.sourceRef.incarnation}</code></dd></div>
                <div><dt>{t("sf.u44.period")}</dt><dd><SfPeriodText start={scope()!.period.start} end={scope()!.period.end} /></dd></div>
                <div><dt>{t("sf.u44.observedVersion")}</dt><dd>{prepared()!.sourceVersion}</dd></div>
                <div><dt>{t("sf.u44.fields")}</dt><dd>{scope()!.fields.join(", ")}</dd></div>
                <div><dt>{t("sf.u44.fingerprint")}</dt><dd><code data-sf-confirm-fingerprint>{prepared()!.scopeFingerprint}</code></dd></div>
                <div><dt>{t("sf.u44.storageVersion")}</dt><dd data-sf-confirm-storage-version>{storageVersion()}</dd></div>
                <div><dt>{t("sf.u44.dependencies")}</dt><dd>{scope()!.materialDependencies.length}</dd></div>
              </dl>
              <Show when={scope()!.materialDependencies.length > 0} fallback={<p data-sf-confirm-no-dependencies>{t("sf.u44.noDependencies")}</p>}>
                <ul data-sf-confirm-dependencies><For each={scope()!.materialDependencies}>
                  {(dependency) => <li><pre data-sf-confirm-dependency style={{ "white-space": "pre-wrap" }}>{JSON.stringify(dependency, null, 2)}</pre></li>}
                </For></ul>
              </Show>
              <h3>{t("sf.u44.materialValues")}</h3>
              <ul><For each={prepared()!.projection.values}>
                {(entry) => <li><strong>{entry.id}</strong> — <SfAmountText value={entry.value} currency={entry.currency} />
                  <small> (<SfEnumText value={entry.evidenceState} />, <SfPeriodText start={entry.period.start} end={entry.period.end} />)</small>
                </li>}
              </For></ul>
              <Show when={prepared()!.projection.missing.length}>
                <ul><For each={prepared()!.projection.missing}>
                  {(value) => <li><bdi>{value.field}</bdi>: <SfEnumText value={value.reason} /></li>}
                </For></ul>
              </Show>
              <SfConfirmation
                selectionRef={selectedRef() as SfRef}
                materialVersion={prepared()!.sourceVersion as SfVersion}
                status="current"
                coverage={coverage()}
                state={effectiveState()}
                canWrite={granted("collaboration.confirmation-confirm") && (prepared()?.projection.missing.length ?? 0) === 0}
                onConfirm={(request) => void confirm(request)}
                onRevalidate={() => void readSelection()}
              />
            </section>
          </Show>
          <Show when={recordedRoute() && currentValidity()}>
            {(observed) => <section class="sf-u44-receipt" data-sf-confirm-record-project>
              <h2>{t("sf.u44.revalidateMaterial")}</h2>
              <dl>
                <div><dt>{t("sf.u44.confirmationId")}</dt><dd><code>{observed().confirmationId}</code></dd></div>
                <div><dt>{t("sf.u44.status")}</dt><dd><SfEnumText value={observed().state} /></dd></div>
                <div><dt>{t("sf.u44.observedVersion")}</dt><dd>{observed().evaluatedSourceVersion}</dd></div>
              </dl>
              <button type="button" class="mx-btn" disabled={busy()} onClick={() => void project(selectedRef())}>
                {t("sf.u44.revalidateMaterial")}
              </button>
            </section>}
          </Show>
          <Show when={confirmed()}>
            {(record) => (
              <section class="sf-u44-receipt" data-sf-confirm-receipt>
                <h2>{t("sf.u44.recorded")}</h2>
                <dl>
                  <div><dt>{t("sf.u44.confirmationId")}</dt><dd><code>{record().id}</code></dd></div>
                  <div><dt>{t("sf.u44.auditRef")}</dt><dd><code>{record().auditRef}</code></dd></div>
                  <div><dt>{t("sf.u44.observedVersion")}</dt><dd>{record().observedSourceVersion}</dd></div>
                  <div><dt>{t("sf.u44.status")}</dt><dd>{currentValidity()?.confirmationId === record().id ? <SfEnumText value={currentValidity()!.state} /> : t("sf.u44.checking")}</dd></div>
                </dl>
                <button type="button" class="mx-btn" disabled={busy()} onClick={() => void project(record().id)}>
                  {t("sf.u44.revalidateMaterial")}
                </button>
              </section>
            )}
          </Show>
          <Show when={!confirmed() && recordedRoute() ? currentValidity() : undefined}>
            {(observed) => <p role="status">{t("sf.u44.status")}: <SfEnumText value={observed().state} /> (<SfEnumText value={observed().reason} />)</p>}
          </Show>
        </SfStatePanel>
        <Show when={pendingKey()}>
          {(id) => <p role="alert" data-sf-confirm-pending>{t("sf.u44.unknownReceipt")} <code>{id()}</code></p>}
        </Show>
      </section>
    </SfPageFrame>
  )
}
