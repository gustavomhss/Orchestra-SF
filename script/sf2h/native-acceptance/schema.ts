import { createHash } from "node:crypto"

export const planningSha = "dbf9547211d9b0fade619790de7c19c0869b7c7d"
export const missionSha = "c708ec0609dbfc95b259707d8c38481617f74f11"
export const codeBaseline = "9e4f3d35833f9b2cea6abdf58f42331f3973d9bf"
export const proofIds = ["AM01", "AM02", "AM03", "AM04", "AM05", "AM06"] as const
export const shaPattern = /^[a-f0-9]{40}$/
export const digestPattern = /^[a-f0-9]{64}$/

export function object(value: unknown, label = "value"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: expected object`)
  return value as Record<string, unknown>
}

export function rows(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label}: expected array`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

export function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}: required nonempty string`)
  return value
}

export function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string" && !!entry.trim()))
    throw new Error(`${label}: expected string array`)
  return value
}

export function digest(bytes: string | Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

export function gitBlobDigest(bytes: Uint8Array) {
  return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex")
}

// This serializes proof metadata only. Domain input/result digests come from the
// canonical product receipt, never from a second business implementation.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

export function equal(left: unknown, right: unknown) {
  return canonical(left) === canonical(right)
}

export function exactSet(actual: string[], expected: string[], label: string) {
  if (new Set(actual).size !== actual.length || !equal([...actual].sort(), [...expected].sort()))
    throw new Error(`${label}: missing, duplicate or unexpected member`)
}

export function requireSha(value: unknown, label: string) {
  const result = text(value, label)
  if (!shaPattern.test(result)) throw new Error(`${label}: expected full commit/tree SHA`)
  return result
}

export function requireDigest(value: unknown, label: string) {
  const result = text(value, label)
  if (!digestPattern.test(result)) throw new Error(`${label}: expected SHA256`)
  return result
}

export type ProofCheck = {
  id: string
  proofId: string
  sourcePointer: string
  kind: "positive" | "negative" | "check" | "consumption"
  expected: string
  ownerTasks: string[]
  consumerTasks: string[]
  skillId?: string
  operationId?: string
}

export type PreparedPlan = {
  schema: "sf2h-native-plan-v1"
  planningSha: string
  missionSha: string
  candidateC: string | null
  status: "PREPARED_NOT_RUN"
  nativeAccepted: false
  coverageDigest: string
  counts: { profiles: number; skills: number; packs: number; operations: number; proofDefinitions: number; checks: number }
  requiredReceiptFields: Record<string, string[]>
  campaignEvidenceFields: string[]
  checks: ProofCheck[]
}
