import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { seedWaveFourWork } from "./wave-four-work-seed"

type Installed = {
  actorId: string
  request(pathname: string, init?: RequestInit): Promise<Response>
}

export const workflowCollabData = {
  comment: "Design test data · Check the source evidence and its period before the next review. This comment belongs only to the isolated installation.",
  draft: "Design test data · Draft retained while reviewing the original context. Do not send.",
  caseObjective: "Design test data · Review the regional source relationships",
} as const

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Canonical collaboration seed expected an object")
  return value as Record<string, unknown>
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Canonical collaboration seed omitted a source reference")
  return value
}

/**
 * Original local human APIs create one handoff relationship, one unaddressed
 * internal comment and one case. No external recipient, notification or email
 * is requested. Evidence, CAS, source periods and IDs are read from producers.
 */
export async function seedWorkflowCollab(installed: Installed, year: number) {
  const local = await seedWaveFourWork(installed, year)
  const post = async (mode: string, payload: unknown) => {
    const response = await installed.request("/dashboard?" + new URLSearchParams({ sf: mode }), {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify(payload),
    })
    if (response.status !== 200)
      throw new Error("Canonical collaboration seed rejected " + mode + " (HTTP " + response.status + ")")
    const body = object(await response.json())
    if (body.status !== "ok")
      throw new Error("Canonical collaboration seed rejected " + mode + ": " + String(body.reason ?? body.status))
    return body
  }
  const relations = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.relation-read"].output)(
    await post("collaboration-relation-read", { recordRefs: [local.actionRef] }),
  )
  if (relations.status !== "ok") throw new Error("Original relationship read failed")
  const matching = relations.value.relations.filter((relation) =>
    relation.kind === "handoff" && relation.toRef === local.actionRef)
  if (matching.length !== 1) throw new Error("Original handoff relationship was not uniquely observed")
  const relation = matching[0]!
  const source = relation.evidenceRefs.find((evidence) =>
    evidence.kind === "record" && evidence.refId === relation.toRef && evidence.target.recordType === "hotTopics")
  if (!source || source.kind !== "record") throw new Error("Original handoff omitted its Dashboard source evidence")
  const version = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.storage-version"].output)(
    await post("collaboration-storage-version", { namespace: "threads" }),
  )
  if (version.status !== "ok") throw new Error("Original thread revision is unavailable")
  const created = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.thread-create"].output)(
    await post("collaboration-thread-create", {
      draft: {
        kind: "comment", sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
        observedVersion: source.target.version, period: source.target.period,
        evidenceRefs: [source], body: workflowCollabData.comment,
      },
      mutation: { expectedStorageVersion: version.value, idempotencyKey: randomUUID() },
    }),
  )
  if (created.status !== "ok" || created.value.messages.length !== 1 ||
      created.value.messages[0]?.body !== workflowCollabData.comment || created.value.recipientRef)
    throw new Error("Original internal comment was not confirmed without a recipient")
  const scope = {
    sourceRef: { surface: source.target.surface, type: source.target.recordType,
      id: source.target.recordId, incarnation: source.target.incarnation },
    fields: source.target.fields, period: source.target.period, materialDependencies: [],
    scopeDefinitionVersion: "dashboard-c06-v1",
  }
  const prepared = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-prepare"].output)(
    await post("collaboration-confirmation-prepare", { scope }),
  )
  if (prepared.status !== "ok" || !prepared.value.selectionRef)
    throw new Error("Original current material selection was not prepared")
  const caseResult = await post("workbench-command", {
    operation: "sf_case_draft", input: {
      objective: workflowCollabData.caseObjective,
      horizon: { start: year + "-01-01", end: year + "-12-31" }, currency: "USD",
      criteria: ["Design test data · Preserve the original evidence"], sourceRefs: [],
    },
  })
  return { relation, thread: created.value, scope, prepared: prepared.value,
    caseRef: text(caseResult.outputRef), post }
}
