import type { SfProductState, SfStateNamespace } from "./state.ts"

/** C08 layout only. WP10 applies additive migration inside the existing Persistence transaction. */
export const sfProductStateSchemaVersion = 1 as const

/** A namespace owns these fields; aliases never inherit authority from their storage surface. */
export const sfProductStateNamespaceFields = {
  preferences: ["preferences"],
  reviews: ["reviews"],
  relations: ["relations"],
  threads: ["threads"],
  confirmations: ["confirmations"],
  cases: ["cases", "claimBindings", "commandProposals", "compositeScenarios", "decisionResults"],
  contributions: ["contributions", "nativeRuns"],
  documents: ["documents"],
  receipts: ["receipts"],
  atlas: ["atlas"],
  outbox: ["outbox"],
  "bi-artifacts": ["biArtifacts"],
} as const satisfies Record<SfStateNamespace, readonly (keyof SfProductState)[]>

/** Provider-owned metadata is never writable through an application callback. */
export const sfProductStateProviderFields = ["schemaVersion", "revision", "versions", "incarnation", "transactions"] as const satisfies readonly (keyof SfProductState)[]

/** Older v1 stores may omit only these additive fields, not erase an existing field or version. */
export const sfProductStateAdditiveFields = ["claimBindings", "commandProposals", "compositeScenarios", "decisionResults", "nativeRuns", "biArtifacts"] as const satisfies readonly (keyof SfProductState)[]
