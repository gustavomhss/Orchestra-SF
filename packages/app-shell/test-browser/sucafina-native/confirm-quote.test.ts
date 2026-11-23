// Injected producer envelopes exercise the real leaf components, not an installed host.
import { expect, test } from "bun:test"
import type { SfEditScopeKey, SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfContextDependencies, SfContextHandle, SfSurfaceProps } from "../../src/orchestra/chapters/sucafina/context/contracts"

const { createComponent, render } = await import("../lean-dom.test-helper")
const { solidDom } = await import("../solid-dom")
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") = await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { SfSourcingView }: typeof import("@/orchestra/chapters/sucafina/procurement/sourcing") = await import(solidDom("@/orchestra/chapters/sucafina/procurement/sourcing", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") = await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test", mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const op = (operationId: string) => ({ operationId, state: "ready" as const, operational: true, reason: null })
const context: SfContext = { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [{ capabilityId: "CAP25" as const, surface: "procurement" as const, page: "Requests", canRead: true, allowedActionIds: ["save", "create", "select_quote"] }],
  availability: [{ family: "procurement", resource: "CAP25", state: "ready" as const, operations: [op("domain.page.CAP25"), op("domain.command.CAP25.save"), op("domain.command.CAP25.create"), op("domain.command.CAP25.select_quote")] }] }
const page = (version: number) => ({ status: "ok", context: stamp, value: {
  capabilityId: "CAP25", selection: { request: "PR-1" }, data: { requests: [{ number: "PR-1", createdBy: "actor",
    status: "sourcing", allowedDraftActions: ["save-sourcing"],
    pr: { title: "Request", description: "source" }, sourcing: { evaluator: "source", quotes: [] } }],
    suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
  versions: { "requests:PR-1": { version, by: "actor" } }, allowedActionIds: ["save", "create"] } })
const waitFor = async (condition: () => unknown) => {
  for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)) }
  throw new Error("Timed out waiting for procurement fixture")
}
const button = (node: HTMLElement, label: string) => [...node.querySelectorAll("button")].find((item) => item.textContent?.trim() === label)
const mount = (transport: SfTransport) => {
  const deps: SfContextDependencies = { listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: context }), createTransport: () => transport,
    resolveTransportIdentity: () => "transport", createDraft: createSfDraft, revalidateDraft: async () => ({ status: "unavailable" }) }
  const route = { surfaceId: "CAP25", ownerSelection: selection, href: "/requests/PR-1" as SfHref,
    pathname: "/requests/PR-1", query: {}, kind: "sourcing", params: { requestRef: "PR-1" as SfRef } } as SfSurfaceProps<"CAP25">["route"]
  const node = document.createElement("div"); document.body.append(node)
  const captured: { handle?: SfContextHandle } = {}
  const child = () => { captured.handle = useSfContext(); return createComponent(SfSourcingView, { surfaceId: "CAP25", route }) }
  const unexpected = () => { throw new Error("Unexpected browser platform action") }
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal: unexpected, restart: unexpected, notify: unexpected },
    get children() {
      return createComponent(LanguageProvider, { locale: "en",
        get children() {
          // The provider prop is a default; persisted preferences can come from another DOM test.
          const language = useLanguage()
          language.setLocale("en")
          expect(language.locale()).toBe("en")
          expect(language.intl()).toBe("en")
          return createComponent(SfContextProvider, { selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) } })
        },
      })
    },
  }), node)
  return { node, captured, close: () => { dispose(); node.remove() } }
}
const selected = (scope: string) => ({ surfaceId: "CAP25" as const, identity: { kind: "record" as const, recordRef: "PR-1" as SfRef }, editScopeKey: scope as SfEditScopeKey })

