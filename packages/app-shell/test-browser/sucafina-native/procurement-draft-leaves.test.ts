// Injected producer envelopes exercise the real leaf components, not an installed host.
import { expect, test } from "bun:test"
import path from "node:path"
import type { SfEditScopeKey, SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfContextDependencies, SfContextHandle, SfSurfaceProps } from "../../src/orchestra/chapters/sucafina/context/contracts"

if (process.env.SF_PROCUREMENT_DRAFT_DOM !== "1") {
  test("procurement draft leaves in the browser lane", async () => {
    const proc = Bun.spawn([Bun.which("bun")!, "--conditions=browser", "test", "--preload", "./happydom.ts", import.meta.path], {
      cwd: path.resolve(import.meta.dir, "../.."), env: { ...process.env, SF_PROCUREMENT_DRAFT_DOM: "1" },
      stdout: "pipe", stderr: "pipe", timeout: 180000, killSignal: "SIGKILL",
    })
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
    expect(code, out + err).toBe(0)
  }, 240000)
} else {
  const { createComponent, render } = await import("../lean-dom.test-helper")
  const { solidDom } = await import("../solid-dom")
  const { withBrowserPlatform } = await import("./platform-fixture")
  const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
  const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") = await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
  const { SfSourcingView }: typeof import("@/orchestra/chapters/sucafina/procurement/sourcing") = await import(solidDom("@/orchestra/chapters/sucafina/procurement/sourcing", import.meta.dir))
  const { SfRequestsPage }: typeof import("@/orchestra/chapters/sucafina/procurement/requests/page") = await import(solidDom("@/orchestra/chapters/sucafina/procurement/requests/page", import.meta.dir))
  const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") = await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
  const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
  const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
  const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test", mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
  const op = (operationId: string) => ({ operationId, state: "ready" as const, operational: true, reason: null })
  const context: SfContext = { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
    destinations: [{ capabilityId: "CAP25" as const, surface: "procurement" as const, page: "Requests", canRead: true, allowedActionIds: ["save"] }],
    availability: [{ family: "procurement", resource: "CAP25", state: "ready" as const, operations: [op("domain.page.CAP25"), op("domain.command.CAP25.save")] }] }
  const page = (kind: "sourcing" | "requisition", version: number) => ({ status: "ok", context: stamp, value: {
    capabilityId: "CAP25", selection: { request: "PR-1" }, data: { requests: [{ number: "PR-1", createdBy: "actor",
      status: kind === "sourcing" ? "sourcing" : "draft", allowedDraftActions: [kind === "sourcing" ? "save-sourcing" : "save-pr"],
      pr: { title: "Request", description: "source" }, sourcing: { evaluator: "source", quotes: [] } }],
      suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
    versions: { "requests:PR-1": { version, by: "actor" } }, allowedActionIds: ["save"] } })
  const waitFor = async (condition: () => unknown) => {
    for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 10)) }
    throw new Error("Timed out waiting for procurement fixture")
  }
  const button = (node: HTMLElement, label: string) => [...node.querySelectorAll("button")].find((item) => item.textContent?.trim() === label)
  const mount = (kind: "sourcing" | "requisition", transport: SfTransport) => {
    const deps: SfContextDependencies = { listInstallations: async () => ({ installations: [binding] }),
      loadContext: async () => ({ status: "ok", value: context }), createTransport: () => transport,
      resolveTransportIdentity: () => "transport", createDraft, revalidateDraft: async () => ({ status: "unavailable" }) }
    const route = { surfaceId: "CAP25", ownerSelection: selection, href: "/requests/PR-1" as SfHref,
      pathname: "/requests/PR-1", query: {}, kind, params: { requestRef: "PR-1" as SfRef } } as SfSurfaceProps<"CAP25">["route"]
    const node = document.createElement("div"); document.body.append(node)
    const captured: { handle?: SfContextHandle } = {}
    const child = () => { captured.handle = useSfContext(); return createComponent(kind === "sourcing" ? SfSourcingView : SfRequestsPage, { surfaceId: "CAP25", route }) }
    const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en",
      get children() { return createComponent(SfContextProvider, { selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) } }) } })), node)
    return { node, captured, close: () => { dispose(); node.remove() } }
  }
  const edit = (input: HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })) }
  const selected = (scope: string) => ({ surfaceId: "CAP25" as const, identity: { kind: "record" as const, recordRef: "PR-1" as SfRef }, editScopeKey: scope as SfEditScopeKey })

  test("a refresh already in flight closes the real sourcing review and hides its private proposal", async () => {
    const delayed = Promise.withResolvers<void>()
    let reads = 0, writes = 0
    const transport: SfTransport = { async execute(operation) {
      if (operation.operationId !== "domain.page.CAP25") { writes++; return { kind: "transport-error", reason: "network" } }
      reads++
      if (reads === 2) await delayed.promise
      return { kind: "response", status: 200, headers: {}, body: page("sourcing", reads === 1 ? 1 : 2) as never }
    } }
    const view = mount("sourcing", transport)
    try {
      await waitFor(() => view.node.querySelector(".sf-u12-fields textarea"))
      button(view.node, "Refresh from source")!.click()
      await waitFor(() => reads === 2)
      edit(view.node.querySelector<HTMLTextAreaElement>(".sf-u12-fields textarea")!, "private proposal")
      button(view.node, "Save sourcing")!.click()
      expect(view.node.querySelector('[data-component="sf-change-review"]')?.textContent).toContain("private proposal")
      delayed.resolve()
      await waitFor(() => view.node.querySelector('[data-draft-conflict="sourcing"]'))
      expect(view.node.querySelector('[data-component="sf-change-review"]')).toBeNull()
      expect(view.node.textContent).not.toContain("private proposal")
      expect(view.node.querySelector(".sf-u12-fields textarea")).toBeNull()
      expect(view.captured.handle?.ready()?.drafts.peek(selected("CAP25:sourcing"))?.snapshot()).toMatchObject({ phase: "conflict", baseVersion: 1, value: { evaluator: "private proposal" } })
      expect(writes).toBe(0)
      view.node.querySelector<HTMLButtonElement>('[data-draft-conflict="sourcing"] button')!.click()
      await waitFor(() => view.node.querySelector(".sf-u12-fields textarea"))
      expect(view.node.querySelector<HTMLTextAreaElement>(".sf-u12-fields textarea")?.value).toBe("source")
    } finally { delayed.resolve(); view.close() }
  })

  test("a typed requests 409 exposes inline conflict and explicit discard reload", async () => {
    let writes = 0
    const transport: SfTransport = { async execute(operation) {
      if (operation.operationId === "domain.page.CAP25") return { kind: "response", status: 200, headers: {}, body: page("requisition", writes ? 2 : 1) as never }
      writes++
      return { kind: "response", status: 409, headers: {}, body: { ok: false, status: 409 } as never }
    } }
    const view = mount("requisition", transport)
    try {
      await waitFor(() => view.node.querySelector('[data-field="description"] textarea'))
      edit(view.node.querySelector<HTMLTextAreaElement>('[data-field="description"] textarea')!, "private request edit")
      const save = button(view.node, "Save requisition draft") ?? button(view.node, "sf.u11.remaining.savePr")
      expect(save).toBeDefined(); save!.click()
      await waitFor(() => view.node.querySelector('[data-component="sf-change-review"]'))
      view.node.querySelector<HTMLButtonElement>('.sf-s03-actions button.primary')!.click()
      await waitFor(() => view.node.querySelector('[data-draft-conflict="pr"]'))
      expect(view.node.querySelector('[data-sf-pr-fields]')).toBeNull()
      expect(view.captured.handle?.ready()?.drafts.peek(selected("pr.details"))?.snapshot()).toMatchObject({ phase: "conflict", pendingOperation: null, baseVersion: 1 })
      view.node.querySelector<HTMLButtonElement>('[data-draft-conflict="pr"] button')!.click()
      await waitFor(() => view.node.querySelector('[data-field="description"] textarea'))
      expect(view.node.querySelector<HTMLTextAreaElement>('[data-field="description"] textarea')?.value).toBe("source")
      expect(writes).toBe(1)
    } finally { view.close() }
  })

  test("sourcing 409 permits explicit discard, whereas 503 keeps the submitted draft fenced", async () => {
    for (const status of [409, 503] as const) {
      let writes = 0
      const transport: SfTransport = { async execute(operation) {
        if (operation.operationId === "domain.page.CAP25") return { kind: "response", status: 200, headers: {}, body: page("sourcing", writes ? 2 : 1) as never }
        writes++
        return { kind: "response", status, headers: {}, body: { ok: false, status } as never }
      } }
      const view = mount("sourcing", transport)
      try {
        await waitFor(() => view.node.querySelector(".sf-u12-fields textarea"))
        edit(view.node.querySelector<HTMLTextAreaElement>(".sf-u12-fields textarea")!, "private sourcing edit")
        button(view.node, "Save sourcing")!.click()
        await waitFor(() => view.node.querySelector('[data-component="sf-change-review"]'))
        view.node.querySelector<HTMLButtonElement>('.sf-s03-actions button.primary')!.click()
        await waitFor(() => {
          const state = view.captured.handle?.ready()?.drafts.peek(selected("CAP25:sourcing"))?.snapshot()
          return writes === 1 && (status === 409 ? view.node.querySelector('[data-draft-conflict="sourcing"]') :
            state?.availability === "active" && state.phase === "outcome-unknown")
        })
        const draft = view.captured.handle?.ready()?.drafts.peek(selected("CAP25:sourcing"))
        if (status === 503) {
          expect(draft?.snapshot()).toMatchObject({ phase: "outcome-unknown", pendingOperation: expect.any(Object) })
          expect(view.captured.handle?.discardDrafts()).toBe(false)
          continue
        }
        expect(draft?.snapshot()).toMatchObject({ phase: "conflict", pendingOperation: null, baseVersion: 1 })
        view.node.querySelector<HTMLButtonElement>('[data-draft-conflict="sourcing"] button')!.click()
        await waitFor(() => view.node.querySelector(".sf-u12-fields textarea"))
        expect(view.node.querySelector<HTMLTextAreaElement>(".sf-u12-fields textarea")?.value).toBe("source")
      } finally { view.close() }
    }
  })
}
