import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { Schema } from "effect"
import { SfProjectionResidents } from "@orchestra/schema/sucafina/analyses"
import { createResidentAiBundle } from "../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfUiAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/ui-authority.ts"
import { createSfLiveContext } from "../src/sucafina-product/native-ui/live-context.ts"
import { createSfResidentProjectionHandlers, observeSfResidentHealth } from "../src/sucafina-product/native-ui/residents.ts"

const root = fileURLToPath(new URL("../../../modules/sucafina/Sucafinav1/product/ai/", import.meta.url))
const bundle = createResidentAiBundle({ root, manifestPath: root + "manifests/resident.json" })
const origin = "https://resident-reader.example", mount = "/sucafina"
const stamp = Object.freeze({
  installationId: "resident-installation", projectId: "resident-project", hostId: "resident-host",
  principalRef: "resident-person", policyVersion: "resident-policy", accessRevision: "resident-access",
})

/** Actual distributed bundle, F01 mapper and private UI lease implementation.
 * Only the external authentication/ACL and revocation event are controlled here.
 */
async function fixture() {
  const selected = structuredClone((await bundle).selected)
  const controls = { present: true, binding: true, allowed: true, revision: stamp.accessRevision,
    principal: stamp.principalRef, operations: new Set(selected.flatMap((entry) => entry.operationIds)), reads: true }
  const hooks: { authorize?: (operation: string) => Promise<void>; finish?: () => void } = {}
  const seen: TrustedUiContext[] = [], finished: TrustedUiContext[] = []
  let sequence = 0
  const ui = createSfUiAuthority({
    authorize: async (_request, operation) => {
      await hooks.authorize?.(operation)
      return controls.allowed && (operation === "sf-human:analysis.read" ? controls.reads : controls.operations.has(operation))
        ? { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: controls.principal,
          policyVersion: stamp.policyVersion, accessRevision: controls.revision } : undefined
    },
    commandIdentity: async () => "resident-command-" + ++sequence,
    createId: () => "resident-lease-" + ++sequence,
    now: () => Date.parse("2026-11-23T00:00:00.000Z"),
    privateCommands: ["sf-human:analysis.read"],
  })
  const runtime = {
    selected,
    ui: {
      ...ui,
      admit: async (...args: Parameters<typeof ui.admit>) => {
        const result = await ui.admit(...args)
        if (result.status === "ok") seen.push(result.value)
        return result
      },
      finish: (context: TrustedUiContext) => { finished.push(context); ui.finish(context); hooks.finish?.() },
    },
  }
  const placement = { installationId: stamp.installationId, projectId: stamp.projectId, hostId: stamp.hostId }
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => controls.present ? placement : undefined,
    admit: async (request) => {
      const digest = digestSfValue(undefined)
      const read = await ui.admit(request, "sf-human:analysis.read", digest)
      if (read.status !== "ok") return { status: "denied" }
      try {
        if (!await ui.validate(read.value, "sf-human:analysis.read", digest) || !await ui.revalidate(read.value))
          return { status: "denied" }
        return { status: "ok", stamp: {
          installationId: read.value.binding.installationId, projectId: read.value.binding.projectId, hostId: stamp.hostId,
          principalRef: read.value.binding.principalRef, policyVersion: read.value.binding.policyVersion,
          accessRevision: read.value.binding.accessRevision,
        }, authMode: "local-operator", destinations: [] }
      } finally { ui.finish(read.value) }
    },
  })
  const deps = {
    origin, mount, runtime: () => controls.present ? runtime : undefined,
    readContext: (request: Request) => live.readRequestContext(request, placement),
  }
  const handlers = createSfResidentProjectionHandlers(deps)
  const handler = handlers.find((entry) => entry.operationId === "projection.residents")
  if (!handler) throw new Error("Original resident reader was not installed")
  const binding = async () => undefined
  const source = () => controls.present && controls.binding ? { runtime, handlers, projectionBinding: binding } : undefined
  const controller = new AbortController()
  const request = new Request(origin + mount + "/api/ui/projections/residents", { signal: controller.signal })
  const terminal = () => {
    expect(finished).toHaveLength(seen.length)
    expect(new Set(finished).size).toBe(seen.length)
    seen.forEach((context) => expect(ui.requestFor(context)).toBeUndefined())
  }
  return { controls, hooks, runtime, handler, source, request, controller, terminal, selected,
    read: () => handler.handle(request), health: () => observeSfResidentHealth({ source }, request, stamp) }
}

