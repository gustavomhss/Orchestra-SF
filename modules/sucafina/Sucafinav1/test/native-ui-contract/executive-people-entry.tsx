import { render } from "solid-js/web"
import { Route, Router } from "@solidjs/router"
import { Schema } from "effect"
import type { SfOwnerSelection, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { PlatformProvider, type Platform } from "../../../../../packages/app-shell/src/context/platform"
import { LanguageProvider } from "../../../../../packages/app-shell/src/context/language"
import { SfContextProvider, useSfContext } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/context"
import type { SfContextDependencies } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/shared/draft"
import { SfExecutiveDashboard } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive"

// Component fixture only: this explicit context is not installation, login,
// discovery, availability or permission proof. The dashboard, reader, formatter,
// CSS and provider lifecycle are production code. HTTP serves canonical DTOs.
const root = document.getElementById("root")
if (!(root instanceof HTMLElement)) throw new Error("Executive component fixture root is missing")
const selection: SfOwnerSelection = { serverKey: "fixture-server", projectId: "fixture-project", installationId: "fixture-install" } as SfOwnerSelection
const binding = { installationId: "fixture-install", projectId: "fixture-project", hostId: "fixture-host",
  publicOrigin: location.origin, mount: "/fixture", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const stamp = { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
  principalRef: "fixture-actor", policyVersion: "fixture-policy", accessRevision: "fixture-access" }
const route: SfResolvedRoute<"CAP01"> = { surfaceId: "CAP01", kind: "entry", params: {}, ownerSelection: selection,
  pathname: "/orchestra/sf-dashboard/executive", href: "/orchestra/sf-dashboard/executive?year=2026&month=4" as SfResolvedRoute<"CAP01">["href"],
  query: { year: 2026, month: 4 } }
const scenario = new URL(location.href).searchParams.get("scenario") ?? "current"
const dependencies: SfContextDependencies = {
  listInstallations: async () => ({ installations: [binding] }),
  loadContext: async () => ({ status: "ok", value: {
    stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
    destinations: [{ capabilityId: "CAP01", surface: "dashboard", page: "Executive Dashboard", canRead: true, allowedActionIds: [] }],
    availability: [{ family: "domain-read", resource: "CAP01", state: "ready", operations: [
      { operationId: "domain.page.CAP01", state: "ready", operational: true, reason: null },
    ] }],
  } }),
  createTransport: () => ({ async execute(operation, value, options) {
    if (operation.operationId !== "domain.page.CAP01") throw new Error("Unexpected Executive component operation")
    const input = Schema.decodeUnknownSync(Schema.toType(operation.input))(value) as { executiveMonth?: number }
    const response = await fetch("/fixture/read?" + new URLSearchParams({
      scenario, month: String(input.executiveMonth ?? 4),
    }), { signal: options?.signal })
    return { kind: "response" as const, status: response.status, headers: {},
      body: Schema.decodeUnknownSync(Schema.toType(operation.output))(await response.json()) }
  } }),
  resolveTransportIdentity: () => "executive-component-fixture", createDraft: createSfDraft,
  revalidateDraft: async () => { throw new Error("Read-only Executive fixture cannot revalidate a draft") },
}
const unexpected = () => { throw new Error("Unexpected Executive component platform side effect") }
const platform: Platform = { platform: "web", openExternal: unexpected, restart: async () => unexpected(), notify: async () => unexpected() }
function Surface() {
  const context = useSfContext()
  return <>
    <p>Executive component fixture — no installed journey or authority qualification</p>
    <button type="button" onClick={() => context.invalidate("revoked")}>Invalidate fixture access</button>
    <output data-fixture-context>{context.state().status}</output>
    <SfExecutiveDashboard surfaceId="CAP01" route={route} />
  </>
}
render(() => <PlatformProvider value={platform}><LanguageProvider locale="en"><Router>
  <Route path="/*" component={() => <SfContextProvider selection={() => selection} dependencies={dependencies}>
    <Surface />
  </SfContextProvider>} />
</Router></LanguageProvider></PlatformProvider>, root)
