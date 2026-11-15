import { createEffect, createMemo, createUniqueId, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfPublicDraftController, SfSurfaceProps } from "../../../context/contracts"
import { useSfContext } from "../../../context"
import { SfChangeReview } from "../../../shared/change-review"
import { SfStatePanel } from "../../../shared/states"
import {
  decodeSfRequestTitlePage,
  isSfRequestTitleSaveAccepted,
  sfRequestTitleSaveCanonicalBody,
  sfRequestTitleSaveInput,
  type SfRequestTitleRead,
  type SfRequestTitleRecord,
} from "./model"

type ProcurementClient = ReturnType<typeof createSfProcurementClient>
type Draft = SfPublicDraftController<{ title: string }>
type ReviewProps = Parameters<typeof SfChangeReview>[0]
type CopyKey = Extract<ReviewProps["confirmation"], { kind: "blocked" }>["labelKey"]
type UiStatus = "loading" | "ready" | "invalid" | "stale" | "denied" | "session-expired" | "unavailable"
type Intent = Readonly<{
  operationRef: SfOperationRef
  intentRef: SfIntentRef
  idempotencyKey: string
  title: string
  version: number
}>
const editScope = "pr.title" as SfEditScopeKey // stable field scope; record and owner are separate registry key parts
const copyKey = (key: string): CopyKey => key as CopyKey
const message = (key: string) => ({ key: copyKey(key) })
const dataText = (text: string) => ({ kind: "data", text } as const)
const titleField = (title: string) => ({
  path: "pr.title",
  label: message("sf.cap25.field.pr.title.label"),
  value: { kind: "text", text: dataText(title) } as const,
})

async function authorizedTitleRead(
  client: ProcurementClient,
  id: SfRef,
  stamp: Parameters<typeof decodeSfRequestTitlePage>[2],
  saveAdmitted: boolean,
  signal: AbortSignal,
): Promise<SfRequestTitleRead> {
  try {
    // No new endpoint, client-side HTML parsing or producer field recalculation.
    // A03 owns this closed CAP25 GET input codec; default selection is no filters.
    const input = {} // A03 PageSelection: all selection keys are optional
    const result = await client["domain.page.CAP25"](input, { signal })
    if (result.kind !== "response") return { kind: "unavailable" }
    if (result.status === 401) return { kind: "unauthenticated" }
    if (result.status === 403) return { kind: "denied" }
    if (result.status === 409) return { kind: "stale" }
    if (result.status < 200 || result.status >= 300) return { kind: "unavailable" }
    return decodeSfRequestTitlePage(result.body, id, stamp, saveAdmitted)
  } catch {
    // Never downgrade a failed authenticated read into an empty, editable PR.
    return { kind: "unavailable" }
  }
}

/**
 * U11.title-save P0: mounted by I00 inside CAP25 Requests detail.
 * No route, dispatcher, producer, review receipt or financial approval is made here.
 */
