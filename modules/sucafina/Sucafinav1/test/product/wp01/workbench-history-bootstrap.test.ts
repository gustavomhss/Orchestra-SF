import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { withSfAnalysisHistory } from "../../../product/interface/analysis-history-bootstrap.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"

/** Component boundary tests use the real private lease registries and an explicit
 * test policy/list port. They are not a native execution or installed witness. */
async function fixture(method = "GET") {
  const origin = "https://history-contract.invalid"
  const controller = new AbortController()
  const request = new Request(origin + "/sucafina/dashboard?sf=workbench-case", { method, signal: controller.signal })
  const caseRef = { id: "history-case", incarnation: "history-incarnation", version: 2 }
  const state = { allowed: true, readAllowed: true, principalRef: "history-reader", lists: 0, wrongIntent: false }
  const contexts: TrustedUiContext[] = []
  const observations: { request?: Request; authorized?: boolean; caseRef?: typeof caseRef; distinct?: boolean } = {}
  const registry = createSfUiAuthority({
    now: Date.now, createId: randomUUID, commandIdentity: async () => randomUUID(),
    privateCommands: ["sf-human:analysis.read", "sf-human:analysis.cancel"],
    authorize: async (incoming, operation) => incoming === request && state.allowed && (operation !== "sf-human:analysis.read" || state.readAllowed)
      ? { installationId: "installation", projectId: "project", principalRef: state.principalRef, policyVersion: "policy", accessRevision: "access" } : undefined,
  })
  const ui: SfHostServices["ui"] = { ...registry,
    admit: async (incoming, operation, digest) => {
      const admitted = await registry.admit(incoming, state.wrongIntent && operation === "sf-human:analysis.read" ? "sf-human:analysis.cancel" : operation, digest)
      if (admitted.status === "ok" && operation === "sf-human:analysis.read") contexts.push(admitted.value)
      return admitted
    },
  }
  const admitted = await ui.admit(request, "sf_case_read", digestSfValue({ caseRef: "opaque-case-reference" }))
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_case_read", digestSfValue({ caseRef: "opaque-case-reference" })))
    throw new Error("fixture case lease unavailable")
  const parent = admitted.value
  const human = createSfHumanAuthority({ origin, ui })
  const value = [{ runRef: "saved-analysis", state: "ready" as const, version: 3, outputRef: "saved-output" }]
  const unavailable = async () => ({ status: "unavailable" as const, reason: "history-test-port" })
  const analyses: NonNullable<SfHostServices["analyses"]> = { start: unavailable, read: unavailable, output: unavailable, cancel: unavailable,
    list: async (context, incomingCase) => {
      state.lists++
      observations.request = ui.requestFor(context)
      observations.authorized = await human.authorize(context, "analysis.read", { caseRef: incomingCase })
      observations.caseRef = incomingCase
      observations.distinct = context !== parent
      return observations.authorized ? { status: "ok", value } : { status: "denied", reason: "history-test-authority" }
    },
  }
  const runtime = { ui, analyses }
  const denied = () => ({ status: "denied" as const, reason: "bootstrap-authority-changed" })
  const render = async (history: Awaited<ReturnType<typeof analyses.list>>) => history
  const input = { request, parent, runtime, caseRef, render, denied }
  return { input, ui, human, state, observations, contexts, value, controller, parent, request, caseRef }
}

for (const method of ["GET", "HEAD"]) test(`history bootstrap uses its own consumed read lease on the original ${method}`, async () => {
  const f = await fixture(method)
  expect(await withSfAnalysisHistory(f.input)).toEqual({ status: "ok", value: f.value })
  expect(f.observations).toEqual({ request: f.request, authorized: true, caseRef: f.caseRef, distinct: true })
  expect(f.state.lists).toBe(1)
  expect(f.contexts).toHaveLength(1)
  expect(await f.ui.revalidate(f.contexts[0]!)).toBe(false)
  expect(await f.ui.revalidate(f.parent)).toBe(true)
  // Composed reads must not broaden the public human-command admission method.
  expect((await f.human.admit(f.request, "analysis.read", { caseRef: f.caseRef })).status).toBe("denied")
  f.ui.finish(f.parent)
})

test("case-read access alone renders unavailable history without fabricating an empty list", async () => {
  const f = await fixture()
  f.state.readAllowed = false
  const result = await withSfAnalysisHistory(f.input)
  expect(result).toEqual({ status: "unavailable", reason: "analysis-history-unavailable" })
  expect(f.state.lists).toBe(0)
  expect(f.contexts).toHaveLength(0)
  expect(await f.ui.revalidate(f.parent)).toBe(true)
  f.ui.finish(f.parent)
})

test("a copied request cannot reuse the case lease for bootstrap", async () => {
  const f = await fixture()
  expect(await withSfAnalysisHistory({ ...f.input, request: new Request(f.request) })).toEqual({ status: "denied", reason: "bootstrap-authority-changed" })
  expect(f.state.lists).toBe(0)
  f.ui.finish(f.parent)
})

for (const change of ["identity", "intent"] as const) test(`history bootstrap refuses a mismatched ${change} and finishes its admission`, async () => {
  const f = await fixture()
  if (change === "identity") f.state.principalRef = "another-reader"
  else f.state.wrongIntent = true
  expect(await withSfAnalysisHistory(f.input)).toEqual({ status: "denied", reason: "bootstrap-authority-changed" })
  expect(f.state.lists).toBe(0)
  expect(f.contexts).toHaveLength(1)
  expect(await f.ui.revalidate(f.contexts[0]!)).toBe(false)
  f.ui.finish(f.parent)
})

for (const change of ["grant", "request", "parent"] as const) test(`history egress refuses a ${change} change during rendering and finishes its lease`, async () => {
  const f = await fixture()
  const result = await withSfAnalysisHistory({ ...f.input, render: async (history) => {
    if (change === "grant") f.state.allowed = false
    else if (change === "request") f.controller.abort()
    else f.ui.finish(f.parent)
    return history
  } })
  expect(result).toEqual({ status: "denied", reason: "bootstrap-authority-changed" })
  expect(f.state.lists).toBe(1)
  expect(f.contexts).toHaveLength(1)
  expect(await f.ui.revalidate(f.contexts[0]!)).toBe(false)
  f.ui.finish(f.parent)
})

test("a list port refusal or failure stays unavailable instead of becoming an empty success", async () => {
  for (const failure of ["denied", "throws"] as const) {
    const f = await fixture()
    const runtime = { ...f.input.runtime, analyses: { ...f.input.runtime.analyses, list: async () => {
      if (failure === "throws") throw new Error("list unavailable")
      return { status: "denied" as const, reason: "case-changed" }
    } } }
    const result = await withSfAnalysisHistory({ ...f.input, runtime })
    expect(result).toEqual(failure === "throws" ? { status: "unavailable", reason: "analysis-history-unavailable" } : { status: "denied", reason: "case-changed" })
    expect(await f.ui.revalidate(f.contexts[0]!)).toBe(false)
    f.ui.finish(f.parent)
  }
})

test("rendering failures still release the private history lease", async () => {
  const f = await fixture()
  await expect(withSfAnalysisHistory({ ...f.input, render: async () => { throw new Error("render failed") } })).rejects.toThrow("render failed")
  expect(await f.ui.revalidate(f.contexts[0]!)).toBe(false)
  f.ui.finish(f.parent)
})
