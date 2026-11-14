import type { SfHostServices } from "../contracts/host-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"

type Runtime = Pick<SfHostServices, "human" | "ui" | "state" | "dispatch" | "selected" | "models">
type Analysis = {
  label: string
  profileId: string
  profileVersion: string
  skillId: "sf-enquadrar-decisao" | "sf-explicar-forecast"
  skillVersion: string
  manifestDigest: string
  outputSchemaVersion: "sf-contribution-v1"
  requestedOperationScope: readonly string[]
}

/** Existing cases, installed skills and configured models; this read grants no execution or import authority. */
export async function readSfImportAnalysisChoices(request: Request, runtime: Runtime): Promise<PortResult<{
  cases: readonly { caseRef: { id: string; incarnation: string; version: number }; label: string }[]
  analyses: readonly Analysis[]
  models: Awaited<ReturnType<SfHostServices["models"]>>
}>> {
  const intent = { purpose: "import-analysis-choices" }
  const admitted = await runtime.human.admit(request, "analysis.prepare", intent)
  if (admitted.status !== "ok") return admitted
  try {
    const read = () => runtime.state.read(request, "cases", (state, actor) => Object.values(state.cases)
      .filter((item) => item.participants.includes(actor.principalRef))
      .map((item) => ({ id: item.id, incarnation: item.incarnation, version: item.version, objective: item.objective })))
    const listed = await read()
    if (listed.status !== "ok") return listed.status === "unavailable" && listed.reason === "product-state-uninitialized"
      ? { status: "ok", value: { cases: [], analyses: [], models: [] } }
      : { status: "unavailable", reason: "analysis-case-list-unavailable" }
    if (listed.value.length > 100) return { status: "unavailable", reason: "analysis-case-list-limit" }
    const cases = await Promise.all(listed.value.map(async (item) => {
      const selection = { caseRef: encodeCaseRef(item) }
      const access = await runtime.ui.admit(request, "sf_case_read", digestSfValue(selection))
      if (access.status !== "ok") return undefined
      try {
        const result = await runtime.dispatch("sf_case_read", selection, access.value)
        if (result.status !== "ok" || !await runtime.ui.revalidate(access.value)) return undefined
        const decoded = decodeSfOperationOutput("sf_case_read", result.result)
        if (!decoded.ok || decoded.value.case.id !== item.id || decoded.value.case.incarnation !== item.incarnation || decoded.value.case.version !== item.version) return undefined
        return { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, label: decoded.value.case.objective }
      } finally { runtime.ui.finish(access.value) }
    }))
    const analyses: Analysis[] = []
    for (const kind of [
      { id: "sf-enquadrar-decisao", schema: "DecisionIntentInput", profile: "sf_maestro", label: "Enquadrar a decisão sobre o arquivo" },
      { id: "sf-explicar-forecast", schema: "ForecastExplainInput", profile: "sf_finance", label: "Explicar o impacto no forecast" },
    ] as const) {
      const selected = runtime.selected.find((entry) => entry.profile.id === kind.profile && entry.skills.some((skill) => skill.id === kind.id && skill.inputSchemaRef === kind.schema && skill.allowedOperations.every((operation) => entry.operationIds.includes(operation))))
      const skill = selected?.skills.find((entry) => entry.id === kind.id && entry.inputSchemaRef === kind.schema)
      if (!selected || !skill) continue
      analyses.push({ label: kind.label, profileId: selected.profile.id, profileVersion: selected.profile.version, skillId: kind.id,
        skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...skill.allowedOperations] })
    }
    const models = await runtime.models()
    const current = await read()
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(listed.value) || request.signal.aborted || !await runtime.ui.revalidate(admitted.value) ||
      !await runtime.human.authorize(admitted.value, "analysis.prepare", intent)) return { status: "stale", reason: "analysis-choices-changed" }
    return { status: "ok", value: { cases: cases.filter((item) => item !== undefined), analyses, models } }
  } finally { runtime.human.finish(admitted.value) }
}
