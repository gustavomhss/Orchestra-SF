import { expect, test } from "bun:test"
import path from "node:path"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createEmbeddedRoutes } from "@orchestra/server/routes"
import { Context, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { ProductHost } from "../src/host.ts"
import { createSfHostRuntime } from "../src/sucafina-product/host-context.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { createSfWorkbenchHttp } from "../../../modules/sucafina/Sucafinav1/product/interface/http.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

test("the actual server root registers resident agents and skills and releases the host", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-host-composition-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "business"))
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: () => crypto.randomUUID(),
    projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  const actor = { active: false }
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: {}, suppliers: [], settings: { currency: "USD" } }
      return { commit: true, value: undefined }
    })
    const runtime = await createSfHostRuntime({ installationId: "installation-1", directory, sourceRoot: path.resolve(import.meta.dir,
      "../../../modules/sucafina/Sucafinav1/product/ai"), origin: "http://localhost", mount: "/sucafina", persistence,
      authenticate: async (_request, context) => actor.active && context ? { id: "person", canWrite: true,
        roles: [{ surface: context.surface, role: context.surface === "procurement" ? "requester" : "viewer" }] } : null,
      grants: [{ principalRef: "person", namespaces: ["cases"], operations: ["sf_work_list", "sf_case_read"] }],
      environment: async () => ({ at: new Date().toISOString(), id: () => crypto.randomUUID(), directory: [] }) })
    const workbench = createSfWorkbenchHttp({ origin: "http://localhost", mount: "/sucafina", runtime: () => runtime.services?.() })
    const web = HttpRouter.toWebHandler(createEmbeddedRoutes({ host: [...ProductHost.contributions(), ...runtime.contributions] })
      .pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true, memoMap: Layer.makeMemoMapUnsafe() })
    try {
      const read = async (pathname: string) => {
        const url = new URL(pathname, "http://localhost")
        url.searchParams.set("location[directory]", directory)
        const response = await web.handler(new Request(url), Context.makeUnsafe<unknown>(new Map()))
        expect(response.status).toBe(200)
        return response.json()
      }
      const agents = await read("/api/agent") as { data: { id: string; engine?: string; steps?: number }[] }
      const skills = await read("/api/skill/catalog") as { data: { name: string }[] }
      const services = runtime.services?.()
      if (!services) throw new Error("host services missing")
      expect(services.selected).toHaveLength(5)
      expect(new Set(services.selected.flatMap((selection) => selection.skills.map((skill) => skill.id))).size).toBe(18)
      for (const selection of services.selected) {
        const agent = agents.data.find((item) => item.id === selection.profile.id)
        expect(agent?.engine).toBe("orchestra")
        expect(agent?.steps).toBe(selection.profile.maxSteps)
        for (const skill of selection.skills) expect(skills.data.some((item) => item.name === skill.id)).toBe(true)
      }
      const denied = await services.ui.admit(new Request("http://localhost/sucafina/dashboard"), "sf_case_read", "a".repeat(64))
      expect(denied.status).toBe("denied")
      const unauthenticated = await workbench(new Request("http://localhost/sucafina/dashboard?sf=workbench"), "dashboard")
      expect(unauthenticated?.status).toBe(403)
      actor.active = true
      const request = new Request("http://localhost/sucafina/dashboard")
      const seeded = await services.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case",
        commandDigest: "a".repeat(64), targetRef: services.creationTarget.ref, targetIncarnation: services.creationTarget.incarnation }, async (state) => {
        state.cases.case = { id: "case", incarnation: "case-inc", version: 1, state: "draft", objective: "Review",
          horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [], participants: ["person"],
          sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
        return { commit: true, value: true }
      })
      expect(seeded.status).toBe("ok")
      const payload = { caseRef: encodeCaseRef({ id: "case", incarnation: "case-inc" }) }
      const casePage = await workbench(new Request(`http://localhost/sucafina/dashboard?sf=workbench-case&caseRef=${encodeURIComponent(payload.caseRef)}`), "dashboard")
      expect(casePage?.status).toBe(200)
      expect(await casePage?.text()).toContain("Review")
      const duplicateMode = await workbench(new Request(`http://localhost/sucafina/dashboard?sf=workbench&sf=workbench`), "dashboard")
      expect(duplicateMode?.status).toBe(400)
      const caseCall = await services.ui.admit(request, "sf_case_read", digestSfValue(payload))
      expect(caseCall.status).toBe("ok")
      if (caseCall.status !== "ok") return
      const result = await services.dispatch("sf_case_read", payload, caseCall.value)
      expect(result.status).toBe("ok")
      services.ui.finish(caseCall.value)
      const period = { start: "2026-01-01", end: "2026-12-31" }
      const digest = digestSfValue({ purpose: "work-selection", period })
      const admitted = await services.ui.admit(new Request("http://localhost/sucafina/dashboard"), "sf_work_list", digest)
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") return
      expect(await services.ui.validate(admitted.value, "sf_work_list", digest)).toBe(true)
      if (!services.procurementSelections) throw new Error("work selection service missing")
      const selected = await services.procurementSelections.create(admitted.value, period)
      expect(selected.status).toBe("ok")
      if (selected.status === "ok") expect(selected.value).toMatchObject({ label: "Procurement requests", period })
      actor.active = false
      expect((await services.procurementSelections.create(admitted.value, period)).status).toBe("denied")
      services.ui.finish(admitted.value)
    } finally { await web.dispose() }
    expect(runtime.identity()).toBeUndefined()
    expect(runtime.services?.()).toBeUndefined()
  } finally { await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 60_000)
