import type { RoutineResult } from "../contracts/context.ts"

export type RoutineExecutionState = "not-started" | "running" | "completed" | "failed" | "cancelled" | "unknown"
export type RoutinePresentation = {
  state: "requested" | "admission-pending" | "preparing" | "reviewable" | "blocked" | "failed" | "cancelled"
  title: string
  nextAction: "review-admission" | "wait" | "open-result" | "correct-input" | "prepare-again"
}

/** Native execution and authenticated output are separate facts; neither an arm nor a URL proves completion. */
export function presentRoutineLifecycle(input: { run: RoutineResult; execution: RoutineExecutionState; outputAuthorized: boolean }): RoutinePresentation {
  if (input.run.admission === "denied" || input.run.admission === "unavailable" || input.run.admission === "stale")
    return { state: "blocked", title: "Preparação bloqueada", nextAction: "correct-input" }
  if (input.execution === "cancelled") return { state: "cancelled", title: "Preparação cancelada", nextAction: "prepare-again" }
  if (input.execution === "failed") return { state: "failed", title: "A preparação falhou", nextAction: "correct-input" }
  if (input.run.admission === "needs-review") return { state: "admission-pending", title: "Aguardando revisão da solicitação", nextAction: "review-admission" }
  if (input.run.admission === "preparing") return { state: "requested", title: "Solicitação em preparação", nextAction: "wait" }
  if (input.execution === "completed" && input.run.resultRef && input.outputAuthorized)
    return { state: "reviewable", title: "Resultado disponível para revisão", nextAction: "open-result" }
  if (input.execution === "running" && input.run.runRef) return { state: "preparing", title: "Preparando material", nextAction: "wait" }
  if (input.execution === "not-started") return { state: "requested", title: "Solicitação admitida", nextAction: "wait" }
  return { state: "blocked", title: "Resultado ainda não verificável", nextAction: "correct-input" }
}
