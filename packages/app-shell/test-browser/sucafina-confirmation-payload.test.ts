import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { createComponent, createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { SfContext } from "@orchestra/schema/sucafina/context"
import type { SfHref, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { createSfBusinessServices } from "../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { ConfirmationCommand, ConfirmationScope } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfStateResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { DashboardPortfolio } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { resolve } from "../../../modules/sucafina/Sucafinav1/src/identity.ts"
import type { SfSurfaceProps } from "../src/orchestra/chapters/sucafina/context/contracts"
import { SF_U44_COPY, SF_U44_COPY_BR } from "../src/i18n/orchestra-chapters/sf-u44"
import { SF_S05_COPY, SF_S05_COPY_BR } from "../src/i18n/orchestra-chapters/sf-s05"
import { SF_COMMON_COPY, SF_COMMON_COPY_BR } from "../src/i18n/orchestra-chapters/sf-common"

const at = "2026-11-22T08:00:00.000Z"
const period = { start: "2026-01-01", end: "2026-12-31" }
const values = { name: "Reviewed project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "" }
function ok<Value>(result: PortResult<Value> | SfStateResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

/** Shipped authority/business factories, canonical Dashboard edits, source receipts,
 * C06 and SQLite are real. Authentication/directory and the F01 owner are explicit
 * fixture boundaries; this is not an installed Entra/Teams or HTTP routing claim. */
async function fixture(dependency = true) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-confirmation-payload-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  const people = [{ id: "person", name: "Authorized reviewer" }]
  const control = { active: true }
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await persistence.initializeSources(surface)
    await persistence.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = [{ surface, role: "admin", entra: "admins", version: 1, by: "person" }]
      snapshot.data.access = { person: { assigned: [], domains: [] } }
      return { commit: true, value: undefined }
    })
  }
  const save = (id: string, budget: number, version: number) => persistence.transaction("dashboard", async (snapshot) => {
    const result = DashboardPortfolio.domain.execute(snapshot, { id: "person", roles: ["admin"], canWrite: true },
      { page: "All Projects", action: "save", ...(version ? { id } : {}), version, values: { ...values, name: id, budget } },
      { at, id: () => id, directory: people })
    if (!result.ok) throw new Error("Canonical Dashboard mutation failed: " + JSON.stringify(result))
    return { commit: true, value: result }
  })
  await save("project", 100, 0)
  if (dependency) await save("dependency", 200, 0)
  const identity = { installationId: "confirmation-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const request = () => new Request("https://example.test/product", {
    method: "POST", headers: { origin: "https://example.test", actor: "person" },
  })
  const authority = createSfProductAuthority({
    identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
    policyVersion: "policy", persistence,
    authenticate: async (candidate, scope) => control.active && candidate.headers.get("actor") === "person" && scope
      ? resolve("person", [...scope.roleMap], (group) => group === "admins") : null,
    environment: async () => ({ at, id: randomUUID, directory: people }),
    grants: [{ principalRef: "person", namespaces: ["confirmations", "threads", "relations", "cases", "preferences"],
      operations: ["sf_relation_read"], humanActions: ["collaboration.confirmation.confirm"] }],
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
  })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
  business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture",
    manifestVersion: "fixture", skillVersion: "fixture" })
  const confirmation = business.collaboration.confirmation
  if (!confirmation) throw new Error("Native C06 composition is unavailable")
  const read = async <Value>(payload: unknown, work: (call: TrustedUiContext) => Promise<Value>) => {
    const digest = digestSfValue(payload)
    const call = ok(await authority.ui.admit(request(), "sf_relation_read", digest))
    try {
      expect(await authority.ui.validate(call, "sf_relation_read", digest)).toBe(true)
      return await work(call)
    } finally { authority.ui.finish(call) }
  }
  const prepared = await read({ purpose: "prepare-material" }, async (call) => {
    const issue = async (id: string) => ok(await business.dashboardRecords.issue({
      page: "All Projects", recordType: "projects", recordId: id, fields: ["name", "budget", "spent", "status"], period,
    }, call))
    const source = await issue("project")
    const material = dependency ? await issue("dependency") : undefined
    const scope: ConfirmationScope = {
      sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: source.target.incarnation },
      fields: source.target.fields, period, scopeDefinitionVersion: "dashboard-c06-v1",
      materialDependencies: material ? [{
        surface: "dashboard", type: "projects", id: "dependency", incarnation: material.target.incarnation,
        version: material.target.version, fields: material.target.fields, period, observedAt: at,
      }] : [],
    }
    const observation = ok(await confirmation.prepare(scope, call))
    expect(observation.projection.missing).toEqual([])
    if (!observation.selectionRef) throw new Error("Native selection receipt missing")
    return { scope, observation, context: Schema.decodeUnknownSync(SfContext)({
      stamp: { installationId: call.binding.installationId, projectId: call.binding.projectId, hostId: identity.hostId,
        principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion },
      contractRevision: "sf-native-ui/1", authMode: "local-operator", destinations: [],
      availability: [{ family: "domain-read", resource: "confirmations", state: "ready", operations: [
        "collaboration.confirmation-prepare", "collaboration.confirmation-project",
        "collaboration.confirmation-confirm", "collaboration.storage-version",
      ].map((operationId) => ({ operationId, state: "ready", reason: null, operational: true })) }],
    }) }
  })
  const events: { operation: string; result?: unknown; error?: string }[] = []
  const commands: ConfirmationCommand[] = []
  const outcomes: Awaited<ReturnType<typeof confirmation.confirm>>[] = []
  const commit = async (command: ConfirmationCommand) => {
    const admitted = await authority.human.admit(request(), "collaboration.confirmation.confirm", command)
    if (admitted.status !== "ok") return admitted
    try { return await confirmation.confirm(command, admitted.value) }
    finally { authority.human.finish(admitted.value) }
  }
  const transport: SfTransport = {
    async execute(operation, input) {
      const event: { operation: string; result?: unknown; error?: string } = { operation: operation.operationId }
      events.push(event)
      try {
      let result: unknown
      if (operation.operationId === "collaboration.confirmation-project") {
        const payload = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-project"].input)(input)
        result = await read(payload, (call) => "selectionRef" in payload
          ? confirmation.readSelection(payload.selectionRef, call) : confirmation.project(payload.id, call))
      } else if (operation.operationId === "collaboration.storage-version") {
        const payload = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.storage-version"].input)(input)
        result = await read(payload, (call) => business.collaboration.storageVersion(payload.namespace, call))
      } else if (operation.operationId === "collaboration.confirmation-confirm") {
        const payload = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-confirm"].input)(input)
        commands.push(structuredClone(payload))
        const outcome = await commit(payload)
        outcomes.push(outcome)
        result = outcome
      } else throw new Error("Unexpected UI operation: " + operation.operationId)
      event.result = result
      return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(operation.output)(result) }
      } catch (error) { event.error = String(error); throw error }
    },
  }
  return { ...prepared, transport, commands, outcomes, commit, save, control, events,
    storage: () => read({ purpose: "read-version" }, (call) => business.collaboration.storageVersion("confirmations", call)).then(ok),
    close: async () => { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>
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
  return { host, close: () => { dispose(); host.remove() } }
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
  const value = await fixture()
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
  const value = await fixture(false)
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
  const value = await fixture()
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
  const value = await fixture()
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
