import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PurchasePreparationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

const unavailable = { status: "unavailable", reason: "analysis-input-producer-unavailable" } as const

type PurchaseSelection = {
  choiceId: string
  requestRef: string
  targets: readonly { id: string; fields: readonly string[] }[]
  includeCommercialComparisons: boolean
}

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function selection(value: unknown): PurchaseSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.some(([key]) => !["choiceId", "requestRef", "targets", "includeCommercialComparisons"].includes(key))) return undefined
  const choiceId = entries.find(([key]) => key === "choiceId")?.[1]
  const requestRef = entries.find(([key]) => key === "requestRef")?.[1]
  const targets = entries.find(([key]) => key === "targets")?.[1]
  const includeCommercialComparisons = entries.find(([key]) => key === "includeCommercialComparisons")?.[1]
  if (typeof includeCommercialComparisons !== "boolean" || typeof choiceId !== "string" || !choiceId.trim() || typeof requestRef !== "string" || !requestRef.trim() || !Array.isArray(targets) || !targets.length) return undefined
  if (targets.some((target) => !target || typeof target !== "object" || Array.isArray(target))) return undefined
  const parsed = targets.flatMap((target) => {
    const fields = Object.entries(target)
    if (fields.some(([key]) => key !== "id" && key !== "fields")) return []
    const id = fields.find(([key]) => key === "id")?.[1]
    const names = fields.find(([key]) => key === "fields")?.[1]
    if (typeof id !== "string" || !id.trim() || !Array.isArray(names) || !names.length || names.some((field) => typeof field !== "string" || !field.trim()) || new Set(names).size !== names.length) return []
    return [{ id, fields: names }]
  })
  if (parsed.length !== targets.length || new Set(parsed.map((target) => target.id)).size !== parsed.length) return undefined
  return { choiceId, requestRef, targets: parsed, includeCommercialComparisons }
}

function covers(target: SourceRef, id: string, fields: readonly string[]) {
  return target.id === id && same([...target.fields].sort(), [...fields].sort())
}

export function createSfPurchaseInputProducer(dependencies: SfAnalysisDependencies): SfInputProducer {
  return {
    skillIds: ["sf-preparar-compra"],
    prepare: async (raw, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = selection(raw)
      if (!human) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (human.includeCommercialComparisons) return { status: "unavailable", reason: "commercial-comparison-binding-unavailable" }
      const first = await load(dependencies, human, request, call)
      const second = await load(dependencies, human, request, call)
      if (!first || !second || !same(first.input, second.input) || first.accessRevision !== second.accessRevision || first.accessRevision !== call.binding.accessRevision) return unavailable
      const decoded = decodeSfSkillInput("PurchasePreparationInput", second.input)
      return decoded.ok ? { status: "ok", value: decoded.value } : unavailable
    },
  }
}

async function load(dependencies: SfAnalysisDependencies, human: PurchaseSelection, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<{ input: PurchasePreparationInput; accessRevision: string } | undefined> {
  if (!(await dependencies.host.revalidate(call))) return undefined
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
  const choice = current.value.case.choices.find((item) => item.id === human.choiceId)
  if (!choice || !current.value.case.alternatives.some((alternative) => alternative.id === choice.alternativeId)) return undefined
  const purchase = await dependencies.procurement.read({ requestRef: human.requestRef }, call)
  if (purchase.status !== "ok") return undefined
  const status = purchase.value.values.find((item) => item.id === "status" && item.evidenceState === "confirmed")
  if (!status || typeof status.value !== "string") return undefined
  const requestRefs = status.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request")
  if (requestRefs.length !== 1) return undefined
  const version = requestRefs[0]?.target.version
  if (version === undefined) return undefined
  const storedTargets = [
    ...purchase.value.context.sourceRefs,
    ...current.value.case.preparedChanges.filter((change) => change.choiceId === choice.id).map((change) => change.target),
  ]
  const allowedChangeTargets = human.targets.flatMap((selected) => {
    const found = storedTargets.filter((target) => covers(target, selected.id, selected.fields))
    return found.length === 1 && found[0] ? [found[0]] : []
  })
  if (allowedChangeTargets.length !== human.targets.length) return undefined
  const targetRefs = allowedChangeTargets.flatMap((target) => current.value.evidenceRefs.filter((ref) => ref.kind === "record" && ref.target.surface === target.surface && ref.target.recordType === target.type && ref.target.recordId === target.id && ref.target.incarnation === target.incarnation && ref.target.version === target.version && ref.target.period?.start === target.period.start && ref.target.period.end === target.period.end && target.fields.every((field) => ref.target.fields.includes(field))))
  if (allowedChangeTargets.some((target) => !targetRefs.some((ref) => ref.kind === "record" && ref.target.surface === target.surface && ref.target.recordType === target.type && ref.target.recordId === target.id && ref.target.incarnation === target.incarnation && ref.target.version === target.version && ref.target.period?.start === target.period.start && ref.target.period.end === target.period.end && target.fields.every((field) => ref.target.fields.includes(field))))) return undefined
  const refs = [...requestRefs, ...choice.evidenceRefs, ...targetRefs].filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
  if (refs.some((ref) => !current.value.evidenceRefs.some((item) => same(item, ref)))) return undefined
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref) || item.accessRevision !== call.binding.accessRevision) || !(await dependencies.host.revalidate(call))) return undefined
  const input: PurchasePreparationInput = {
    choice,
    request: { requestRef: human.requestRef, version, stage: status.value },
    allowedChangeTargets,
    commercialComparisons: [],
  }
  return { input, accessRevision: call.binding.accessRevision }
}
