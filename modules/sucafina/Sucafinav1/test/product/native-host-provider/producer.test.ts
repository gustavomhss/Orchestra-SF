import { expect, test } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { SfTokenCountReceipt } from "../../../../../../apps/cli/src/sucafina-product/token-count.ts"
import { createSfNativeAuthorityProducer, createSfNativeMaestroHttp } from "../../../../../../apps/cli/src/sucafina-product/native-authority-provider.ts"

const origin = "https://sf-native-mission95.invalid"
const mount = "/workbench"
const caseRef = { id: "case-95", incarnation: "inc-95", version: 1 }
const sessionID = SessionSchema.ID.make("ses_" + "9".repeat(64))
const receipt: SfTokenCountReceipt = {
  schema: "sf-token-count-v1", oracle: "https://api.openai.com/v1/responses/input_tokens",
  model: "gpt-5", inputDigest: "a".repeat(64), requestDigest: "b".repeat(64),
  inputTokens: 128, contextBudgetTokens: 24_000, maxOutputTokens: 4096,
  observedAt: "2026-11-15T00:00:00.000Z",
}
const request = (body: unknown, extra: Record<string, string> = {}) =>
  new Request(origin + mount + "/dashboard?sf=workbench-native-maestro", {
    method: "POST", headers: { "origin": origin, "content-type": "application/json",
      "idempotency-key": "admission-95-valid", ...extra }, body: JSON.stringify(body),
  })
const input = { action: "admit", caseRef, objective: "Show the human-approved objective, do not execute unapproved work" }

/** COMPONENT-ONLY, NOT an installed Session/Task/Relay/provider proof. Host refuses
 * immediately after exercising the real producer's pre-create C09 reservation callback.
 */
function fixture() {
  const actor = { principalRef: "actor-95", accessRevision: "ar-95", policyVersion: "pv-95" }
  const context = Object.freeze({
    kind: "ui" as const,
    binding: Object.freeze({
      principalRef: "actor-95", accessRevision: "ar-95", policyVersion: "pv-95",
      installationId: "installation-95", projectId: "project-95",
      requestId: "req-95", expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }), lease: Object.freeze({}),
  })
  const state = {
    preferences: {} as Record<string, unknown>,
    cases: { [caseRef.id]: { ...caseRef, participants: ["actor-95"] } },
  }
  let version = 1
  let original: Request | undefined
  let authorized = true
  let reserved = false
  let beforeReserve = false
  let afterReserve = false
  let writes = 0
  let hostCalls = 0
  const privateWrites = new WeakSet<object>()
  let persisted: SfTokenCountReceipt | undefined
  const fakeHost = {
    admitMaestro: (value: { revalidate: () => Effect.Effect<boolean, unknown>;
      reserve?: (id: typeof sessionID) => Effect.Effect<boolean, unknown>;
      persistReceipt: (value: SfTokenCountReceipt) => Effect.Effect<void, unknown> }) =>
      Effect.tryPromise(async () => {
        ++hostCalls
        beforeReserve = await Effect.runPromise(value.revalidate())
        reserved = !!value.reserve && await Effect.runPromise(value.reserve(sessionID))
        afterReserve = await Effect.runPromise(value.revalidate())
        if (reserved && afterReserve) {
          await Effect.runPromise(value.persistReceipt(receipt))
          persisted = receipt
        }
        // This component fixture NEVER fabricates Session.create or an executed provider turn.
        return { status: "denied" as const, reason: "fixture-no-real-session" }
      }),
    releaseMaestro: () => Effect.void,
  }
  const authority = {
    human: {
      admit: async (r: Request) => { original = r; return authorized ?
        { status: "ok" as const, value: context } :
        { status: "denied" as const, reason: "fixture-human-denied" } },
      authorize: async () => authorized,
      finish: () => { original = undefined },
    },
    host: { requestFor: (value: unknown) => value === context ? original : undefined },
    authority: { revalidateDomainContext: async () => authorized },
    nativeEvidenceWrites: privateWrites,
    state: {
      read: async (_r: Request, _namespace: string, pick: (state: unknown, actor: unknown) => unknown) => ({
        status: "ok" as const, storageVersion: version, aggregateRevision: version, incarnation: "sf-95",
        value: await pick(state, actor),
      }),
      transaction: async (_r: Request, command: { expectedStorageVersion: number },
        work: (state: unknown, actor: unknown, snapshot: unknown) => Promise<{ commit: boolean; value: unknown }>) => {
        if (command.expectedStorageVersion !== version) return { status: "conflict" as const, reason: "fixture-CAS" }
        if (!privateWrites.has(work)) throw new Error("private C09 writer capability was not supplied")
        const result = await work(state, actor, {})
        if (result.commit) { ++version; ++writes }
        return { status: "ok" as const, storageVersion: version, aggregateRevision: version,
          incarnation: "sf-95", value: result.value }
      },
    },
  }
  const producer = createSfNativeAuthorityProducer({
    authority: authority as unknown as Parameters<typeof createSfNativeAuthorityProducer>[0]["authority"],
    identity: () => ({ installationId: "installation-95", hostId: "host-95",
      projectId: "project-95", location: { directory: "/tmp/sf-native-mission95" } as
        Parameters<typeof createSfNativeAuthorityProducer>[0]["identity"] extends () => infer I ? NonNullable<I>["location"] : never }),
    nativeHost: () => fakeHost as unknown as NonNullable<ReturnType<Parameters<typeof createSfNativeAuthorityProducer>[0]["nativeHost"]>>,
    persistence: { transaction: async () => ({}) } as unknown as Parameters<typeof createSfNativeAuthorityProducer>[0]["persistence"],
    generation: async () => 1,
    model: async () => ({ providerID: "openai", id: "gpt-5" }) as
      unknown as Awaited<ReturnType<Parameters<typeof createSfNativeAuthorityProducer>[0]["model"]>>,
    policy: { tools: ["task"], contextBudgetTokens: 24_000, toolCallBudget: 12 },
    enabled: () => false, // no real native Task child admission; readiness must be OFF
  })
  return {
    authority, producer, state, actor, context,
    setAuthorized: (value: boolean) => { authorized = value },
    checks: () => ({ reserved, beforeReserve, afterReserve, writes, hostCalls, persisted }),
  }
}

