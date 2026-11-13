import { expect, test } from "bun:test"
import { createRecipientCommitCheck, createRecipientSourceAuthorizer } from "../../../product/collaboration/recipient-authority.ts"
import type { CollaborationRecipientAuthority } from "../../../product/collaboration/recipient-authority.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"

const context = { kind: "ui", binding: { installationId: "installation", projectId: "project", principalRef: "person-A", requestId: "request", accessRevision: "access", policyVersion: "policy", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
function reference(id: string): Extract<BusinessEvidenceRef, { kind: "record" }> {
  const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", installationId: "installation", projectId: "project", refId: `source-${id}`, refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "contracts", recordId: id, incarnation: `inc-${id}`, version: 1, fields: ["status"], period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: "a".repeat(64) } }
  return { ...ref, refDigest: digestSfEvidenceRef(ref) }
}

test("caller access permits self-assignment but cannot substitute for recipient source authority", async () => {
  const refs = [reference("contract")]
  const authorize = createRecipientSourceAuthorizer({ sources: async () => true, revalidate: async () => true })
  expect(await authorize("person-A", refs, context)).toBe(true)
  expect(await authorize("person-B", refs, context)).toBe(false)
})

test("recipient identity and every material dependency are checked without name inference", async () => {
  const refs = [reference("contract"), reference("dependency")]
  const grants = new Map([["person-B", new Set(["source-contract"])], ["person-C", new Set(["source-contract", "source-dependency"])]])
  const recipientAuthority: CollaborationRecipientAuthority = { authorize: async (id, selected, caller) => caller === context && selected.every((ref) => grants.get(id)?.has(ref.refId) === true) }
  const authorize = createRecipientSourceAuthorizer({ sources: async () => true, revalidate: async () => true, recipientAuthority })
  // B and C may have the same directory name; only C has the exact selected source scope.
  expect(await authorize("person-B", refs, context)).toBe(false)
  expect(await authorize("person-C", refs, context)).toBe(true)
  expect(await authorize("Same Name", refs, context)).toBe(false)
  grants.get("person-C")!.delete("source-dependency")
  expect(await authorize("person-C", refs, context)).toBe(false)
})

test("revocation during source inspection and proof failure refuse assignment", async () => {
  const refs = [reference("contract")]
  const state = { proofCalls: 0, caller: true }
  const authorize = createRecipientSourceAuthorizer({
    sources: async () => state.caller,
    revalidate: async () => true,
    recipientAuthority: { authorize: async () => ++state.proofCalls === 1 },
  })
  expect(await authorize("person-B", refs, context)).toBe(false)
  expect(state.proofCalls).toBe(2)
  const failed = createRecipientSourceAuthorizer({ sources: async () => true, revalidate: async () => true, recipientAuthority: { authorize: async () => { throw new Error("proof unavailable") } } })
  expect(await failed("person-B", refs, context)).toBe(false)
  state.caller = false
  expect(await authorize("person-A", refs, context)).toBe(false)
})

test("the proof gets detached exact refs and cannot rewrite the assignment or omit a dependency", async () => {
  const refs = [reference("contract"), reference("dependency")]
  const expected = digestSfValue(refs)
  const seen: string[] = []
  const authorize = createRecipientSourceAuthorizer({ sources: async (selected) => digestSfValue(selected) === expected, revalidate: async () => true, recipientAuthority: { authorize: async (_id, selected) => {
    seen.push(digestSfValue(selected))
    const first = selected[0]
    if (first?.kind === "record") first.target.fields = []
    return true
  } } })
  expect(await authorize("person-B", refs, context)).toBe(true)
  expect(seen).toEqual([expected, expected])
  expect(digestSfValue(refs)).toBe(expected)
  const revoked = createRecipientSourceAuthorizer({ sources: async () => true, revalidate: async () => false, recipientAuthority: { authorize: async () => true } })
  expect(await revoked("person-B", refs, context)).toBe(false)
})

test("commit checks require a current synchronous recipient lease without repeating source I/O", async () => {
  const refs = [reference("contract"), reference("dependency")]
  const lease = { valid: true, preparations: 0 }
  const authority: CollaborationRecipientAuthority = {
    authorize: async () => { lease.preparations++; return true },
    checkAtCommit: (id, selected, caller) => lease.valid && id === "person-B" && caller === context && digestSfValue(selected) === digestSfValue(refs),
  }
  expect(await authority.authorize("person-B", refs, context)).toBe(true)
  const check = createRecipientCommitCheck(authority)
  expect(check("person-B", refs, context)).toBe(true)
  lease.valid = false
  expect(check("person-B", refs, context)).toBe(false)
  expect(lease.preparations).toBe(1)
  expect(createRecipientCommitCheck()("person-B", refs, context)).toBe(false)
  expect(createRecipientCommitCheck()("person-A", refs, context)).toBe(true)
  expect(createRecipientCommitCheck({ authorize: authority.authorize, checkAtCommit: () => { throw new Error("lease unavailable") } })("person-B", refs, context)).toBe(false)
  expect(createRecipientCommitCheck({ authorize: authority.authorize, checkAtCommit: () => Promise.resolve(true) as unknown as boolean })("person-B", refs, context)).toBe(false)
})
