import type { BusinessPorts } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { SfOperationInputMap, WorkListRequest, KnowledgeSearchRequest } from "../contracts/operations.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { decisionDesk, routineStatus, workList } from "./components.ts"
import { esc } from "../../src/screen-shell.ts"

/** Dispatch UI work through the same host-bound capability path as other consumers. */
export async function dispatchUiOperation<K extends keyof SfOperationInputMap>(ports: Pick<BusinessPorts, "dispatch">, binding: TrustedUiContext, operation: K, input: SfOperationInputMap[K]) {
  const request = decodeSfOperationInput(operation, input)
  if (!request.ok) return { status: "failed" as const, reason: "The request is invalid." }
  const result = await ports.dispatch(operation, request.value, binding)
  if (result.status !== "ok") return { status: result.status, reason: result.reason }
  const decoded = decodeSfOperationOutput(operation, result.result)
  if (!decoded.ok) return { status: "failed" as const, reason: "The result could not be displayed." }
  return { status: "ok" as const, value: decoded.value, outputRef: result.outputRef, receipt: result.receipt }
}

/** The binding comes from the host's private UI registry, never from browser input. */
export async function readDecisionView(ports: Pick<BusinessPorts, "dispatch">, binding: TrustedUiContext, caseRef: string) {
  const result = await dispatchUiOperation(ports, binding, "sf_case_read", { caseRef })
  if (result.status !== "ok") return { status: result.status, reason: result.reason }
  return { status: "ok" as const, html: decisionDesk(result.value), outputRef: result.outputRef, receipt: result.receipt }
}

export async function readWorkView(ports: Pick<BusinessPorts, "dispatch">, binding: TrustedUiContext, request: WorkListRequest) {
  const result = await dispatchUiOperation(ports, binding, "sf_work_list", request)
  if (result.status !== "ok") return { status: result.status, reason: result.reason }
  return { status: "ok" as const, html: workList(result.value), outputRef: result.outputRef, receipt: result.receipt }
}

export async function searchEvidenceView(ports: Pick<BusinessPorts, "dispatch">, binding: TrustedUiContext, request: KnowledgeSearchRequest) {
  const result = await dispatchUiOperation(ports, binding, "sf_knowledge_search", request)
  if (result.status !== "ok") return { status: result.status, reason: result.reason }
  const matches = result.value.matches
  const html = `<section aria-label="Search results"><h2>Search results</h2>${matches.length ? `<ul>${matches.map((item) => `<li><strong>${esc(item.documentRef.refId)}</strong><p>${esc(item.text)}</p></li>`).join("")}</ul>` : "<p>No accessible results.</p>"}${result.value.limitations.length ? `<ul>${result.value.limitations.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}</section>`
  return { status: "ok" as const, html, outputRef: result.outputRef, receipt: result.receipt }
}

export async function readRoutineView(ports: Pick<BusinessPorts, "dispatch">, binding: TrustedUiContext, runRef: string) {
  const result = await dispatchUiOperation(ports, binding, "sf_routine_status", { runRef })
  if (result.status !== "ok") return { status: result.status, reason: result.reason }
  return { status: "ok" as const, html: routineStatus(result.value), outputRef: result.outputRef, receipt: result.receipt }
}