export function SfRequestTitleEdit(props: SfSurfaceProps) {
  const sf = useSfContext()
  const language = useLanguage()
  const fieldId = createUniqueId()
  const [view, setView] = createStore({
    status: "loading" as UiStatus,
    record: undefined as SfRequestTitleRecord | undefined,
    refreshToken: 0,
    reviewing: false,
    sending: false,
    intent: undefined as Intent | undefined,
    saved: false,
    acceptedWithoutProjection: false,
  })
  let pendingCommand: AbortController | undefined

  const ref = createMemo<SfRef | undefined>(() => {
    if (props.surfaceId !== "CAP25") return undefined
    const route = props.route
    if ((route.kind === "detail" || route.kind === "requisition") &&
        "requestRef" in route.params && typeof route.params.requestRef === "string")
      return route.params.requestRef as SfRef
    return undefined
  })
  const sameOwner = (ownerKey: string, generation: number) => {
    const current = sf.state()
    return sf.generation() === generation && current.status === "ready" && current.ownerKey === ownerKey
  }
  const saveAdmitted = () => sf.ready()?.context.destinations.some(
    (destination) => destination.capabilityId === "CAP25" &&
      destination.canRead && destination.allowedActionIds.includes("save"),
  ) === true

  // A late response cannot repopulate data after an owner/generation transition.
  // Abort and clear private projection on each changed route, context or read intent.
  createEffect(() => {
    const current = sf.state()
    const ready = sf.ready()
    const generation = sf.generation()
    const requestRef = ref()
    const refreshToken = view.refreshToken
    void refreshToken
    setView({ record: undefined, status: "loading", reviewing: false, saved: false, acceptedWithoutProjection: false })
    if (!requestRef) {
      setView("status", "invalid")
      return
    }
    if (current.status !== "ready" || !ready) {
      setView("status", current.status === "denied" ? "denied" :
        current.status === "unauthenticated" ? "session-expired" : "unavailable")
      return
    }
    if (!ready.context.destinations.some((destination) =>
      destination.capabilityId === "CAP25" && destination.canRead)) {
      setView("status", "denied")
      return
    }

    const controller = new AbortController()
    const ownerKey = current.ownerKey
    const client = createSfProcurementClient(ready.transport)
    void authorizedTitleRead(client, requestRef, ready.context.stamp, saveAdmitted(), controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !sameOwner(ownerKey, generation)) return
        if (result.kind !== "ready") {
          setView({ record: undefined, status: result.kind === "unauthenticated" ? "session-expired" :
            result.kind === "invalid" ? "invalid" : result.kind })
          if (result.kind === "denied") sf.invalidate("revoked")
          if (result.kind === "unauthenticated") void sf.reload()
          return
        }
        if (result.record.canSave) {
          const draft = ready.drafts.acquire<{ title: string }>({
            surfaceId: "CAP25",
            identity: { kind: "record", recordRef: requestRef },
            editScopeKey: editScope,
            baseVersion: result.record.version,
            base: { title: result.record.title },
            value: { title: result.record.title },
            revalidation: {
              operationId: "domain.page.CAP25",
              input: {},
              fieldPaths: ["pr.title"],
              actionIds: ["save"],
            },
          })
          draft.receiveRemote({ baseVersion: result.record.version, value: { title: result.record.title } })
        }
        setView({ status: "ready", record: result.record })
      })
    onCleanup(() => controller.abort())
  })
  // Aborting a sent command during context change never claims a rollback.
  createEffect(() => {
    void sf.generation()
    onCleanup(() => pendingCommand?.abort())
  })
  onCleanup(() => pendingCommand?.abort())

  const draft = createMemo<Draft | undefined>(() => {
    const requestRef = ref()
    const row = view.record
    const ready = sf.ready()
    const state = sf.state()
    if (!requestRef || !row?.canSave || !ready || state.status !== "ready" || row.ref !== requestRef)
      return undefined
    return ready.drafts.acquire<{ title: string }>({
      surfaceId: "CAP25",
      identity: { kind: "record", recordRef: requestRef },
      editScopeKey: editScope,
      baseVersion: row.version,
      base: { title: row.title },
      value: { title: row.title },
      revalidation: {
        operationId: "domain.page.CAP25",
        input: {},
        fieldPaths: ["pr.title"],
        actionIds: ["save"],
      },
    })
  })
  const draftState = createMemo(() => draft()?.snapshot())
  const title = () => {
    const current = draftState()
    return current?.availability === "active" ? current.value.title : view.record?.title ?? ""
  }
  const reviewable = () => {
    const snapshot = draftState()
    return snapshot?.availability === "active" && snapshot.dirty &&
      snapshot.baseVersion === view.record?.version && !!view.record?.canSave
  }
  const outcomeUnknown = () => {
    const current = draftState()
    return current?.availability === "active" && current.phase === "outcome-unknown"
  }
  const refreshSource = () => setView("refreshToken", (value) => value + 1)

  const beginReview = () => {
    const current = draftState()
    const row = view.record
    if (!draft() || !row?.canSave || current?.availability !== "active" ||
        !current.dirty || view.sending || outcomeUnknown() ||
        current.baseVersion !== row.version || !saveAdmitted()) return
    setView({
      intent: {
        operationRef: crypto.randomUUID() as SfOperationRef,
        intentRef: crypto.randomUUID() as SfIntentRef,
        idempotencyKey: crypto.randomUUID(),
        title: current.value.title,
        version: row.version,
      },
      reviewing: true,
      saved: false,
    })
    draft()?.setPhase("reviewing")
  }

  const save = async () => {
    const record = view.record
    const currentDraft = draft()
    const snapshot = currentDraft?.snapshot()
    const intent = view.intent
    const ready = sf.ready()
    const actor = sf.state()
    if (view.sending || !view.reviewing || !record?.canSave || !currentDraft ||
        snapshot?.availability !== "active" || !intent || !ready ||
        actor.status !== "ready" || !saveAdmitted() ||
        snapshot.value.title !== intent.title || snapshot.baseVersion !== intent.version ||
        record.version !== intent.version || record.ref !== ref() || outcomeUnknown()) return

    setView("sending", true)
    const generation = sf.generation()
    const ownerKey = actor.ownerKey
    const input = sfRequestTitleSaveInput(record, intent.title)
    const canonical = sfRequestTitleSaveCanonicalBody(record, intent.title)
    const command = new AbortController()
    pendingCommand = command

    // Content digest is display/intention correlation, not a server receipt C12.
    let digest: string
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)))
      digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
    } catch {
      if (sameOwner(ownerKey, generation)) {
        currentDraft.setPhase("failed")
        setView({ sending: false, reviewing: false, status: "unavailable" })
      }
      return
    }
    if (!sameOwner(ownerKey, generation) || command.signal.aborted) return
    currentDraft.setPending({
      operationRef: intent.operationRef,
      idempotencyKey: intent.idempotencyKey,
      payloadDigest: digest,
      expectedVersion: intent.version,
    })
    currentDraft.setPhase("submitting")

    try {
      const client = createSfProcurementClient(ready.transport)
      // Only A03's closed domain.command.CAP25.save. A03/I00 must attach the
      // native owner expectation header and enforce it IN the producer transaction.
      const result = await client["domain.command.CAP25.save"](input, {
        signal: command.signal,
        idempotencyKey: intent.idempotencyKey,
      })
      if (!sameOwner(ownerKey, generation)) return
      if (result.kind === "transport-error") {
        if (result.reason === "contract-unavailable" || result.reason === "contract-mismatch") {
          currentDraft.setPhase("failed")
          setView({ sending: false, reviewing: false, status: "unavailable" })
        } else {
          // Network error, abort, invalid response or unknown after send: may
          // have committed. Keep the exact pending intent; never retry it.
          currentDraft.setPhase("outcome-unknown")
          setView({ sending: false, reviewing: false })
        }
        return
      }
      if (result.status === 401) {
        setView({ record: undefined, status: "session-expired", sending: false, reviewing: false })
        void sf.reload()
        return
      }
      if (result.status === 403) {
        setView({ record: undefined, status: "denied", sending: false, reviewing: false })
        sf.invalidate("revoked")
        return
      }
      if (result.status >= 200 && result.status < 300 && !isSfRequestTitleSaveAccepted(result.body)) {
        // A 2xx body that failed its canonical success decoder may follow a
        // committed mutation; it is not evidence that a retry is safe.
        currentDraft.setPhase("outcome-unknown")
        setView({ sending: false, reviewing: false })
        return
      }
      if (result.status < 200 || result.status >= 300) {
        currentDraft.setPhase(result.status === 422 ? "validation-error" : "failed")
        // A 409 is not by itself proof of an editable CAS conflict: the native
        // fence may reject an owner/host mismatch with the same HTTP code.
        setView({ sending: false, reviewing: false, status: "unavailable" })
        return
      }

      // The original producer acknowledged success. Do not display submitted
      // values as canonical until a fresh authorized CAP25 read confirms them.
      const reread = await authorizedTitleRead(
        client, record.ref, ready.context.stamp, saveAdmitted(), command.signal,
      )
      if (!sameOwner(ownerKey, generation)) return
      if (reread.kind === "ready" && reread.record.title === intent.title &&
          reread.record.version > intent.version) {
        currentDraft.confirmSave({
          kind: "projected",
          operationRef: intent.operationRef,
          baseVersion: reread.record.version,
          value: { title: reread.record.title },
        })
        setView({
          record: reread.record,
          status: "ready",
          sending: false,
          reviewing: false,
          intent: undefined,
          saved: true,
        })
      } else {
        currentDraft.confirmSave({
          kind: "confirmed-without-projection",
          operationRef: intent.operationRef,
          resultVersion: null,
        })
        setView({
          status: "unavailable",
          sending: false,
          reviewing: false,
          intent: undefined,
          acceptedWithoutProjection: true,
        })
      }
    } catch {
      if (!sameOwner(ownerKey, generation)) return
      currentDraft.setPhase("outcome-unknown")
      setView({ sending: false, reviewing: false })
    } finally {
      if (pendingCommand === command) pendingCommand = undefined
    }
  }

  const statusCopy = () => {
    switch (view.status) {
      case "loading": return "sf.common.loading"
      case "denied": return "sf.common.noAccess"
      case "session-expired": return "sf.common.loginAgain"
      case "stale": return "sf.common.stale"
      case "invalid": return "sf.u11.title.invalidResponse"
      default: return "sf.u11.title.readError"
    }
  }

  return (
    <section data-component="sf-request-title-save" class="flex min-w-0 flex-col gap-3" aria-busy={view.sending}>
      <Show when={view.status === "ready" && view.record !== undefined} fallback={
        <SfStatePanel
          state={view.status === "ready" ? "unavailable" : view.status}
          messageKey={copyKey(view.acceptedWithoutProjection
            ? "sf.u11.title.saveAcceptedNoProjection" : statusCopy())}
          onRetryRead={view.status === "denied" ? undefined : refreshSource}
        />
      }>
        <h3 class="text-sm font-medium text-v2-text-text-strong">{language.t("sf.u11.title.section")}</h3>
        <label class="flex min-w-0 flex-col gap-1 text-sm text-v2-text-text-muted" for={fieldId}>
          {language.t("sf.cap25.field.pr.title.label")}
          <input
            id={fieldId}
            name="pr.title"
            type="text"
            autocomplete="off"
            class="w-full min-w-0 rounded-lg border border-v2-border-weak bg-v2-surface-base px-3 py-2 text-v2-text-text-strong"
            value={title()}
            readOnly={!view.record?.canSave || view.sending || view.reviewing || outcomeUnknown()}
            aria-readonly={!view.record?.canSave || outcomeUnknown()}
            onInput={(event) => {
              if (!view.sending && !view.reviewing && !outcomeUnknown())
                draft()?.edit({ title: event.currentTarget.value })
            }}
          />
        </label>
        <Show when={!view.record?.canSave}>
          <p role="status" class="text-sm text-v2-text-text-muted">{language.t("sf.u11.title.readonly")}</p>
        </Show>
        <Show when={outcomeUnknown()}>
          <p role="alert" class="text-sm text-v2-text-text-muted">{language.t("sf.u11.title.unknown")}</p>
          <button type="button" onClick={refreshSource} class="self-start text-sm underline">
            {language.t("sf.u11.title.refreshSource")}
          </button>
        </Show>
        <Show when={view.saved}>
          <p role="status" class="text-sm text-v2-text-text-muted">{language.t("sf.common.saved")}</p>
        </Show>
        <Show when={view.record?.canSave && !outcomeUnknown() && !view.reviewing}>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-lg bg-v2-primary-base px-3 py-2 text-sm text-v2-text-text-strong disabled:opacity-50"
              disabled={view.sending || !reviewable()}
              onClick={beginReview}
            >
              {language.t("sf.u11.title.reviewAction")}
            </button>
            <button type="button" class="text-sm underline" disabled={view.sending}
              onClick={() => draft()?.discard()}>
              {language.t("sf.common.discard")}
            </button>
          </div>
        </Show>
        <Show when={view.reviewing && view.intent !== undefined && view.record !== undefined}>
          <SfChangeReview
            operation={{
              ref: view.intent!.operationRef,
              label: message("sf.u11.title.reviewAction"),
              scope: dataText(view.record!.ref),
            }}
            base={{
              kind: "persisted",
              ref: view.record!.ref,
              version: view.record!.version,
              fields: [titleField(view.record!.title)],
            }}
            current={{
              kind: "persisted",
              ref: view.record!.ref,
              version: view.record!.version,
              fields: [titleField(view.record!.title)],
            }}
            proposed={{
              kind: "draft",
              intentRef: view.intent!.intentRef,
              sourceRef: view.record!.ref,
              sourceVersion: view.intent!.version,
              fields: [titleField(view.intent!.title)],
            }}
            effects={[]}
            coverage={{
              state: "complete",
              summary: message("sf.u11.title.reviewSummary"),
              reasons: [],
              knownCount: 1,
              expectedCount: 1,
            }}
            blockingReasons={[]}
            confirmation={{
              kind: "admitted",
              labelKey: copyKey("sf.common.save"),
              purpose: "save",
              binding: {
                kind: "catalog-command",
                operationId: "domain.command.CAP25.save",
                version: { kind: "record", expectedVersion: view.intent!.version },
                confirmation: "presentation-only",
              },
            }}
            state={view.sending ? "loading" : "ready"}
            onConfirm={() => void save()}
            onRevise={() => setView("reviewing", false)}
            onCancel={() => setView("reviewing", false)}
          />
        </Show>
      </Show>
    </section>
  )
}
