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
import { pathKey } from "@/utils/path-key"
import { showToast } from "@/utils/toast"
import { authTokenFromCredentials } from "@/utils/server"
import { SfInstallationList, type SfContext, type SfHref, type SfInstallationDescriptor, type SfOwnerKey,
  type SfOwnerSelection, type SfRef, type SfResolvedRoute, type SfServerKey } from "@orchestra/schema/sucafina/context"
import { createSfTransport, type SfTransport, type SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { createSfDraft } from "../shared/draft"
import { createSfNavigationState, type SfNativeNavigationState } from "../navigation-state"
import { isSfNativeChapter, matchSfNativeRoutePath } from "../route-registry"
import { useSfContext } from "../context"
import { SfPageFrame } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import type { SfContextDependencies, SfContextHandle, SfDraftRevalidationInput,
  SfDraftRevalidation, SfSurfaceProps } from "../context/contracts"
import { parsePlannerRouteQuery, plannerRouteAvailable, plannerOverviewSelectionMatches } from "./planner-route"
import { isExtendedSurface, parseExtendedRouteQuery, extendedRouteAvailable, SfExtendedPages } from "./extended-routes"
import { homeContextStatusRoute } from "./home-pages-route"
import { isPlannerPagesSurface, plannerPagesRouteAvailable } from "./planner-pages-route"
import { plannerPagesNeedsPreflight, preflightPlannerPages } from "./planner-pages-preflight"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import { SfPlannerOverviewView } from "../planner/overview"
import { SfPlannerVersionsView } from "../planner/versions"
import { SfPlannerCompareView } from "../planner/compare"
import { SfBiCatalog } from "../bi/catalog"
import { validBiRoute, biRouteAvailable } from "./bi-route"
import { parseDashboardRouteQuery, dashboardRouteAvailable } from "./dashboard-route"
import { SfDashboardExecutiveView } from "../dashboard/executive"
import { SfHotTopicsView } from "../dashboard/hot-topics"
import { SfHotTopicProposalView } from "../dashboard/hot-topics/proposals"
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
import { revalidateReportRecovery } from "../reviews/reports/recovery"
import { revalidateSfNativeDraft } from "./draft-revalidation"
import { SfTodayBoundOwnerProvider } from "./today-resume-binding"
import { createSfDesktopOriginBridge238 } from "./desktop-origin-bridge238"
import { bindSfNativeChapterNavigation, confirmSfOwnerExit, rejectInvalidSfOwnerQuery, sfCaptureReadyOwner, sfReadyOwnerSelection, sfSameReadyOwnerSnapshot, transitionSfNativeChapter } from "./native-chapter-entry"

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
  const key: string = ServerConnection.key(server)
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
  contextStatusRoute: (selection: SfOwnerSelection) => SfResolvedRoute<"UI67"> | undefined
  bind: (handle: SfContextHandle | undefined) => void
  status: (status: string, generation: number) => void
}>): JSX.Element {
  const handle = useSfContext()
  props.bind(handle)
  createEffect(() => props.status(handle.state().status, handle.generation()))
  onCleanup(() => { props.bind(undefined); props.status("unmounted", -1) })
  const current = () => props.view().route
  const contextStatus = () => {
    const state = handle.state()
    return state.status === "ready" ? undefined : props.contextStatusRoute(state.selection)
  }
  const statusKey = (key: string) => key as Parameters<typeof SfStatePanel>[0]["messageKey"]
  const ownerStatus = () => {
    const status = handle.state().status
    return status === "resolving" ? "loading" as const : status === "denied" ? "denied" as const :
      status === "unauthenticated" ? "session-expired" as const : status === "context-mismatch" ? "invalid" as const :
      status === "ready" ? "ready" as const : "unavailable" as const
  }
  const ownerMessage = () => {
    const status = handle.state().status
    return status === "resolving" ? "sf.ui67.loading" : status === "denied" ? "sf.ui67.denied" :
      status === "unauthenticated" ? "sf.ui67.unauthenticated" : status === "context-mismatch" ? "sf.ui67.mismatch" :
      status === "choose-installation" ? "sf.ui67.select" : "sf.ui67.unavailable"
  }
  return (
    <Switch fallback={<p role="status" data-sf-f01="not-admitted">Sucafina route not admitted</p>}>
      <Match when={contextStatus()}>
        <SfPageFrame titleKey={statusKey("sf.ui67.title")} context={[]} tabs={[]} activeTab={null}
          secondaryActions={[]} density="comfortable" layout="reading" onLayoutMode={() => undefined}>
          <SfStatePanel state={ownerStatus()} messageKey={statusKey(ownerMessage())} onRetryRead={() => { void handle.reload() }} />
        </SfPageFrame>
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI29"}>
        <SfTodayView surfaceId="UI29" route={current() as SfSurfaceProps<"UI29">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI33"}>
        <SfCasesView surfaceId="UI33" route={current() as SfSurfaceProps<"UI33">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI34"}>
        <SfIntentView surfaceId="UI34" route={current() as SfSurfaceProps<"UI34">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current() && isExtendedSurface(current()!.surfaceId)}>
        <SfExtendedPages route={current()!} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP01"}>
        <SfDashboardExecutiveView surfaceId="CAP01" route={current() as SfSurfaceProps<"CAP01">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "CAP02"}>
        <SfHotTopicsView surfaceId="CAP02" route={current() as SfSurfaceProps<"CAP02">["route"]} />
      </Match>
      <Match when={props.view().status === "ready" && current()?.surfaceId === "UI54"}>
        <SfHotTopicProposalView surfaceId="UI54" route={current() as SfSurfaceProps<"UI54">["route"]} />
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
  const confirmExit = (signal?: AbortSignal) => confirmSfOwnerExit({
    handle: () => mounted, disposed: () => disposed, confirmDiscard, restoreFocus: restoreEditorFocus,
    valid: () => !signal?.aborted,
    onDiscarded: () => setView({ status: "resolving", route: undefined }),
    onBlocked: () => {
      console.error("Sucafina draft discard was refused")
      showToast({ variant: "error", title: language.t("common.requestFailed"), description: language.t("sf.common.pending") })
    },
  })
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
    value.serverKey === (ServerConnection.key(props.server) as string)
  // Discovery already sends the selected ServerConnection's HTTP credentials.
  // Native F01/F02 reads must use that SAME connection, not an unauthenticated
  // global fetch. Never forward Basic to another origin or outside this mount.
  const nativeFetch: SfTransportFetch = (input, init) => {
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.href)
    if (!alignedOrigin || target.origin !== window.location.origin ||
        target.origin !== new URL(props.server.http.url).origin ||
        !target.pathname.startsWith("/sucafina/"))
      return Promise.reject(new Error("SF_NATIVE_SELECTED_ORIGIN_REQUIRED"))
    if (!props.server.http.password) return fetcher(input, init)
    const headers = new Headers(init?.headers)
    headers.set("Authorization", "Basic " + authTokenFromCredentials({
      username: props.server.http.username, password: props.server.http.password,
    }))
    return fetcher(input, { ...init, headers })
  }
  const newTransport = (binding: SfInstallationDescriptor, generation: number,
    currentGeneration: () => number): SfTransport => desktopBridge
    ? desktopBridge.createTransport(binding, generation, currentGeneration)
    : createSfTransport({
        binding, generation, currentGeneration, fetch: nativeFetch, operations: SfNativeOperationBindings,
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
  const dependencies: SfContextDependencies & Readonly<{ onDraftAccessRevoked: () => void }> = {
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
    onDraftAccessRevoked: () => {
      if (disposed) return
      showToast({ variant: "error", title: language.t("common.requestFailed"),
        description: language.t("sf.common.noAccess") })
    },
    revalidateDraft: async (input: SfDraftRevalidationInput, fresh, transport, signal): Promise<SfDraftRevalidation> => {
      if (input.surfaceId === "UI50" && input.read.operationId === "dashboard.dashboard-review")
        return revalidateReportRecovery(input, fresh, transport, signal)
      // Every other retained edit is proved again at its original producer. No
      // guessed field/action grant and no restoration of pending writes.
      return revalidateSfNativeDraft(input, fresh, transport, signal)
    },
  }

  const preflights = new WeakMap<AbortSignal, ReturnType<NonNullable<typeof desktopBridge>["stage"]>>()
  const consentRechecks = new WeakMap<AbortSignal, (route: SfResolvedRoute, ownerKey: SfOwnerKey) => Promise<boolean>>()
  let routePreflightSignal: AbortSignal | undefined
  const navigation: SfNativeNavigationState = createSfNavigationState({
    finishPreflight: (signal, commit) => {
      consentRechecks.delete(signal)
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
    confirmDiscard: () => confirmExit(routePreflightSignal),
    revalidateAfterConsent: (route, ownerKey, signal) => consentRechecks.get(signal)?.(route, ownerKey) ?? Promise.resolve(false),
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
      routePreflightSignal = signal
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
      const extendedQuery = isExtendedSurface(candidate.surfaceId) ? parseExtendedRouteQuery(url.searchParams, candidate) : undefined
      const plannerQuery = (candidate.surfaceId === "CAP23" || candidate.surfaceId === "CAP17") ? parsePlannerRouteQuery(url.searchParams, candidate) : undefined
      if (candidate.chapterId === "sf-dashboard" ? !dashboardQuery :
        candidate.chapterId === "sf-procurement" ? !procurementQuery :
        isExtendedSurface(candidate.surfaceId) ? !extendedQuery :
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
      const binding = found.installations[0]
      if (!binding) return { status: "denied" }
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
      if (signal.aborted || currentGeneration !== ownerEpoch) return { status: "unavailable" }
      if (context.status !== "ok")
        return { status: context.status === "denied" || context.status === "unauthenticated"
          ? "denied" : "unavailable" }
      const stamp = context.value.stamp
      if (stamp.projectId !== binding.projectId ||
        stamp.installationId !== binding.installationId || stamp.hostId !== binding.hostId)
        return { status: "denied" }
      const requiredOperation = candidate.surfaceId === "UI29" ? "projection.home"
        : candidate.surfaceId === "UI33" ? "projection.cases" : "projection.case"
      const routeAvailable = (access: SfContext): boolean => {
        return candidate.chapterId === "sf-dashboard" ? dashboardRouteAvailable(access, candidate) :
          candidate.chapterId === "sf-procurement" ? procurementRouteAvailable(access, candidate) :
          isExtendedSurface(candidate.surfaceId) ? extendedRouteAvailable(access, candidate) :
          candidate.surfaceId === "CAP23" || candidate.surfaceId === "CAP17" ? plannerRouteAvailable(access, candidate) :
          candidate.surfaceId === "UI45" || candidate.surfaceId === "UI46" ? biRouteAvailable(access, candidate) :
          access.availability.some((resource) => resource.operations.some((operation) =>
            operation.operationId === requiredOperation && operation.state === "ready" && operation.operational))
      }
      if (!routeAvailable(context.value)) return { status: "denied" }
      const pendingHandle = mounted
      const pendingState = pendingHandle?.state()
      if (pendingHandle && pendingState && pendingState.status !== "ready" && pendingHandle.hasDirtyDrafts() &&
        !sameSelection(pendingState.selection, selected)) {
        const generation = pendingHandle.generation()
        if (!(await confirmExit(signal))) return { status: "denied" }
        if (signal.aborted || currentGeneration !== ownerEpoch || mounted !== pendingHandle ||
          pendingHandle.generation() !== generation) return { status: "unavailable" }
        const fresh = await readPreflightContext()
        if (signal.aborted || currentGeneration !== ownerEpoch || mounted !== pendingHandle ||
          pendingHandle.generation() !== generation) return { status: "unavailable" }
        if (fresh.status !== "ok" || !sameStamp(stamp, fresh.value.stamp) || !routeAvailable(fresh.value))
          return { status: "denied" }
      }
      if (isPlannerPagesSurface(candidate.surfaceId) && extendedQuery && plannerPagesNeedsPreflight(candidate, extendedQuery)) {
        const result = await preflightPlannerPages({ candidate, query: extendedQuery, transport: preflightTransport(), stamp,
          signal, current: () => currentGeneration === ownerEpoch })
        if (result !== "authorized") return { status: result }
        const fresh = await readPreflightContext()
        if (signal.aborted || currentGeneration !== ownerEpoch) return { status: "unavailable" }
        if (fresh.status !== "ok" || !sameStamp(stamp, fresh.value.stamp) ||
          !plannerPagesRouteAvailable(fresh.value, candidate)) return { status: "denied" }
      }
      if (candidate.surfaceId === "CAP17" && plannerQuery && (plannerQuery.version || plannerQuery.filter)) {
        const input = {
          ...(plannerQuery.year === undefined ? {} : { year: plannerQuery.year }),
          ...(plannerQuery.version ? { version: plannerQuery.version } : {}),
          ...(plannerQuery.filter ? { filter: plannerQuery.filter } : {}),
        }
        const transport = preflightTransport()
        const result = await createSfPlannerClient(transport)["domain.page.CAP17"](input, { signal })
        if (signal.aborted || currentGeneration !== ownerEpoch) return { status: "unavailable" }
        if (result.kind !== "response" || result.status < 200 || result.status >= 300 || result.body.status !== "ok") return { status: "denied" }
        if (!sameStamp(stamp, result.body.context) ||
          plannerQuery.version && result.body.value.selection.versionId !== plannerQuery.version ||
          plannerQuery.year !== undefined && result.body.value.data.selectedVersion?.year !== plannerQuery.year)
          return { status: "denied" }
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
      const existingSelection = existing?.status === "ready" ? sfReadyOwnerSelection(existing) : undefined
      if (existing?.status === "ready" && !existingSelection) return { status: "denied" }
      if (existing?.status === "ready" && existingSelection && sameSelection(existingSelection, selected) &&
        !sameStamp(existing.context.stamp, stamp)) return { status: "denied" }
      const ownerKey = existing?.status === "ready" && existingSelection && sameSelection(existingSelection, selected)
        ? existing.ownerKey : ownerKeyFromVerifiedContext(props.server, binding, stamp)
      // Strict Q01 path parser + original context admission precede this
      // route assembly. The UI34 original useSfCase validates the case read;
      // the 227 Today resume port separately performs two original reads.
      const route = {
        surfaceId: candidate.surfaceId, kind: candidate.kind,
        params: candidate.parameters, ownerSelection: selected,
        pathname: url.pathname, href: (url.pathname + url.search) as SfHref, query: dashboardQuery ?? procurementQuery ?? extendedQuery ?? plannerQuery ?? {},
      } as SfResolvedRoute
      consentRechecks.set(signal, async (resolved, resolvedOwner) => {
        if (resolved.href !== route.href || resolvedOwner !== ownerKey || signal.aborted || currentGeneration !== ownerEpoch) return false
        const contextStillValid = async () => {
          const fresh = await readPreflightContext()
          return !signal.aborted && currentGeneration === ownerEpoch && fresh.status === "ok" &&
            sameStamp(stamp, fresh.value.stamp) && routeAvailable(fresh.value)
        }
        if (!(await contextStillValid())) return false
        if (isPlannerPagesSurface(candidate.surfaceId) && extendedQuery && plannerPagesNeedsPreflight(candidate, extendedQuery)) {
          const result = await preflightPlannerPages({ candidate, query: extendedQuery, transport: preflightTransport(), stamp,
            signal, current: () => currentGeneration === ownerEpoch })
          return result === "authorized" && await contextStillValid()
        }
        if (candidate.surfaceId === "CAP17" && plannerQuery && (plannerQuery.version || plannerQuery.filter)) {
          const input = { ...(plannerQuery.year === undefined ? {} : { year: plannerQuery.year }),
            ...(plannerQuery.version ? { version: plannerQuery.version } : {}), ...(plannerQuery.filter ? { filter: plannerQuery.filter } : {}) }
          const result = await createSfPlannerClient(preflightTransport())["domain.page.CAP17"](input, { signal })
          if (signal.aborted || currentGeneration !== ownerEpoch || result.kind !== "response" ||
            result.status < 200 || result.status >= 300 || result.body.status !== "ok" ||
            !sameStamp(stamp, result.body.context) ||
            plannerQuery.version && result.body.value.selection.versionId !== plannerQuery.version ||
            plannerQuery.year !== undefined && result.body.value.data.selectedVersion?.year !== plannerQuery.year ||
            !plannerOverviewSelectionMatches(plannerQuery, result.body.value)) return false
          return contextStillValid()
        }
        return true
      })
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
  const unbindChapterNavigation = bindSfNativeChapterNavigation(async (request) => {
    if (request.server !== ServerConnection.key(props.server) ||
      pathKey(request.directory ?? "") !== pathKey(props.directory)) return "profile-mismatch"
    const handle = mounted
    const state = handle?.state()
    const snapshot = state?.status === "ready" ? sfCaptureReadyOwner(state) : undefined
    if (!handle || !snapshot || snapshot.selection.serverKey !== request.server) {
      console.error("Sucafina sidebar owner is not ready")
      showToast({ title: language.t("common.requestFailed"), description: language.t("sf.common.unavailable") })
      return "blocked"
    }
    const generation = handle.generation()
    const result = await transitionSfNativeChapter(request.chapter, snapshot.selection, snapshot.ownerKey, navigation).catch((error: unknown) => {
      console.error("Sucafina sidebar transition failed", error)
      return { status: "unavailable" as const }
    })
    if (disposed || mounted !== handle || !sfSameReadyOwnerSnapshot(handle, snapshot, generation)) return "blocked"
    if (result.status === "committed") return "committed"
    restoreEditorFocus()
    if (result.status !== "kept-editing" && result.status !== "aborted") {
      console.error("Sucafina sidebar transition not admitted", result.status)
      showToast({ title: language.t("common.requestFailed"), description: language.t("sf.common.unavailable") })
    }
    return "blocked"
  })
  // The exact 227 resume adapter receives this single navigation instance.
  const boundDependencies: SfContextDependencies = Object.freeze({ ...dependencies, navigation })
  let discoveryAttempt = 0
  createEffect(() => {
    // Route selectors never borrow missing values from a remembered profile.
    const query = location.search
    const directory = props.directory
    const actualServerKey: string = ServerConnection.key(props.server)
    const parsed = explicitSelection(query)
    // Async outcomes must not themselves restart discovery: failed/denied reads
    // are terminal for this owner query until its URL or profile changes.
    const activeSelection = untrack(selection)
    const epoch = ++discoveryAttempt
    if (parsed.kind === "invalid") {
      rejectInvalidSfOwnerQuery({ ownerMounted: !!mounted, selectionPresent: !!activeSelection,
        previousHref: untrack(() => view.route?.href) }, {
        restore: (href) => { navigate(href, { replace: true }); restoreEditorFocus() },
        notify: () => {
          console.error("Sucafina owner query is invalid")
          showToast({ variant: "error", title: language.t("common.requestFailed"), description: language.t("sf.common.invalidLink") })
        },
        initialInvalid: () => {
          setDiscovery({ status: "invalid-link", selection: undefined })
          setView({ status: "invalid-link", route: undefined })
        },
      })
      return
    }
    if (parsed.kind === "selected") {
      if (parsed.selection.serverKey !== actualServerKey && !activeSelection) {
        setDiscovery({ status: "denied", selection: undefined })
        setView({ status: "denied", route: undefined })
        return
      }
      if (activeSelection && sameSelection(activeSelection, parsed.selection)) return
      if (activeSelection) {
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
          if (result.status !== "kept-editing") {
            console.error("Sucafina owner transition not admitted", result.status)
            showToast({ variant: "error", title: language.t("common.requestFailed"), description: language.t("sf.common.unavailable") })
          }
        })
        onCleanup(() => abort.abort())
        return
      }
      setDiscovery({ status: "ready", selection: parsed.selection })
      return
    }
    if (activeSelection) return // already admitted by original location discovery
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
        const only = found.installations[0]
        if (!only) {
          setDiscovery({ status: "denied", selection: undefined })
          return
        }
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
    if (requested.kind === "invalid") return // discovery retains any live owner and rejects the URL
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
      if (result.status === "invalid-link" && previous) {
        navigate(String(previous.href), { replace: true })
        restoreEditorFocus()
        console.error("Sucafina route query is invalid")
        showToast({ variant: "error", title: language.t("common.requestFailed"), description: language.t("sf.common.invalidLink") })
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
    unbindChapterNavigation()
    unbindExit()
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", unload)
  })

  const reconnectDesktop = async () => {
    const handle = mounted
    if (!desktopBridge || !handle || disposed || reconnect.busy) return
    const state = handle.state()
    const selected = state.status === "ready" ? sfReadyOwnerSelection(state) : { ...state.selection }
    const discovered = selection()
    if (!selected || !discovered || !sameSelection(selected, discovered)) return
    setReconnect("busy", true)
    try {
      // Reload re-discovers and binds the exact selected owner; it never revives
      // the retired handle or restores private state without fresh admission.
      await handle.reload()
      const current = handle.state()
      const currentSelection = current.status === "ready" ? sfReadyOwnerSelection(current) : current.selection
      const next = selection()
      if (disposed || mounted !== handle || !next || !currentSelection ||
        !sameSelection(next, selected) || !sameSelection(currentSelection, selected)) return
      const status = current.status
      if (status === "ready" || status === "unauthenticated") setReconnect("required", false)
    } finally {
      if (!disposed) setReconnect("busy", false)
    }
  }
  const desktopLogin = async () => {
    const handle = mounted
    const state = handle?.state()
    if (!desktopBridge || !handle || !state || state.status !== "unauthenticated" || disposed || provider.status !== "unauthenticated") return
    const selected = { ...state.selection }
    const discovered = selection()
    if (!discovered || !sameSelection(discovered, selected) || !sameServer(selected) ||
      selected.projectId !== state.binding.projectId || selected.installationId !== state.binding.installationId) return
    const generation = handle.generation()
    const parsed = explicitSelection(location.search)
    const routePath = matchSfNativeRoutePath(location.pathname)
    const planner = routePath && (routePath.surfaceId === "CAP17" || routePath.surfaceId === "CAP23")
      ? parsePlannerRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const dashboard = routePath && routePath.chapterId === "sf-dashboard"
      ? parseDashboardRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const procurement = routePath && routePath.chapterId === "sf-procurement"
      ? parseProcurementRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const extended = routePath && isExtendedSurface(routePath.surfaceId)
      ? parseExtendedRouteQuery(new URLSearchParams(location.search), routePath) : undefined
    const nonPlanner = routePath &&
      (routePath.kind === "entry" && ["UI29", "UI33", "UI34"].includes(routePath.surfaceId) ||
        routePath.surfaceId === "UI33" && routePath.kind === "new") &&
      [...new URLSearchParams(location.search).keys()].every((key) => ["server", "project", "installation"].includes(key))
    const bi = routePath && validBiRoute(routePath, new URLSearchParams(location.search))
    if (parsed.kind === "invalid" || parsed.kind === "selected" &&
        !sameSelection(parsed.selection, selected) ||
        !routePath || !(dashboard || procurement || extended || planner || nonPlanner || bi)) {
      setView({ status: "invalid-link", route: undefined })
      return
    }
    const returnRoute = {
      surfaceId: routePath.surfaceId, kind: routePath.kind, params: routePath.parameters,
      ownerSelection: selected, pathname: location.pathname,
      href: (location.pathname + location.search) as SfHref, query: dashboard ?? procurement ?? extended ?? planner ?? {},
    } as SfResolvedRoute
    try {
      const auth = await desktopBridge.login(returnRoute)
      if (auth.status !== "authenticated") {
        console.error("SF_NATIVE_AUTH_NOT_CONFIRMED", auth.status)
        setView({ status: "unavailable", route: undefined })
        return
      }
      const current = handle.state()
      const next = selection()
      if (disposed || mounted !== handle || handle.generation() !== generation || current.status !== "unauthenticated" ||
        !next || !sameSelection(next, selected) || !sameSelection(current.selection, selected)) return
      await handle.reload()
    } catch (error) {
      console.error("SF_NATIVE_AUTH_FAILED", error instanceof Error ? error.name : "unknown")
      setView({ status: "unavailable", route: undefined })
    }
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col" data-sf-host="owner-runtime231"
      data-sf-provider-status={provider.status}
      data-sf-view-status={view.status}
      data-sf-discovery-status={discovery.status}
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
        {(selected) => <SfTodayBoundOwnerProvider
          selection={selected}
          dependencies={boundDependencies}
          ownerNavigation={navigation}
        >
          <MountedSurface view={() => view}
            contextStatusRoute={(current) => homeContextStatusRoute(location.pathname, location.search, current)}
            bind={(handle) => { mounted = handle }}
            status={(status, generation) => setProvider({ status, generation })} />
        </SfTodayBoundOwnerProvider>}
      </Show>
    </div>
  )
}
