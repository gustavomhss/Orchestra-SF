/**
 * Mission 231: installed F01 owner composition. UI29 / UI33 / UI34 stay admitted;
 * other sidebar chapters admit through the existing family parsers.
 *
 * This is the real chapter body consumed by chapter-route's inert callsite,
 * NOT a provider that manufactures context or an independent login/session.
 * Sources: selected ServerConnection, admitted installation discovery, original
 * ctx.context and projection.case. Desktop capabilities are not substituted.
 * Requires the exact 227 context/navigation leaves and 228 adapter postimages.
 */
import { useLocation, useNavigate } from "@solidjs/router"
import { createEffect, createSignal, onCleanup, on, Show, Switch, Match, untrack, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { DropdownMenu } from "@orchestra/ui/dropdown-menu"
import { Icon } from "@orchestra/ui/icon"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server-connection"
import { pathKey } from "@/utils/path-key"
import { authTokenFromCredentials } from "@/utils/server"
import { SfInstallationList, type SfHref, type SfInstallationDescriptor, type SfOwnerKey,
  type SfOwnerSelection, type SfRef, type SfResolvedRoute, type SfServerKey } from "@orchestra/schema/sucafina/context"
import { createSfAuthActions, createSfTransport, type SfTransport, type SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { createSfDraft } from "../shared/draft"
import { createSfNavigationState, type SfNativeNavigationState } from "../navigation-state"
import { matchSfNativeRoutePath, type SfNativeRouteCandidate } from "../route-registry"
import { useSfContext } from "../context"
import type { SfContextDependencies, SfContextHandle, SfSurfaceProps } from "../context/contracts"
import { SfTodayView } from "../home"
import { SfCasesView } from "../decisions/cases"
import { SfIntentView } from "../decisions/intent"
import { SfTodayBoundOwnerProvider } from "./today-resume-binding"
import { bindSfNativeChapterNavigation, confirmSfOwnerExit, sfNativeOwnerChapterRequest, sfReadyOwnerSelection, transitionSfNativeChapter } from "./native-chapter-entry"
import { extendedRouteAvailable, isExtendedSurface, parseExtendedRouteQuery, SfExtendedPages } from "./extended-routes"
import { revalidateSfNativeDraft } from "./draft-revalidation"
import { SfSourceNavigation } from "./source-navigation"
import { SfPageFrame, type SfCopyKey } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { sfUnavailableScheduleOwner, SfUnavailableScheduleView } from "./schedule-unavailable"
import { sfUnavailableRoutineCatalogOwner, SfUnavailableRoutineCatalogView } from "./routine-catalog-unavailable"

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
  const settled = request.finally(() => {
    if (exitInFlight237 === settled) exitInFlight237 = undefined
  })
  exitInFlight237 = settled
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

const sameServerKey = (selected: string, connected: string) => selected === connected

function isSfServerKey(value: string): value is SfServerKey {
  return value.length > 0
}

const ownerKeys = ["server", "project", "installation"] as const

function namedOwner(url: URL): { kind: "absent" } | { kind: "invalid" } | { kind: "named"; selection: SfOwnerSelection } {
  const values = ownerKeys.map((key) => url.searchParams.getAll(key))
  if (values.every((items) => items.length === 0)) return { kind: "absent" }
  if (values.some((items) => items.length !== 1 || !items[0])) return { kind: "invalid" }
  return { kind: "named", selection: {
    serverKey: values[0]![0]! as SfServerKey,
    projectId: values[1]![0]! as SfRef,
    installationId: values[2]![0]! as SfRef,
  } }
}

function requestHashAdmitted(url: URL): boolean {
  if (!url.hash) return true
  const requested = url.searchParams.getAll("request")
  if (requested.length !== 1 || !requested[0]) return false
  try { return decodeURIComponent(url.hash.slice(1)) === requested[0] } catch { return false }
}

function publishedHref(url: URL, keepOwner: boolean): string {
  const params = new URLSearchParams(url.search)
  if (!keepOwner) for (const key of ownerKeys) params.delete(key)
  const search = params.toString()
  return url.pathname + (search ? "?" + search : "")
}

function isCoreEntry(candidate: SfNativeRouteCandidate): boolean {
  return candidate.kind === "entry" && (
    candidate.surfaceId === "UI29" || candidate.surfaceId === "UI33" || candidate.surfaceId === "UI34"
  )
}

/** Syntax gate used by the mounted runtime. Source availability is a later check. */
export function sfMountedPathAdmitted(pathname: string, params: URLSearchParams): boolean {
  const candidate = matchSfNativeRoutePath(pathname)
  if (!candidate) return false
  if (isCoreEntry(candidate)) {
    if ([...params.keys()].length === 0) return true
    return explicitSelection(params.toString()).kind === "selected"
  }
  if (!isExtendedSurface(candidate.surfaceId)) return false
  return parseExtendedRouteQuery(params, candidate) !== undefined
}

function explicitSelection(query: string): { kind: "none" } | { kind: "invalid" } |
  { kind: "selected"; selection: SfOwnerSelection } {
  if (!query || query === "?") return { kind: "none" }
  const params = new URLSearchParams(query)
  const entries = [...params]
  if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3 ||
    entries.some(([key, value]) => !["server", "project", "installation"].includes(key) || !value))
    return { kind: "invalid" }
  return { kind: "selected", selection: {
    serverKey: params.get("server")! as SfServerKey,
    projectId: params.get("project")! as SfRef,
    installationId: params.get("installation")! as SfRef,
  } }
}

/** Only the selected registered Orchestra connection may discover its installed SF. */
export function createSfInstalledOwnerSource231(
  server: ServerConnection.Any,
  fetcher: SfTransportFetch,
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
      if (!sameServerKey(selection.serverKey, key) || !selection.projectId || !selection.installationId)
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
  gate: () => boolean
  navigation: Pick<SfNativeNavigationState, "requestNativeTransition">
  bind: (handle: SfContextHandle | undefined) => void
  status: (status: string, generation: number, reason?: string) => void
}>): JSX.Element {
  const handle = useSfContext()
  const location = useLocation()
  const language = useLanguage()
  const [authBusy, setAuthBusy] = createSignal(false)
  const [authFailed, setAuthFailed] = createSignal(false)
  const signOut = async () => {
    const state = handle.state(), ready = handle.ready(), generation = handle.generation()
    if (state.status !== "ready" || !ready || authBusy()) return
    setAuthBusy(true); setAuthFailed(false)
    try {
      await createSfAuthActions({
        binding: state.binding, transport: ready.transport,
        navigate: (url) => window.location.assign(url),
      }).logout()
      if (handle.generation() === generation && handle.ready()?.transport === ready.transport) {
        handle.invalidate("logout")
        await handle.reload()
      }
    } catch (error) {
      console.warn("Sucafina sign-out failed", error instanceof Error && /^SF_NATIVE_[A-Z_]+$/.test(error.message)
        ? error.message : error instanceof Error ? error.name : "unknown")
      setAuthFailed(true)
    } finally { setAuthBusy(false) }
  }
  const message = () => {
    const state = handle.state().status
    return language.t(state === "resolving" ? "sf.ui67.loading" :
      state === "unauthenticated" ? "sf.ui67.unauthenticated" :
      state === "denied" ? "sf.ui67.denied" :
      state === "context-mismatch" ? "sf.ui67.mismatch" : "sf.ui67.unavailable")
  }
  props.bind(handle)
  createEffect(() => {
    const state = handle.state()
    props.status(state.status, handle.generation(), "reason" in state ? state.reason : undefined)
  })
  onCleanup(() => { props.bind(undefined); props.status("unmounted", -1) })
  const current = () => props.gate() && props.view().status === "ready" ? props.view().route : undefined
  const unavailableRoutineCatalog = () => props.gate() && props.view().status === "denied"
    ? sfUnavailableRoutineCatalogOwner(handle.state(), matchSfNativeRoutePath(location.pathname), new URLSearchParams(location.search))
    : undefined
  const unavailableSchedule = () => props.gate() && props.view().status === "denied"
    ? sfUnavailableScheduleOwner(handle.state(), matchSfNativeRoutePath(location.pathname), new URLSearchParams(location.search))
    : undefined
  const [homeReturn, setHomeReturn] = createStore({ pending: false, failed: false })
  let homeRequest: AbortController | undefined
  const resetHomeReturn = () => {
    homeRequest?.abort()
    homeRequest = undefined
    setHomeReturn({ pending: false, failed: false })
  }
  createEffect(on(() => [handle.generation(), props.view().status, location.pathname, location.search],
    resetHomeReturn))
  onCleanup(resetHomeReturn)
  const homeTarget = () => {
    const state = handle.state()
    if (state.status !== "ready" || props.view().status === "resolving" ||
      !state.context.availability.some((resource) => resource.operations.some((operation) =>
        operation.operationId === "projection.home" && operation.state === "ready" && operation.operational))) return
    const selection = sfReadyOwnerSelection(state)
    const href = selection && sfNativeOwnerChapterRequest("sf-home", selection)
    return href ? { href, ownerKey: state.ownerKey } : undefined
  }
  const returnHome = async () => {
    const target = homeTarget()
    if (!target || homeReturn.pending) return
    const request = new AbortController()
    homeRequest = request
    setHomeReturn({ pending: true, failed: false })
    try {
      const result = await props.navigation.requestNativeTransition(target.href, "sidebar", {
        expectedOwnerKey: target.ownerKey, signal: request.signal,
      })
      if (homeRequest !== request || request.signal.aborted) return
      const failed = result.status === "denied" || result.status === "unavailable" || result.status === "invalid-link"
      if (failed) console.error("Sucafina return to Today refused", result.status)
      setHomeReturn("failed", failed)
    } catch {
      if (homeRequest !== request || request.signal.aborted) return
      console.error("Sucafina return to Today failed")
      setHomeReturn("failed", true)
    } finally {
      if (homeRequest === request) {
        homeRequest = undefined
        setHomeReturn("pending", false)
      }
    }
  }
  const polishedSurface = () => {
    const surface = current()?.surfaceId
    return !!unavailableRoutineCatalog() || !!unavailableSchedule() || surface !== undefined &&
      (/^CAP(?:0[1-9]|1[0-9]|2[0-8])$/.test(surface) || /^UI(?:29|[3-6][0-9]|70)$/.test(surface))
  }
  return (
    <>
    <Show when={polishedSurface()} fallback={
    <div class="flex flex-wrap gap-2" role="toolbar" aria-label={language.t("sf.ui67.title")}>
      <button type="button" class="mx-btn" disabled={authBusy()}
        onClick={() => { void handle.reload() }}>{language.t("sf.ui67.refreshAccess")}</button>
      <Show when={handle.state().status === "ready"}>
        <button type="button" class="mx-btn" disabled={authBusy()}
          onClick={() => { void signOut() }}>{language.t("sf.ui67.signOut")}</button>
      </Show>
    </div>
    }>
      <div class="sf-wave-access">
        <DropdownMenu placement="bottom-end">
          <DropdownMenu.Trigger class="sf-wave-access-trigger" disabled={authBusy()}>
            <Icon name="shield" size="small" />
            <span>{language.t("sf.ui67.title")}</span>
            <Icon name="chevron-down" size="small" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content class="sf-wave-access-menu" aria-label={language.t("sf.ui67.title")}>
              <DropdownMenu.Item disabled={authBusy()} onSelect={() => { void handle.reload() }}>
                <DropdownMenu.ItemLabel>{language.t("sf.ui67.refreshAccess")}</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
              <Show when={handle.state().status === "ready"}>
                <DropdownMenu.Item disabled={authBusy()} onSelect={() => { void signOut() }}>
                  <DropdownMenu.ItemLabel>{language.t("sf.ui67.signOut")}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              </Show>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    </Show>
    <Show when={authFailed()}><p role="alert">{language.t("sf.ui67.signOutFailed")}</p></Show>
    <Show when={props.gate()} fallback={<p role="status" data-sf-f01={handle.state().status}>{message()}</p>}>
      <SfSourceNavigation route={current} navigation={props.navigation} />
      <Switch fallback={
        <Show when={unavailableRoutineCatalog()} fallback={
          <Show when={unavailableSchedule()} fallback={<div data-sf-f01={props.view().status === "resolving" ? "loading" : "not-admitted"}>
            <SfPageFrame titleKey={(props.view().status === "resolving" ? "sf.common.loading" : "sf.common.unavailable") as SfCopyKey}
              context={[]} tabs={[]} activeTab={null} secondaryActions={[]} density="comfortable" layout="reading" onLayoutMode={() => undefined}>
              <SfStatePanel state={props.view().status === "resolving" ? "loading" : "unavailable"}
                messageKey={(props.view().status === "resolving" ? "sf.common.loading" :
                  homeReturn.failed ? "sf.common.returnHomeFailed" : "sf.common.routeUnavailable") as SfCopyKey}
                onRetryRead={() => { void handle.reload() }} />
              <Show when={homeTarget()}>
                <button class="mx-btn" type="button" disabled={homeReturn.pending} aria-busy={homeReturn.pending}
                  onClick={() => { void returnHome() }}>{language.t("sf.common.returnHome")}</button>
              </Show>
            </SfPageFrame>
          </div>}>
            {(snapshot) => <SfUnavailableScheduleView owner={snapshot()} />}
          </Show>
        }>
          {(snapshot) => <SfUnavailableRoutineCatalogView owner={snapshot()} />}
        </Show>
      }>
        <Match when={current()?.surfaceId === "UI29"}>
          <SfTodayView surfaceId="UI29" route={current() as SfSurfaceProps<"UI29">["route"]} />
        </Match>
        <Match when={current()?.surfaceId === "UI33"}>
          <SfCasesView surfaceId="UI33" route={current() as SfSurfaceProps<"UI33">["route"]} />
        </Match>
        <Match when={current()?.surfaceId === "UI34"}>
          <SfIntentView surfaceId="UI34" route={current() as SfSurfaceProps<"UI34">["route"]} />
        </Match>
        <Match when={current() && isExtendedSurface(current()!.surfaceId)}>
          <SfExtendedPages route={current()!} />
        </Match>
      </Switch>
    </Show>
    </>
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
  // A native browser fetch must retain its Window receiver when the transport
  // invokes the injected function through its options object.
  const fetcher: SfTransportFetch = (input, init) =>
    platform.fetch ? platform.fetch(input, init) : globalThis.fetch(input, init)
  const source = createSfInstalledOwnerSource231(props.server, fetcher)
  const [discovery, setDiscovery] = createStore<Discovery>({ status: "resolving" })
  const [view, setView] = createStore<View>({ status: "resolving" })
  const [provider, setProvider] = createStore({ status: "unmounted", generation: -1, reason: undefined as string | undefined })
  let mounted: SfContextHandle | undefined
  let authenticatedTransport: Readonly<{ binding: SfInstallationDescriptor; generation: number; transport: SfTransport }> | undefined
  let explicitOwner: SfOwnerSelection | undefined
  let ownerEpoch = 0
  let disposed = false
  let lastEditorFocus: HTMLElement | undefined
  const releaseExit = bindSfOwnerShellExit237(() => confirmSfOwnerExit({
    handle: () => mounted,
    disposed: () => disposed,
    confirmDiscard: async () => {
      if (typeof window === "undefined") return false
      const message = window.navigator.language.toLowerCase().startsWith("pt")
        ? "Descartar alterações não salvas antes de sair?"
        : "Discard unsaved changes before leaving?"
      return window.confirm(message)
    },
    restoreFocus: () => { if (lastEditorFocus?.isConnected) lastEditorFocus.focus() },
    onDiscarded: () => setView({ status: "resolving", route: undefined }),
    onBlocked: () => { console.error("Sucafina draft discard was refused") },
  }))
  const unload = (event: BeforeUnloadEvent) => {
    if (!mounted?.hasDirtyDrafts()) return
    event.preventDefault()
    event.returnValue = ""
  }
  if (typeof window !== "undefined") window.addEventListener("beforeunload", unload)
  const currentHref = () => location.pathname + location.search
  const selection = () => discovery.status === "ready" ? discovery.selection : undefined
  const sameServer = (value: SfOwnerSelection) =>
    sameServerKey(value.serverKey, ServerConnection.key(props.server))
  const newTransport = (binding: SfInstallationDescriptor, generation: number,
    currentGeneration: () => number): SfTransport => createSfTransport({
    binding, generation, currentGeneration, fetch: fetcher, operations: SfNativeOperationBindings,
  })
  const readContext = async (binding: SfInstallationDescriptor, signal: AbortSignal,
    generation: number, currentGeneration: () => number,
    transport = newTransport(binding, generation, currentGeneration)) => {
    const answer = await createSfContextClient(transport)["ctx.context"]({
      installationId: binding.installationId, projectId: binding.projectId,
      hostId: binding.hostId,
    }, { signal })
    if (answer.kind !== "response") console.warn("Sucafina context transport failed", JSON.stringify({
      reason: answer.reason, generation, currentGeneration: currentGeneration(),
      sameOrigin: typeof window !== "undefined" && window.location.origin === binding.publicOrigin,
      authMode: binding.authMode, publicOrigin: binding.publicOrigin,
    }))
    return answer.kind === "response"
      ? answer.body
      : { status: "unavailable" as const, reason: "host-unavailable" as const }
  }
  const dependencies: SfContextDependencies = {
    listInstallations: async (selected, signal) => {
      authenticatedTransport = undefined
      ownerEpoch += 1 // invalidate all old transport generations before the next load
      const found = await source.listByIds(selected, signal)
      return found ?? { installations: [] }
    },
    loadContext: async (binding, signal) => {
      const handle = mounted
      if (!handle) return { status: "unavailable", reason: "host-unavailable" }
      const generation = handle.generation()
      const currentGeneration = () => !disposed && mounted === handle ? handle.generation() : -1
      const transport = newTransport(binding, generation, currentGeneration)
      const result = await readContext(binding, signal, generation, currentGeneration, transport)
      if (result.status === "ok" && !signal.aborted && currentGeneration() === generation)
        authenticatedTransport = { binding, generation, transport }
      return result
    },
    createTransport: (binding, generation) => {
      const authenticated = authenticatedTransport
      authenticatedTransport = undefined
      if (!authenticated || authenticated.binding !== binding || authenticated.generation !== generation ||
          mounted?.generation() !== generation || disposed)
        throw new Error("SF_NATIVE_CONTEXT_TRANSPORT_NOT_CURRENT")
      return authenticated.transport
    },
    resolveTransportIdentity: (selected) => sameServer(selected) ? source.transportIdentity : "",
    createDraft: createSfDraft,
    revalidateDraft: revalidateSfNativeDraft,
  }

  const navigation: SfNativeNavigationState = createSfNavigationState({
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
    confirmDiscard: async () => {
      if (typeof window === "undefined") return false
      const message = window.navigator.language.toLowerCase().startsWith("pt")
        ? "Descartar alterações não salvas antes de mudar a instalação Sucafina?"
        : "Discard unsaved changes before changing the Sucafina installation?"
      return window.confirm(message)
    },
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
        if (url.origin !== window.location.origin || url.username || url.password || !requestHashAdmitted(url))
          return { status: "invalid-link" }
      } catch { return { status: "invalid-link" } }
      if (!sfMountedPathAdmitted(url.pathname, url.searchParams)) return { status: "invalid-link" }
      const candidate = matchSfNativeRoutePath(url.pathname)!
      const named = namedOwner(url)
      if (named.kind === "invalid") return { status: "invalid-link" }
      if (named.kind === "named" && !sameSelection(named.selection, selected)) return { status: "invalid-link" }
      if (named.kind === "absent") {
        const shell = selection()
        if (shell && !sameSelection(shell, selected)) return { status: "invalid-link" }
        if (explicitOwner && sameSelection(explicitOwner, selected)) return { status: "invalid-link" }
      }
      const core = isCoreEntry(candidate)
      const parsed = core ? {} : parseExtendedRouteQuery(url.searchParams, candidate)
      if (!parsed) return { status: "invalid-link" }
      const found = await source.listByIds(selected, signal)
      if (signal.aborted || !found) return { status: "unavailable" }
      if (found.installations.length !== 1) return { status: "denied" }
      const binding = found.installations[0]!
      const currentGeneration = ownerEpoch
      const context = await readContext(binding, signal, currentGeneration, () => ownerEpoch)
      if (signal.aborted) return { status: "unavailable" }
      if (context.status !== "ok")
        return { status: context.status === "denied" || context.status === "unauthenticated"
          ? "denied" : "unavailable" }
      const stamp = context.value.stamp
      if (stamp.projectId !== binding.projectId ||
        stamp.installationId !== binding.installationId || stamp.hostId !== binding.hostId)
        return { status: "denied" }
      if (core) {
        const requiredOperation = candidate.surfaceId === "UI29" ? "projection.home"
          : candidate.surfaceId === "UI33" ? "projection.cases" : "projection.case"
        if (!context.value.availability.some((resource) => resource.operations.some((operation) =>
          operation.operationId === requiredOperation && operation.state === "ready" && operation.operational)))
          return { status: "denied" }
      } else if (!extendedRouteAvailable(context.value, candidate)) return { status: "denied" }
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
        params: candidate.parameters,
        ownerSelection: named.kind === "named" ? named.selection : selected,
        pathname: url.pathname, href: publishedHref(url, named.kind === "named") as SfHref, query: parsed,
      } as SfResolvedRoute
      return { status: "authorized", route, ownerKey }
    },
    commit: ({ route, selection: selected, cause }) => {
      if (disposed) return
      let url: URL
      try { url = new URL(String(route.href), window.location.origin) } catch { return }
      const named = namedOwner(url)
      if (named.kind === "invalid") return
      const replace = cause === "deep-link" || cause === "history" || cause === "reload"
      if (named.kind === "absent") {
        const shell = selection()
        if (!shell || !sameSelection(shell, selected) || (explicitOwner && sameSelection(explicitOwner, selected))) return
        const published = publishedHref(url, false)
        setView({ status: "ready", route: { ...route, href: published as SfHref, ownerSelection: shell } })
        if (currentHref() !== published) navigate(published, { replace })
        return
      }
      if (!sameSelection(named.selection, selected)) return
      explicitOwner = named.selection
      // Committing a route within the same owner must not replace the selection
      // object: the provider observes that identity and would fence/reload on
      // every successful admission, immediately starting another transition.
      const selectedOwner = selection()
      if (!selectedOwner || !sameSelection(selectedOwner, named.selection))
        setDiscovery({ status: "ready", selection: named.selection })
      setView({ status: "ready", route })
      const target = String(route.href)
      if (currentHref() !== target) navigate(target, { replace })
    },
  })
  // The exact 227 resume adapter receives this single navigation instance.
  const boundDependencies: SfContextDependencies = Object.freeze({ ...dependencies, navigation })
  const releaseChapter = bindSfNativeChapterNavigation(async (request) => {
    if (request.server !== ServerConnection.key(props.server) ||
      pathKey(request.directory ?? "") !== pathKey(props.directory)) return "profile-mismatch"
    const selected = selection()
    const state = mounted?.state()
    if (!selected || state?.status !== "ready" || !state.ownerKey) return "blocked"
    const result = await transitionSfNativeChapter(request.chapter, selected, state.ownerKey, navigation)
    return result.status === "committed" ? "committed" : "blocked"
  })
  let discoveryAttempt = 0
  createEffect(() => {
    // Route selectors never borrow missing values from a remembered profile.
    const query = location.search
    const directory = props.directory
    const actualServerKey = ServerConnection.key(props.server)
    const params = new URLSearchParams(query)
    // Admit the complete family query before extracting the exact owner triplet.
    // No unknown, repeated or partial selector can reach discovery.
    const parsed = sfMountedPathAdmitted(location.pathname, params)
      ? explicitSelection(new URLSearchParams([...params].filter(([key]) =>
          ownerKeys.some((ownerKey) => ownerKey === key))).toString())
      : { kind: "invalid" as const }
    const epoch = ++discoveryAttempt
    if (parsed.kind === "invalid") {
      explicitOwner = undefined
      setDiscovery({ status: "invalid-link", selection: undefined })
      setView({ status: "invalid-link", route: undefined })
      return
    }
    if (parsed.kind === "selected") {
      if (!sameServerKey(parsed.selection.serverKey, actualServerKey)) {
        explicitOwner = undefined
        setDiscovery({ status: "denied", selection: undefined })
        setView({ status: "denied", route: undefined })
        return
      }
      explicitOwner = parsed.selection
      if (selection() && sameSelection(selection()!, parsed.selection)) return
      setDiscovery({ status: "ready", selection: parsed.selection })
      return
    }
    if (explicitOwner) {
      explicitOwner = undefined
      setDiscovery({ status: "resolving", selection: undefined })
      setView({ status: "resolving", route: undefined })
    } else if (selection()) return
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
        if (!isSfServerKey(actualServerKey)) {
          setDiscovery({ status: "unavailable", selection: undefined })
          return
        }
        setDiscovery({ status: "ready", selection: {
          serverKey: actualServerKey,
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
    const gateReady = provider.status === "ready" && provider.generation >= 0
    if (!gateReady) {
      setView({ status: "resolving", route: undefined })
      return
    }
    if (!selected || disposed) return
    if (untrack(() => view.status === "ready" && view.route?.href === href &&
      sameSelection(view.route.ownerSelection, selected))) return
    const epoch = ++routeEpoch
    setView({ status: "resolving", route: undefined })
    const abort = new AbortController()
    void navigation.requestNativeTransition(href, "deep-link", { signal: abort.signal }).then((result) => {
      if (disposed || abort.signal.aborted || epoch !== routeEpoch ||
        result.status === "committed" || result.status === "aborted") return
      setView({ status: result.status, route: undefined })
    })
    onCleanup(() => abort.abort())
  })
  onCleanup(() => {
    disposed = true
    authenticatedTransport = undefined
    ownerEpoch += 1
    releaseChapter()
    navigation.dispose()
    releaseExit()
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", unload)
  })

  return (
    <div class="flex min-h-0 flex-1 flex-col" data-sf-host="owner-runtime231"
      data-sf-discovery-state={discovery.status} data-sf-provider-state={provider.status} data-sf-provider-reason={provider.reason}
      data-sf-view-state={view.status}
      onFocusIn={(event) => {
        if (event.target instanceof HTMLElement &&
          event.target.matches("input, textarea, select, [contenteditable='true']"))
          lastEditorFocus = event.target
      }}>
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
          <MountedSurface view={() => view} gate={() => provider.status === "ready" && provider.generation >= 0}
            navigation={navigation} bind={(handle) => { mounted = handle }}
            status={(status, generation, reason) => setProvider({ status, generation, reason })} />
        </SfTodayBoundOwnerProvider>
      </Show>
    </div>
  )
}
