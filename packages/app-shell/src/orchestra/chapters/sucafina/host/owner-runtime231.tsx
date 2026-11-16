/**
 * Mission 231: installed F01 owner composition for UI29 / UI33 / UI34.
 *
 * This is the real chapter body consumed by chapter-route's inert callsite,
 * NOT a provider that manufactures context or an independent login/session.
 * Sources: selected ServerConnection, admitted installation discovery, original
 * ctx.context and projection.case. Desktop capabilities are not substituted.
 * Requires the exact 227 context/navigation leaves and 228 adapter postimages.
 */
import { useBeforeLeave, useLocation, useNavigate } from "@solidjs/router"
import { createEffect, onCleanup, Show, Switch, Match, untrack, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server"
import { authTokenFromCredentials } from "@/utils/server"
import { SfInstallationList, type SfHref, type SfInstallationDescriptor, type SfOwnerKey,
  type SfOwnerSelection, type SfRef, type SfResolvedRoute, type SfServerKey } from "@orchestra/schema/sucafina/context"
import { createSfTransport, type SfTransport } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { createSfDraft } from "../shared/draft"
import { createSfNavigationState, type SfNativeNavigationState } from "../navigation-state"
import { isSfNativeChapter, matchSfNativeRoutePath } from "../route-registry"
import { useSfContext } from "../context"
import type { SfContextDependencies, SfContextHandle, SfDraftRevalidationInput,
  SfDraftRevalidation, SfSurfaceProps } from "../context/contracts"
import { parsePlannerRouteQuery, plannerRouteAvailable, plannerOverviewSelectionMatches } from "./planner-route"
import { isPlannerPagesSurface, parsePlannerPagesRouteQuery, plannerPagesRouteAvailable, SfPlannerPages } from "./planner-pages-route"
import { isPeopleSurface, parsePeopleRouteQuery, peopleRouteAvailable, SfPeoplePages } from "./people-route"
import { isOperationsSurface, parseOperationsRouteQuery, operationsRouteAvailable, SfOperationsPages } from "./operations-route"
import { isPortfolioSurface, parsePortfolioRouteQuery, portfolioRouteAvailable, SfPortfolioPages } from "./portfolio-route"
import { isDecisionPagesSurface, parseDecisionPagesRouteQuery, decisionPagesRouteAvailable, SfDecisionPages } from "./decisions-pages-route"
import { isWorkSurface, parseWorkRouteQuery, workRouteAvailable, SfWorkPages } from "./work-route"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import { SfPlannerOverviewView } from "../planner/overview"
import { SfPlannerVersionsView } from "../planner/versions"
import { SfPlannerCompareView } from "../planner/compare"
import { SfBiCatalog } from "../bi/catalog"
import { validBiRoute, biRouteAvailable } from "./bi-route"
import { parseDashboardRouteQuery, dashboardRouteAvailable } from "./dashboard-route"
import { SfDashboardExecutiveView } from "../dashboard/executive"
import { SfHotTopicsView } from "../dashboard/hot-topics"
import { SfDashboardBudgetView } from "../dashboard/budget"
import { SfDashboardOpexView } from "../dashboard/opex"
import { SfDashboardCapexView } from "../dashboard/capex"
import { parseProcurementRouteQuery, procurementRouteAvailable } from "./procurement-route"
import { SfProcurementOverviewView } from "../procurement/overview"
import { SfRequestsPage } from "../procurement/requests/page"
import { SfPrApprovalView } from "../procurement/approvals/pr"
import { SfRemainingApprovalsView } from "../procurement/approvals/remaining"
import { SfSourcingView } from "../procurement/sourcing"
import { SfSuppliersView } from "../procurement/suppliers"
import { SfProcurementSettingsView } from "../procurement/settings"
import { SfVendorContractsPage } from "../procurement/contracts"
import { SfTodayView } from "../home"
import { SfCasesView } from "../decisions/cases"
import { SfIntentView } from "../decisions/intent"
import { SfTodayBoundOwnerProvider } from "./today-resume-binding"
import { createSfDesktopOriginBridge238 } from "./desktop-origin-bridge238"

/** The shell asks the live F01 owner, never a second source of draft authority. */
let liveExitGuard237: (() => Promise<boolean>) | undefined
let exitInFlight237: Promise<boolean> | undefined
export function bindSfOwnerShellExit237(guard: () => Promise<boolean>): () => void {
  if (liveExitGuard237 && liveExitGuard237 !== guard) throw new Error("SF_F01_MULTIPLE_EXIT_OWNERS")
  liveExitGuard237 = guard
  return () => {
    if (liveExitGuard237 === guard) liveExitGuard237 = undefined
  }
}
export function requestSfOwnerShellExit237(): Promise<boolean> {
  if (!liveExitGuard237) return Promise.resolve(true)
  if (exitInFlight237) return exitInFlight237
  const request = liveExitGuard237()
  exitInFlight237 = request.finally(() => {
    if (exitInFlight237 === settled) exitInFlight237 = undefined
  })
  const settled = exitInFlight237
  return settled
}

export type SfOwnerRuntime231Props = Readonly<{
  server: ServerConnection.Any
  directory: string
}>

type Discovery = Readonly<{
  status: "resolving" | "ready" | "denied" | "unavailable" | "ambiguous" | "invalid-link"
  selection?: SfOwnerSelection
}>
type View = Readonly<{
  status: "resolving" | "ready" | "denied" | "unavailable" | "invalid-link" | "kept-editing"
  route?: SfResolvedRoute
}>

const sameSelection = (a: SfOwnerSelection, b: SfOwnerSelection) =>
  a.serverKey === b.serverKey && a.projectId === b.projectId && a.installationId === b.installationId

const sameStamp = (
  a: Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string;
    policyVersion: string; accessRevision: string }>,
  b: typeof a,
) => a.installationId === b.installationId && a.projectId === b.projectId &&
  a.hostId === b.hostId && a.principalRef === b.principalRef &&
  a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision

