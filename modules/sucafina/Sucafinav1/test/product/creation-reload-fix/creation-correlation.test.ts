import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("96: lost ACK, browser reload and SQLite restart recover one original case and receipt; equal new intention stays distinct", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-creation-reload-"))
  await chmod(directory, 0o700)
  const actors = { alice: { allowed: true, revision: "access-alice" }, bob: { allowed: true, revision: "access-bob" } }
  const environment = { time: Date.parse("2026-11-15T00:00:00Z"), id: 0, request: new Request("https://sf.test/") }
  const makeRequest = (principal: "alice" | "bob", key: string, method: "GET" | "POST") =>
    new Request("https://sf.test/sf/dashboard?sf=workbench-command", {
      method, headers: { "actor": principal, ...(method === "POST" || method === "GET" ? { "Idempotency-Key": key } : {}) },
      ...(method === "POST" ? { body: "{}", headers: { actor: principal, "Idempotency-Key": key, "Content-Type": "application/json" } } : {}),
    })
  const binding = (principal: "alice" | "bob" = "alice", expiresAt = "2100-01-01T00:00:00Z") => ({
    kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: principal,
      requestId: "read-" + randomUUID(), policyVersion: "policy", accessRevision: actors[principal].revision, expiresAt }, lease: {},
  }) as unknown as TrustedUiContext
  const evidence: BusinessContextService = {
    context: async () => [], resolve: async () => { throw new Error("unexpected evidence resolve") },
    recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected ledger emission") },
  }
  const permitted = (context: TrustedDomainContext) => {
    if (context.kind !== "ui") return false
    const principal = context.binding.principalRef as "alice" | "bob"
    return (principal === "alice" || principal === "bob") && actors[principal].allowed &&
      actors[principal].revision === context.binding.accessRevision &&
      environment.request.headers.get("actor") === principal &&
      Date.parse(context.binding.expiresAt) > environment.time && !environment.request.signal.aborted
  }
  const target = { ref: "sf-workspace:install", incarnation: "install" }
  const open = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({ persistence: store, createId: () => "sf-state-incarnation",
      resolveTarget: async () => ({ incarnation: target.incarnation }),
      authorize: async (request) => {
        const principal = request.headers.get("actor")
        if (principal !== "alice" && principal !== "bob" || !actors[principal].allowed) return undefined
        return { principalRef: principal, policyVersion: "policy", accessRevision: actors[principal].revision }
      },
    })
    const cases = createDecisionCasePort({
      state, host: { requestFor: (context) => permitted(context) ? environment.request : undefined,
        revalidate: async (context) => permitted(context) },
      creationTarget: target,
      operationIdentity: (context) => {
        if (!permitted(context)) return undefined
        const key = environment.request.headers.get("Idempotency-Key")
        return key ? digestSfValue({ operation: "sf_case_draft", key }) : undefined
      },
      authorizeCase: async (value, context) => permitted(context) && value.participants.includes(context.binding.principalRef),
      verifyScenarioOperations: async (_value, context) => permitted(context),
      evidence, createId: () => "case-id-" + ++environment.id,
      now: () => "2026-11-15T00:00:00Z",
    })
    return { store, state, cases }
  }
  const payload = { objective: "Same deliberate wording", horizon: { start: "2027-01-01", end: "2027-12-31" },
    currency: "USD", criteria: ["cost", "risk"], sourceRefs: [] }
  const keyA = randomUUID(), keyB = randomUUID()
  let opened: Awaited<ReturnType<typeof open>> | undefined
  try {
    opened = await open()
    environment.request = makeRequest("alice", keyA, "GET")
    const alice = binding()
    // A GET lookup before an uncertain POST completes must never create a case.
    expect(await opened.cases.recoverCreation(keyA, alice)).toEqual({ status: "ok", value: { state: "missing" } })
    environment.request = makeRequest("alice", keyA, "POST")
    const created = await opened.cases.draft(payload, alice)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") throw new Error("initial C08 write failed")
    const originalRef = encodeCaseRef(created.value)
    const before = await opened.state.read(environment.request, "cases", (state) => ({
      cases: Object.keys(state.cases), transactions: Object.keys(state.transactions), version: state.versions.cases,
    }))
    expect(before.status).toBe("ok")
    if (before.status !== "ok") throw new Error("initial state observation failed")
    expect(before.value.cases).toHaveLength(1)
    expect(before.value.transactions).toHaveLength(1)

    // Simulate a committed reply lost by transport, then reload as a new request.
    // Only the original opaque key survives, not the original request body/ref.
    environment.request = makeRequest("alice", keyA, "GET")
    const reloaded = await opened.cases.recoverCreation(keyA, binding())
    expect(reloaded).toMatchObject({ status: "ok", value: { state: "committed", caseRef: originalRef } })
    if (reloaded.status !== "ok" || reloaded.value.state !== "committed") throw new Error("receipt not recovered")
    const receipt = reloaded.value.receipt
    expect(receipt.commandDigest).toBe(digestSfValue(payload))
    expect(receipt.storageVersion).toBe(before.storageVersion)
    const after = await opened.state.read(environment.request, "cases", (state) => ({
      cases: Object.keys(state.cases), transactions: Object.keys(state.transactions), version: state.versions.cases,
    }))
    expect(after.status).toBe("ok")
    if (after.status === "ok") expect(after.value).toEqual(before.value)

    // Exact POST retry is authorized but C08 returns the original result with no second effect.
    environment.request = makeRequest("alice", keyA, "POST")
    const retry = await opened.cases.draft(payload, binding())
    expect(retry).toEqual(created)
    environment.request = makeRequest("alice", keyA, "GET")
    const reread = await opened.cases.recoverCreation(keyA, binding())
    expect(reread).toEqual(reloaded)

    // An altered body with the same command identity conflicts, never overwrites.
    environment.request = makeRequest("alice", keyA, "POST")
    const changed = await opened.cases.draft({ ...payload, objective: "Changed without new intention" }, binding())
    expect(changed).toEqual({ status: "conflict", reason: "idempotency-content-changed" })

    // The same text, deliberately created with a second UUID, is a distinct case.
    environment.request = makeRequest("alice", keyB, "POST")
    const second = await opened.cases.draft(payload, binding())
    expect(second.status).toBe("ok")
    if (second.status !== "ok") throw new Error("second deliberate case failed")
    expect(encodeCaseRef(second.value)).not.toBe(originalRef)
    expect(second.value.id).not.toBe(created.value.id)
    const two = await opened.state.read(environment.request, "cases", (state) => ({
      cases: Object.keys(state.cases), transactions: Object.keys(state.transactions), version: state.versions.cases,
    }))
    expect(two.status).toBe("ok")
    if (two.status === "ok") {
      expect(two.value.cases).toHaveLength(2)
      expect(two.value.transactions).toHaveLength(2)
    }

    // The C08 ledger and case identities, not browser outputRef, survive restart.
    await opened.store.dispose()
    opened = await open()
    environment.request = makeRequest("alice", keyA, "GET")
    expect(await opened.cases.recoverCreation(keyA, binding())).toEqual(reloaded)
    environment.request = makeRequest("alice", keyB, "GET")
    expect((await opened.cases.recoverCreation(keyB, binding())).status).toBe("ok")

    // A different principal cannot correlate the original key with the case.
    environment.request = makeRequest("bob", keyA, "GET")
    const other = await opened.cases.recoverCreation(keyA, binding("bob"))
    expect(other).toEqual({ status: "ok", value: { state: "missing" } })
    expect(JSON.stringify(other)).not.toContain(originalRef)

    // Revoked grants, changed revision and expired UI leases never egress a ref.
    actors.alice.allowed = false
    environment.request = makeRequest("alice", keyA, "GET")
    expect((await opened.cases.recoverCreation(keyA, binding())).status).toBe("denied")
    actors.alice.allowed = true
    const stale = binding()
    actors.alice.revision = "access-revoked-replaced"
    expect((await opened.cases.recoverCreation(keyA, stale)).status).toBe("denied")
    environment.request = makeRequest("alice", keyA, "GET")
    expect((await opened.cases.recoverCreation(keyA, binding("alice", "2020-01-01T00:00:00Z"))).status).toBe("denied")
    actors.alice.revision = "access-alice"

    // A case with a reused ID but a new physical incarnation must not be emitted.
    await opened.store.transaction("dashboard", async (snapshot) => {
      const product = snapshot.data.__sfProductV1 as { cases: Record<string, { incarnation: string }> }
      product.cases[created.value.id]!.incarnation = "replaced-incarnation"
      return { commit: true, value: undefined }
    })
    environment.request = makeRequest("alice", keyA, "GET")
    const replaced = await opened.cases.recoverCreation(keyA, binding())
    expect(replaced.status).toBe("denied")
    expect(JSON.stringify(replaced)).not.toContain(originalRef)
    const final = await opened.state.read(environment.request, "cases", (state) => ({
      cases: Object.keys(state.cases), transactions: Object.keys(state.transactions),
    }))
    expect(final.status).toBe("ok")
    if (final.status === "ok") {
      expect(final.value.cases).toHaveLength(2)
      expect(final.value.transactions).toHaveLength(2)
    }
  } finally {
    await opened?.store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 180_000)
