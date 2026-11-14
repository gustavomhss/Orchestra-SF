import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Schema } from "effect"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { LocalStore } from "../../../../runtime/local-contract.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../../../product/integration/product-authority.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../../product/contracts/resident-ai.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { selection } from "../resident-runtime/fixture.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"

async function fixture(grants: readonly SfProductGrant[], work: (input: { product: ReturnType<typeof createSfProductAuthority>; request: Request; location: Location.Ref; persistence: LocalStore; actor: { write: boolean; active: boolean }; changes: { role: string; mutateAuth: boolean; mutateInspect: boolean; session?: SessionSchema.Info } }) => Promise<void>, options: { rejectNested?: boolean } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-product-authority-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(join(directory, "store"))
  const callback = { active: false }
  const persistence: LocalStore = options.rejectNested ? { ...driver, transaction: (surface, work, transactionOptions) => {
    if (callback.active) throw new Error("Cross-surface nested transaction forbidden")
    return driver.transaction(surface, async (snapshot, blobs) => {
      callback.active = true
      try { return await work(snapshot, blobs) }
      finally { callback.active = false }
    }, transactionOptions)
  } } : driver
  const actor = { write: true, active: true }
  const changes: { role: string; mutateAuth: boolean; mutateInspect: boolean; session?: SessionSchema.Info } = { role: "viewer", mutateAuth: false, mutateInspect: false }
  const request = new Request("https://example.test/product")
  const identity = { installationId: "installation", hostId: "host-epoch", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const product = createSfProductAuthority({ identity: () => identity, installationId: "installation", origin: "https://example.test",
    policyVersion: "policy", persistence, grants, now: Date.now, createId: () => crypto.randomUUID(),
    authenticate: async (_request, context) => {
      if (changes.mutateAuth) identity.hostId = "changed-during-auth"
      return !actor.active || !context ? null : { id: "person", canWrite: actor.write,
        roles: [{ surface: context.surface, role: context.surface === "dashboard" ? changes.role : "viewer" }] }
    },
    environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }),
    commandIdentity: async () => "stable-command", inspectSession: async () => {
      if (changes.mutateInspect) identity.hostId = "changed-during-inspection"
      return changes.session
    },
    verifySelection: async () => true, verifySkillReceipt: async () => true, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  try {
    await work({ product, request, location: identity.location, persistence, actor, changes })
  } finally {
    await persistence.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

test("product authority revalidates current surfaces without opening a nested transaction", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases"], operations: ["sf_context_get"] }], async ({ product, request }) => {
    const admitted = await product.ui.admit(request, "sf_context_get", "a".repeat(64))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const result = await product.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0,
      targetRef: product.creationTarget.ref, targetIncarnation: product.creationTarget.incarnation,
      idempotencyKey: "nested-free", commandDigest: "b".repeat(64) }, async () => ({ commit: false, value: await product.ui.revalidate(admitted.value) }))
    expect(result.status).toBe("preview")
    if (result.status === "preview") expect(result.value).toBe(true)
    product.ui.finish(admitted.value)
  }, { rejectNested: true })
})

test("human writes require their own action grant and cannot borrow a consumed read lease", async () => {
  await fixture([{ principalRef: "person", namespaces: ["threads"], operations: ["sf_context_get"] }], async ({ product, request }) => {
    const payload = { threadId: "thread", body: "Human reply" }
    const read = await product.ui.admit(request, "sf_context_get", digestSfValue(payload))
    expect(read.status).toBe("ok")
    if (read.status !== "ok") return
    expect(await product.ui.validate(read.value, "sf_context_get", digestSfValue(payload))).toBe(true)
    expect(await product.human.authorize(read.value, "collaboration.thread.reply", payload)).toBe(false)
    const post = new Request(request, { method: "POST", headers: { origin: "https://example.test" } })
    expect((await product.human.admit(post, "collaboration.thread.reply", payload)).status).toBe("denied")
    product.ui.finish(read.value)
  })
})

