import { expect, test } from "bun:test"
import type { Browser, BrowserContext } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { launchWp01Browser, closeWp01Browser } from "../wp01/browser-fixture.ts"
import { decisionCreateForm, decisionCreateScript, scopeDecisionCreateForm } from "../../../product/ui/decision-create.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../product/contracts/schema-admission.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"

test("96/browser: committed ACK is lost; reload + host restart use GET receipt, not a second POST or CDP outputRef", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-creation-browser-"))
  await chmod(directory, 0o700)
  let browser: Browser | undefined, context: BrowserContext | undefined
  const actors = { alice: { allowed: true, revision: "a1" }, bob: { allowed: true, revision: "b1" } }
  const identity = (request: Request) => {
    const name = request.headers.get("actor")
    if (name !== "alice" && name !== "bob" || !actors[name].allowed) return undefined
    return { installationId: "install", projectId: "project", principalRef: name,
      policyVersion: "policy", accessRevision: actors[name].revision }
  }
  const scopeFor = (principalRef: string) => digestSfValue({
    installationId: "install", projectId: "project", principalRef, policyVersion: "policy",
  })
  const evidence: BusinessContextService = {
    context: async () => [], resolve: async () => { throw new Error("unexpected record resolve") },
    recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected ledger emission") },
  }
  const serverState = { nextId: 0, loseNextAck: true, posts: [] as { key: string; principalRef: string; objective: string; status: number }[],
    recoveries: [] as { key: string; principalRef: string; state: string }[] }
  const createRuntime = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({
      persistence: store, createId: () => "root-incarnation",
      resolveTarget: async () => ({ incarnation: "install" }),
      authorize: async (request) => {
        const actor = identity(request)
        return actor && { principalRef: actor.principalRef, accessRevision: actor.accessRevision, policyVersion: actor.policyVersion }
      },
    })
    const ui = createSfUiAuthority({ authorize: async (request, operation) =>
        ["sf_case_read", "sf_case_draft"].includes(operation) ? identity(request) : undefined,
      commandIdentity: async (request, operation) => {
        if (request.method === "GET" || request.method === "HEAD") return randomUUID()
        const key = request.headers.get("Idempotency-Key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      }, createId: randomUUID, now: Date.now })
    const cases = createDecisionCasePort({
      state,
      host: {
        requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
        revalidate: async (call) => call.kind === "ui" && ui.revalidate(call),
      },
      creationTarget: { ref: "sf-workspace:install", incarnation: "install" },
      operationIdentity: (call) => call.kind === "ui" ? ui.operationIdentity(call) : undefined,
      authorizeCase: async (value, call) => call.kind === "ui" &&
        value.participants.includes(call.binding.principalRef) && await ui.revalidate(call),
      verifyScenarioOperations: async (_value, call) => call.kind === "ui" && ui.revalidate(call),
      evidence, createId: () => "case-" + ++serverState.nextId, now: () => "2026-11-15T00:00:00Z",
    })
    return { store, state, ui, cases }
  }
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined
  let server: ReturnType<typeof Bun.serve> | undefined
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
  const inspect = async () => {
    const request = new Request("http://localhost/", { headers: { actor: "alice" } })
    const value = await runtime!.state.read(request, "cases", (state) => ({
      cases: Object.keys(state.cases), transactions: Object.keys(state.transactions), version: state.versions.cases,
    }))
    if (value.status !== "ok") throw new Error("SQLite case observation unavailable")
    return value.value
  }
  try {
    runtime = await createRuntime()
    server = Bun.serve({
      hostname: "127.0.0.1", port: 0, idleTimeout: 30,
      fetch: async (request) => {
        const current = runtime
        if (!current) return json({ status: "unavailable" }, 503)
        const url = new URL(request.url)
        if (url.pathname !== "/sf/dashboard") return json({ status: "denied" }, 404)
        const actor = identity(request)
        if (!actor) return json({ status: "denied" }, 403)
        if (url.searchParams.get("sf") === "workbench" && request.method === "GET") {
          const form = scopeDecisionCreateForm(decisionCreateForm, scopeFor(actor.principalRef))
          return new Response('<!doctype html><html><head><meta charset="utf-8"></head><body>' +
            form + '<script>' + decisionCreateScript + '</script></body></html>',
            { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
        }
        if (url.searchParams.get("sf") === "workbench-case" && request.method === "GET") {
          const caseRef = url.searchParams.get("caseRef") ?? ""
          const digest = digestSfValue({ caseRef })
          const access = await current.ui.admit(request, "sf_case_read", digest)
          if (access.status !== "ok") return json(access, 403)
          try {
            if (!await current.ui.validate(access.value, "sf_case_read", digest)) return json({ status: "denied" }, 403)
            const read = await current.cases.read({ caseRef }, access.value)
            if (read.status !== "ok") return json(read, 403)
            return new Response('<!doctype html><html><body><h1>Saved case</h1>' +
              '<p data-case-id>' + read.value.case.id + '</p></body></html>',
              { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
          } finally { current.ui.finish(access.value) }
        }
        const suppliedScope = request.headers.get("X-SF-Creation-Scope")
        if (suppliedScope !== scopeFor(actor.principalRef)) return json({ status: "denied" }, 403)
        const key = request.headers.get("Idempotency-Key")
        if (!key || !/^[a-f0-9-]{36}$/.test(key)) return json({ status: "needs-input" }, 400)
        if (url.searchParams.get("sf") === "workbench-create-recover" && request.method === "GET") {
          const digest = digestSfValue({ purpose: "creation-recovery", key })
          const access = await current.ui.admit(request, "sf_case_read", digest)
          if (access.status !== "ok") return json(access, 403)
          try {
            if (!await current.ui.validate(access.value, "sf_case_read", digest)) return json({ status: "denied" }, 403)
            const found = await current.cases.recoverCreation(key, access.value)
            if (found.status !== "ok") return json(found, found.status === "denied" ? 403 : 503)
            serverState.recoveries.push({ key, principalRef: actor.principalRef, state: found.value.state })
            return found.value.state === "committed"
              ? json({ status: "ok", state: "committed", outputRef: found.value.caseRef, receipt: found.value.receipt })
              : json({ status: "ok", state: "not-found" })
          } finally { current.ui.finish(access.value) }
        }
        if (url.searchParams.get("sf") !== "workbench-command" || request.method !== "POST") return json({ status: "denied" }, 405)
        const body: unknown = await request.json().catch(() => undefined)
        if (!body || typeof body !== "object" || !("operation" in body) ||
          body.operation !== "sf_case_draft" || !("input" in body))
          return json({ status: "invalid" }, 400)
        const decoded = decodeSfOperationInput("sf_case_draft", body.input)
        if (!decoded.ok) return json({ status: "invalid" }, 400)
        const digest = digestSfValue(decoded.value)
        const access = await current.ui.admit(request, "sf_case_draft", digest)
        if (access.status !== "ok") return json(access, 403)
        try {
          if (!await current.ui.validate(access.value, "sf_case_draft", digest)) return json({ status: "denied" }, 403)
          const saved = await current.cases.draft(decoded.value, access.value)
          serverState.posts.push({ key, principalRef: actor.principalRef, objective: decoded.value.objective, status: saved.status === "ok" ? 200 : 409 })
          if (saved.status !== "ok") return json(saved, saved.status === "conflict" ? 409 : 503)
          if (serverState.loseNextAck) {
            serverState.loseNextAck = false
            // A real C08 commit took place above, but the browser never gets its ref.
            return json({ status: "unavailable" }, 503)
          }
          return json({ status: "ok", outputRef: encodeCaseRef(saved.value) })
        } finally { current.ui.finish(access.value) }
      },
    })
    const origin = server.url.origin
    browser = await launchWp01Browser()
    context = await browser.newContext({ extraHTTPHeaders: { actor: "alice" } })
    const page = await context.newPage()
    const pageErrors: string[] = []
    page.on("pageerror", (error) => pageErrors.push(error.message))
    const main = origin + "/sf/dashboard?sf=workbench"
    const fill = async () => {
      await page.getByLabel("Decision objective").fill("Same deliberate wording")
      await page.getByLabel("Start", { exact: true }).fill("2027-01-01")
      await page.getByLabel("End", { exact: true }).fill("2027-12-31")
      await page.getByLabel("Currency").fill("USD")
      await page.getByLabel("Criteria, one per line").fill("cost\nrisk")
    }
    await page.goto(main)
    await fill()
    await page.getByRole("button", { name: "Create decision" }).click()
    await page.waitForFunction(() => document.querySelector('[data-decision-create] [role=status]')?.textContent?.includes("unconfirmed"))
    expect(await inspect()).toMatchObject({ cases: [expect.any(String)], transactions: [expect.any(String)], version: 1 })
    const savedLocal = await page.evaluate(() => Array.from({ length: localStorage.length }, (_, i) => ({
      key: localStorage.key(i), value: localStorage.getItem(localStorage.key(i)!),
    })))
    expect(savedLocal).toHaveLength(1)
    expect(savedLocal[0]!.key).toContain("sf:case-create:pending:v1:" + scopeFor("alice") + ":")
    expect(savedLocal[0]!.value).toBe("pending")
    expect(JSON.stringify(savedLocal)).not.toContain("Same deliberate wording")
    expect(JSON.stringify(savedLocal)).not.toContain("authorization")
    expect(JSON.stringify(savedLocal)).not.toContain("Bearer ")
    const originalKey = savedLocal[0]!.key!.split(":").at(-1)!
    expect(serverState.posts).toHaveLength(1)
    expect(serverState.posts[0]!.key).toBe(originalKey)

    // Recreate all host leases/state port objects against the same SQLite files.
    await runtime.store.dispose()
    runtime = await createRuntime()
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.searchParams.get("sf") === "workbench-case")
    expect(await page.locator("[data-case-id]").textContent()).toMatch(/^case-/)
    expect(serverState.posts).toHaveLength(1)
    expect(serverState.recoveries).toEqual([{ key: originalKey, principalRef: "alice", state: "committed" }])
    expect(await inspect()).toMatchObject({ cases: [expect.any(String)], transactions: [expect.any(String)], version: 1 })
    expect(await page.evaluate(() => localStorage.length)).toBe(0)

    // Intentional equal-text creation must use a different opaque key.
    await page.goto(main)
    await fill()
    await page.getByRole("button", { name: "Create decision" }).click()
    await page.waitForURL((url) => url.searchParams.get("sf") === "workbench-case")
    expect(serverState.posts).toHaveLength(2)
    expect(serverState.posts[1]!.key).not.toBe(originalKey)
    expect(serverState.posts[1]!.objective).toBe("Same deliberate wording")
    expect(await inspect()).toMatchObject({
      cases: [expect.any(String), expect.any(String)],
      transactions: [expect.any(String), expect.any(String)], version: 2,
    })

    // Changed content on an earlier key cannot be silently replayed.
    const altered = { operation: "sf_case_draft", input: { objective: "Different body",
      horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["cost", "risk"], sourceRefs: [] } }
    const changedResponse = await fetch(origin + "/sf/dashboard?sf=workbench-command", {
      method: "POST", headers: { actor: "alice", origin, "Content-Type": "application/json",
        "X-SF-Creation-Scope": scopeFor("alice"), "Idempotency-Key": originalKey }, body: JSON.stringify(altered),
    })
    expect(changedResponse.status).toBe(409)
    expect(await inspect()).toMatchObject({ cases: [expect.any(String), expect.any(String)], version: 2 })

    // Browser profile is reused by another principal; its own scope must not
    // disclose the previous principal's saved key or auto-replay a POST.
    serverState.loseNextAck = true
    await page.goto(main)
    await fill()
    await page.getByRole("button", { name: "Create decision" }).click()
    await page.waitForFunction(() => document.querySelector('[data-decision-create] [role=status]')?.textContent?.includes("unconfirmed"))
    expect(await page.evaluate(() => localStorage.length)).toBe(1)
    const recoveriesBeforeOther = serverState.recoveries.length
    const postsBeforeOther = serverState.posts.length
    await context.setExtraHTTPHeaders({ actor: "bob" })
    await page.reload({ waitUntil: "domcontentloaded" })
    expect(await page.locator("[data-decision-create] [role=status]").textContent()).not.toContain("original creation")
    expect(serverState.posts).toHaveLength(postsBeforeOther)
    expect(serverState.recoveries).toHaveLength(recoveriesBeforeOther)
    await context.setExtraHTTPHeaders({ actor: "alice" })
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.searchParams.get("sf") === "workbench-case")
    expect(serverState.recoveries.at(-1)).toMatchObject({ principalRef: "alice", state: "committed" })
    expect(serverState.posts).toHaveLength(postsBeforeOther)
    expect(await inspect()).toMatchObject({ cases: [expect.any(String), expect.any(String), expect.any(String)], version: 3 })
    expect(pageErrors).toEqual([])
  } finally {
    await context?.close()
    if (browser) await closeWp01Browser(browser)
    if (server) await server.stop(true)
    await runtime?.store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 180_000)
