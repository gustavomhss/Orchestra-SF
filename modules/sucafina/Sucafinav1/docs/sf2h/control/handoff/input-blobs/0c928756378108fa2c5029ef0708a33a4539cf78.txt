import { digestSfValue } from "../contracts/canonical.ts"
import type { CommandReceipt } from "../contracts/context.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult, PreparedApplyPort, PreparedDomainMutation } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"

/** The callbacks resolve current host authority and domain data; none are supplied by a capability caller. */
export function createSfPreparedApply(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeLookup: (request: Parameters<PreparedApplyPort["readReceipt"]>[0], context: TrustedDomainContext) => Promise<boolean>
  authorizeReceipt: (receipt: CommandReceipt, request: Parameters<PreparedApplyPort["readReceipt"]>[0], context: TrustedDomainContext) => Promise<boolean>
  confirmHuman: (request: Parameters<PreparedApplyPort["executePrepared"]>[0], change: PreparedChange, context: TrustedDomainContext) => Promise<boolean>
  resolveActor: (snapshot: Snapshot, context: TrustedDomainContext) => Actor | undefined
  resolveMutation: (snapshot: Snapshot, change: PreparedChange, actor: Actor, context: TrustedDomainContext) => PreparedDomainMutation | undefined
  verifyGrant: (snapshot: Snapshot, request: Parameters<PreparedApplyPort["executePrepared"]>[0], change: PreparedChange, actor: Actor, context: TrustedDomainContext) => boolean
  receiptVersion: (snapshot: Snapshot, change: PreparedChange, actor: Actor) => number | undefined
  environment: (context: TrustedDomainContext) => Environment
  createId: () => string
  now: () => string
}): PreparedApplyPort {
  const port: PreparedApplyPort = {
    readReceipt: async (incoming, context) => {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context).catch(() => false) || !await input.authorizeLookup(request, context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
      const current = await input.state.read(source, "receipts", (state, authority) => {
        if (!sameAuthority(authority, context)) return undefined
        return Object.values(state.receipts).filter((item) => item.surface === request.surface && item.targetIncarnation === request.targetIncarnation && item.idempotencyKey === request.idempotencyKey && item.principalRef === context.binding.principalRef)
      }).catch(() => undefined)
      if (!current || current.status !== "ok" || !current.value) return { status: "unavailable", reason: "receipt-unavailable" }
      if (current.value.length > 1) return { status: "unavailable", reason: "receipt-identity-conflict" }
      const receipt = current.value[0]
      if (!receipt) {
        if (!await input.authorizeLookup(request, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
        return { status: "ok", value: { state: "not-found" } }
      }
      if (!await input.authorizeLookup(request, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "receipt-access-unavailable" }
      if (receipt.commandDigest !== request.commandDigest) return { status: "conflict", reason: "idempotency-content-changed" }
      if (!await input.authorizeReceipt(receipt, request, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "receipt-access-unavailable" }
      return { status: "ok", value: { state: "found", receipt: structuredClone(receipt) } }
    },
    executePrepared: async (incoming, context) => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui") return { status: "denied", reason: "human-authority-required" }
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
      const current = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined).catch(() => undefined)
      if (!current || current.status !== "ok") return { status: "unavailable", reason: "case-unavailable" }
      const decision = current.value
      const change = decision?.preparedChanges.find((item) => item.id === request.changeId && item.choiceId === request.choiceId)
      if (!decision || decision.incarnation !== request.caseRef.incarnation || decision.version < request.caseRef.version || !decision.participants.includes(context.binding.principalRef) || !decision.choices.some((choice) => choice.id === request.choiceId) || !change || (decision.version !== request.caseRef.version && !change.receipt)) return { status: "stale", reason: "case-changed" }
      if (!await input.authorizeCase(decision, context).catch(() => false) || !await input.confirmHuman(request, change, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "human-authority-required" }
      if (change.receipt) {
        const prior = await port.readReceipt({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context)
        if (prior.status !== "ok") return prior
        if (prior.value.state !== "found" || digestSfValue(prior.value.receipt) !== digestSfValue(change.receipt)) return { status: "unavailable", reason: "authoritative-receipt-unavailable" }
        const again = await input.state.read(source, "cases", (state, authority) => sameAuthority(authority, context) ? state.cases[request.caseRef.id] : undefined).catch(() => undefined)
        const currentChange = again?.status === "ok" ? again.value?.preparedChanges.find((item) => item.id === change.id && item.choiceId === request.choiceId) : undefined
        if (!again || again.status !== "ok" || !again.value || again.value.incarnation !== decision.incarnation || again.value.version !== decision.version || !again.value.participants.includes(context.binding.principalRef) || !currentChange || digestSfValue(currentChange) !== digestSfValue(change) || !await input.authorizeCase(again.value, context).catch(() => false) || !await input.confirmHuman(request, currentChange, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "receipt-authority-changed" }
        return { status: "ok", value: prior.value.receipt }
      }
      if (change.state !== "planned") return { status: "conflict", reason: "change-not-applicable" }
      const receipts = await input.state.read(source, "receipts", (_state, authority) => sameAuthority(authority, context)).catch(() => undefined)
      if (!receipts || receipts.status !== "ok" || !receipts.value) return { status: "unavailable", reason: "receipt-unavailable" }
      const id = input.createId()
      if (!id.trim()) return { status: "unavailable", reason: "receipt-identity-unavailable" }
      const applied = await input.state.transaction(source, { namespace: "receipts", domainSurface: change.target.surface, expectedStorageVersion: receipts.storageVersion, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: `prepared:${change.idempotencyKey}`, commandDigest: change.operation.commandDigest }, async (state, authority, snapshot) => {
        const actual = state.cases[request.caseRef.id]
        const selected = actual?.preparedChanges.find((item) => item.id === request.changeId && item.choiceId === request.choiceId)
        if (!sameAuthority(authority, context) || !actual || actual.incarnation !== decision.incarnation || actual.version !== decision.version || !actual.participants.includes(context.binding.principalRef) || !actual.choices.some((choice) => choice.id === request.choiceId) || !selected || selected.state !== "planned" || digestSfValue(selected) !== digestSfValue(change)) return { commit: false, value: null }
        const actor = input.resolveActor(snapshot, context)
        if (!actor || actor.id !== context.binding.principalRef || !input.verifyGrant(snapshot, request, selected, actor, context)) return { commit: false, value: null }
        const prior = Object.values(state.receipts).filter((item) => item.surface === selected.target.surface && item.idempotencyKey === selected.idempotencyKey && item.targetIncarnation === selected.target.incarnation && item.principalRef === actor.id)
        if (prior.length > 1) return { commit: false, value: { failure: "unavailable" as const } }
        if (prior[0]) return prior[0].commandDigest === selected.operation.commandDigest ? { commit: false, value: { existing: prior[0] } } : { commit: false, value: { failure: "conflict" as const } }
        const mutation = input.resolveMutation(snapshot, selected, actor, context)
        if (!mutation || mutation.surface !== selected.target.surface || mutation.targetIncarnation !== selected.target.incarnation || mutation.idempotencyKey !== selected.idempotencyKey || mutation.commandDigest !== selected.operation.commandDigest || mutation.expectedVersion !== selected.expectedVersion || selected.operation.expectedVersion !== selected.expectedVersion || selected.operation.command.version !== selected.expectedVersion || selected.operation.idempotencyKey !== selected.idempotencyKey || digestSfValue(selected.operation.target) !== digestSfValue(selected.target) || state.receipts[id]) return { commit: false, value: null }
        const staged = structuredClone(snapshot)
        const outcome = mutation.execute(staged, actor, input.environment(context))
        const status = outcome.value && typeof outcome.value === "object" && !Array.isArray(outcome.value) && "status" in outcome.value ? outcome.value.status : undefined
        if (!outcome.commit && status !== "conflict" && status !== "denied" && status !== "failed") return { commit: false, value: { failure: "unavailable" as const } }
        const target = outcome.commit ? staged : snapshot
        const version = input.receiptVersion(target, selected, actor)
        if (!Number.isSafeInteger(version) || version! < 0 || !input.verifyGrant(target, request, selected, actor, context)) return { commit: false, value: null }
        const result: CommandReceipt["result"] = outcome.commit ? { ok: true, value: outcome.value } : { ok: false, status: status === "conflict" ? 409 : status === "denied" ? 403 : 422, errors: ["domain-application-rejected"] }
        const receipt: CommandReceipt = { id, surface: mutation.surface, idempotencyKey: mutation.idempotencyKey, commandDigest: mutation.commandDigest, targetIncarnation: mutation.targetIncarnation, principalRef: actor.id, version: version!, result, at: input.now() }
        if (outcome.commit) Object.assign(snapshot, staged)
        state.receipts[id] = receipt
        return { commit: true, value: receipt }
      }).catch(() => undefined)
      if (applied?.status === "preview" && applied.value && "existing" in applied.value && applied.value.existing) {
        const receipt = applied.value.existing
        if (!await input.authorizeCase(decision, context).catch(() => false) || !await input.confirmHuman(request, change, context).catch(() => false) || !await input.authorizeReceipt(receipt, { surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "receipt-access-unavailable" }
        return { status: "ok", value: receipt }
      }
      if (applied?.status === "preview" && applied.value && "failure" in applied.value && applied.value.failure) return { status: applied.value.failure, reason: "domain-application-rejected" }
      if (!applied || applied.status !== "ok" || !applied.value || "failure" in applied.value || "existing" in applied.value) return { status: applied?.status === "conflict" ? "conflict" : "unavailable", reason: "domain-application-unavailable" }
      if (!await input.authorizeCase(decision, context).catch(() => false) || !await input.confirmHuman(request, change, context).catch(() => false) || !await input.authorizeReceipt(applied.value, { surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "receipt-authority-changed" }
      return { status: "ok", value: applied.value }
    },
  }
  return port
}

function sameAuthority(authority: { principalRef: string; policyVersion: string; accessRevision: string }, context: TrustedDomainContext) {
  return authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
}