function explicitSelection(query: string): { kind: "none" } | { kind: "invalid" } |
  { kind: "selected"; selection: SfOwnerSelection } {
  const params = new URLSearchParams(query)
  const values = ["server", "project", "installation"].map((key) => params.getAll(key))
  if (values.some((items) => items.length > 1)) return { kind: "invalid" }
  if (values.every((items) => items.length === 0)) return { kind: "none" }
  if (!values.every((items) => items.length === 1 && items[0])) return { kind: "invalid" }
  return { kind: "selected", selection: {
    serverKey: params.get("server")! as SfServerKey,
    projectId: params.get("project")! as SfRef,
    installationId: params.get("installation")! as SfRef,
  } }
}

/** Only the selected registered Orchestra connection may discover its installed SF. */
export function createSfInstalledOwnerSource231(
  server: ServerConnection.Any,
  fetcher: typeof globalThis.fetch,
) {
  const key = ServerConnection.key(server)
  const endpoint = (() => {
    try {
      const url = new URL(server.http.url)
      if (url.origin !== server.http.url.replace(/\/+$/, "") ||
        url.username || url.password || url.search || url.hash) return
      return new URL("/api/sucafina/installations", url.origin)
    } catch { return }
  })()
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(server.http.password ? {
      Authorization: "Basic " + authTokenFromCredentials({
        username: server.http.username, password: server.http.password,
      }),
    } : {}),
  }
  const discover = async (query: URLSearchParams, signal: AbortSignal) => {
    if (!endpoint || signal.aborted) return
    const url = new URL(endpoint)
    url.search = query.toString()
    try {
      const response = await fetcher(url.href, {
        method: "GET", headers, signal, credentials: "same-origin",
        cache: "no-store", redirect: "error",
      })
      if (!response.ok || signal.aborted) return
      const parsed = Schema.decodeUnknownOption(SfInstallationList, { onExcessProperty: "error" })(await response.json())
      return Option.isSome(parsed) && !signal.aborted ? parsed.value : undefined
    } catch { return }
  }
  return Object.freeze({
    transportIdentity: key,
    listByIds: (selection: SfOwnerSelection, signal: AbortSignal) => {
      if (selection.serverKey !== key || !selection.projectId || !selection.installationId)
        return Promise.resolve(undefined)
      return discover(new URLSearchParams({
        select: "ids", projectId: selection.projectId, installationId: selection.installationId,
      }), signal)
    },
    listByLocation: (directory: string, signal: AbortSignal) =>
      directory ? discover(new URLSearchParams({
        select: "location", "location[directory]": directory,
      }), signal) : Promise.resolve(undefined),
  })
}

function ownerKeyFromVerifiedContext(
  server: ServerConnection.Any, binding: SfInstallationDescriptor,
  stamp: Readonly<{ projectId: string; installationId: string; principalRef: string;
    hostId: string; policyVersion: string; accessRevision: string }>,
): SfOwnerKey {
  // This opaque client discriminator is NOT a grant. The original producer
  // context has been authenticated; UI34's original useSfCase performs its
  // own case read and admission after the route has been mounted.
  return JSON.stringify([
    ServerConnection.key(server), server.http.url, binding.publicOrigin,
    stamp.projectId, stamp.installationId, stamp.hostId,
    stamp.principalRef, stamp.policyVersion, stamp.accessRevision,
  ]) as SfOwnerKey
}

