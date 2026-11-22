export type SfExecutiveRecord = Readonly<{
  kind: "project" | "risk" | "stakeholder" | "topic"
  ref: string
}>
