import { expect, test } from "bun:test"
import { Schema } from "effect"
import { solidDom } from "../solid-dom"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfContextDependencies, SfContextHandle } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { DASHBOARD_PAGES } from "../../../../modules/sucafina/Sucafinav1/src/nav"

// Rendered consumer tests with injected producer replies, not installed identity evidence.
const { createComponent } = await import("solid-js")
const { render } = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { SfSummarySettings }: typeof import("@/orchestra/chapters/sucafina/local-administration/summary-settings") =
  await import(solidDom("@/orchestra/chapters/sucafina/local-administration/summary-settings", import.meta.dir))

const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "operator", policyVersion: "p1", accessRevision: "a1" }
const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test",
  mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "local-operator" as const }
const route = { surfaceId: "UI69" as const, kind: "entry" as const, params: {}, ownerSelection: selection,
  href: "/orchestra/sf-home/administration" as SfHref, pathname: "/orchestra/sf-home/administration", query: {} }
const context = (write = true): SfContext => ({ stamp, contractRevision: "sf-native-ui/1", authMode: "local-operator", destinations: [],
  availability: [{ family: "domain-read", resource: "local-admin", state: write ? "ready" : "partial", operations: [
    { operationId: "local-admin.summary-read", state: "ready", operational: true, reason: null },
    write ? { operationId: "local-admin.summary-configure", state: "ready", operational: true, reason: null }
      : { operationId: "local-admin.summary-configure", state: "denied", operational: false, reason: "denied" },
  ] }] })
type Settings = Extract<typeof SfDomain.operations["local-admin.summary-read"]["output"]["Type"], { status: "ok" }>["value"]
type Configure = typeof SfDomain.operations["local-admin.summary-configure"]["input"]["Type"]
async function waitFor(predicate: () => unknown) {
  for (let index = 0; index < 100; index++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Summary settings fixture did not reach the expected state")
}
const button = (node: HTMLElement, label: string) =>
  [...node.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label)
const checkbox = (node: HTMLElement) => node.querySelector<HTMLInputElement>('input[name="pages"][value="IT Risks"]')!
async function fixture(options: { write?: boolean; foreignReply?: boolean; foreignAfterRead?: boolean; foreignRoute?: boolean;
  configure?: (input: Configure) => Promise<unknown> } = {}) {
  let persisted: Settings = { pages: [], availablePages: [...DASHBOARD_PAGES], version: 0, canConfigure: true }
  const calls: { id: string; input: unknown; idempotencyKey?: string }[] = []
  let reads = 0
  const captured: { handle?: SfContextHandle } = {}
  const transport: SfTransport = { async execute(operation, input, callOptions) {
    calls.push({ id: operation.operationId, input: structuredClone(input), idempotencyKey: callOptions.idempotencyKey })
    if (operation.operationId === "local-admin.summary-configure")
      expect(callOptions.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    if (operation.operationId === "local-admin.summary-read") reads += 1
    const body = operation.operationId === "local-admin.summary-read"
      ? { status: "ok", context: options.foreignReply || options.foreignAfterRead && reads > 1 ? { ...stamp, principalRef: "foreign" } : stamp, value: persisted }
      : operation.operationId === "local-admin.summary-configure"
        ? await (options.configure ?? (async (value: Configure) => {
          expect(value.context).toEqual(stamp)
          expect(value.version).toBe(persisted.version)
          persisted = { ...persisted, pages: [...value.pages], version: persisted.version + 1 }
          return { ok: true }
        }))(Schema.decodeUnknownSync(SfDomain.operations["local-admin.summary-configure"].input)(input))
        : (() => { throw new Error("Unexpected summary operation: " + operation.operationId) })()
    return { kind: "response", status: typeof body === "object" && body && "ok" in body && body.ok === false ? 409 : 200,
      headers: {}, body: Schema.decodeUnknownSync(operation.output)(body) }
  } }
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }), loadContext: async () => ({ status: "ok", value: context(options.write) }),
    createTransport: () => transport, resolveTransportIdentity: () => "transport", createDraft: createSfDraft,
    revalidateDraft: async () => ({ status: "unavailable" }),
  }
  const child = () => {
    captured.handle = useSfContext()
    return createComponent(SfSummarySettings, { surfaceId: "UI69",
      route: options.foreignRoute ? { ...route, ownerSelection: { ...selection, projectId: "foreign" as SfRef } } : route })
  }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en",
    get children() { return createComponent(SfContextProvider, { selection: () => selection, dependencies,
      get children() { return createComponent(child, {}) } }) } })), node)
  await waitFor(() => captured.handle?.state().status === "ready")
  return { node, calls, get handle() { return captured.handle! }, setSource(value: Settings) { persisted = value },
    close() { dispose(); node.remove() } }
}
function review(node: HTMLElement) {
  checkbox(node).checked = true
  checkbox(node).dispatchEvent(new Event("change", { bubbles: true }))
  button(node, "Review changes")!.click()
}

