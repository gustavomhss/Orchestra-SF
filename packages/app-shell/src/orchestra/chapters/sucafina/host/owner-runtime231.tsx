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
import { matchSfNativeRoutePath } from "../route-registry"
import { useSfContext } from "../context"
import type { SfContextDependencies, SfContextHandle, SfDraftRevalidationInput,
  SfDraftRevalidation, SfSurfaceProps } from "../context/contracts"
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
    // The two Sucafina chapters retain the SAME F01 owner and drafts.
    const target = new URL(event.to.toString(), window.location.href)
    if (target.origin === window.location.origin &&
      ((target.pathname === "/orchestra/sf-home" ||
        target.pathname.startsWith("/orchestra/sf-home/")) ||
        target.pathname === "/orchestra/sf-decisions" ||
        target.pathname.startsWith("/orchestra/sf-decisions/"))) return
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
            reason === "access-revoked" || reason === "session-expired" ? "revoked" : "owner-changed")
          setView({ status: "denied", route: undefined })
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
      if ([...url.searchParams.keys()].some((key) => !["server", "project", "installation"].includes(key)))
        return { status: "invalid-link" }
      const candidate = matchSfNativeRoutePath(url.pathname)
      if (!candidate || !(
        candidate.surfaceId === "UI29" && candidate.kind === "entry" ||
        candidate.surfaceId === "UI33" && candidate.kind === "entry" ||
        candidate.surfaceId === "UI34" && candidate.kind === "entry"
      )) return { status: "invalid-link" }
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
      const requiredOperation = candidate.surfaceId === "UI29" ? "projection.home"
        : candidate.surfaceId === "UI33" ? "projection.cases" : "projection.case"
      if (!context.value.availability.some((resource) => resource.operations.some((operation) =>
        operation.operationId === requiredOperation && operation.state === "ready" && operation.operational)))
        return { status: "denied" }
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
        pathname: url.pathname, href: (url.pathname + url.search) as SfHref, query: {},
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

  const desktopLogin = async () => {
    const selected = selection()
    if (!desktopBridge || !selected || disposed || provider.status !== "unauthenticated") return
    const parsed = explicitSelection(location.search)
    const routePath = matchSfNativeRoutePath(location.pathname)
    if (parsed.kind === "invalid" || parsed.kind === "selected" &&
        !sameSelection(parsed.selection, selected) ||
        !routePath || routePath.kind !== "entry" ||
        !["UI29", "UI33", "UI34"].includes(routePath.surfaceId)) {
      setView({ status: "invalid-link", route: undefined })
      return
    }
    const returnRoute = {
      surfaceId: routePath.surfaceId, kind: routePath.kind, params: routePath.parameters,
      ownerSelection: selected, pathname: location.pathname,
      href: (location.pathname + location.search) as SfHref, query: {},
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
