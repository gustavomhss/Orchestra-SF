import type { SF_U05_COPY } from "@/i18n/orchestra-chapters/sf-u05"
import type { SfProjectMilestone, SfProjectRecord } from "./model"

type CopyKey = keyof typeof SF_U05_COPY

/** Labels only. Canonical values and producer ordering are never changed. */
export function sfProjectStatusKey(status: SfProjectRecord["status"]): CopyKey {
  if (status === "Planning") return "sf.u05.projects.status.Planning"
  if (status === "In Progress") return "sf.u05.projects.status.InProgress"
  if (status === "On Hold") return "sf.u05.projects.status.OnHold"
  if (status === "Completed") return "sf.u05.projects.status.Completed"
  return "sf.u05.projects.notRecorded"
}

export function sfProjectRiskKey(risk: SfProjectRecord["risk"]): CopyKey {
  if (risk === "Low") return "sf.u05.projects.risk.Low"
  if (risk === "Medium") return "sf.u05.projects.risk.Medium"
  if (risk === "High") return "sf.u05.projects.risk.High"
  return "sf.u05.projects.notRecorded"
}

export function sfMilestoneStatusKey(status: SfProjectMilestone["status"]): CopyKey {
  if (status === "done") return "sf.u05.projects.milestone.done"
  if (status === "in-progress") return "sf.u05.projects.milestone.inprogress"
  if (status === "upcoming") return "sf.u05.projects.milestone.upcoming"
  if (status === "late") return "sf.u05.projects.milestone.late"
  return "sf.u05.projects.notRecorded"
}
