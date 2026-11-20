import { onCleanup } from "solid-js"
import { render } from "solid-js/web"
import { Route, Router } from "@solidjs/router"
import { Schema } from "effect"
import { SfContext, type SfOwnerSelection, type SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { createSfTransport } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { PlatformProvider, type Platform } from "../../../../../packages/app-shell/src/context/platform"
import { LanguageProvider } from "../../../../../packages/app-shell/src/context/language"
import { SfContextProvider, useSfContext } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/context"
import type { SfContextDependencies, SfContextHandle } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/shared/draft"
import { SfRisksView } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/operations/risks"
import { matchSfNativeRoutePath } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/route-registry"
import { parseExtendedRouteQuery } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/extended-routes"

// Component input only. This supplied context and the typed HTTP read fixture
// do not qualify installed authentication, permissions or a durable Risk write.
const root = document.getElementById("root")
const supplied = document.getElementById("sf-collection-fixture")?.textContent
if (!(root instanceof HTMLElement) || !supplied) throw new Error("Collection label fixture is incomplete")
const context = Schema.decodeUnknownSync(SfContext, { onExcessProperty: "error" })(JSON.parse(supplied))
const binding = {
  installationId: context.stamp.installationId, projectId: context.stamp.projectId, hostId: context.stamp.hostId,
  publicOrigin: location.origin, mount: "/sucafina", contractRevision: "sf-native-ui/1" as const, authMode: context.authMode,
}
const selection = {
  serverKey: location.origin, projectId: binding.projectId, installationId: binding.installationId,
} as SfOwnerSelection
const pathname = "/orchestra/sf-operations/risks"
const candidate = matchSfNativeRoutePath(pathname)
if (!candidate || candidate.surfaceId !== "CAP13" || candidate.kind !== "entry")
  throw new Error("Collection label fixture path is absent from the native manifest")
const params = new URLSearchParams({
  server: selection.serverKey!, project: selection.projectId!, installation: selection.installationId!,
})
const query = parseExtendedRouteQuery(params, candidate)
if (!query) throw new Error("Collection label fixture query is not admitted by the original parser")
const route: SfResolvedRoute<"CAP13"> = {
  surfaceId: "CAP13", kind: "entry", params: {}, ownerSelection: selection, pathname,
  href: (pathname + "?" + params) as SfResolvedRoute<"CAP13">["href"], query,
}
const mounted: { handle?: SfContextHandle } = {}
const dependencies: SfContextDependencies = {
  listInstallations: async () => ({ installations: [binding] }),
  loadContext: async () => ({ status: "ok", value: context }),
  createTransport: (descriptor, generation) => createSfTransport({
    binding: descriptor, generation,
    currentGeneration: () => mounted.handle?.generation() ?? -1,
    fetch: (input, init) => globalThis.fetch(input, init),
    operations: SfNativeOperationBindings,
  }),
  resolveTransportIdentity: () => "collection-label-component",
  createDraft: createSfDraft,
  revalidateDraft: async () => { throw new Error("Collection label control cannot revalidate a persisted draft") },
}
function Surface() {
  const owner = useSfContext()
  mounted.handle = owner
  onCleanup(() => { if (mounted.handle === owner) mounted.handle = undefined })
  return <>
    <p>Collection label component fixture — no installed authority or durable write qualification</p>
    <output hidden data-fixture-context>{owner.state().status}</output>
    <SfRisksView surfaceId="CAP13" route={route} />
  </>
}
const unexpected = () => { throw new Error("Unexpected collection label platform side effect") }
const platform: Platform = { platform: "web", openExternal: unexpected, restart: async () => unexpected(), notify: async () => unexpected() }
render(() => <PlatformProvider value={platform}><LanguageProvider locale="en"><Router>
  <Route path="/*" component={() => <SfContextProvider selection={() => selection} dependencies={dependencies}>
    <Surface />
  </SfContextProvider>} />
</Router></LanguageProvider></PlatformProvider>, root)
