import { For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { render } from "solid-js/web"
import { Route, Router } from "@solidjs/router"
import { Schema } from "effect"
import { SfContext, type SfHref, type SfOwnerSelection, type SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { PlatformProvider, type Platform } from "../../../../../packages/app-shell/src/context/platform"
import { LanguageProvider } from "../../../../../packages/app-shell/src/context/language"
import { SfContextProvider, useSfContext } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/context"
import type { SfContextDependencies } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/shared/draft"
import { createSfNavigationState, type SfNativeNavigationState } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/route-registry"
import { extendedRouteAvailable, parseExtendedRouteQuery } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/extended-routes"
import { SfSourceNavigation } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/source-navigation"
import { sourceNavigationChapters } from "./source-navigation-oracles"

// Component/navigation-state control only. Context responses below are declared
// fixture inputs, not login, installation, health, source availability or grant
// qualification. No domain producer is called or reported successful here.
const root = document.getElementById("root")
if (!(root instanceof HTMLElement)) throw new Error("Source navigation fixture root is missing")
const selection = { serverKey: "fixture-server", projectId: "fixture-project", installationId: "fixture-install" } as SfOwnerSelection
const binding = { installationId: "fixture-install", projectId: "fixture-project", hostId: "fixture-host",
  publicOrigin: location.origin, mount: "/fixture", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const rows: readonly { cap: string; path: string; page: string }[] = sourceNavigationChapters.flatMap((chapter) => [...chapter.pages])
const input = { mode: "all", principal: "fixture-actor" }
function contextInput() {
  return Schema.decodeUnknownSync(SfContext)({
    stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
      principalRef: input.principal, policyVersion: "fixture-policy", accessRevision: "fixture-" + input.mode },
    contractRevision: "sf-native-ui/1", authMode: "microsoft",
    destinations: rows.map((row) => ({ capabilityId: row.cap, page: row.page,
      surface: Number(row.cap.slice(3)) <= 16 ? "dashboard" : Number(row.cap.slice(3)) <= 23 ? "planner" : "procurement",
      canRead: input.mode !== "limited" || row.cap !== "CAP02", allowedActionIds: [] })),
    availability: rows.map((row) => ({ resource: row.cap,
      family: Number(row.cap.slice(3)) <= 16 ? "domain-read" : Number(row.cap.slice(3)) <= 23 ? "planner" : "procurement",
      state: input.mode === "partial" ? "partial" : "ready",
      operations: input.mode === "limited" && row.cap === "CAP05" ? [] : [{
        operationId: "domain.page." + row.cap,
        ...(input.mode === "limited" && ["CAP03", "CAP04"].includes(row.cap)
          ? { state: row.cap === "CAP03" ? "unavailable" : "denied", reason: "Fixture source condition", operational: false }
          : { state: "ready", reason: null, operational: true }),
      }],
    })),
  })
}
function routeAt(pathname: string, selected = selection): SfResolvedRoute {
  const candidate = matchSfNativeRoutePath(pathname)
  if (!candidate) throw new Error("Fixture path does not exist in the native manifest")
  const query = new URLSearchParams({ server: selected.serverKey!, project: selected.projectId!, installation: selected.installationId! })
  const parsed = parseExtendedRouteQuery(query, candidate)
  if (!parsed) throw new Error("Fixture query does not pass the original route parser")
  return { surfaceId: candidate.surfaceId, kind: candidate.kind, params: candidate.parameters,
    ownerSelection: selected, pathname, href: (pathname + "?" + query) as SfHref, query: parsed } as SfResolvedRoute
}
const dependencies: SfContextDependencies = {
  listInstallations: async () => ({ installations: [binding] }),
  loadContext: async () => input.mode === "denied" ? { status: "denied" } : { status: "ok", value: contextInput() },
  createTransport: () => ({ async execute() { throw new Error("Component navigation must not fabricate a domain producer") } }),
  resolveTransportIdentity: () => "source-navigation-component", createDraft: createSfDraft,
  revalidateDraft: async () => { throw new Error("Read-only navigation fixture cannot revalidate drafts") },
}
function Harness() {
  const handle = useSfContext()
  const [view, setView] = createStore({
    route: routeAt(rows[0]!.path), mounted: true, pending: false,
    calls: [] as { href: string; cause: string; expectedOwnerKey: string | null; actualOwnerKey: string | null }[],
    commits: [] as string[], results: [] as string[],
  })
  const hold: { next: "authorized" | "denied" | undefined; release?: () => void } = { next: undefined }
  const currentKey = () => { const state = handle.state(); return state.status === "ready" ? state.ownerKey : undefined }
  const navigation = createSfNavigationState({
    selected: () => selection, currentHref: () => String(view.route.href), currentOwnerKey: currentKey,
    hasDirtyDrafts: handle.hasDirtyDrafts, confirmDiscard: async () => false, discardDrafts: handle.discardDrafts,
    invalidateOwner: handle.invalidate, validateRetained: (_route, values) => values,
    resolveAuthorizedRoute: async (href, selected, signal) => {
      const state = handle.state()
      if (state.status !== "ready") return { status: "denied" }
      const url = new URL(href, location.origin), candidate = matchSfNativeRoutePath(url.pathname)
      if (url.origin !== location.origin || !candidate || !extendedRouteAvailable(state.context, candidate)) return { status: "denied" }
      const route = routeAt(url.pathname, selected), ownerKey = state.ownerKey
      const outcome = hold.next
      hold.next = undefined
      if (outcome) {
        setView("pending", true)
        await new Promise<void>((resolve) => { hold.release = resolve })
        hold.release = undefined
        setView("pending", false)
      }
      if (outcome === "denied") return { status: "denied" }
      // A deliberately delayed, previously captured resolution allows the real
      // navigation-state expectedOwnerKey fence to reject a changed provider.
      return signal.aborted ? { status: "unavailable" } : { status: "authorized", route, ownerKey }
    },
    commit: ({ route }) => { setView("commits", (values) => [...values, route.surfaceId]); setView("route", route) },
  })
  const observed: Pick<SfNativeNavigationState, "requestNativeTransition"> = {
    requestNativeTransition: async (href, cause, options) => {
      setView("calls", (values) => [...values, { href, cause,
        expectedOwnerKey: options?.expectedOwnerKey ?? null, actualOwnerKey: currentKey() ?? null }])
      const result = await navigation.requestNativeTransition(href, cause, options)
      setView("results", (values) => [...values, result.status])
      return result
    },
  }
  onCleanup(() => { hold.release?.(); navigation.dispose() })
  const load = async (mode: string, principal = "fixture-actor") => {
    input.mode = mode; input.principal = principal
    await handle.reload()
  }
  // Reading the real provider exposes only fixture identity, never a hand-made
  // owner token. The browser compares delegated expectedOwnerKey with this key.
  return <>
    <p>Source navigation component fixture — no installed authorization or source qualification</p>
    <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
      <For each={sourceNavigationChapters}>{(chapter) => <button type="button" data-fixture-chapter={chapter.chapter}
        onClick={() => setView("route", routeAt(chapter.pages[0].path))}>{chapter.chapter}</button>}</For>
      <button type="button" data-fixture-action="all" onClick={() => { void load("all") }}>Restore fixture context</button>
      <button type="button" data-fixture-action="limited" onClick={() => { void load("limited") }}>Limit fixture sources</button>
      <button type="button" data-fixture-action="partial" onClick={() => { void load("partial") }}>Partial fixture resource</button>
      <button type="button" data-fixture-action="denied" onClick={() => { void load("denied") }}>Deny fixture context</button>
      <button type="button" data-fixture-action="owner" onClick={() => { void load("all", "fixture-other-actor") }}>Change fixture owner</button>
      <button type="button" data-fixture-action="revoke" onClick={() => handle.invalidate("revoked")}>Revoke fixture owner</button>
      <button type="button" data-fixture-action="mismatch" onClick={() => setView("route", routeAt(rows[0]!.path,
        { ...selection, installationId: "fixture-other-install" } as SfOwnerSelection))}>Mismatched route owner</button>
      <button type="button" data-fixture-action="hold-allow" onClick={() => { hold.next = "authorized" }}>Delay fixture resolution</button>
      <button type="button" data-fixture-action="hold-deny" onClick={() => { hold.next = "denied" }}>Delay fixture denial</button>
      <button type="button" data-fixture-action="release" onClick={() => hold.release?.()}>Release fixture resolution</button>
      <button type="button" data-fixture-action="unmount" onClick={() => setView("mounted", false)}>Unmount navigation</button>
      <button type="button" data-fixture-action="mount" onClick={() => setView("mounted", true)}>Mount navigation</button>
    </div>
    <output hidden data-fixture-context>{handle.state().status}</output>
    <output hidden data-fixture-owner>{currentKey() ?? ""}</output>
    <output hidden data-fixture-pending>{String(view.pending)}</output>
    <output hidden data-fixture-route>{view.route.surfaceId}</output>
    <output hidden data-fixture-calls>{JSON.stringify(view.calls)}</output>
    <output hidden data-fixture-commits>{JSON.stringify(view.commits)}</output>
    <output hidden data-fixture-results>{JSON.stringify(view.results)}</output>
    <Show when={view.mounted}><SfSourceNavigation route={() => view.route} navigation={observed} /></Show>
  </>
}
const unexpected = () => { throw new Error("Unexpected navigation fixture platform side effect") }
const platform: Platform = { platform: "web", openExternal: unexpected, restart: async () => unexpected(), notify: async () => unexpected() }
render(() => <PlatformProvider value={platform}><LanguageProvider locale="en"><Router>
  <Route path="/*" component={() => <SfContextProvider selection={() => selection} dependencies={dependencies}>
    <Harness />
  </SfContextProvider>} />
</Router></LanguageProvider></PlatformProvider>, root)
