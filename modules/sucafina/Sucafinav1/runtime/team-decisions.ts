import { randomUUID } from "node:crypto"
import { AbsolutePath } from "@orchestra/schema/schema"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { SfHostServices } from "../product/contracts/host-context.ts"
import type { Application } from "./application.ts"
import type { AssetPersistence } from "./assets.ts"
import { object } from "./contract.ts"
import { createDecisionCasePort } from "../product/decisions/case-port.ts"
import { draftCase } from "../product/decisions/capabilities.ts"
import { createSfProductAuthority } from "../product/integration/product-authority.ts"
import { handleSfWorkbenchCommand } from "../product/interface/workbench-command-http.ts"
import type { LocalStore } from "./local-contract.ts"

export async function runTeamDecisions(input: {
  request: Request
  directory: string
  partition: string
  principalId: string
  persistence: LocalStore
  intentions: Pick<LocalStore, "transaction">
  authenticate: Application["authenticate"]
  current: (options?: { refreshSession?: boolean }) => Promise<boolean>
  now: () => Date
}) {
  const { request, principalId, partition, directory, persistence, intentions, current, authenticate, now } = input
  const origin = new URL(request.url).origin
  const at = () => now().toISOString()
  const hostIdentity = Object.freeze({
    installationId: partition,
    hostId: digestSfValue({ partition, capability: "decisions" }),
    projectId: partition,
    location: Object.freeze({ directory: AbsolutePath.make(directory) }),
  })
  const unavailable = () => Promise.reject(new Error("Team Decisions evidence provider unavailable"))
  const assets: AssetPersistence = persistence
  const authority = createSfProductAuthority({
    identity: () => hostIdentity,
    installationId: partition,
    origin,
    policyVersion: "sf-product-v1",
    persistence: {
      ...persistence,
      transaction: (surface, work, options) => assets.transaction(surface, async (snapshot, blobs) => {
        const result = await work(snapshot, blobs)
        if (result.commit && !await current()) throw new Error("Team Decisions authority changed before commit")
        return result
      }, options),
    },
    authenticate,
    environment: async () => ({ at: at(), id: randomUUID, directory: [] }),
    grants: [{ principalRef: principalId, namespaces: ["cases"], operations: ["sf_case_draft"] }],
    createId: randomUUID,
    now: () => now().getTime(),
    commandIdentity: async (original, operation) => {
      const key = original.headers.get("idempotency-key")
      if (original !== request || operation !== "sf_case_draft" || !key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return undefined
      return digestSfValue({ operation, key })
    },
    inspectSession: async () => undefined,
    verifySelection: async () => false,
    verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined,
    authorizeDocument: async () => undefined,
  })
  const cases = createDecisionCasePort({
    state: authority.state,
    host: authority.host,
    creationTarget: authority.creationTarget,
    operationIdentity: (call) => call.kind === "ui" ? authority.ui.operationIdentity(call) : undefined,
    authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await authority.host.revalidate(call),
    verifyScenarioOperations: async () => false,
    evidence: { resolve: unavailable, context: unavailable, recall: unavailable, emitFromLedger: unavailable },
    createId: randomUUID,
    now: at,
  })
  const dispatch: SfHostServices["dispatch"] = async (operation, command, call) => {
    const commandDigest = digestSfValue(command)
    const denied = () => ({ status: "denied" as const, reason: "team-decisions-access-unavailable",
      receipt: { kind: "unbound" as const, operation, code: "invalid-binding" as const, at: at() } })
    if (operation !== "sf_case_draft" || call.kind !== "ui" || !await authority.ui.validate(call, operation, commandDigest) || !await current())
      return denied()
    const intent = authority.ui.operationIdentity(call)
    if (!intent) return denied()
    const key = digestSfValue({ principalId, intent })
    const binding = digestSfValue({ partition, commandDigest })
    const bound = await intentions.transaction("dashboard", async (snapshot) => {
      const previous = object(snapshot.data.teamDecisionIntentions)
      if (Object.hasOwn(previous, key)) return { commit: false, value: previous[key] === binding }
      // The intention store also holds the Entra session. Recheck authority without refreshing it under the writer lock.
      if (!await current({ refreshSession: false })) return { commit: false, value: false }
      snapshot.data.teamDecisionIntentions = { ...previous, [key]: binding }
      return { commit: true, value: true }
    }, { signal: request.signal })
    if (!bound) return denied()
    return draftCase(command, call, {
      cases,
      createReceipt: authority.authority.receiptFor,
      requiredAuthority: { draft: ["cases:write"], read: [], receipt: [], alternative: [], change: [] },
    })
  }
  const response = await handleSfWorkbenchCommand(request, origin, { ui: authority.ui, dispatch }, (operation) => operation === "sf_case_draft")
  if (response.ok && !await current())
    return Response.json({ status: "denied" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  return response
}
