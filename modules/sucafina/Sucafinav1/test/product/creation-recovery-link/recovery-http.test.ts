import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSfCreationRecoveryHttp, type SfCreationRecoveryRuntime } from "../../../../../../apps/cli/src/sucafina-product/creation-recovery-http.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"

test("111/HTTP+C08+SQLite: original key recovers once after restart; actor, revocation and incarnation remain fenced", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-creation-link-"))
  await chmod(directory, 0o700)
  const actors = {
    alice: { allowed: true, revision: "alice-1" },
    bob: { allowed: true, revision: "bob-1" },
  }
  const scope = (actor: "alice" | "bob") => digestSfValue({
    installationId: "install", projectId: "project", principalRef: actor, policyVersion: "policy",
  })
  const authenticated = (request: Request) => {
    const id = request.headers.get("actor")
    if (id !== "alice" && id !== "bob" || !actors[id].allowed) return undefined
    return { installationId: "install", projectId: "project", principalRef: id,
      policyVersion: "policy", accessRevision: actors[id].revision }
  }
  const evidence: BusinessContextService = {
    context: async () => [],
    resolve: async () => { throw new Error("no sources supplied to the case") },
    recall: async () => [],
    emitFromLedger: async () => { throw new Error("no case ledger source requested") },
  }
  let nextId = 0
  const createRuntime = async (targetIncarnation = "install") => {
    const store = await openLocalStore(directory)
    const ui = createSfUiAuthority({
      authorize: async (request, operation) =>
        ["sf_case_read", "sf_case_draft"].includes(operation) ? authenticated(request) : undefined,
      commandIdentity: async (request, operation) => {
        if (request.method === "GET" || request.method === "HEAD") return randomUUID()
        const key = request.headers.get("Idempotency-Key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key)
          ? digestSfValue({ operation, key }) : undefined
      },
      createId: randomUUID, now: Date.now,
    })
    const state = createSfProductState({
      persistence: store, createId: () => "root-incarnation",
      resolveTarget: async () => ({ incarnation: targetIncarnation }),
      authorize: async (request) => {
        const who = authenticated(request)
        return who && { principalRef: who.principalRef, accessRevision: who.accessRevision,
          policyVersion: who.policyVersion }
      },
    })
    const cases = createDecisionCasePort({
      state, host: { requestFor: ui.requestFor, revalidate: ui.revalidate },
      creationTarget: { ref: "sf-workspace:install", incarnation: targetIncarnation },
      operationIdentity: ui.operationIdentity,
      authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await ui.revalidate(context),
      verifyScenarioOperations: async (_value, context) => ui.revalidate(context),
      evidence, createId: () => "case-id-" + ++nextId, now: () => "2026-11-15T00:00:00Z",
    })
    // No replacement lookup is installed here: this is the real case-port
    // function from mission96. An uncomposed C53 MUST fail, not get a fixture PASS.
    const recoverCreation = (cases as typeof cases & {
      recoverCreation?: SfCreationRecoveryRuntime["recoverCreation"]
    }).recoverCreation
    if (!recoverCreation) throw new Error("mission96 case-port recovery not composed")
    const http = createSfCreationRecoveryHttp({
      origin: "https://sf.test", mount: "/sf",
      runtime: () => ({ ui, recoverCreation }),
    })
    return { store, state, ui, cases, http, recoverCreation }
  }
  const payload = { objective: "Deliberately identical decision", horizon: { start: "2027-01-01", end: "2027-12-31" },
    currency: "USD", criteria: ["cost", "risk"], sourceRefs: [] }
  const get = (key: string, actor: "alice" | "bob" = "alice", options: {
    scope?: string; url?: string; method?: "GET" | "POST"; extra?: Record<string, string>
  } = {}) => new Request(options.url ?? "https://sf.test/sf/dashboard?sf=workbench-create-recover", {
    method: options.method ?? "GET", headers: {
      actor, "Idempotency-Key": key, "X-SF-Creation-Scope": options.scope ?? scope(actor),
      ...options.extra,
    },
  })
  const inspect = async (runtime: Awaited<ReturnType<typeof createRuntime>>) => {
    const observed = await runtime.state.read(new Request("https://sf.test/", { headers: { actor: "alice" } }),
      "cases", (state) => ({ cases: Object.keys(state.cases), transactions: Object.keys(state.transactions),
        version: state.versions.cases }))
    if (observed.status !== "ok") throw new Error("durable C08 observation unavailable")
    return observed.value
  }
  const save = async (runtime: Awaited<ReturnType<typeof createRuntime>>, key: string, value = payload) => {
    const request = new Request("https://sf.test/sf/dashboard?sf=workbench-command", {
      method: "POST", headers: {
        actor: "alice", "Idempotency-Key": key, "Content-Type": "application/json",
        origin: "https://sf.test",
      }, body: JSON.stringify({ operation: "sf_case_draft", input: value }),
    })
    const digest = digestSfValue(value)
    const admission = await runtime.ui.admit(request, "sf_case_draft", digest)
    if (admission.status !== "ok") throw new Error("real UI admission failed")
    try {
      if (!await runtime.ui.validate(admission.value, "sf_case_draft", digest))
        throw new Error("original C08 admission was not consumed")
      return await runtime.cases.draft(value, admission.value)
    } finally { runtime.ui.finish(admission.value) }
  }
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined
  const keyA = randomUUID(), keyB = randomUUID()
  try {
    runtime = await createRuntime()
    const empty = await runtime.http(get(keyA), "dashboard")
    expect(empty?.status).toBe(200)
    expect(await empty?.json()).toEqual({ status: "ok", state: "not-found" })

    const savedA = await save(runtime, keyA)
    expect(savedA.status).toBe("ok")
    if (savedA.status !== "ok") throw new Error("C08 failed to create the first case")
    const firstRef = encodeCaseRef(savedA.value)
    const committed = await inspect(runtime)
    expect(committed).toMatchObject({ version: 1 })
    expect(committed.cases).toHaveLength(1)
    expect(committed.transactions).toHaveLength(1)

    const verified = await runtime.http(get(keyA), "dashboard")
    expect(verified?.status).toBe(200)
    expect(await verified?.json()).toMatchObject({
      status: "ok", state: "committed", outputRef: firstRef,
      receipt: { commandDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
    })
    expect(await inspect(runtime)).toEqual(committed) // GET never persists or dispatches.

    const otherWithOriginalScope = await runtime.http(get(keyA, "bob", { scope: scope("alice") }), "dashboard")
    expect(otherWithOriginalScope?.status).toBe(403)
    const otherWithOwnScope = await runtime.http(get(keyA, "bob"), "dashboard")
    expect(otherWithOwnScope?.status).toBe(200)
    expect(await otherWithOwnScope?.json()).toEqual({ status: "ok", state: "not-found" })
    expect(await inspect(runtime)).toEqual(committed)

    expect((await runtime.http(get(keyA.toUpperCase()), "dashboard"))?.status).toBe(400)
    expect((await runtime.http(get(keyA, "alice", { method: "POST" }), "dashboard"))?.status).toBe(405)
    expect((await runtime.http(get(keyA, "alice", { url: "https://sf.test/sf/dashboard?sf=workbench-create-recover&caseRef=x" }), "dashboard"))?.status).toBe(400)
    expect((await runtime.http(get(keyA, "alice", { extra: { "sec-fetch-site": "cross-site" } }), "dashboard"))?.status).toBe(403)
    expect((await runtime.http(get(keyA, "alice", { extra: { origin: "https://evil.test" } }), "dashboard"))?.status).toBe(403)
    expect((await runtime.http(get(keyA), "unknown"))?.status).toBe(403)
    expect(await inspect(runtime)).toEqual(committed)

    // Reload the application, dropping all previous UI leases but reopening
    // the same on-disk SQLite store. No body or caseRef travels to the GET.
    await runtime.store.dispose()
    runtime = await createRuntime()
    const restarted = await runtime.http(get(keyA), "dashboard")
    expect(restarted?.status).toBe(200)
    expect(await restarted?.json()).toMatchObject({ status: "ok", state: "committed", outputRef: firstRef })
    expect(await inspect(runtime)).toEqual(committed)

    const savedB = await save(runtime, keyB)
    expect(savedB.status).toBe("ok")
    if (savedB.status !== "ok") throw new Error("C08 failed to create a deliberate second case")
    expect(encodeCaseRef(savedB.value)).not.toBe(firstRef)
    expect(await inspect(runtime)).toMatchObject({ version: 2 })
    expect((await inspect(runtime)).transactions).toHaveLength(2)
    expect((await inspect(runtime)).cases).toHaveLength(2)
    const altered = await save(runtime, keyA, { ...payload, objective: "Changed command body" })
    expect(altered.status).toBe("conflict")
    expect((await inspect(runtime)).cases).toHaveLength(2)

    actors.alice.allowed = false
    expect((await runtime.http(get(keyA), "dashboard"))?.status).toBe(403)
    actors.alice.allowed = true
    const lateRevocation = createSfCreationRecoveryHttp({
      origin: "https://sf.test", mount: "/sf",
      runtime: () => ({
        ui: runtime!.ui,
        recoverCreation: async (key, context) => {
          const result = await runtime!.recoverCreation(key, context)
          actors.alice.allowed = false
          return result
        },
      }),
    })
    const deniedAtEgress = await lateRevocation(get(keyA), "dashboard")
    expect(deniedAtEgress?.status).toBe(403)
    expect(JSON.stringify(await deniedAtEgress?.json())).not.toContain(firstRef)
    actors.alice.allowed = true

    await runtime.store.dispose()
    runtime = await createRuntime("different-installation-incarnation")
    const replaced = await runtime.http(get(keyA), "dashboard")
    expect((await replaced?.json())?.outputRef).not.toBe(firstRef)
    expect(await runtime.http(get(keyB), "dashboard")).toBeDefined()
  } finally {
    await runtime?.store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 180_000)
