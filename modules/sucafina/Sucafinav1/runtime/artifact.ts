import type { Result } from "./contract.ts"
export type Artifact = {
  ok: true
  name: string
  type: string
  bytes: Uint8Array
}
export type ArtifactResult = Artifact | Exclude<Result, { ok: true }>