for (const duplicateSupplier of [false, true]) test("confirming a quote shows progress, sends one CAS command, and reads the recorded selection" +
  (duplicateSupplier ? " when supplier labels and totals are equal" : ""), async () => {
  const chosenId = duplicateSupplier ? "B" : "A"
  const preflight = Promise.withResolvers<void>(), commit = Promise.withResolvers<void>()
  const verification = Promise.withResolvers<void>()
  const writes: { input: unknown; idempotencyKey?: string }[] = []
  let reads = 0, recorded = false
  const transport: SfTransport = { async execute(operation, input, options) {
    if (operation.operationId === "domain.command.CAP25.select_quote") {
      writes.push({ input, idempotencyKey: options.idempotencyKey })
      await commit.promise
      recorded = true
      return { kind: "response", status: 200, headers: {}, body: { ok: true } as never }
    }
    reads++
    if (reads === 2) return { kind: "transport-error", reason: "network" }
    if (reads === 3) await preflight.promise
    if (reads === 4) await verification.promise
    const source = page(recorded ? 2 : 1)
    const item = { ...source.value.data.requests[0]!, sourcing: {
      selectedId: recorded ? chosenId : duplicateSupplier ? "A" : null,
      quotes: [
        { id: "A", supplier: "Fornecedor A", currency: "USD", total: 32400, techPass: true },
        ...(duplicateSupplier ? [{ id: "B", supplier: "Fornecedor A", currency: "USD", total: 32400, techPass: true }] : []),
      ],
    } }
    return { kind: "response", status: 200, headers: {}, body: { ...source, value: {
      ...source.value, allowedActionIds: ["save", "select_quote"], data: { ...source.value.data, requests: [item] },
    } } as never }
  } }
  const view = mount(transport)
  try {
    await waitFor(() => button(view.node, "Compare quotations"))
    button(view.node, "Compare quotations")!.click()
    const quote = [...view.node.querySelectorAll<HTMLSelectElement>(".sf-u12-comparison select")]
      .find((select) => [...select.options].some((option) => option.value === "A"))
    expect(quote).toBeDefined()
    expect([...quote!.options].filter((option) => option.value === "A" || option.value === "B").map((option) => option.textContent))
      .toEqual(duplicateSupplier ? ["Fornecedor A · A · 32,400 USD", "Fornecedor A · B · 32,400 USD"] : ["Fornecedor A · 32,400 USD"])
    quote!.value = chosenId
    quote!.dispatchEvent(new Event("change", { bubbles: true }))
    button(view.node, "Select winning quote")!.click()
    const review = view.node.querySelector('[data-component="sf-change-review"]')!
    const confirm = review.querySelector<HTMLButtonElement>("button.primary")!
    const alert = () => view.node.querySelector('[role="alert"]')
    expect(review.textContent).toContain("Fornecedor A")
    const selection = [...review.querySelectorAll(".sf-s03-comparison-field")]
      .find((field) => field.querySelector("h4")?.textContent === "Selected quotation")
    expect(selection).toBeDefined()
    expect(selection?.getAttribute("data-difference")).toBe("changed")
    if (duplicateSupplier) expect(selection?.querySelector('[data-version="base"] .sf-s03-field-value')?.textContent).toBe("Fornecedor A · A")
    expect(selection?.querySelector('[data-version="proposed"] .sf-s03-field-value')?.textContent).toBe("Fornecedor A · " + chosenId)
    expect(review.textContent).toContain(new Intl.NumberFormat("en", { maximumSignificantDigits: 21 }).format(32400) + " USD")
    expect(confirm.textContent?.trim()).toBe("Select winning quote")
    confirm.click()
    await waitFor(() => alert() && !confirm.disabled)
    expect(writes).toHaveLength(0)
    expect(view.node.contains(review)).toBe(true)
    confirm.click()
    confirm.click()
    expect(confirm.disabled).toBe(true)
    expect(view.node.textContent).toContain("Loading authorized sourcing")
    preflight.resolve()
    await waitFor(() => writes.length === 1)
    expect(view.node.textContent).toContain("Sending one command")
    expect(confirm.textContent?.trim()).toBe("Confirm once")
    expect(view.node.textContent).not.toContain("Command outcome unknown")
    expect(alert()).toBeNull()
    expect(writes).toEqual([{
      input: { page: "Requests", action: "select_quote", id: "PR-1", version: 1, values: { quoteId: chosenId } },
      idempotencyKey: expect.any(String),
    }])
    confirm.click()
    commit.resolve()
    await waitFor(() => reads === 4)
    expect(view.node.contains(review)).toBe(true)
    expect([...review.querySelectorAll("button")].every((item) => item.disabled)).toBe(true)
    expect(alert()).toBeNull()
    verification.resolve()
    await waitFor(() => view.node.querySelector('[data-confirmation-phase="producer-confirmed"]'))
    expect(view.captured.handle?.ready()?.drafts.peek(selected("CAP25:sourcing"))?.snapshot()).toMatchObject({ baseVersion: 2, value: { selectedId: chosenId }, pendingOperation: null })
    expect(writes).toHaveLength(1)
  } finally { preflight.resolve(); commit.resolve(); verification.resolve(); view.close() }
})
