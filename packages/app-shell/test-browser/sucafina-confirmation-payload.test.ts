import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { Schema } from "effect"
import { createComponent, createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfHref, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { ConfirmationCommand } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import { confirmationSelectionFixture } from "../../../modules/sucafina/Sucafinav1/test/product/wp10/integration/confirmation-selection-fixture.ts"
import type { SfSurfaceProps } from "../src/orchestra/chapters/sucafina/context/contracts"
import { SF_U44_COPY, SF_U44_COPY_BR } from "../src/i18n/orchestra-chapters/sf-u44"
import { SF_S05_COPY, SF_S05_COPY_BR } from "../src/i18n/orchestra-chapters/sf-s05"
import { SF_COMMON_COPY, SF_COMMON_COPY_BR } from "../src/i18n/orchestra-chapters/sf-common"

function ok<Value>(result: PortResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
type Fixture = Awaited<ReturnType<typeof confirmationSelectionFixture>>
let active: Fixture | undefined
const [locale, setLocale] = createSignal<"en" | "pt-BR">("en")
const [generation, setGeneration] = createSignal(1)
const translate = (key: string, params: Record<string, string | number> = {}) => {
  const dictionary = locale() === "en" ? { ...SF_COMMON_COPY, ...SF_U44_COPY, ...SF_S05_COPY }
    : { ...SF_COMMON_COPY_BR, ...SF_U44_COPY_BR, ...SF_S05_COPY_BR }
  return String(Reflect.get(dictionary, key) ?? key).replace(/\{\{?(\w+)\}?\}/g,
    (_, name: string) => String(params[name] ?? ""))
}
const owner = {
  state: () => ({ status: "ready", ownerKey: "confirmation-owner", context: active!.context }),
  generation,
  ready: () => ({ context: active!.context, transport: active!.transport }),
}
const fixtures: Record<string, object> = {
  context: { useSfContext: () => owner },
  language: { useLanguage: () => ({ t: translate, intl: () => locale() === "en" ? "en-US" : "pt-BR" }) },
  router: { useNavigate: () => () => undefined },
}
const imports: Record<string, string> = {
  "../../context": "confirmation-payload:context",
  "@/context/language": "confirmation-payload:language",
  "@solidjs/router": "confirmation-payload:router",
  "../../shared/frame": "confirmation-payload:frame",
  "../shared/frame": "confirmation-payload:frame",
}
const compiler = createRequire(Bun.resolveSync("vite-plugin-solid", import.meta.dir))
const suffix = "?confirmation-payload"
// Isolate the real view, SfConfirmation, states and presentation graph.
// Only F01 ownership, language injection and the outer shell/router are fixtures.
Bun.plugin({
  name: "confirmation-payload-dom",
  setup(build) {
    build.onResolve({ filter: /^confirmation-payload:/ }, (args) => ({
      path: args.path.slice("confirmation-payload:".length), namespace: "confirmation-payload",
    }))
    build.onLoad({ filter: /.*/, namespace: "confirmation-payload" }, (args) => ({ loader: "object", exports: fixtures[args.path] }))
    build.onLoad({ filter: /\.tsx?\?confirmation-payload$/ }, async (args) => {
      const file = args.path.slice(0, -suffix.length)
      const source = await Bun.file(file).text()
      const code = file.endsWith(".tsx")
        ? (await compiler("@babel/core").transformAsync(source, {
          filename: file, presets: [[compiler("babel-preset-solid"), { generate: "dom" }]],
          parserOpts: { plugins: ["jsx", "typescript"] }, configFile: false, babelrc: false,
        })).code : source
      const contents = code.replace(/(from\s+)(["'])([^"']+)\2/g,
        (match: string, lead: string, _quote: string, spec: string) => {
          if (imports[spec]) return lead + JSON.stringify(imports[spec])
          const resolved = Bun.resolveSync(spec, path.dirname(file))
          return /\.tsx?$/.test(resolved) && !resolved.includes("node_modules")
            ? lead + JSON.stringify(resolved + suffix) : match
        })
      return { contents, loader: "ts" }
    })
  },
})
const presentation: typeof import("../src/orchestra/chapters/sucafina/shared/frame/presentation") =
  await import(Bun.resolveSync("../src/orchestra/chapters/sucafina/shared/frame/presentation", import.meta.dir) + suffix)
fixtures.frame = { SfPageFrame: (props: { children?: JSX.Element }) => props.children, SfDisplayValueText: presentation.SfDisplayValueText }
const { SfConfirmationView }: typeof import("../src/orchestra/chapters/sucafina/collaboration-pages/confirmations") =
  await import(Bun.resolveSync("../src/orchestra/chapters/sucafina/collaboration-pages/confirmations", import.meta.dir) + suffix)

function mount(value: Fixture, language: "en" | "pt-BR", reference = value.observation.selectionRef!) {
  active = value
  setLocale(language)
  setGeneration((value) => value + 1)
  const props: SfSurfaceProps<"UI53"> = { surfaceId: "UI53", route: {
    surfaceId: "UI53", kind: "entry", ownerSelection: { serverKey: "confirmation-server" as SfServerKey, projectId: "project" as SfRef },
    href: ("/orchestra/sf-confirmation/" + reference) as SfHref, pathname: "/orchestra/sf-confirmation",
    query: {}, params: { selectionRef: reference as SfRef },
  } }
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(SfConfirmationView, props), host)
  let open = true
  return { host, close: () => { if (!open) return; open = false; dispose(); host.remove() } }
}
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 300 && !predicate(); attempt++) await new Promise((resolve) => setTimeout(resolve, 10))
  if (!predicate()) throw new Error("Confirmation DOM did not settle: " + document.body.innerHTML + "\n" + JSON.stringify(active?.events))
}
function confirm(host: HTMLElement) {
  const button = host.querySelector<HTMLButtonElement>("[data-sf-component=confirmation] button.primary")
  expect(button?.disabled).toBe(false)
  button!.click()
}
const mutation = (value: Fixture, idempotencyKey: string, expectedStorageVersion = 0): ConfirmationCommand => ({
  scope: value.scope, expectedScopeFingerprint: value.observation.scopeFingerprint,
  observedSourceVersion: value.observation.sourceVersion, expectedStorageVersion, idempotencyKey,
})

test("UI53 displays the exact native C06 payload and preserves its original retry receipt", async () => {
  const value = await confirmationSelectionFixture()
  const view = mount(value, "en")
  try {
    await until(() => view.host.querySelector("[data-sf-confirm-material]") !== null)
    const fingerprint = view.host.querySelector("[data-sf-confirm-fingerprint]")?.textContent
    const version = view.host.querySelector("[data-sf-confirm-storage-version]")?.textContent
    const dependencies = [...view.host.querySelectorAll("[data-sf-confirm-dependency]")].map((node) => JSON.parse(node.textContent!))
    expect(fingerprint).toBe(value.observation.scopeFingerprint)
    expect(version).toBe("0")
    expect(dependencies).toEqual(value.scope.materialDependencies)
    expect(view.host.textContent).toContain(SF_U44_COPY["sf.u44.fingerprint"])
    setLocale("pt-BR")
    expect(view.host.textContent).toContain(SF_U44_COPY_BR["sf.u44.storageVersion"])
    expect(view.host.querySelector("[data-sf-confirm-fingerprint]")?.textContent).toBe(fingerprint)
    expect(value.commands).toHaveLength(0)
    confirm(view.host)
    await until(() => view.host.querySelector("[data-sf-confirm-receipt]") !== null)
    expect(value.commands).toHaveLength(1)
    const sent = value.commands[0]!
    expect(sent).toEqual(mutation(value, sent.idempotencyKey))
    expect(sent.expectedScopeFingerprint).toBe(fingerprint)
    expect(sent.expectedStorageVersion).toBe(Number(version))
    expect(sent.scope.materialDependencies).toEqual(dependencies)
    const receipt = ok(value.outcomes[0]!)
    expect(view.host.querySelector("[data-sf-confirm-receipt]")?.textContent).toContain(receipt.auditRef)
    expect(await value.storage()).toBe(1)
    const replay = await createSfCollaborationClient(value.transport)["collaboration.confirmation-confirm"](
      Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-confirm"].input)(sent),
      { signal: new AbortController().signal, idempotencyKey: sent.idempotencyKey, retry: "same-intent" },
    )
    expect(replay.kind).toBe("response")
    if (replay.kind !== "response") throw new Error("Native replay failed")
    expect(ok(replay.body)).toEqual(receipt)
    expect(await value.storage()).toBe(1)
    view.close()
    const recorded = mount(value, "pt-BR", receipt.id)
    try {
      await until(() => recorded.host.querySelector("[data-sf-confirm-record-project]") !== null)
      expect(recorded.host.textContent).toContain(receipt.id)
      expect(recorded.host.querySelector("[data-sf-confirm-material]")).toBeNull()
      expect(value.commands).toHaveLength(2)
      expect(await value.storage()).toBe(1)
    } finally { recorded.close() }
  } finally { view.close(); await value.close() }
}, 120_000)

test("UI53 shows no dependencies and the native producer rejects a source changed after review", async () => {
  const value = await confirmationSelectionFixture(false)
  const view = mount(value, "pt-BR")
  try {
    await until(() => view.host.querySelector("[data-sf-confirm-material]") !== null)
    expect(view.host.querySelector("[data-sf-confirm-no-dependencies]")?.textContent).toBe(SF_U44_COPY_BR["sf.u44.noDependencies"])
    expect(view.host.querySelectorAll("[data-sf-confirm-dependency]")).toHaveLength(0)
    await value.save("project", 110, 1)
    confirm(view.host)
    await until(() => value.outcomes.length === 1 && view.host.querySelector("[data-sf-state=conflict]") !== null)
    expect(value.commands[0]).toEqual(mutation(value, value.commands[0]!.idempotencyKey))
    expect(value.outcomes[0]).toMatchObject({ status: "conflict", reason: "material-scope-changed" })
    expect(await value.storage()).toBe(0)
    expect(view.host.querySelector("[data-sf-confirm-receipt]")).toBeNull()
  } finally { view.close(); await value.close() }
}, 120_000)

test("UI53 retains the reviewed CAS and native C06 rejects a concurrent confirmation", async () => {
  const value = await confirmationSelectionFixture()
  const view = mount(value, "en")
  try {
    await until(() => view.host.querySelector("[data-sf-confirm-material]") !== null)
    const other = ok(await value.commit(mutation(value, "concurrent-confirmation")))
    expect(await value.storage()).toBe(1)
    confirm(view.host)
    await until(() => value.outcomes.length === 1 && view.host.querySelector("[data-sf-state=conflict]") !== null)
    expect(value.commands[0]?.expectedStorageVersion).toBe(0)
    expect(value.outcomes[0]?.status).toBe("conflict")
    expect(await value.storage()).toBe(1)
    expect(view.host.querySelector("[data-sf-confirm-receipt]")).toBeNull()
    expect(ok(await value.commit(mutation(value, "concurrent-confirmation")))).toEqual(other)
    expect(await value.storage()).toBe(1)
  } finally { view.close(); await value.close() }
}, 120_000)

test("UI53 native C06 refuses a material dependency changed after review", async () => {
  const value = await confirmationSelectionFixture()
  const view = mount(value, "en")
  try {
    await until(() => view.host.querySelector("[data-sf-confirm-material]") !== null)
    await value.save("dependency", 210, 1)
    confirm(view.host)
    await until(() => value.outcomes.length === 1)
    expect(value.commands[0]?.scope.materialDependencies).toEqual(value.scope.materialDependencies)
    expect(value.outcomes[0]?.status).not.toBe("ok")
    expect(await value.storage()).toBe(0)
    expect(view.host.querySelector("[data-sf-confirm-receipt]")).toBeNull()
  } finally { view.close(); await value.close() }
}, 120_000)