test("human command admission binds exact action and payload and revokes on authority change", async () => {
  await fixture([{ principalRef: "person", namespaces: ["threads"], operations: [], humanActions: ["collaboration.thread.reply"] }], async ({ product, request, actor }) => {
    const payload = { threadId: "thread", body: "Human reply" }
    expect((await product.human.admit(request, "collaboration.thread.reply", payload)).status).toBe("denied")
    const post = new Request(request, { method: "POST", headers: { origin: "https://example.test" } })
    const admitted = await product.human.admit(post, "collaboration.thread.reply", payload)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect(product.ui.requestFor(admitted.value)).toBe(post)
    expect(await product.human.authorize(admitted.value, "collaboration.thread.reply", payload)).toBe(true)
    expect(await product.human.authorize(admitted.value, "collaboration.thread.reply", { ...payload, body: "Changed" })).toBe(false)
    expect(await product.human.authorize(admitted.value, "collaboration.thread.resolve", payload)).toBe(false)
    expect(product.ui.receiptFor(admitted.value, "sf-human:collaboration.thread.reply", digestSfValue(payload))).toBeUndefined()
    actor.write = false
    expect(await product.human.authorize(admitted.value, "collaboration.thread.reply", payload)).toBe(false)
    product.human.finish(admitted.value)
  })
})

test("private collaboration reads admit a viewer with an explicit grant and bind exact payload", async () => {
  await fixture([{ principalRef: "person", namespaces: ["threads"], operations: [], humanActions: ["collaboration.thread.read", "collaboration.thread.reply"] }], async ({ product, request, actor }) => {
    actor.write = false
    const payload = { id: "thread" }
    const post = new Request(request, { method: "POST", headers: { origin: "https://example.test" } })
    const admitted = await product.human.admit(post, "collaboration.thread.read", payload)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect(await product.human.authorize(admitted.value, "collaboration.thread.read", payload)).toBe(true)
    expect(await product.human.authorize(admitted.value, "collaboration.thread.read", { id: "another" })).toBe(false)
    expect((await product.human.admit(post, "collaboration.thread.reply", { id: "thread", body: "Changed" })).status).toBe("denied")
    actor.active = false
    expect(await product.human.authorize(admitted.value, "collaboration.thread.read", payload)).toBe(false)
    product.human.finish(admitted.value)
  })
})

test("the read-only exception does not grant unconfigured private reads", async () => {
  await fixture([{ principalRef: "person", namespaces: ["threads"], operations: ["sf_work_list"], humanActions: [] }], async ({ product, request, actor }) => {
    actor.write = false
    const post = new Request(request, { method: "POST", headers: { origin: "https://example.test" } })
    expect((await product.human.admit(post, "collaboration.thread.read", { id: "thread" })).status).toBe("denied")
    expect((await product.ui.admit(post, "sf-human:collaboration.thread.secret", digestSfValue({ id: "thread" }))).status).toBe("denied")
  })
})

test("dashboard roles alone do not grant C08 or a business operation", async () => {
  await fixture([], async ({ product, request }) => {
    expect(await product.state.read(request, "preferences", () => "secret")).toMatchObject({ status: "denied" })
    expect((await product.ui.admit(request, "sf_context_get", "a".repeat(64))).status).toBe("denied")
  })
})

test("collaboration read leases require the exact operation and all namespaces without granting writes", async () => {
  await fixture([{ principalRef: "person", namespaces: ["threads", "relations", "confirmations"], operations: ["sf_work_list"] }], async ({ product, request, actor, changes }) => {
    actor.write = false
    const operation = "sf-read:collaboration.work.list"
    const payload = { period: { start: "2026-01-01", end: "2026-12-31" } }
    const admitted = await product.ui.admit(request, operation, digestSfValue(payload))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error("Explicit collaboration read grant was not admitted")
    expect(await product.ui.validate(admitted.value, operation, digestSfValue(payload))).toBe(true)
    expect(await product.human.authorize(admitted.value, "collaboration.thread.reply", payload)).toBe(false)
    expect((await product.ui.admit(request, "sf-read:collaboration.unlisted", digestSfValue(payload))).status).toBe("denied")
    expect((await product.ui.admit(request, "sf-read:collaboration.question.output", digestSfValue(payload))).status).toBe("denied")
    const write = await product.state.transaction(request, { namespace: "threads", expectedStorageVersion: 0, targetRef: product.creationTarget.ref,
      targetIncarnation: product.creationTarget.incarnation, idempotencyKey: "read-cannot-write", commandDigest: digestSfValue(payload) }, async () => ({ commit: true, value: true }))
    expect(write.status).toBe("denied")
    changes.role = "contributor"
    expect(await product.ui.revalidate(admitted.value)).toBe(false)
    product.ui.finish(admitted.value)
  })
  await fixture([{ principalRef: "person", namespaces: ["threads", "relations"], operations: ["sf_work_list"] }], async ({ product, request }) => {
    expect((await product.ui.admit(request, "sf-read:collaboration.work.list", digestSfValue({}))).status).toBe("denied")
  })
})

