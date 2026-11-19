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
import { createEffect, onCleanup, Show, Switch, Match, untrack, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { usePlatform } from "@/context/platform"
import { ServerConnection } from "@/context/server"
import { pathKey } from "@/utils/path-key"
import { authTokenFromCredentials } from "@/utils/server"
import { SfInstallationList, type SfHref, type SfInstallationDescriptor, type SfOwnerKey,
  type SfOwnerSelection, type SfRef, type SfResolvedRoute, type SfServerKey } from "@orchestra/schema/sucafina/context"
import { createSfTransport, type SfTransport } from "@orchestra/client/sucafina/transport"
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
import { bindSfNativeChapterNavigation, confirmSfOwnerExit, transitionSfNativeChapter } from "./native-chapter-entry"
import { extendedRouteAvailable, isExtendedSurface, parseExtendedRouteQuery, SfExtendedPages } from "./extended-routes"
import { revalidateSfNativeDraft } from "./draft-revalidation"

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
  bind: (handle: SfContextHandle | undefined) => void
  status: (status: string, generation: number) => void
}>): JSX.Element {
  const handle = useSfContext()
  props.bind(handle)
  createEffect(() => props.status(handle.state().status, handle.generation()))
  onCleanup(() => { props.bind(undefined); props.status("unmounted", -1) })
  const current = () => props.gate() && props.view().status === "ready" ? props.view().route : undefined
  return (
    <Show when={props.gate()} fallback={<p role="status" data-sf-f01="resolving">Resolving installed Sucafina</p>}>
      <Switch fallback={<p role="status" data-sf-f01="not-admitted">Sucafina route not admitted</p>}>
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
  const fetcher = platform.fetch ?? globalThis.fetch
  const source = createSfInstalledOwnerSource231(props.server, fetcher)
  const [discovery, setDiscovery] = createStore<Discovery>({ status: "resolving" })
  const [view, setView] = createStore<View>({ status: "resolving" })
  const [provider, setProvider] = createStore({ status: "unmounted", generation: -1 })
  let mounted: SfContextHandle | undefined
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
        if (url.origin !== window.location.origin || url.hash || url.username || url.password)
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
    const parsed = explicitSelection(query)
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
    ownerEpoch += 1
    releaseChapter()
    navigation.dispose()
    releaseExit()
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", unload)
  })

  return (
    <div class="flex min-h-0 flex-1 flex-col" data-sf-host="owner-runtime231"
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
            bind={(handle) => { mounted = handle }}
            status={(status, generation) => setProvider({ status, generation })} />
        </SfTodayBoundOwnerProvider>
      </Show>
    </div>
  )
}
