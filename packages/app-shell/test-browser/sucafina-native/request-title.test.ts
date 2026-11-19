import { expect, test } from "bun:test"
import { Schema } from "effect"
import { solidDom } from "../real-ui-solid"
import type { SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfContextHandle, SfSurfaceProps } from "../../src/orchestra/chapters/sucafina/context/contracts"

// Component fixture only: injected transport, not installed identity/runtime proof.
const { createComponent } = await import("solid-js")
const { render } = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { SfRequestTitleEdit }: typeof import("@/orchestra/chapters/sucafina/procurement/requests/title") =
  await import(solidDom("@/orchestra/chapters/sucafina/procurement/requests/title", import.meta.dir))

const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test",
  mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const context = { stamp, contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const,
  destinations: [{ capabilityId: "CAP25" as const, surface: "procurement" as const, page: "Requests", canRead: true, allowedActionIds: ["save"] }],
  availability: [{ family: "procurement" as const, resource: "CAP25" as const, state: "ready" as const, operations: [
    { operationId: "domain.page.CAP25" as const, state: "ready" as const, operational: true, reason: null },
    { operationId: "domain.command.CAP25.save" as const, state: "ready" as const, operational: true, reason: null },
  ] }] }
const page = { status: "ok", context: stamp, value: { capabilityId: "CAP25", selection: { request: "PR-1" },
  data: { requests: [{ number: "PR-1", status: "draft", createdBy: "actor", allowedDraftActions: ["save-pr"],
    pr: { title: "before", description: "do not send" }, sourcing: { evaluator: "private" }, po: { notes: "private" } }],
    suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
  versions: { "requests:PR-1": { version: 7, by: "actor" } }, allowedActionIds: ["save"] } }

async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("title fixture did not reach expected state")
}

test("the actual title component submits only its title once and retains an unknown outcome", async () => {
  const writes: { body: unknown; idempotencyKey: string | undefined }[] = []
  const transport: SfTransport = { async execute(operation, input, options) {
    if (operation.operationId === "domain.command.CAP25.save") {
      writes.push({ body: input, idempotencyKey: options.idempotencyKey })
      return { kind: "transport-error", reason: "network" }
    }
    return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(page) }
  } }
  const deps: SfContextDependencies = { listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: context }), createTransport: () => transport,
    resolveTransportIdentity: () => "transport", createDraft: createSfDraft,
    revalidateDraft: async () => ({ status: "unavailable" }) }
  const route: SfSurfaceProps<"CAP25">["route"] = { surfaceId: "CAP25", kind: "entry", params: {}, ownerSelection: selection,
    href: "/orchestra/sf-procurement/requests" as SfHref, pathname: "/orchestra/sf-procurement/requests", query: {} }
  const node = document.createElement("div")
  document.body.append(node)
  const captured: { handle?: SfContextHandle } = {}
  const child = () => { captured.handle = useSfContext(); return createComponent(SfRequestTitleEdit,
    { surfaceId: "CAP25", route, requestRef: "PR-1" as SfRef }) }
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en", get children() {
    return createComponent(SfContextProvider, { selection: () => selection, dependencies: deps,
      get children() { return createComponent(child, {}) } })
  } })), node)
  try {
    await waitFor(() => !!captured.handle)
    await captured.handle!.reload()
    await waitFor(() => !!node.querySelector("input"))
    const input = node.querySelector<HTMLInputElement>("input")!
    input.value = "after"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    const button = (text: string) => [...node.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.trim() === text)
    button("Review save")!.click()
    await waitFor(() => !!node.querySelector('[data-component="sf-change-review"]'))
    expect(writes).toEqual([])
    const confirm = button("Confirm save")
    expect(confirm, `Missing source-reviewed confirmation label. Rendered actions: ${[...node.querySelectorAll("button")].map((item) => item.textContent?.trim()).join(" | ")}`).toBeDefined()
    confirm!.click()
    await waitFor(() => writes.length === 1 && !node.querySelector('[data-component="sf-change-review"]'))
    expect(writes[0]!.body).toEqual({ page: "Requests", action: "save", id: "PR-1", version: 7, values: { pr: { title: "after" } } })
    expect(writes[0]!.idempotencyKey).toBeTruthy()
    expect(node.querySelector("input")).toBeNull()
    expect(button("Discard local draft changes")).toBeUndefined()
    expect(writes).toHaveLength(1)
  } finally { dispose(); node.remove() }
})
