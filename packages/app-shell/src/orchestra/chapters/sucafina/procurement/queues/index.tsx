import { createEffect, createMemo, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfProcurementQueuePanel } from "./panel"
import { SF_QUEUE_INITIAL_FILTERS } from "./model"
import type { SfProcurementQueueFilters, SfProcurementQueueReadPhase, SfProcurementQueueRow } from "./model"
import type { SfU10QueueCopyKey } from "./copy"

type Read = Extract<Awaited<ReturnType<ReturnType<typeof createSfProcurementClient>["domain.page.CAP25"]>>, { kind: "response" }>["body"]
type Ready = Extract<Read, { status: "ok" }>

export function SfProcurementQueueView(props: SfSurfaceProps<"CAP25">) {
  const owner = useSfContext()
  const language = useLanguage()
  const [view, setView] = createStore({
    phase: "loading" as SfProcurementQueueReadPhase,
    read: undefined as Ready | undefined,
    filters: SF_QUEUE_INITIAL_FILTERS,
    refresh: 0,
    layoutMode: "split" as "single" | "split" | "split-context",
  })
  const requested = () => props.route.query.request
  const rows = createMemo(() => {
    const page = view.read
    if (!page) return []
    return page.value.data.requests.flatMap((record) => {
      const id = record.number
      if (!id) return []
      const version = page.value.versions["requests:" + id]?.version
      const row: SfProcurementQueueRow = {
        id: id as SfRef,
        group: null,
        sourceRef: record.sourceRef ?? null,
        sourceDigest: record.sourceDigest ?? null,
        version: Number.isSafeInteger(version) ? version! : null,
        moneySentence: record.moneySentence ?? null,
        status: record.status,
        subject: record.pr?.title ?? null,
        holder: null,
        approvalStage: null,
        stageEnteredAt: null,
        ageDays: null,
        baseAmount: typeof record.value === "number" && Number.isFinite(record.value) ? record.value : null,
        baseCurrency: page.value.data.formSettings.currency ?? "",
        submittedAmount: null,
        submittedCurrency: null,
        originalAmount: null,
        originalCurrency: null,
        monetaryState: record.monetaryState ?? null,
        reason: null,
        nextStep: null,
      }
      return [row]
    })
  })
  createEffect(() => {
    const state = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    void view.refresh
    if (!ready || state.status !== "ready") {
      setView({
        read: undefined,
        phase: state.status === "unauthenticated" ? "session-expired" : state.status === "denied" ? "denied" : "unavailable",
      })
      return
    }
    if (!ready.context.destinations.some((item) => item.capabilityId === "CAP25" && item.canRead)) {
      setView({ read: undefined, phase: "denied" })
      return
    }
    const abort = new AbortController()
    setView({ read: undefined, phase: "loading" })
    const request = requested()
    void createSfProcurementClient(ready.transport)["domain.page.CAP25"](request ? { request } : {}, { signal: abort.signal })
      .then((result) => {
        if (abort.signal.aborted || owner.generation() !== generation || owner.state().status !== "ready") return
        if (result.kind !== "response") { setView({ read: undefined, phase: "unavailable" }); return }
        const body = result.body
        if (body.status !== "ok") {
          setView({
            read: undefined,
            phase: body.status === "unauthenticated" ? "session-expired" : body.status === "denied" ? "denied" : body.status === "stale" ? "stale" : body.status === "needs-input" ? "invalid" : "unavailable",
          })
          return
        }
        const stamp = ready.context.stamp
        if (body.context.projectId !== stamp.projectId || body.context.installationId !== stamp.installationId ||
          body.context.hostId !== stamp.hostId || body.context.principalRef !== stamp.principalRef ||
          body.context.policyVersion !== stamp.policyVersion || body.context.accessRevision !== stamp.accessRevision) {
          setView({ read: undefined, phase: "denied" })
          return
        }
        setView({ read: body, phase: "ready" })
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted || owner.generation() !== generation) return
        console.error("Procurement queue read failed", error instanceof Error ? error.name : "unknown")
        setView({ read: undefined, phase: "unavailable" })
      })
    onCleanup(() => abort.abort())
  })
  const openRequest = (id: string) => {
    window.location.assign("?request=" + encodeURIComponent(id) + "#" + encodeURIComponent(id))
  }
  return <SfProcurementQueuePanel
    phase={view.phase}
    rows={rows()}
    filters={view.filters}
    selectedRef={rows().some((row) => row.id === requested()) ? requested() : undefined}
    context={[]}
    tabs={[]}
    activeTab={null}
    density="comfortable"
    layoutMode={view.layoutMode}
    page={{ kind: "none", total: rows().length }}
    sort={{ kind: "none" }}
    onLayoutMode={(mode) => setView("layoutMode", mode)}
    onFilters={(next: SfProcurementQueueFilters) => setView("filters", next)}
    onSelect={openRequest}
    onBack={() => window.location.assign(props.route.pathname)}
    onSort={() => undefined}
    onPage={() => undefined}
    onRetryRead={() => setView("refresh", (value) => value + 1)}
    canOpenSource={() => false}
    onOpenSource={() => undefined}
    translate={(key: SfU10QueueCopyKey) => language.t(key)}
  />
}
