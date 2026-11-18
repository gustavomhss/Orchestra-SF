import { DashboardPeople, hotTopicView } from "../../runtime/dashboard-people.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type HotTopic = { id: string; version: number; action: string; owner: string; due: string; status: string; priority: string; notes: string }
type Correlation = { digest: string; id: string; result?: HotTopic }
// Host authenticates, validates current source access and serializes correlations with the domain
// mutation in one durable dashboard transaction. It must revalidate the binding before returning.
export type HotTopicHost = {
  transact: <T>(binding: TrustedDomainContext, sourceRefs: readonly BusinessEvidenceRef[], work: (snapshot: Snapshot, actor: Actor, environment: Environment, correlations: Record<string, Correlation>) => { commit: boolean; value: PortResult<T> }) => Promise<PortResult<T>>
}
export type HotTopicIntent = { correlationKey: string; sourceRefs: readonly BusinessEvidenceRef[]; action: string; owner: string; due: string; priority: "critical" | "high" | "normal"; notes: string }

export function createHotTopicPort(host: HotTopicHost) {
  return {
    create: (input: HotTopicIntent, binding: TrustedDomainContext) => {
      const intent = (() => { try { return structuredClone(input) } catch { return undefined } })()
      if (!intent || !Array.isArray(intent.sourceRefs) || [intent.correlationKey, intent.action, intent.owner, intent.due, intent.priority, intent.notes].some((value) => typeof value !== "string")) return Promise.resolve({ status: "needs-input" as const, reason: "invalid-intent" })
      return host.transact<{ state: "created" | "existing"; topic: HotTopic }>(binding, intent.sourceRefs, (snapshot, actor, environment, correlations) => {
        if (!intent.correlationKey.trim() || !intent.action.trim() || !intent.sourceRefs.length) return { commit: false, value: { status: "needs-input", reason: "intent-and-source-required" } }
        if (!actor.canWrite || !actor.roles.some((role) => role === "admin" || role === "domain leader")) return { commit: false, value: { status: "denied", reason: "hot-topic-write-denied" } }
        const key = digestSfValue({ correlationKey: intent.correlationKey })
        const digest = digestSfValue({ principal: actor.id, action: intent.action, owner: intent.owner, due: intent.due, priority: intent.priority, notes: intent.notes, sourceRefs: intent.sourceRefs })
        const existing = correlations[key]
        if (existing) {
          if (existing.digest !== digest) return { commit: false, value: { status: "conflict", reason: "correlation-reused" } }
          const topic = read(snapshot, actor, existing.id)
          return topic ? { commit: false, value: { status: "ok", value: { state: "existing" as const, topic } } } : { commit: false, value: { status: "unavailable", reason: "action-unavailable" } }
        }
        const result = DashboardPeople.domain.execute(snapshot, actor, { page: "Hot Topics & Actions", action: "save", version: 0, values: { action: intent.action, owner: intent.owner, due: intent.due, priority: intent.priority, notes: intent.notes } }, environment)
        if (!result.ok) return { commit: false, value: { status: result.status === 403 ? "denied" : result.status === 409 ? "conflict" : "needs-input", reason: result.errors?.join("; ") || "action-rejected" } }
        const id = typeof result.value === "object" && result.value !== null && "id" in result.value ? String(result.value.id) : ""
        const topic = read(snapshot, actor, id)
        if (!topic) return { commit: false, value: { status: "unavailable", reason: "action-unavailable" } }
        correlations[key] = { digest, id }
        return { commit: true, value: { status: "ok", value: { state: "created" as const, topic } } }
      })
    },
    read: (id: string, sourceRefs: readonly BusinessEvidenceRef[], binding: TrustedDomainContext) => {
      const refs = (() => { try { return structuredClone(sourceRefs) } catch { return undefined } })()
      if (typeof id !== "string" || !id || !Array.isArray(refs)) return Promise.resolve({ status: "needs-input" as const, reason: "invalid-action-reference" })
      return host.transact(binding, refs, (snapshot, actor) => {
        if (!refs.length) return { commit: false, value: { status: "needs-input", reason: "source-required" } }
        const topic = read(snapshot, actor, id)
        return topic ? { commit: false, value: { status: "ok", value: topic } } : { commit: false, value: { status: "unavailable", reason: "action-unavailable" } }
      })
    },
    update: (request: { id: string; version: number; idempotencyKey: string; sourceRefs: readonly BusinessEvidenceRef[]; values: Partial<Pick<HotTopic, "action" | "owner" | "due" | "status" | "priority" | "notes">> }, binding: TrustedDomainContext) => {
      const input = (() => { try { return structuredClone(request) } catch { return undefined } })()
      if (!input || typeof input.id !== "string" || !input.id || typeof input.idempotencyKey !== "string" || !Array.isArray(input.sourceRefs) || !Number.isSafeInteger(input.version) || input.version < 0 || !input.values || typeof input.values !== "object" || Array.isArray(input.values)) return Promise.resolve({ status: "needs-input" as const, reason: "invalid-action-update" })
      return host.transact(binding, input.sourceRefs, (snapshot, actor, environment, correlations) => {
        if (!actor.canWrite || !actor.roles.some((role) => role === "admin" || role === "domain leader")) return { commit: false, value: { status: "denied", reason: "hot-topic-write-denied" } }
        if (!input.idempotencyKey.trim() || !input.sourceRefs.length) return { commit: false, value: { status: "needs-input", reason: "idempotency-and-source-required" } }
        const key = digestSfValue({ correlationKey: input.idempotencyKey })
        const digest = digestSfValue({ principal: actor.id, operation: "update", id: input.id, version: input.version, values: input.values, sourceRefs: input.sourceRefs })
        const existing = correlations[key]
        if (existing) {
          if (existing.digest !== digest) return { commit: false, value: { status: "conflict", reason: "correlation-reused" } }
          if (!read(snapshot, actor, existing.id) || !existing.result) return { commit: false, value: { status: "unavailable", reason: "action-unavailable" } }
          return { commit: false, value: { status: "ok", value: existing.result } }
        }
        if (hotTopicView(snapshot, actor).some((row) => String(row.id) === input.id) && !read(snapshot, actor, input.id)) return { commit: false, value: { status: "unavailable", reason: "action-ambiguous" } }
        const result = DashboardPeople.domain.execute(snapshot, actor, { page: "Hot Topics & Actions", action: "save", id: input.id, version: input.version, values: input.values }, environment)
        if (!result.ok) return { commit: false, value: { status: result.status === 403 ? "denied" : result.status === 409 ? "conflict" : result.status === 404 ? "unavailable" : "needs-input", reason: result.errors?.join("; ") || "action-rejected" } }
        const topic = read(snapshot, actor, input.id)
        if (!topic) return { commit: false, value: { status: "unavailable", reason: "action-unavailable" } }
        correlations[key] = { digest, id: input.id, result: topic }
        return { commit: true, value: { status: "ok", value: topic } }
      })
    },
  }
}

function read(snapshot: Snapshot, actor: Actor, id: string): HotTopic | undefined {
  const matches = hotTopicView(snapshot, actor).filter((entry) => String(entry.id) === id)
  if (matches.length !== 1) return undefined
  const row = matches[0]!
  return { id, version: snapshot.versions[`hotTopics:${id}`]?.version ?? 0, action: String(row.action ?? ""), owner: String(row.owner ?? ""), due: String(row.due ?? ""), status: String(row.status ?? ""), priority: String(row.priority ?? ""), notes: String(row.notes ?? "") }
}
