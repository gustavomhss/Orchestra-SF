import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { createComponent, render } from "../lean-dom.test-helper"
import { solidDom } from "../solid-dom"
import { withBrowserPlatform } from "./platform-fixture"
import type { SfContext, SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfSurfaceProps } from "../../src/orchestra/chapters/sucafina/context/contracts"

const { LanguageProvider }: typeof import("@/context/language") =
  await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider }: typeof import("../../src/orchestra/chapters/sucafina/context") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/context", import.meta.dir))
const { SfImportsView }: typeof import("../../src/orchestra/chapters/sucafina/imports") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/imports", import.meta.dir))
const { createSfDraft }: typeof import("../../src/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/shared/draft", import.meta.dir))

const stamp = {
  installationId: "install", projectId: "project", hostId: "host",
  principalRef: "actor", policyVersion: "p1", accessRevision: "a1",
}
const binding = {
  installationId: "install", projectId: "project", hostId: "host",
  publicOrigin: "https://sf.test", mount: "/sf",
  contractRevision: "sf-native-ui/1", authMode: "microsoft",
} satisfies Parameters<SfContextDependencies["loadContext"]>[0]
// Opaque F01 refs in this isolated test identify the synthetic, already-selected owner.
const selection: SfOwnerSelection = {
  serverKey: "server" as SfServerKey,
  projectId: "project" as SfRef,
  installationId: "install" as SfRef,
}
const route: SfSurfaceProps<"UI55">["route"] = {
  surfaceId: "UI55", kind: "entry", params: {}, ownerSelection: selection,
  href: "/orchestra/sf-imports/new" as SfHref,
  pathname: "/orchestra/sf-imports/new", query: {},
}
const operation = (operationId: SfOperationId): SfContext["availability"][number]["operations"][number] =>
  ({ operationId, state: "ready", operational: true, reason: null })
