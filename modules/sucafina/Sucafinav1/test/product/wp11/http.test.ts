import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createDecisionHttp } from "../../../product/decisions/http.ts"
import { createDecisionCaseManagement } from "../../../product/decisions/case-management.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("decision HTTP uses the real human admission and case CAS", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-decision-http-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const origin = "https://example.test"
    const edit = { caseRef: { id: "case", incarnation: "inc", version: 1 }, objective: "Revised", criteria: [{ id: "cost", description: "Cost", required: true }], sourceRefs: [] }
    const ui = createSfUiAuthority({ authorize: async (request) => request.headers.get("x-principal") === "principal" ? { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined, commandIdentity: async () => "intent", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:decisions.edit", "sf-private:decision-list"] })
    const human = createSfHumanAuthority({ origin, ui })
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async (request) => request.headers.get("x-principal") === "principal" ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", objective: "Initial", criteria: edit.criteria, participants: ["principal"], sourceRefs: [], horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", assumptions: [], alternatives: [], choices: [], preparedChanges: [], ledger: [] } as unknown as DecisionCase
    await state.transaction(new Request(`${origin}/seed`, { headers: { "x-principal": "principal" } }), { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    const management = createDecisionCaseManagement({ state, host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), authorizeEdit: (request, context) => human.authorize(context, "decisions.edit", request), verifyEvidence: async () => true, verifyEdit: (_snapshot, _before, _after, context: TrustedDomainContext) => context.kind === "ui" && ui.matchesIntent(context, "sf-human:decisions.edit", digestSfValue(edit)), operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined })
    const scopes: boolean[] = []
    const empty = {} as unknown as Parameters<typeof createDecisionHttp>[0]
    const handle = createDecisionHttp({ ...empty, origin, mount: "/app", human, management, withCase: async (_context, _caseRef, options, action) => { scopes.push(options.allowHistoricalRetry); return action() }, admitList: async (request) => { const admitted = await ui.admit(request, "sf-private:decision-list", digestSfValue({})); if (admitted.status !== "ok") return admitted; return await ui.validate(admitted.value, "sf-private:decision-list", digestSfValue({})) ? admitted : { status: "denied", reason: "list-unavailable" } } })
    const post = (payload: unknown, source = origin) => new Request(`${origin}/app?sf=decision-edit`, { method: "POST", headers: { "content-type": "application/json", origin: source, "x-principal": "principal" }, body: JSON.stringify(payload) })
    expect((await handle(post({ ...edit, extra: true })))?.status).toBe(400)
    expect((await handle(post(edit, "https://untrusted.example")))?.status).toBe(403)
    const result = await handle(post(edit))
    expect(result?.status).toBe(200)
    expect(scopes).toEqual([true])
    expect(await result?.json()).toMatchObject({ status: "ok", value: { caseRef: { id: "case", incarnation: "inc", version: 2 } } })
    const listed = await handle(new Request(`${origin}/app?sf=decision-list`, { headers: { "x-principal": "principal" } }))
    expect(await listed?.json()).toMatchObject({ status: "ok", value: [{ objective: "Revised", caseRef: { version: 2 } }] })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