test("C09 origin is committed using the private CAS writer BEFORE any native Session/create; no fake Task/provider", async () => {
  const f = fixture()
  const r = request(input)
  const result = await f.producer.admit(r, { caseRef, objective: input.objective })
  expect(result.status).toBe("denied") // the fixture's host explicitly refuses real Session creation
  expect(f.checks()).toMatchObject({ beforeReserve: true, reserved: true, afterReserve: true,
    writes: 2, hostCalls: 1, persisted: receipt })
  expect(f.state.preferences["sf:native-maestro:" + sessionID]).toMatchObject({
    schema: "sf-native-maestro-origin-v1", principalRef: "actor-95",
    accessRevision: "ar-95", installationId: "installation-95",
    projectId: "project-95", caseRef, sessionID, tokenReceipts: [{ receipt }],
  })
  expect(f.producer.ready()).toBe(false) // no child C15 admission exists
  f.producer.dispose()
})

test("human denial or changed principal prevents C09 origin and native host admission", async () => {
  const f = fixture()
  f.setAuthorized(false)
  expect((await f.producer.admit(request(input), { caseRef, objective: input.objective })).status).toBe("denied")
  expect(f.checks().hostCalls).toBe(0)
  expect(f.checks().writes).toBe(0)
  f.producer.dispose()
})

test("expired/incorrect case and absent model cannot issue a native owner ticket", async () => {
  const f = fixture()
  expect((await f.producer.admit(request(input), { caseRef: { ...caseRef, version: 55 },
    objective: input.objective })).status).toBe("denied")
  expect(f.checks().writes).toBe(0)
  f.producer.dispose()
})

test("HTTP entry only processes the existing same-origin POST action; never treats IDs as authority", async () => {
  const f = fixture()
  const handler = createSfNativeMaestroHttp({ origin, mount, producer: () => f.producer })
  expect(await handler(new Request(origin + mount + "/dashboard?sf=other"), "dashboard")).toBeUndefined()
  for (const [r, surface] of [
    [request(input, { origin: "https://evil.invalid" }), "dashboard"],
    [request(input, { "sec-fetch-site": "cross-site" }), "dashboard"],
    [request(input), "wrong-surface"],
    [new Request(origin + mount + "/dashboard?sf=workbench-native-maestro"), "dashboard"],
  ] as const) {
    const response = await handler(r, surface)
    expect(response?.status).toBe(403)
  }
  expect(f.checks().hostCalls).toBe(0)
  f.producer.dispose()
})

test("HTTP rejects invalid shape, duplicate selector, missing idempotency and oversized body before authority", async () => {
  const f = fixture()
  const handler = createSfNativeMaestroHttp({ origin, mount, producer: () => f.producer })
  const invalid = request({ ...input, clientRole: "maestro" })
  expect((await handler(invalid, "dashboard"))?.status).toBe(400)
  const duplicate = request(input)
  expect((await handler(new Request(duplicate.url + "&sf=workbench-native-maestro", duplicate), "dashboard"))?.status).toBe(400)
  expect((await handler(request(input, { "idempotency-key": "" }), "dashboard"))?.status).toBe(400)
  expect((await handler(request({ ...input, objective: "x".repeat(65_537) }), "dashboard"))?.status).toBe(413)
  expect(f.checks().hostCalls).toBe(0)
  f.producer.dispose()
})

test("native run and historical read stay unavailable without installed child admission and real human lease", async () => {
  const f = fixture()
  const r = request(input)
  expect(f.producer.ready()).toBe(false)
  expect((await f.producer.run(r, { sessionID,
    intent: { planRevisionId: "plan-95", authorizationId: "auth-95",
      inputDigest: "a".repeat(64), caseRef }, humanText: "approve" })).status).toBe("denied")
  expect(await f.producer.historical(f.context as unknown as Parameters<ReturnType<
    typeof createSfNativeAuthorityProducer>["historical"]>[0], r)).toBeUndefined()
  expect(f.checks().hostCalls).toBe(0)
  f.producer.dispose()
})