test("private grants narrow namespaces and operations; role changes revoke existing UI authority", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_context_get"] }], async ({ product, request, changes }) => {
    const context = await product.ui.admit(request, "sf_context_get", "a".repeat(64))
    expect(context.status).toBe("ok")
    expect((await product.ui.admit(request, "sf_forecast_compare", "a".repeat(64))).status).toBe("denied")
    expect(await product.state.read(request, "documents", () => "secret")).toMatchObject({ status: "denied" })
    changes.role = "contributor"
    if (context.status === "ok") expect(await product.ui.revalidate(context.value)).toBe(false)
  })
})

test("write requires current write authority and document targets do not accept unverified identifiers", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases", "documents"], operations: ["sf_context_get"] }], async ({ product, request, actor }) => {
    actor.write = false
    const denied = await product.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: product.creationTarget.ref,
      targetIncarnation: product.creationTarget.incarnation, idempotencyKey: "create-case", commandDigest: "b".repeat(64) }, async () => ({ commit: true, value: true }))
    expect(denied.status).toBe("denied")
    actor.write = true
    const document = await product.state.transaction(request, { namespace: "documents", expectedStorageVersion: 0, targetRef: "made-up-asset",
      targetIncarnation: "made-up-incarnation", idempotencyKey: "document", commandDigest: "c".repeat(64) }, async () => ({ commit: true, value: true }))
    expect(document.status).toBe("denied")
  })
})

test("native binding cannot be invented without a current stored run", async () => {
  await fixture([{ principalRef: "person", namespaces: ["contributions"], operations: ["sf_forecast_compare"] }], async ({ product, request }) => {
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
      allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [], contextBudgetTokens: 1000,
      maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const sessionID = SessionSchema.ID.make("ses_forged")
    const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
      profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64),
      instructionsDigest: "c".repeat(64), loadedMessageId: "msg_forged", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) }
    const result = await product.native.bind({ request, selected: selection(profile), sessionID, runId: receipt.runId,
      caseRef: { id: "case", incarnation: "inc", version: 1 }, profile, manifestDigest: receipt.manifestDigest,
      skillReceipts: [receipt], entryMode: "interactive" })
    expect(result.status).toBe("denied")
  })
})

