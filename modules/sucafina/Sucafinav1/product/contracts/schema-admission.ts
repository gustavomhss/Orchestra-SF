import { isSfPeriod } from "./validation.ts"
import { sfOperationInputSchemas } from "./operations.ts"
import type { SfOperationInputMap } from "./operations.ts"
import { sfContributionOutputSchemas, sfOperationOutputSchemas } from "./output-schemas.ts"
import type { SfContributionOutputMap, SfOperationOutputMap } from "./outputs.ts"

type JsonSchema = {
  "x-sf-period"?: boolean
  $ref?: string
  type?: string | readonly string[]
  const?: unknown
  enum?: readonly unknown[]
  anyOf?: readonly JsonSchema[]
  oneOf?: readonly JsonSchema[]
  not?: JsonSchema
  properties?: Readonly<Record<string, JsonSchema>>
  additionalProperties?: boolean
  required?: readonly string[]
  items?: JsonSchema
  minimum?: number
  minLength?: number
  pattern?: string
  definitions?: Readonly<Record<string, JsonSchema>>
}

export function decodeSfOperationInput<K extends keyof SfOperationInputMap>(operation: K, value: unknown): { ok: true; value: SfOperationInputMap[K] } | { ok: false; reason: "invalid-operation-input" } {
  const schema = sfOperationInputSchemas[operation]
  if (!schema || !valid(schema, value, schema.definitions)) return { ok: false, reason: "invalid-operation-input" }
  return { ok: true, value: structuredClone(value) as SfOperationInputMap[K] }
}

export function decodeSfContributionOutput<K extends keyof SfContributionOutputMap>(kind: K, value: unknown): { ok: true; value: SfContributionOutputMap[K] } | { ok: false; reason: "invalid-contribution-output" } {
  const schema = sfContributionOutputSchemas[kind]
  if (!schema || !valid(schema, value, schema.definitions)) return { ok: false, reason: "invalid-contribution-output" }
  return { ok: true, value: structuredClone(value) as SfContributionOutputMap[K] }
}

export function decodeSfOperationOutput<K extends keyof SfOperationOutputMap>(operation: K, value: unknown): { ok: true; value: SfOperationOutputMap[K] } | { ok: false; reason: "invalid-operation-output" } {
  const schema = sfOperationOutputSchemas[operation]
  if (!schema || !valid(schema, value, schema.definitions)) return { ok: false, reason: "invalid-operation-output" }
  return { ok: true, value: structuredClone(value) as SfOperationOutputMap[K] }
}

function valid(schema: JsonSchema, value: unknown, definitions: Readonly<Record<string, JsonSchema>>, depth = 0): boolean {
  if (depth > 100 || (schema["x-sf-period"] && !isSfPeriod(value))) return false
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/definitions/")) return false
    const target = definitions[schema.$ref.slice("#/definitions/".length)]
    return !!target && valid(target, value, definitions, depth + 1)
  }
  if (schema.not && valid(schema.not, value, definitions, depth + 1)) return false
  if (schema.anyOf && !schema.anyOf.some((entry) => valid(entry, value, definitions, depth + 1))) return false
  if (schema.oneOf && schema.oneOf.filter((entry) => valid(entry, value, definitions, depth + 1)).length !== 1) return false
  if (Object.hasOwn(schema, "const") && value !== schema.const) return false
  if (schema.enum && !schema.enum.includes(value)) return false
  if (Array.isArray(schema.type)) return schema.type.some((type) => valid({ ...schema, type }, value, definitions, depth + 1))
  if (schema.type === "null") return value === null
  if (schema.type === "boolean") return typeof value === "boolean"
  if (schema.type === "string") return typeof value === "string" && (schema.minLength === undefined || value.length >= schema.minLength) && (!schema.pattern || new RegExp(schema.pattern).test(value))
  if (schema.type === "number" || schema.type === "integer")
    return typeof value === "number" && Number.isFinite(value) && (schema.type !== "integer" || Number.isSafeInteger(value)) && (schema.minimum === undefined || value >= schema.minimum)
  if (schema.type === "array") return Array.isArray(value) && (!schema.items || value.every((item) => valid(schema.items!, item, definitions, depth + 1)))
  if (schema.type !== "object") return true
  if (value === null || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false
  const input = value as Record<string, unknown>
  if (schema.required?.some((key) => !Object.hasOwn(input, key))) return false
  if (schema.additionalProperties === false && Reflect.ownKeys(input).some((key) => typeof key !== "string" || !Object.hasOwn(schema.properties ?? {}, key))) return false
  return Object.entries(schema.properties ?? {}).every(([key, property]) => !Object.hasOwn(input, key) || valid(property, input[key], definitions, depth + 1))
}