test("resident projection reads the real distributed inventory through current original leases", async () => {
  const context = await fixture()
  const before = digestSfValue(context.selected)
  const response = await context.read()
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  const result = Schema.decodeUnknownSync(SfProjectionResidents, { onExcessProperty: "error" })(await response.json())
  if (result.status !== "ok") throw new Error("Original resident inventory failed")
  expect(result.context).toEqual(stamp)
  expect(result.value.profiles.map((entry) => entry.id).sort()).toEqual(["sf_finance", "sf_maestro", "sf_portfolio", "sf_procurement", "sf_reviewer"])
  expect(digestSfValue(context.selected)).toBe(before)
  const text = JSON.stringify(result.value)
  for (const key of ["sourcePath", "sourceDigest", "instructionsDigest", "manifestDigest", "maxSteps", "lease", "binding", "nativeSessionId"])
    expect(text).not.toContain('"' + key + '"')
  expect(await context.health()).toEqual([{ operationId: "projection.residents", state: "ready", reason: null, operational: true }])
  context.terminal()
})

test("resident inventory reveals only operations admitted for this principal", async () => {
  const context = await fixture()
  context.controls.operations = new Set(["sf_case_read"])
  const response = await context.read()
  expect(response.status).toBe(200)
  const result = Schema.decodeUnknownSync(SfProjectionResidents)(await response.json())
  if (result.status !== "ok") throw new Error("Restricted resident read failed")
  expect(result.value.profiles.length).toBeGreaterThan(0)
  for (const profile of result.value.profiles)
    for (const skill of profile.skills) expect(skill.allowedOperations).toEqual(["sf_case_read"])
  context.controls.operations.clear()
  const empty = Schema.decodeUnknownSync(SfProjectionResidents)(await (await context.read()).json())
  expect(empty.status).toBe("ok")
  if (empty.status === "ok") expect(empty.value.profiles).toEqual([])
  context.terminal()
})

test("resident private read denial releases no inventory and cannot publish readiness", async () => {
  const context = await fixture()
  context.controls.reads = false
  const response = await context.read()
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ status: "denied" })
  expect(await context.health()).toEqual([])
  context.terminal()
})

test("resident health requires the original reader and mounted route identity", async () => {
  const context = await fixture()
  context.controls.binding = false
  expect(await context.health()).toEqual([])
  context.controls.binding = true
  expect(await observeSfResidentHealth({ source: () => ({
    runtime: context.runtime, handlers: [{ operationId: "projection.residents", handle: context.handler.handle }],
    projectionBinding: async () => undefined,
  }) }, context.request, stamp)).toEqual([])
  context.terminal()
})

for (const mutation of ["principal", "access", "registry", "abort", "binding"] as const) {
  test("resident reader rejects " + mutation + " change during original operation admission", async () => {
    const context = await fixture()
    let changed = false
    context.hooks.authorize = async (operation) => {
      if (changed || operation === "sf-human:analysis.read") return
      changed = true
      if (mutation === "principal") context.controls.principal = "another-person"
      if (mutation === "access") context.controls.revision = "revoked-access"
      if (mutation === "registry") context.selected[0]!.profile.mission = "Changed source while awaiting admission"
      if (mutation === "abort") context.controller.abort()
      if (mutation === "binding") context.controls.present = false
    }
    expect(await context.health()).toEqual([])
    expect(changed).toBe(true)
    context.terminal()
  })
}

test("resident health rejects source disposal during lease cleanup", async () => {
  const context = await fixture()
  context.hooks.finish = () => { context.controls.binding = false }
  expect(await context.health()).toEqual([])
  context.terminal()
})

test("resident GET validates its original route and origin before reading authority", async () => {
  const context = await fixture()
  const response = await context.handler.handle(new Request(origin + mount + "/api/ui/projections/residents?profile=sf_maestro"))
  expect(response.status).toBe(400)
  const crossSite = await context.handler.handle(new Request(origin + mount + "/api/ui/projections/residents", {
    headers: { origin: "https://unrelated.example", "sec-fetch-site": "cross-site" },
  }))
  expect(crossSite.status).toBe(400)
  context.terminal()
})
