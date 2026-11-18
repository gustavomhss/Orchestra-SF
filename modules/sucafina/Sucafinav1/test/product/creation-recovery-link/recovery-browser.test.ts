import { expect, test } from "bun:test"
import type { Browser, BrowserContext } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { launchWp01Browser, closeWp01Browser } from "../wp01/browser-fixture.ts"
import { createSfCreationRecoveryHttp } from "../../../../../../apps/cli/src/sucafina-product/creation-recovery-http.ts"
import { decisionCreateForm, decisionCreateFromContext, decisionCreateScript, scopeDecisionCreateForm } from "../../../product/ui/decision-create.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../product/contracts/schema-admission.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"

/** Named WP01 Linux browser selection; this test must run between startup and lifecycle. */
test("111/browser: same opaque pending key survives lost ACK, restart and normal/contextual view switching", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-creation-link-browser-"))
  await chmod(directory, 0o700)
  const actors = { alice: { allowed: true, revision: "a1" }, bob: { allowed: true, revision: "b1" } }
  const identity = (request: Request) => {
    const actor = request.headers.get("actor")
    if (actor !== "alice" && actor !== "bob" || !actors[actor].allowed) return undefined
    return { installationId: "install", projectId: "project", principalRef: actor,
      policyVersion: "policy", accessRevision: actors[actor].revision }
  }
  const scopeFor = (actor: string) => digestSfValue({
    installationId: "install", projectId: "project", principalRef: actor, policyVersion: "policy",
  })
  const evidence: BusinessContextService = {
    context: async () => [],
    resolve: async () => { throw new Error("unexpected source resolve") },
    recall: async () => [],
    emitFromLedger: async () => { throw new Error("unexpected ledger emission") },
  }
  const state = { nextId: 0, loseNextAck: true,
    posts: [] as { key: string; actor: string; objective: string }[],
    recovered: [] as { key: string; actor: string; state: string }[] }
  const makeRuntime = async () => {
    const store = await openLocalStore(directory)
    const ui = createSfUiAuthority({
      authorize: async (request, operation) => ["sf_case_read", "sf_case_draft"].includes(operation) ? identity(request) : undefined,
      commandIdentity: async (request, operation) => {
        if (request.method === "GET" || request.method === "HEAD") return randomUUID()
        const key = request.headers.get("Idempotency-Key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      },
      createId: randomUUID, now: Date.now,
    })
    const productState = createSfProductState({
      persistence: store, createId: () => "root-incarnation",
      resolveTarget: async () => ({ incarnation: "install" }),
      authorize: async (request) => {
        const actor = identity(request)
        return actor && { principalRef: actor.principalRef, policyVersion: actor.policyVersion,
          accessRevision: actor.accessRevision }
      },
    })
    const cases = createDecisionCasePort({
      state: productState,
      host: {
        requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
        revalidate: async (context) => context.kind === "ui" && ui.revalidate(context),
      },
      creationTarget: { ref: "sf-workspace:install", incarnation: "install" },
      operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
      authorizeCase: async (value, context) => context.kind === "ui" &&
        value.participants.includes(context.binding.principalRef) && await ui.revalidate(context),
      verifyScenarioOperations: async (_value, context) => context.kind === "ui" && ui.revalidate(context),
      evidence, createId: () => "case-id-" + ++state.nextId, now: () => "2026-11-15T00:00:00Z",
    })
    const recoverCreation = cases.recoverCreation
    if (!recoverCreation) throw new Error("mission96 case-port must be included in the CI snapshot")
    return { store, ui, cases, productState, recoverCreation }
  }
  let runtime: Awaited<ReturnType<typeof makeRuntime>> | undefined
  let server: ReturnType<typeof Bun.serve> | undefined
  let browser: Browser | undefined, context: BrowserContext | undefined
  const json = (value: unknown, code: number) => Response.json(value, { status: code,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  const inspect = async () => {
    const request = new Request("https://sf.test/", { headers: { actor: "alice" } })
    const read = await runtime!.productState.read(request, "cases", (storage) => ({
      cases: Object.keys(storage.cases), transactions: Object.keys(storage.transactions),
      version: storage.versions.cases,
    }))
    if (read.status !== "ok") throw new Error("real SQLite C08 snapshot unavailable")
    return read.value
  }
  try {
    runtime = await makeRuntime()
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 30,
      fetch: async (request) => {
        const url = new URL(request.url)
        if (url.pathname !== "/sf/dashboard") return json({ status: "denied" }, 404)
        const actor = identity(request)
        if (!actor) return json({ status: "denied" }, 403)
        const mode = url.searchParams.get("sf")
        if (mode === "workbench-create-recover") {
          const adapter = createSfCreationRecoveryHttp({ origin: url.origin, mount: "/sf",
            runtime: () => ({ ui: runtime!.ui,
              recoverCreation: async (key, context) => {
                const result = await runtime!.recoverCreation(key, context)
                state.recovered.push({ key, actor: context.binding.principalRef,
                  state: result.status === "ok" ? result.value.state : result.status })
                return result
              } }),
          })
          return await adapter(request, "dashboard") ?? json({ status: "denied" }, 404)
        }
        if (request.method === "GET" && (mode === "workbench" || mode === "workbench-context")) {
          const contextual = mode === "workbench-context"
          // The contextual route here tests read-only pending reconciliation
          // after view switching; context evidence issuance and POST are owned
          // by the installed 52 route and are NOT claimed as proven here.
          const form = contextual
            ? decisionCreateFromContext({ sourceRefs: [],
              period: { start: "2027-01-01", end: "2027-12-31" },
              returnTo: "/sf/dashboard?page=Vendor+Contracts&year=2027#record-example" })
            : decisionCreateForm
          const scoped = scopeDecisionCreateForm(form, scopeFor(actor.principalRef))
          return new Response("<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" +
            scoped + "<script>" + decisionCreateScript + "</script></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
        }
        if (mode === "workbench-case" && request.method === "GET") {
          const value = { caseRef: url.searchParams.get("caseRef") ?? "" }
          const digest = digestSfValue(value)
          const admitted = await runtime!.ui.admit(request, "sf_case_read", digest)
          if (admitted.status !== "ok") return json({ status: "denied" }, 403)
          try {
            if (!await runtime!.ui.validate(admitted.value, "sf_case_read", digest))
              return json({ status: "denied" }, 403)
            const read = await runtime!.cases.read(value, admitted.value)
            if (read.status !== "ok" || !await runtime!.ui.revalidate(admitted.value))
              return json({ status: "denied" }, 403)
            return new Response("<!doctype html><html><body><h1>Saved case</h1>" +
              "<p data-case-id>" + read.value.case.id + "</p></body></html>", {
              headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
            })
          } finally { runtime!.ui.finish(admitted.value) }
        }
        if (mode !== "workbench-command" || request.method !== "POST") return json({ status: "denied" }, 405)
        if (request.headers.get("origin") !== url.origin ||
          request.headers.get("X-SF-Creation-Scope") !== scopeFor(actor.principalRef))
          return json({ status: "denied" }, 403)
        const key = request.headers.get("Idempotency-Key")
        if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key))
          return json({ status: "needs-input" }, 400)
        const parsed: unknown = await request.json().catch(() => undefined)
        if (!parsed || typeof parsed !== "object" || !("operation" in parsed) || !("input" in parsed) ||
          parsed.operation !== "sf_case_draft")
          return json({ status: "needs-input" }, 400)
        const decoded = decodeSfOperationInput("sf_case_draft", parsed.input)
        if (!decoded.ok) return json({ status: "needs-input" }, 400)
        const digest = digestSfValue(decoded.value)
        const admitted = await runtime!.ui.admit(request, "sf_case_draft", digest)
        if (admitted.status !== "ok") return json({ status: "denied" }, 403)
        try {
          if (!await runtime!.ui.validate(admitted.value, "sf_case_draft", digest))
            return json({ status: "denied" }, 403)
          const saved = await runtime!.cases.draft(decoded.value, admitted.value)
          if (saved.status !== "ok")
            return json({ status: saved.status }, saved.status === "conflict" ? 409 : 503)
          state.posts.push({ key, actor: actor.principalRef, objective: decoded.value.objective })
          if (state.loseNextAck) {
            state.loseNextAck = false
            return json({ status: "unavailable" }, 503) // durable C08 commit, lost HTTP ACK
          }
          return json({ status: "ok", outputRef: encodeCaseRef(saved.value) }, 200)
        } finally { runtime!.ui.finish(admitted.value) }
      },
    })
    browser = await launchWp01Browser()
    context = await browser.newContext({ extraHTTPHeaders: { actor: "alice" } })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const base = server.url.origin + "/sf/dashboard"
    const fill = async () => {
      // The normal form lives in a closed details element until a person opens it.
      await page.locator("details:has(form[data-decision-create]) > summary").click()
      await page.getByLabel("Decision objective").fill("Deliberately identical")
      await page.getByLabel("Start", { exact: true }).fill("2027-01-01")
      await page.getByLabel("End", { exact: true }).fill("2027-12-31")
      await page.getByLabel("Currency").fill("USD")
      await page.getByLabel("Criteria, one per line").fill("cost\nrisk")
    }
    await page.goto(base + "?sf=workbench")
    await fill()
    await page.getByRole("button", { name: "Create decision" }).click()
    await page.waitForFunction(() => document.querySelector("[data-decision-create] [role=status]")?.textContent?.includes("unconfirmed"))
    const persisted = await page.evaluate(() => Array.from({ length: localStorage.length }, (_, i) =>
      ({ key: localStorage.key(i), value: localStorage.getItem(localStorage.key(i)!) })))
    expect(persisted).toHaveLength(1)
    expect(persisted[0]?.key).toContain("sf:case-create:pending:v1:" + scopeFor("alice") + ":")
    expect(persisted[0]?.value).toBe("pending")
    expect(JSON.stringify(persisted)).not.toContain("Deliberately identical")
    expect(JSON.stringify(persisted)).not.toContain("Bearer")
    const originalKey = persisted[0]!.key!.split(":").at(-1)!
    expect(state.posts).toHaveLength(1)
    expect(state.posts[0]!.key).toBe(originalKey)
    expect(await inspect()).toMatchObject({ version: 1 })

    await runtime.store.dispose()
    runtime = await makeRuntime()
    // A normal pending intention is recovered by the context form after host
    // restart. The browser supplies only the original UUID, no original body.
    await page.goto(base + "?sf=workbench-context")
    await page.waitForURL((url) => url.searchParams.get("sf") === "workbench-case")
    expect(await page.locator("[data-case-id]").textContent()).toMatch(/^case-id-/)
    expect(state.posts).toHaveLength(1)
    expect(state.recovered).toEqual([{ key: originalKey, actor: "alice", state: "committed" }])
    expect(await page.evaluate(() => localStorage.length)).toBe(0)
    expect(await inspect()).toMatchObject({ version: 1 })

    // A distinct user intention can use identical words but MUST use a new
    // identity and produce exactly one distinct C08 case.
    await page.goto(base + "?sf=workbench")
    await fill()
    await page.getByRole("button", { name: "Create decision" }).click()
    await page.waitForURL((url) => url.searchParams.get("sf") === "workbench-case")
    expect(state.posts).toHaveLength(2)
    expect(state.posts[1]!.key).not.toBe(originalKey)
    expect(state.posts[1]!.objective).toBe("Deliberately identical")
    expect((await inspect()).cases).toHaveLength(2)
    expect((await inspect()).transactions).toHaveLength(2)

    // Leave another committed creation uncertain, then reuse the browser
    // profile with a different actor. Its own scope cannot read Alice's key.
    state.loseNextAck = true
    await page.goto(base + "?sf=workbench")
    await fill()
    await page.getByRole("button", { name: "Create decision" }).click()
    await page.waitForFunction(() => document.querySelector("[data-decision-create] [role=status]")?.textContent?.includes("unconfirmed"))
    const before = { posts: state.posts.length, lookups: state.recovered.length }
    await context.setExtraHTTPHeaders({ actor: "bob" })
    await page.reload({ waitUntil: "domcontentloaded" })
    expect(await page.locator("[data-decision-create] [role=status]").textContent()).not.toContain("original creation")
    expect(state.posts).toHaveLength(before.posts)
    expect(state.recovered).toHaveLength(before.lookups)
    await context.setExtraHTTPHeaders({ actor: "alice" })
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.searchParams.get("sf") === "workbench-case")
    expect(state.recovered.at(-1)?.actor).toBe("alice")
    expect(state.posts).toHaveLength(before.posts)
    expect((await inspect()).cases).toHaveLength(3)
    expect(errors).toEqual([])
  } finally {
    await context?.close()
    if (browser) await closeWp01Browser(browser)
    if (server) await server.stop(true)
    await runtime?.store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 180_000)