const context: SfContext = {
  stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [],
  availability: [{
    family: "files", resource: "import-preview", state: "ready",
    operations: [
      operation("files.import-targets"),
      operation("files.import-admit"),
      operation("files.import-preview"),
      operation("files.import-reference"),
      operation("files.import-detail"),
      operation("files.import-apply"),
    ],
  }],
}
const period = { start: "2027-01-01", end: "2027-12-31" }
const target = {
  label: "FY2027 — Draft 1", surface: "planner",
  selectionRef: "fy2027-draft1", formats: ["xlsx"], sheet: "Budget",
  period,
}
const manifest = {
  id: "preview-2027", version: 1, sourceDigest: "source-2027", format: "xlsx",
  context: { ...stamp, surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] },
  baseIdentity: [], commands: [], issues: [],
  state: "preview", domainApplied: false, receipts: [],
}
const detail = {
  manifestId: manifest.id, version: manifest.version, sourceDigest: manifest.sourceDigest,
  changes: [],
}
const receipt = {
  operation: "files.import-preview", handlerExport: "fixture",
  inputDigest: "input", resultDigest: "result", principalRef: "actor",
  callId: "call-1", accessRevision: "a1", at: "2026-11-17T14:00:00Z",
  kind: "ui", requestId: "req-1",
}
const waitFor = async (condition: () => unknown) => {
  for (let index = 0; index < 100; index++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Timed out waiting for the Imports browser journey")
}
const button = (node: HTMLElement, label: string) =>
  [...node.querySelectorAll("button")].find((item) => item.textContent?.trim() === label)

describe("UI55 Imports: preserve the same-owner upload across destination discovery and preview", () => {
  test("upload → discover → select destination → preview retains the real form DOM and period", async () => {
    const discovered = Promise.withResolvers<void>()
    const calls: string[] = []
    const transport: SfTransport = {
      async execute(operation, input) {
        calls.push(operation.operationId)
        let body: unknown
        switch (operation.operationId) {
          case "files.import-targets":
            await discovered.promise
            body = { status: "ok", value: [target] }
            break
          case "files.import-admit":
            expect(JSON.stringify(input)).toContain(target.selectionRef)
            expect(JSON.stringify(input)).toContain("IMPORT-OPEX-VALID.xlsx")
            body = { status: "ok", value: { ref: "admitted-2027", digest: "file-2027", expiresAt: "2026-11-18T00:00:00Z" } }
            break
          case "files.import-preview":
            expect(JSON.stringify(input)).toContain("admitted-2027")
            body = { status: "ok", value: manifest, receipt }
            break
          case "files.import-reference":
            body = { status: "ok", value: { manifest, detail, digest: "reference-digest" } }
            break
          default:
            throw new Error("Unexpected file operation: " + operation.operationId)
        }
        // Decode against the *real* operation schema, not an unchecked mocked type.
        return { kind: "response", status: 200, headers: {},
          body: Schema.decodeUnknownSync(operation.output)(body) }
      },
    }
    const dependencies: SfContextDependencies = {
      listInstallations: async () => ({ installations: [binding] }),
      loadContext: async () => ({ status: "ok", value: context }),
      createTransport: () => transport,
      resolveTransportIdentity: () => "transport",
      createDraft: createSfDraft,
      revalidateDraft: async () => ({ status: "unavailable" }),
    }
    const node = document.createElement("div")
    document.body.append(node)
    const dispose = render(() => withBrowserPlatform(() =>
      createComponent(LanguageProvider, {
        locale: "en",
        get children() {
          return createComponent(SfContextProvider, {
            selection: () => selection, dependencies,
            get children() { return createComponent(SfImportsView, { surfaceId: "UI55", route }) },
          })
        },
      })), node)
    try {
      await waitFor(() => node.querySelector('[data-sf-read-state="ready"] input[type="file"]'))
      const fileInput = node.querySelector<HTMLInputElement>('input[type="file"]')!
      const dateInputs = [...node.querySelectorAll<HTMLInputElement>('input[type="date"]')]
      expect(dateInputs).toHaveLength(2)
      const file = new File([new Uint8Array([80, 75, 3, 4])], "IMPORT-OPEX-VALID.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      // Happy DOM has no OS file picker; dispatch the genuine native input change.
      Object.defineProperty(fileInput, "files", { configurable: true, value: [file] })
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
      for (const [index, value] of ["2027-01-01", "2027-12-31"].entries()) {
        dateInputs[index]!.value = value
        dateInputs[index]!.dispatchEvent(new Event("change", { bubbles: true }))
      }
      expect(fileInput.files?.[0]).toBe(file)
      expect(dateInputs.map((input) => input.value)).toEqual(["2027-01-01", "2027-12-31"])

      button(node, "Find destinations")!.click()
      await waitFor(() => calls.includes("files.import-targets"))
      // Baseline regression: "loading" previously unmounted SfStatePanel's
      // children, immediately replacing the browser's non-restorable FileList.
      expect(node.querySelector('input[type="file"]')).toBe(fileInput)
      expect(node.querySelectorAll('input[type="date"]')).toHaveLength(2)
      expect(dateInputs.map((input) => input.value)).toEqual(["2027-01-01", "2027-12-31"])
      discovered.resolve()
      await waitFor(() => [...node.querySelectorAll("option")].some((item) => item.textContent === target.label))
      const destination = [...node.querySelectorAll("select")].find((item) =>
        [...item.options].some((option) => option.value === target.selectionRef))!
      destination.value = target.selectionRef
      destination.dispatchEvent(new Event("change", { bubbles: true }))
      expect(destination.value).toBe(target.selectionRef)
      expect(fileInput.files?.[0]).toBe(file)

      button(node, "Preview changes")!.click()
      await waitFor(() => node.querySelector('[data-sf-phase="reviewing"]'))
      expect(calls).toEqual([
        "files.import-targets", "files.import-admit",
        "files.import-preview", "files.import-reference",
      ])
      expect(node.querySelector('input[type="file"]')).toBe(fileInput)
      expect(fileInput.files?.[0]).toBe(file)
      expect(dateInputs.map((input) => input.value)).toEqual(["2027-01-01", "2027-12-31"])
      expect(destination.value).toBe(target.selectionRef)
      expect(node.textContent).toContain("FY2027 — Draft 1")
      expect(node.querySelector('[data-sf-phase="reviewing"]')).not.toBeNull()
    } finally {
      discovered.resolve()
      dispose()
      node.remove()
    }
  })
})
