export const operationalCase = {
  context: { kind: "ui", installationId: "installation", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "revision" },
  case: { id: "0", incarnation: "incarnation", version: 1, state: "draft", objective: "Review",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [], participants: ["person"],
    sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [] },
  events: [], evidenceRefs: [], checkedAt: "2026-01-01T00:00:00Z",
} as const