test("a real C08 run and case still cannot bind a missing native Session", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases", "contributions"], operations: ["sf_forecast_compare"] }], async ({ product, request, changes, actor, location }) => {
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const created = await product.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: product.creationTarget.ref,
      targetIncarnation: product.creationTarget.incarnation, idempotencyKey: "seed-case", commandDigest: "e".repeat(64) }, async (state) => {
      state.cases.case = { ...caseRef, state: "draft", objective: "Review", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD",
        criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    expect(created.status).toBe("ok")
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
      allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [], contextBudgetTokens: 1000,
      maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const selected = selection(profile)
    const state = await product.state.read(request, "contributions", (_current, authority) => authority)
    expect(state.status).toBe("ok")
    if (state.status !== "ok") return
    const prepared = await product.state.transaction(request, { namespace: "contributions", expectedStorageVersion: state.storageVersion,
      targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-run", commandDigest: "f".repeat(64) }, async (current) => {
      current.nativeRuns ??= {}
      current.nativeRuns.run = { schema: "sf-native-run-v1", runRef: "run", version: 1, requestDigest: "1".repeat(64), skillInputDigest: "2".repeat(64),
        principalRef: "person", accessRevision: state.value.accessRevision, policyVersion: state.value.policyVersion, caseRef, selection: selected,
        model: { providerID: "openai", id: "model" }, skillId: "sf-explicar-forecast", objective: "Review", contextFingerprint: "context",
        createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z", state: "preparing" }
      return { commit: true, value: true }
    })
    expect(prepared.status).toBe("ok")
    const sessionID = SessionSchema.ID.make("ses_missing")
    const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
      profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64),
      instructionsDigest: "c".repeat(64), loadedMessageId: "msg_fixture", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: selected.manifestDigest }
    const admission = { request, selected, sessionID, runId: "run", caseRef, profile,
      manifestDigest: selected.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" as const }
    expect((await product.native.bind(admission)).status).toBe("denied")
    changes.session = Schema.decodeUnknownSync(SessionSchema.Info)({ id: sessionID, projectID: "project", agent: profile.id,
      location, model: { providerID: "openai", id: "model" }, cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: Date.now(), updated: Date.now() }, title: "fixture" })
    const baseline = await product.native.bind(admission)
    expect(baseline.status).toBe("ok")
    if (baseline.status === "ok") {
      expect(await product.authorizeNative(admission, baseline.value)).toBe(true)
      actor.active = false
      expect(await product.authorizeNative(admission, baseline.value)).toBe(false)
      actor.active = true
      product.native.revoke(baseline.value)
    }
    changes.mutateInspect = true
    expect((await product.native.bind(admission)).status).toBe("denied")
  })
})

test("assignment and domain revocation invalidate authority without incorporating other principals", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases"], operations: ["sf_context_get"] }], async ({ product, request, persistence }) => {
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.access = { person: { assigned: ["contracts"], domains: ["finance"] }, another: { assigned: ["one"] } }
      return { commit: true, value: undefined }
    })
    const first = await product.ui.admit(request, "sf_context_get", "a".repeat(64))
    expect(first.status).toBe("ok")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.access = { person: { assigned: ["contracts"], domains: ["finance"] }, another: { assigned: ["two"] } }
      return { commit: true, value: undefined }
    })
    if (first.status === "ok") expect(await product.ui.revalidate(first.value)).toBe(true)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.access = { person: { assigned: [], domains: ["finance"] }, another: { assigned: ["two"] } }
      return { commit: true, value: undefined }
    })
    if (first.status === "ok") expect(await product.ui.revalidate(first.value)).toBe(false)
    const second = await product.ui.admit(request, "sf_context_get", "b".repeat(64))
    expect(second.status).toBe("ok")
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.access = { person: { domains: ["planning"] } }
      return { commit: true, value: undefined }
    })
    if (second.status === "ok") expect(await product.ui.revalidate(second.value)).toBe(false)
  })
})

test("workspace target is limited to explicit creation namespaces and still requires current grant and write access", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases", "reviews", "relations", "threads", "confirmations", "documents", "preferences", "receipts", "outbox"], operations: ["sf_context_get"] }], async ({ product, request, actor }) => {
    for (const namespace of ["cases", "reviews", "relations", "threads", "confirmations", "documents", "preferences", "receipts", "outbox"] as const) {
      const result = await product.state.transaction(request, { namespace, expectedStorageVersion: 0, targetRef: product.creationTarget.ref,
        targetIncarnation: product.creationTarget.incarnation, idempotencyKey: `preview-${namespace}`, commandDigest: "c".repeat(64) },
        async () => ({ commit: false, value: true }))
      expect(result.status).toBe(namespace === "receipts" || namespace === "outbox" ? "denied" : "preview")
    }
    actor.write = false
    const denied = await product.state.transaction(request, { namespace: "reviews", expectedStorageVersion: 0, targetRef: product.creationTarget.ref,
      targetIncarnation: product.creationTarget.incarnation, idempotencyKey: "no-write", commandDigest: "d".repeat(64) },
      async () => ({ commit: false, value: true }))
    expect(denied.status).toBe("denied")
  })
})


test("identity mutation during authentication is denied", async () => {
  await fixture([{ principalRef: "person", namespaces: ["cases"], operations: ["sf_context_get"] }], async ({ product, request, changes }) => {
    changes.mutateAuth = true
    expect((await product.ui.admit(request, "sf_context_get", "a".repeat(64))).status).toBe("denied")
  })
})