function MountedSurface(props: Readonly<{
  view: () => View
  bind: (handle: SfContextHandle | undefined) => void
  status: (status: string, generation: number) => void
}>): JSX.Element {
  const handle = useSfContext()
  props.bind(handle)
  createEffect(() => props.status(handle.state().status, handle.generation()))
  onCleanup(() => { props.bind(undefined); props.status("unmounted", -1) })
  const current = () => props.view().route
  return (
    <Switch fallback={<p role="status" data-sf-f01="not-admitted">Sucafina route not admitted</p>}>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI29"}>
        <SfTodayView surfaceId="UI29" route={current() as SfSurfaceProps<"UI29">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI33"}>
        <SfCasesView surfaceId="UI33" route={current() as SfSurfaceProps<"UI33">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI34"}>
        <SfIntentView surfaceId="UI34" route={current() as SfSurfaceProps<"UI34">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isDecisionPagesSurface(current()!.surfaceId)}>
        <SfDecisionPages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isWorkSurface(current()!.surfaceId)}>
        <SfWorkPages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP01"}>
        <SfDashboardExecutiveView surfaceId="CAP01" route={current() as SfSurfaceProps<"CAP01">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP02"}>
        <SfHotTopicsView surfaceId="CAP02" route={current() as SfSurfaceProps<"CAP02">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP03"}>
        <SfDashboardBudgetView surfaceId="CAP03" route={current() as SfSurfaceProps<"CAP03">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP04"}>
        <SfDashboardOpexView surfaceId="CAP04" route={current() as SfSurfaceProps<"CAP04">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP05"}>
        <SfDashboardCapexView surfaceId="CAP05" route={current() as SfSurfaceProps<"CAP05">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP14"}>
        <SfVendorContractsPage surfaceId="CAP14" route={current() as SfSurfaceProps<"CAP14">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP24"}>
        <SfProcurementOverviewView surfaceId="CAP24" route={current() as SfSurfaceProps<"CAP24">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP25" &&
        (current()?.kind === "sourcing" || current()?.kind === "quotes")}>
        <SfSourcingView surfaceId="CAP25" route={current() as SfSurfaceProps<"CAP25">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP25"}>
        <SfRequestsPage surfaceId="CAP25" route={current() as SfSurfaceProps<"CAP25">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP26"}>
        <SfPrApprovalView surfaceId="CAP26" route={current() as SfSurfaceProps<"CAP26">["route"]} />
        <SfRemainingApprovalsView surfaceId="CAP26" route={current() as SfSurfaceProps<"CAP26">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP27"}>
        <SfSuppliersView surfaceId="CAP27" route={current() as SfSurfaceProps<"CAP27">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP28"}>
        <SfProcurementSettingsView surfaceId="CAP28" route={current() as SfSurfaceProps<"CAP28">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP17"}>
        <SfPlannerOverviewView surfaceId="CAP17" route={current() as SfSurfaceProps<"CAP17">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isPlannerPagesSurface(current()!.surfaceId)}>
        <SfPlannerPages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isPeopleSurface(current()!.surfaceId)}>
        <SfPeoplePages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isOperationsSurface(current()!.surfaceId)}>
        <SfOperationsPages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isPortfolioSurface(current()!.surfaceId)}>
        <SfPortfolioPages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI45"}>
        <SfBiCatalog surfaceId="UI45" route={current() as SfSurfaceProps<"UI45">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI46"}>
        <SfBiCatalog surfaceId="UI46" route={current() as SfSurfaceProps<"UI46">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP23" && current()?.kind === "compare"}>
        <SfPlannerCompareView surfaceId="CAP23" route={current() as SfSurfaceProps<"CAP23">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP23"}>
        <SfPlannerVersionsView surfaceId="CAP23" route={current() as SfSurfaceProps<"CAP23">["route"]} />
      </Match>
    </Switch>
  )
}

/**
 * One Solid owner lifetime, outside the keyed per-chapter Suspense boundary.
 * The shell is already inside its genuine selected Server/SDK/Models contexts.
 */
export function SfOwnerRuntime231(props: SfOwnerRuntime231Props): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const platform = usePlatform()
  const language = useLanguage()
  const fetcher = platform.fetch ?? globalThis.fetch
  const [discovery, setDiscovery] = createStore<Discovery>({ status: "resolving" })
  const [view, setView] = createStore<View>({ status: "resolving" })
  const [provider, setProvider] = createStore({ status: "unmounted", generation: -1 })
  const [reconnect, setReconnect] = createStore({ required: false, busy: false })
  let mounted: SfContextHandle | undefined
  let ownerEpoch = 0
  let disposed = false
  let lastEditorFocus: HTMLElement | undefined
  const restoreEditorFocus = () => {
    if (lastEditorFocus?.isConnected) lastEditorFocus.focus()
  }
  const confirmDiscard = async () => typeof window !== "undefined" &&
    window.confirm(language.t("sf.ui67.discardNavigate"))
  const confirmExit = async () => {
    const handle = mounted
    if (!handle || !handle.hasDirtyDrafts()) return true
    const before = handle.state()
    if (before.status !== "ready") return false // quarantined: no private restore without revalidation
    const accepted = await confirmDiscard()
    if (!accepted) {
      restoreEditorFocus()
      return false
    }
    if (disposed || mounted !== handle) return false
    const now = handle.state()
    if (now.status !== "ready" || now.ownerKey !== before.ownerKey) return false
    const discarded = handle.discardDrafts()
    if (!discarded) restoreEditorFocus()
    else setView({ status: "resolving", route: undefined }) // purge mounted private surface before shell selection
    return discarded
  }
  const unbindExit = bindSfOwnerShellExit237(confirmExit)
  const unload = (event: BeforeUnloadEvent) => {
    if (!mounted?.hasDirtyDrafts()) return
    event.preventDefault()
    event.returnValue = ""
  }
  if (typeof window !== "undefined") window.addEventListener("beforeunload", unload)
  useBeforeLeave((event) => {
    // Canonical Sucafina chapters retain the SAME F01 owner and drafts.
    const target = new URL(event.to.toString(), window.location.href)
    const parts = target.pathname.split("/")
    if (target.origin === window.location.origin && parts[1] === "orchestra" &&
      isSfNativeChapter(parts[2] ?? "")) return
    if (!mounted?.hasDirtyDrafts()) return
    event.preventDefault()
    void requestSfOwnerShellExit237().then((accepted) => {
      if (accepted && !disposed) event.retry(true)
    })
  })

  const alignedOrigin = (() => {
    try { return typeof window !== "undefined" &&
      window.location.origin === new URL(props.server.http.url).origin }
    catch { return false }
  })()
  const desktopBridge = !alignedOrigin && platform.platform === "desktop" && platform.sucafina
    ? createSfDesktopOriginBridge238({
        desktop: platform.sucafina, server: props.server, directory: props.directory,
        fetch: fetcher, onInvalidated: (reason) => {
          ownerEpoch += 1
          mounted?.invalidate(reason === "logout" ? "logout" :
            reason === "access-revoked" ? "revoked" :
            reason === "session-expired" ? "session-expired" : "owner-changed")
          setView({ status: "denied", route: undefined })
          setReconnect({ required: reason === "session-expired", busy: false })
        },
      }) : undefined
  // Web discovery is admitted only on the identical server origin. An
  // unbridged cross-origin renderer cannot fall back to fetch or Basic auth.
  const source = desktopBridge ?? (alignedOrigin
    ? createSfInstalledOwnerSource231(props.server, fetcher)
    : {
        listByIds: async (_selection: SfOwnerSelection, _signal: AbortSignal) => undefined,
        listByLocation: async (_directory: string, _signal: AbortSignal) => undefined,
      })

  const currentHref = () => location.pathname + location.search
  const selection = () => discovery.status === "ready" ? discovery.selection : undefined
  const sameServer = (value: SfOwnerSelection) =>
    value.serverKey === ServerConnection.key(props.server)
  const newTransport = (binding: SfInstallationDescriptor, generation: number,
    currentGeneration: () => number): SfTransport => desktopBridge
    ? desktopBridge.createTransport(binding, generation, currentGeneration)
    : createSfTransport({
        binding, generation, currentGeneration, fetch: fetcher, operations: SfNativeOperationBindings,
      })
  const readContext = async (binding: SfInstallationDescriptor, signal: AbortSignal,
    generation: number, currentGeneration: () => number) => {
    const transport = newTransport(binding, generation, currentGeneration)
    const answer = await createSfContextClient(transport)["ctx.context"]({
      installationId: binding.installationId, projectId: binding.projectId,
      hostId: binding.hostId,
    }, { signal })
    return answer.kind === "response"
      ? answer.body
      : { status: "unavailable" as const, reason: "host-unavailable" as const }
  }
  const dependencies: SfContextDependencies = {
    listInstallations: async (selected, signal) => {
      ownerEpoch += 1 // invalidate all old transport generations before the next load
      const found = await source.listByIds(selected, signal)
      return found ?? { installations: [] }
    },
    loadContext: (binding, signal) => readContext(binding, signal, ownerEpoch, () => ownerEpoch),
    createTransport: (binding, generation) => newTransport(
      binding, generation, () => mounted?.generation() ?? generation,
    ),
    resolveTransportIdentity: (selected) => !sameServer(selected) ? "" :
      desktopBridge ? desktopBridge.transportIdentity(selected) :
      alignedOrigin ? ServerConnection.key(props.server) : "",
    createDraft: createSfDraft,
    revalidateDraft: async (input: SfDraftRevalidationInput, fresh, transport, signal): Promise<SfDraftRevalidation> => {
      // Retained record reads only. No guessed field/action grants or automatic
      // restoration of pending writes; those require producer-specific proofs.
      if (signal.aborted || input.read.operationId !== "projection.case" ||
        input.identity.kind !== "record" || input.read.fieldPaths.length ||
        input.read.actionIds.length) return { status: "unavailable" }
      const ready = fresh.availability.some((resource) => resource.operations.some((operation) =>
        operation.operationId === "projection.case" && operation.state === "ready" && operation.operational))
      if (!ready) return { status: "denied" }
      const result = await createSfDecisionsClient(transport)["projection.case"]({
        caseRef: input.identity.recordRef,
      }, { signal }).catch(() => undefined)
      if (signal.aborted || !result || result.kind !== "response" ||
        result.body.status !== "ok") return { status: "unavailable" }
      const projection = result.body.value.projection
      // The original case selector is opaque, NOT equal to projection.case.id.
      // Confirm it matches the registered revalidation input, then require the
      // original producer's independently stamped case read and intact version.
      const originalInput = input.read.input
      if (!originalInput || typeof originalInput !== "object" ||
        Array.isArray(originalInput) ||
        originalInput.caseRef !== input.identity.recordRef ||
        !sameStamp(result.body.context, fresh.stamp) ||
        projection.context.installationId !== fresh.stamp.installationId ||
        projection.context.projectId !== fresh.stamp.projectId ||
        projection.context.principalRef !== fresh.stamp.principalRef ||
        projection.context.policyVersion !== fresh.stamp.policyVersion ||
        projection.context.accessRevision !== fresh.stamp.accessRevision ||
        !projection.case.id || !projection.case.incarnation ||
        !Number.isSafeInteger(projection.case.version))
        return { status: "denied" }
      return { status: "authorized", authority: "unchanged",
        stamp: fresh.stamp, sourceVersion: projection.case.version }
    },
  }

  const preflights = new WeakMap<AbortSignal, ReturnType<NonNullable<typeof desktopBridge>["stage"]>>()
  const navigation: SfNativeNavigationState = createSfNavigationState({
    finishPreflight: (signal, commit) => {
      const stage = preflights.get(signal)
      if (!stage) return !desktopBridge
      preflights.delete(signal)
      if (commit) {
        const promoted = stage.promote()
        if (!promoted) stage.discard()
        return promoted
      }
      stage.discard()
      return true
    },
    selected: () => {
      const selected = selection()
      if (!selected) throw new Error("SF_F01_SELECTION_NOT_DISCOVERED")
      return selected
    },
    currentHref,
    currentOwnerKey: () => {
      const state = mounted?.state()
      return state?.status === "ready" ? state.ownerKey : undefined
    },
    hasDirtyDrafts: () => mounted?.hasDirtyDrafts() ?? true,
    confirmDiscard,
    invalidateOwner: () => {
      ownerEpoch += 1
      mounted?.invalidate("owner-changed")
    },
    validateRetained: (route, values) => {
      // Only a scroll position is retained in this first owner-bound composition.
      // No private query/filter/cursor can be replayed before an original read.
      if (route.surfaceId !== "UI29" || !Number.isSafeInteger(values.scrollY) ||
        (values.scrollY ?? -1) < 0) return
      return { scrollY: values.scrollY }
    },
    resolveAuthorizedRoute: async (href, selected, signal) => {
      if (!sameServer(selected) || !selected.installationId) return { status: "denied" }
      let url: URL
      try {
        url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin || url.hash || url.username || url.password)
          return { status: "invalid-link" }
      } catch { return { status: "invalid-link" } }
      const candidate = matchSfNativeRoutePath(url.pathname)
      if (!candidate) return { status: "invalid-link" }
      const dashboardQuery = candidate.chapterId === "sf-dashboard" ? parseDashboardRouteQuery(url.searchParams, candidate) : undefined
      const procurementQuery = candidate.chapterId === "sf-procurement" ? parseProcurementRouteQuery(url.searchParams, candidate) : undefined
      const plannerPagesQuery = isPlannerPagesSurface(candidate.surfaceId) ? parsePlannerPagesRouteQuery(url.searchParams, candidate) : undefined
      const peopleQuery = candidate.chapterId === "sf-people" ? parsePeopleRouteQuery(url.searchParams, candidate) : undefined
      const operationsQuery = candidate.chapterId === "sf-operations" ? parseOperationsRouteQuery(url.searchParams, candidate) : undefined
      const portfolioQuery = candidate.chapterId === "sf-portfolio" ? parsePortfolioRouteQuery(url.searchParams, candidate) : undefined
      const decisionPagesQuery = isDecisionPagesSurface(candidate.surfaceId) ? parseDecisionPagesRouteQuery(url.searchParams, candidate) : undefined
      const workQuery = candidate.chapterId === "sf-work" ? parseWorkRouteQuery(url.searchParams, candidate) : undefined
      const plannerQuery = (candidate.surfaceId === "CAP23" || candidate.surfaceId === "CAP17") ? parsePlannerRouteQuery(url.searchParams, candidate) : undefined
      if (candidate.chapterId === "sf-dashboard" ? !dashboardQuery :
        candidate.chapterId === "sf-procurement" ? !procurementQuery :
        candidate.chapterId === "sf-people" ? !peopleQuery :
        candidate.chapterId === "sf-operations" ? !operationsQuery :
        candidate.chapterId === "sf-portfolio" ? !portfolioQuery :
        candidate.chapterId === "sf-work" ? !workQuery :
        isDecisionPagesSurface(candidate.surfaceId) ? !decisionPagesQuery :
        isPlannerPagesSurface(candidate.surfaceId) ? !plannerPagesQuery :
        candidate.surfaceId === "CAP23" || candidate.surfaceId === "CAP17" ? !plannerQuery :
        [...url.searchParams.keys()].some((key) => !["server", "project", "installation"].includes(key)) || !(
          (candidate.surfaceId === "UI45" || candidate.surfaceId === "UI46") && validBiRoute(candidate, url.searchParams) ||
          candidate.surfaceId === "UI29" && candidate.kind === "entry" ||
          candidate.surfaceId === "UI33" && (candidate.kind === "entry" || candidate.kind === "new") ||
          candidate.surfaceId === "UI34" && candidate.kind === "entry"
        )) return { status: "invalid-link" }
      const staged = desktopBridge?.stage(selected, signal)
      if (staged) preflights.set(signal, staged)
      const found = await (staged ? staged.listByIds() : source.listByIds(selected, signal))
      if (signal.aborted || !found) return { status: "unavailable" }
      if (found.installations.length !== 1) return { status: "denied" }
      const binding = found.installations[0]!
      const currentGeneration = ownerEpoch
      const preflightTransport = () => staged
        ? staged.createTransport(binding, currentGeneration, () => ownerEpoch)
        : newTransport(binding, currentGeneration, () => ownerEpoch)
      const readPreflightContext = async () => {
        const answer = await createSfContextClient(preflightTransport())["ctx.context"]({
          installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        }, { signal })
        return answer.kind === "response" ? answer.body : { status: "unavailable" as const, reason: "host-unavailable" as const }
      }
      const context = await readPreflightContext()
      if (signal.aborted) return { status: "unavailable" }
      if (context.status !== "ok")
        return { status: context.status === "denied" || context.status === "unauthenticated"
          ? "denied" : "unavailable" }
      const stamp = context.value.stamp
      if (stamp.projectId !== binding.projectId ||
        stamp.installationId !== binding.installationId || stamp.hostId !== binding.hostId)
        return { status: "denied" }
      const requiredOperation = candidate.surfaceId === "UI29" ? "projection.home"
        : candidate.surfaceId === "UI33" ? "projection.cases" : "projection.case"
      if (candidate.surfaceId === "UI33" && candidate.kind === "new" &&
        !context.value.destinations.some((item) => item.capabilityId === "UI33" && item.canRead))
        return { status: "denied" }
      if (candidate.chapterId === "sf-dashboard" ? !dashboardRouteAvailable(context.value, candidate) :
        candidate.chapterId === "sf-procurement" ? !procurementRouteAvailable(context.value, candidate) :
        candidate.chapterId === "sf-people" ? !peopleRouteAvailable(context.value, candidate) :
        candidate.chapterId === "sf-operations" ? !operationsRouteAvailable(context.value, candidate) :
        candidate.chapterId === "sf-portfolio" ? !portfolioRouteAvailable(context.value, candidate) :
        candidate.chapterId === "sf-work" ? !workRouteAvailable(context.value, candidate) :
        isDecisionPagesSurface(candidate.surfaceId) ? !decisionPagesRouteAvailable(context.value, candidate) :
        isPlannerPagesSurface(candidate.surfaceId) ? !plannerPagesRouteAvailable(context.value, candidate) :
        candidate.surfaceId === "CAP23" || candidate.surfaceId === "CAP17" ? !plannerRouteAvailable(context.value, candidate) :
        candidate.surfaceId === "UI45" || candidate.surfaceId === "UI46" ? !biRouteAvailable(context.value, candidate) :
        !context.value.availability.some((resource) => resource.operations.some((operation) =>
          operation.operationId === requiredOperation && operation.state === "ready" && operation.operational)))
        return { status: "denied" }
      if (candidate.surfaceId === "CAP17" && plannerQuery && (plannerQuery.version || plannerQuery.filter)) {
        const input = {
          ...(plannerQuery.year === undefined ? {} : { year: plannerQuery.year }),
          ...(plannerQuery.version ? { version: plannerQuery.version } : {}),
          ...(plannerQuery.filter ? { filter: plannerQuery.filter } : {}),
        }
        const transport = preflightTransport()
        const result = await createSfPlannerClient(transport)["domain.page.CAP17"](input, { signal })
        if (signal.aborted || currentGeneration !== ownerEpoch) return { status: "unavailable" }
        if (result.kind !== "response" || result.body.status !== "ok") return { status: "denied" }
        if (!plannerOverviewSelectionMatches(plannerQuery, result.body.value)) return { status: "denied" }
        const fresh = await readPreflightContext()
        if (signal.aborted || currentGeneration !== ownerEpoch) return { status: "unavailable" }
        if (fresh.status !== "ok" || !sameStamp(stamp, fresh.value.stamp) ||
            !plannerRouteAvailable(fresh.value, candidate)) return { status: "denied" }
      }
      // UI34 data admission remains at original useSfCase. When returning from
      // UI29, the exact 227 resume port alone performs BOTH original case reads
      // (preflight and pre-commit), not a third implicit prefetch here.
      const existing = mounted?.state()
      if (existing?.status === "ready" && sameSelection(existing.selection, selected) &&
        !sameStamp(existing.context.stamp, stamp)) return { status: "denied" }
      const ownerKey = existing?.status === "ready" && sameSelection(existing.selection, selected)
        ? existing.ownerKey : ownerKeyFromVerifiedContext(props.server, binding, stamp)
      // Strict Q01 path parser + original context admission precede this
      // route assembly. The UI34 original useSfCase validates the case read;
      // the 227 Today resume port separately performs two original reads.
      const route = {
        surfaceId: candidate.surfaceId, kind: candidate.kind,
        params: candidate.parameters, ownerSelection: selected,
        pathname: url.pathname, href: (url.pathname + url.search) as SfHref, query: dashboardQuery ?? procurementQuery ?? peopleQuery ?? operationsQuery ?? portfolioQuery ?? workQuery ?? decisionPagesQuery ?? plannerPagesQuery ?? plannerQuery ?? {},
      } as SfResolvedRoute
      return { status: "authorized", route, ownerKey }
    },
    commit: ({ route, selection: selected, cause }) => {
      if (disposed) return
      setDiscovery({ status: "ready", selection: selected })
      setView({ status: "ready", route })
      const target = String(route.href)
      if (currentHref() !== target)
        navigate(target, { replace: cause === "deep-link" || cause === "history" || cause === "reload" })
    },
  })
  // The exact 227 resume adapter receives this single navigation instance.
  const boundDependencies: SfContextDependencies = Object.freeze({ ...dependencies, navigation })
  let discoveryAttempt = 0
  createEffect(() => {
    // Route selectors never borrow missing values from a remembered profile.
    const query = location.search
    const directory = props.directory
    const actualServerKey = ServerConnection.key(props.server)
    const parsed = explicitSelection(query)
    const epoch = ++discoveryAttempt
    if (parsed.kind === "invalid") {
      setDiscovery({ status: "invalid-link", selection: undefined })
      setView({ status: "invalid-link", route: undefined })
      return
    }
    if (parsed.kind === "selected") {
      if (parsed.selection.serverKey !== actualServerKey && !selection()) {
        setDiscovery({ status: "denied", selection: undefined })
        setView({ status: "denied", route: undefined })
        return
      }
      if (selection() && sameSelection(selection()!, parsed.selection)) return
      if (selection()) {
        // Preserve 231 follow-up: discovery, not the route effect, owns
        // cross-owner admission and cancel/return. Never pre-publish the selector.
        const abort = new AbortController()
        const previousHref = untrack(() => view.route?.href)
        void navigation.requestNativeTransition(currentHref(), "deep-link", { signal: abort.signal }).then((result) => {
          if (disposed || abort.signal.aborted ||
            result.status === "committed" || result.status === "aborted") return
          if (previousHref) {
            navigate(String(previousHref), { replace: true })
            restoreEditorFocus()
          }
        })
        onCleanup(() => abort.abort())
        return
      }
      setDiscovery({ status: "ready", selection: parsed.selection })
      return
    }
    if (selection()) return // already admitted by original location discovery
    setDiscovery({ status: "resolving", selection: undefined })
    const abort = new AbortController()
    void source.listByLocation(directory, abort.signal).then((found) => {
      if (disposed || abort.signal.aborted || epoch !== discoveryAttempt) return
      if (!found) {
        setDiscovery({ status: "unavailable", selection: undefined })
      } else if (found.installations.length === 0) {
        setDiscovery({ status: "denied", selection: undefined })
      } else if (found.installations.length !== 1) {
        // Distinct genuine installations require explicit owner selection.
        setDiscovery({ status: "ambiguous", selection: undefined })
      } else {
        const only = found.installations[0]!
        setDiscovery({ status: "ready", selection: {
          serverKey: actualServerKey as SfServerKey,
          projectId: only.projectId as SfRef,
          installationId: only.installationId as SfRef,
        } })
      }
    }).catch(() => {
      if (!abort.signal.aborted && epoch === discoveryAttempt)
        setDiscovery({ status: "unavailable", selection: undefined })
    })
    onCleanup(() => abort.abort())
  })

  let routeEpoch = 0
  createEffect(() => {
    const selected = selection()
    const href = currentHref()
    const providerStatus = provider.status
    const providerGeneration = provider.generation
    if (!selected || disposed || providerStatus !== "ready" || providerGeneration < 0) return
    const requested = explicitSelection(location.search)
    // Preserve PR208 #208 cross-owner single admission; never race discovery.
    if (requested.kind === "selected" && !sameSelection(requested.selection, selected)) return
    if (untrack(() => view.status === "ready" && view.route?.href === href &&
      sameSelection(view.route.ownerSelection, selected))) return
    const epoch = ++routeEpoch
    // Keep the editor mounted during the decision; cancel retains value AND focus.
    const previous = untrack(() => view.status === "ready" ? view.route : undefined)
    if (!previous) setView({ status: "resolving", route: undefined })
    const abort = new AbortController()
    void navigation.requestNativeTransition(href, "deep-link", { signal: abort.signal }).then((result) => {
      if (disposed || abort.signal.aborted || epoch !== routeEpoch ||
        result.status === "committed" || result.status === "aborted") return
      if (result.status === "kept-editing" && previous) {
        navigate(String(previous.href), { replace: true })
        restoreEditorFocus()
        return
      }
      setView({ status: result.status, route: undefined })
    })
    onCleanup(() => abort.abort())
  })
  onCleanup(() => {
    disposed = true
    ownerEpoch += 1
    desktopBridge?.dispose()
    navigation.dispose()
    unbindExit()
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", unload)
  })

  const reconnectDesktop = async () => {
    const selected = selection()
    const handle = mounted
    if (!desktopBridge || !selected || !handle || disposed || reconnect.busy) return
    setReconnect("busy", true)
    try {
      // Reload re-discovers and binds the exact selected owner; it never revives
      // the retired handle or restores private state without fresh admission.
      await handle.reload()
      if (disposed || mounted !== handle || !selection() || !sameSelection(selection()!, selected)) return
      const status = handle.state().status
      if (status === "ready" || status === "unauthenticated") setReconnect("required", false)
    } finally {
      if (!disposed) setReconnect("busy", false)
    }
  }
  const desktopLogin = async () => {
    const selected = selection()
    if (!desktopBridge || !selected || disposed || provider.status !== "unauthenticated") return
    const parsed = explicitSelection(location.search)
    const routePath = matchSfNativeRoutePath(location.pathname)
    const planner = routePath && (routePath.surfaceId === "CAP17" || routePath.surfaceId === "CAP23")
      ? parsePlannerRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const dashboard = routePath && routePath.chapterId === "sf-dashboard"
      ? parseDashboardRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const procurement = routePath && routePath.chapterId === "sf-procurement"
      ? parseProcurementRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const plannerPages = routePath && isPlannerPagesSurface(routePath.surfaceId)
      ? parsePlannerPagesRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const people = routePath && routePath.chapterId === "sf-people"
      ? parsePeopleRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const operations = routePath && routePath.chapterId === "sf-operations"
      ? parseOperationsRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const portfolio = routePath && routePath.chapterId === "sf-portfolio"
      ? parsePortfolioRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const decisionPages = routePath && isDecisionPagesSurface(routePath.surfaceId)
      ? parseDecisionPagesRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const work = routePath && routePath.chapterId === "sf-work"
      ? parseWorkRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const nonPlanner = routePath &&
      (routePath.kind === "entry" && ["UI29", "UI33", "UI34"].includes(routePath.surfaceId) ||
        routePath.surfaceId === "UI33" && routePath.kind === "new") &&
      [...new URLSearchParams(location.search).keys()].every((key) => ["server", "project", "installation"].includes(key))
    const bi = routePath && validBiRoute(routePath, new URLSearchParams(location.search))
    if (parsed.kind === "invalid" || parsed.kind === "selected" &&
        !sameSelection(parsed.selection, selected) ||
        !routePath || !(dashboard || procurement || people || operations || portfolio || work || decisionPages || plannerPages || planner || nonPlanner || bi)) {
      setView({ status: "invalid-link", route: undefined })
      return
    }
    const returnRoute = {
      surfaceId: routePath.surfaceId, kind: routePath.kind, params: routePath.parameters,
      ownerSelection: selected, pathname: location.pathname,
      href: (location.pathname + location.search) as SfHref, query: dashboard ?? procurement ?? people ?? operations ?? portfolio ?? work ?? decisionPages ?? plannerPages ?? planner ?? {},
    } as SfResolvedRoute
    try {
      const auth = await desktopBridge.login(returnRoute)
      if (auth.status !== "authenticated") {
        console.error("SF_NATIVE_AUTH_NOT_CONFIRMED", auth.status)
        setView({ status: "unavailable", route: undefined })
        return
      }
      await mounted?.reload()
    } catch (error) {
      console.error("SF_NATIVE_AUTH_FAILED", error instanceof Error ? error.name : "unknown")
      setView({ status: "unavailable", route: undefined })
    }
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col" data-sf-host="owner-runtime231"
      onFocusIn={(event) => {
        if (event.target instanceof HTMLElement &&
          (event.target.matches("input, textarea, select, [contenteditable='true']")))
          lastEditorFocus = event.target
      }}>

      <Show when={desktopBridge && reconnect.required}>
        <button type="button" data-sf-desktop-reconnect="required" disabled={reconnect.busy}
          onClick={() => { void reconnectDesktop() }}>{language.t("sf.common.loginAgain")}</button>
      </Show>
      <Show when={desktopBridge && provider.status === "unauthenticated"}>
        <button type="button" data-sf-desktop-login="required"
          onClick={() => { void desktopLogin() }}>{language.t("sf.common.loginAgain")}</button>
      </Show>

      <Show when={selection()} fallback={
        <p role="status" data-sf-f01={discovery.status}>
          {discovery.status === "ambiguous" ? "Sucafina installation selection required"
            : discovery.status === "resolving" ? "Resolving installed Sucafina"
            : "Sucafina installation unavailable or unauthorized"}
        </p>
      }>
        <SfTodayBoundOwnerProvider
          selection={() => selection()!}
          dependencies={boundDependencies}
          ownerNavigation={navigation}
        >
          <MountedSurface view={() => view} bind={(handle) => { mounted = handle }}
            status={(status, generation) => setProvider({ status, generation })} />
        </SfTodayBoundOwnerProvider>
      </Show>
    </div>
  )
}
