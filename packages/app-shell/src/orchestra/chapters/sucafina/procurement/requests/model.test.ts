import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { decodeRequestsPage, prCommandInput, prFromRecord } from "./model"

const tenantId = "11111111-1111-4111-8111-111111111111"
const principalRef = "22222222-2222-4222-8222-222222222222"
const teamObjectId = "33333333-3333-4333-8333-333333333333"
const legacy: SfContextStamp = {
  installationId: "installation-1", projectId: "project-1", hostId: "host-1",
  principalRef, policyVersion: "policy-1", accessRevision: "access-1",
}
const team = Schema.decodeUnknownSync(SfContextStamp)({
  ...legacy,
  team: {
    owner: {
      profile: { installationId: legacy.installationId, tenantId, teamObjectId },
      principal: { tenantId, principalObjectId: principalRef },
    },
    revisions: { configRevision: 1, accessRevision: legacy.accessRevision },
  },
})

const projection = {
  context: {
    installationId: legacy.installationId, projectId: legacy.projectId,
    principalRef, accessRevision: legacy.accessRevision, policyVersion: legacy.policyVersion,
    surface: "procurement", period: { start: "2026-01-01", end: "2026-12-31" },
    currency: "USD", sourceRefs: [], capabilities: [],
  },
  version: 1, engineVersion: "queue-test-v1", components: [], values: [], missing: [],
} as const
const queueRow = {
  id: "PR-2026-0001",
  evidence: {
    schema: "sf-evidence-v1", refId: "evidence-1", installationId: legacy.installationId,
    projectId: legacy.projectId, refDigest: "a".repeat(64), evidenceLevel: "observed",
    kind: "record", target: {
      surface: "procurement", recordType: "procurement-request", recordId: "PR-2026-0001",
      incarnation: "request-incarnation-1", version: 1, fields: [], projectionDigest: "b".repeat(64),
    },
  },
  version: 1, projection, status: "draft", subject: null, holder: null, approvalStage: null,
  stageEnteredAt: null, ageDays: null, baseAmount: null, baseCurrency: "USD",
  submittedAmount: null, submittedCurrency: null, originalAmount: null, originalCurrency: null,
  monetaryState: null, reason: null, nextStep: null,
} as const
const queueView = { rows: [queueRow], stock: projection, aging: [projection] } as const

function page(context: unknown, includeQueue = false) {
  return {
    status: "ok",
    context,
    value: {
      capabilityId: "CAP25",
      selection: {},
      data: {
        requests: [], suppliers: [], directory: [], formSettings: {},
        bankVerificationAvailable: false,
        ...(includeQueue ? { procurementQueueView: queueView } : {}),
      },
      versions: {}, allowedActionIds: [],
    },
  }
}

function decodePage(context: unknown, includeQueue = false) {
  const decoded = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(page(context, includeQueue))
  if (decoded.status !== "ok") throw new Error("Expected CAP25 fixture projection")
  return decoded
}

test("CAP25 create command removes absent PR fields and retains explicit falsy values", () => {
  const source = { ...prFromRecord(), estAmount: 0, recurring: false, estAnnual: null }
  const input = {
    page: "Requests", action: "create", version: 0,
    values: { pr: prCommandInput(source) },
  }
  const codec = SfNativeOperationBindings["domain.command.CAP25.create"]
  if (!codec) throw new Error("Expected CAP25 command codec")

  expect(input.values.pr).toEqual({ title: "", estAmount: 0, recurring: false, estAnnual: null })
  expect(codec.decodeInput(input)).toEqual({ status: "ok", value: input })
  expect(codec.decodeInput({
    ...input, values: { pr: prFromRecord() },
  })).toEqual({ status: "invalid" })

  const edited = { ...source, estAmount: "100.50", estAnnual: "" }
  const editedInput = { ...input, values: { pr: prCommandInput(edited) } }
  expect(editedInput.values.pr).toEqual({ title: "", estAmount: 100.5, recurring: false, estAnnual: null })
  expect(codec.decodeInput(editedInput)).toEqual({ status: "ok", value: editedInput })
})

test("CAP25 operation schema retains its queue view and admitted Team binding", () => {
  const decoded = decodePage(team, true)
  expect(decoded.context.team).toEqual(team.team)
  expect(decoded.value.data.procurementQueueView).toEqual(queueView)
  expect(decodeRequestsPage(decoded, team).kind).toBe("ready")
  const legacyReply = decodePage(legacy)
  expect(legacyReply.value.data).not.toHaveProperty("procurementQueueView")
  expect(decodeRequestsPage(legacyReply, legacy).kind).toBe("ready")
})

test("CAP25 operation schema rejects malformed queue structures", () => {
  const valid = page(team, true)
  const malformed = {
    ...valid,
    value: {
      ...valid.value,
      data: {
        ...valid.value.data,
        procurementQueueView: { ...queueView, rows: [{ ...queueRow, status: 4 }] },
      },
    },
  }
  expect(() => Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(malformed)).toThrow()
})

test("CAP25 operation schema rejects Team owners mismatched to technical identity", () => {
  expect(() => decodePage({ ...team, team: {
    ...team.team!, owner: { ...team.team!.owner,
      profile: { ...team.team!.owner.profile, installationId: "installation-2" } },
  } })).toThrow()
  expect(() => decodePage({ ...team, team: {
    ...team.team!, owner: { ...team.team!.owner,
      principal: { ...team.team!.owner.principal, principalObjectId: "44444444-4444-4444-8444-444444444444" } },
  } })).toThrow()
})

test("CAP25 decoder rejects a mismatched Team revision or Team", () => {
  expect(decodeRequestsPage(decodePage({ ...team, team: {
    ...team.team!, revisions: { ...team.team!.revisions, configRevision: 2 },
  } }), team)).toEqual({ kind: "stale" })
  expect(decodeRequestsPage(decodePage({ ...team, team: {
    ...team.team!, owner: { ...team.team!.owner,
      profile: { ...team.team!.owner.profile, teamObjectId: "55555555-5555-4555-8555-555555555555" } },
  } }), team)).toEqual({ kind: "stale" })
})
