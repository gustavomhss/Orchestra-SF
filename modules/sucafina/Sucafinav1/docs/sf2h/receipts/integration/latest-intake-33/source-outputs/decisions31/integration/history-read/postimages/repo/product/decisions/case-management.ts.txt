import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Edit = { caseRef: CaseRef; objective: string; criteria: DecisionCase["criteria"]; sourceRefs: readonly BusinessEvidenceRef[]; horizon?: DecisionCase["horizon"]; currency?: string; assumptions?: DecisionCase["assumptions"] }

/** Private host API shared by the UI and other trusted consumers. */
export function createDecisionCaseManagement(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeEdit: (request: Edit, context: TrustedDomainContext) => Promise<boolean>
  verifyEvidence: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  /** Read-only history admission; edits continue using current evidence. */
  verifyReadEvidence?: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  verifyEdit: (snapshot: import("../../runtime/contract.ts").Snapshot, before: DecisionCase, after: DecisionCase, context: TrustedDomainContext) => boolean
  operationIdentity: (context: TrustedDomainContext) => string | undefined
}) {
  return {
    list: async (context: TrustedDomainContext): Promise<PortResult<readonly { caseRef: CaseRef; objective: string; state: DecisionCase["state"] }[]>> => {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
      const read = () => input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? Object.values(state.cases).filter((value) => value.participants.includes(context.binding.principalRef)) : undefined)
      const current = await read().catch(() => undefined)
      if (!current || current.status !== "ok" || !current.value) return { status: "unavailable", reason: "case-list-unavailable" }
      const allowed = await Promise.all(current.value.map(async (value) => context.kind === "native" && (context.binding.caseId !== value.id || context.binding.caseIncarnation !== value.incarnation || context.binding.caseVersion !== value.version) ? undefined : await input.authorizeCase(value, context).catch(() => false) && await (input.verifyReadEvidence ?? input.verifyEvidence)(value.sourceRefs, context).catch(() => false) ? value : undefined))
      const again = await read().catch(() => undefined)
      if (!again || again.status !== "ok" || again.storageVersion !== current.storageVersion || digestSfValue(again.value) !== digestSfValue(current.value) || !await input.host.revalidate(context).catch(() => false)) return { status: "stale", reason: "case-list-changed" }
      const authorized = allowed.filter((value): value is DecisionCase => !!value)
      if (!(await Promise.all(authorized.map(async (value) => await input.authorizeCase(value, context).catch(() => false) && await (input.verifyReadEvidence ?? input.verifyEvidence)(value.sourceRefs, context).catch(() => false)))).every(Boolean) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-list-access-changed" }
      return { status: "ok", value: authorized.map((value) => ({ caseRef: { id: value.id, incarnation: value.incarnation, version: value.version }, objective: value.objective, state: value.state })) }
    },
    edit: async (incoming: Edit, context: TrustedDomainContext): Promise<PortResult<{ caseRef: CaseRef }>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-edit-required" }
      const request = structuredClone(incoming)
      if (!await input.authorizeEdit(request, context).catch(() => false)) return { status: "denied", reason: "human-edit-required" }
      if ((request.horizon !== undefined && !isSfPeriod(request.horizon)) || (request.currency !== undefined && !/^[A-Z]{3}$/.test(request.currency)) || (request.assumptions && (request.assumptions.some((item) => !item.id.trim() || !item.text.trim() || !["open", "confirmed", "rejected"].includes(item.state)) || new Set(request.assumptions.map((item) => item.id)).size !== request.assumptions.length)) || !request.objective.trim() || !request.criteria.length || request.criteria.some((item) => !item.id.trim() || !item.description.trim() || typeof item.required !== "boolean") || new Set(request.criteria.map((item) => item.id)).size !== request.criteria.length) return { status: "needs-input", reason: "invalid-case-edit" }
      const source = input.host.requestFor(context)
      const identity = input.operationIdentity(context)
      if (!source || !identity || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
      const loaded = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? { value: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `${identity}:edit`])] } : undefined).catch(() => undefined)
      if (!loaded || loaded.status !== "ok" || !loaded.value) return { status: "unavailable", reason: "case-unavailable" }
      const current = loaded.value.value
      if (!current || current.incarnation !== request.caseRef.incarnation || !current.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current, context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
      if (loaded.value.prior) {
        const prior = loaded.value.prior
        if (prior.targetIncarnation !== request.caseRef.incarnation || prior.commandDigest !== digestSfValue(request)) return { status: "conflict", reason: "idempotency-content-changed" }
        const value = prior.value
        if (!value || typeof value !== "object" || !("id" in value) || !("incarnation" in value) || !("version" in value) || value.id !== current.id || value.incarnation !== current.incarnation || !Number.isSafeInteger(value.version) || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "case-edit-receipt-unavailable" }
        return { status: "ok", value: { caseRef: { id: current.id, incarnation: current.incarnation, version: Number(value.version) } } }
      }
      if (current.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      if ((request.currency !== undefined && request.currency !== current.currency || request.horizon !== undefined && digestSfValue(request.horizon) !== digestSfValue(current.horizon)) && (current.alternatives.length > 0 || current.choices.length > 0 || current.preparedChanges.length > 0)) return { status: "conflict", reason: "case-basis-in-use" }
      const next = { ...current, version: current.version + 1, objective: request.objective, criteria: request.criteria, sourceRefs: request.sourceRefs, horizon: request.horizon ?? current.horizon, currency: request.currency ?? current.currency, assumptions: request.assumptions ?? current.assumptions }
      if (!await input.verifyEvidence([...next.sourceRefs, ...next.assumptions.flatMap((item) => item.evidenceRefs)], context).catch(() => false) || !await input.authorizeCase(next, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
      const saved = await input.state.transaction(source, { namespace: "cases", domainSurface: "planner", expectedStorageVersion: loaded.storageVersion, targetRef: current.id, targetIncarnation: current.incarnation, idempotencyKey: `${identity}:edit`, commandDigest: digestSfValue(request) }, async (state, authority, snapshot) => {
        const actual = state.cases[current.id]
        if (!sameAuthority(authority, context) || !actual || actual.incarnation !== current.incarnation || actual.version !== current.version || !actual.participants.includes(context.binding.principalRef) || !input.verifyEdit(snapshot, actual, next, context)) return { commit: false, value: null }
        state.cases[current.id] = next
        return { commit: true, value: next }
      }).catch(() => undefined)
      if (!saved || saved.status !== "ok" || !saved.value) return { status: saved?.status === "conflict" || saved?.status === "preview" ? "conflict" : "unavailable", reason: "case-edit-unavailable" }
      if (!await input.authorizeCase(saved.value, context).catch(() => false) || !await input.verifyEvidence([...saved.value.sourceRefs, ...saved.value.assumptions.flatMap((item) => item.evidenceRefs)], context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
      return { status: "ok", value: { caseRef: { id: saved.value.id, incarnation: saved.value.incarnation, version: saved.value.version } } }
    },
  }
}

function sameAuthority(authority: { principalRef: string; policyVersion: string; accessRevision: string }, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