test("UI69 reviews the closed original summaries command and refreshes its persisted version", async () => {
  const view = await fixture()
  try {
    await waitFor(() => checkbox(view.node))
    expect(button(view.node, "Save summaries")).toBeUndefined()
    review(view.node)
    await waitFor(() => button(view.node, "Save summaries"))
    expect(view.calls.map((call) => call.id)).toEqual(["local-admin.summary-read"])
    button(view.node, "Save summaries")!.click()
    await waitFor(() => view.node.querySelector("[data-sf-summary-form]")?.getAttribute("data-version") === "1")
    expect(view.calls.map((call) => call.id)).toEqual(["local-admin.summary-read", "local-admin.summary-configure", "local-admin.summary-read"])
    expect(view.calls[1]!.input).toEqual({ context: stamp, version: 0, pages: ["IT Risks"] })
    expect(view.calls[1]!.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(checkbox(view.node).checked).toBe(true)
    expect(view.node.querySelector("[data-sf-summary-version]")?.textContent).toBe("1")
    expect(view.node.textContent).toContain("Changes saved.")
  } finally { view.close() }
})

test("UI69 does not expose an editor without current command admission or for a foreign route", async () => {
  for (const options of [{ write: false }, { foreignRoute: true }]) {
    const view = await fixture(options)
    try {
      await waitFor(() => options.foreignRoute || view.node.textContent?.includes("Read only"))
      expect(view.node.querySelector("[data-sf-summary-form]")).toBeNull()
      expect(button(view.node, "Save summaries")).toBeUndefined()
      expect(view.calls.map((call) => call.id)).toEqual(options.foreignRoute ? [] : ["local-admin.summary-read"])
    } finally { view.close() }
  }
})

test("UI69 rejects a successful projection belonging to another principal", async () => {
  const view = await fixture({ foreignReply: true })
  try {
    await waitFor(() => view.node.textContent?.includes("You do not have access"))
    expect(view.node.querySelector("[data-sf-summary-form]")).toBeNull()
    expect(view.node.querySelector("[data-sf-summary-version]")).toBeNull()
    expect(view.calls.map((call) => call.id)).toEqual(["local-admin.summary-read"])
  } finally { view.close() }
})

test("UI69 retains dirty summaries and original CAS after 409 until an explicit source read", async () => {
  const view = await fixture({ configure: async () => ({ ok: false, status: 409 }) })
  try {
    await waitFor(() => checkbox(view.node))
    review(view.node)
    await waitFor(() => button(view.node, "Save summaries"))
    view.setSource({ pages: ["Budget Overview"], availablePages: [...DASHBOARD_PAGES], version: 1, canConfigure: true })
    button(view.node, "Save summaries")!.click()
    await waitFor(() => view.node.textContent?.includes("Review the current source"))
    expect(view.node.querySelector("[data-sf-summary-form]")?.getAttribute("data-version")).toBe("0")
    expect(checkbox(view.node).checked).toBe(true)
    expect(button(view.node, "Review changes")!.disabled).toBe(true)
    expect(view.calls.filter((call) => call.id === "local-admin.summary-configure")).toHaveLength(1)
    button(view.node, "Current source")!.click()
    await waitFor(() => view.node.querySelector("[data-sf-summary-form]")?.getAttribute("data-version") === "1")
    expect(checkbox(view.node).checked).toBe(false)
    expect(view.calls.filter((call) => call.id === "local-admin.summary-configure")).toHaveLength(1)
  } finally { view.close() }
})

test("UI69 purges the editor and ignores a late command reply after revocation", async () => {
  const gate = Promise.withResolvers<unknown>()
  const view = await fixture({ configure: async () => gate.promise })
  try {
    await waitFor(() => checkbox(view.node))
    review(view.node)
    await waitFor(() => button(view.node, "Save summaries"))
    button(view.node, "Save summaries")!.click()
    await waitFor(() => view.calls.some((call) => call.id === "local-admin.summary-configure"))
    view.handle.invalidate("revoked")
    gate.resolve({ ok: true })
    await gate.promise
    await new Promise((resolve) => setTimeout(resolve, 0))
    await waitFor(() => !view.node.querySelector("[data-sf-summary-form]"))
    expect(view.node.querySelector("[data-sf-summary-version]")).toBeNull()
    expect(view.node.textContent).not.toContain("Changes saved.")
    expect(view.calls.map((call) => call.id)).toEqual(["local-admin.summary-read", "local-admin.summary-configure"])
  } finally { gate.resolve({ ok: true }); view.close() }
})

test("UI69 purges private settings if the post-command source reply belongs to another owner", async () => {
  const view = await fixture({ foreignAfterRead: true })
  try {
    await waitFor(() => checkbox(view.node))
    review(view.node)
    await waitFor(() => button(view.node, "Save summaries"))
    button(view.node, "Save summaries")!.click()
    await waitFor(() => view.node.textContent?.includes("You do not have access"))
    expect(view.node.querySelector("[data-sf-summary-form]")).toBeNull()
    expect(view.node.querySelector("[data-sf-summary-version]")).toBeNull()
    expect(view.node.textContent).not.toContain("Changes saved.")
    expect(view.calls.map((call) => call.id)).toEqual(["local-admin.summary-read", "local-admin.summary-configure", "local-admin.summary-read"])
  } finally { view.close() }
})
