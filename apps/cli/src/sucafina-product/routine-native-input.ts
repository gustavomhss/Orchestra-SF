import { Option, Schema } from "effect"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { RoutineAdmittedInput } from "../../../../modules/sucafina/Sucafinav1/product/routines/result-access.ts"
import { routineInputDigest } from "../../../../modules/sucafina/Sucafinav1/product/routines/result-access.ts"
import type { NativePlan } from "./routine-native-records.ts"

/** Part of the existing, reviewed native workflow parameters, never a second admission record. */
export const SF_ROUTINE_INPUT_PARAMETER = "SF_ROUTINE_INPUT"

const ownerSchema = Schema.Struct({
  installationId: Schema.NonEmptyString,
  hostId: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  locationId: Schema.NonEmptyString,
  authoritySessionId: Schema.NonEmptyString,
  principalRef: Schema.NonEmptyString,
  policyVersion: Schema.NonEmptyString,
  accessRevision: Schema.NonEmptyString,
  providerGeneration: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})

const inputSchema = Schema.Struct({
  schema: Schema.Literal("sf-routine-native-input-v1"),
  purpose: Schema.NonEmptyString,
  owner: ownerSchema,
  caseRef: Schema.Struct({ id: Schema.NonEmptyString, incarnation: Schema.NonEmptyString, version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)) }),
  publishedRecipeRef: Schema.NonEmptyString,
  inputRefs: Schema.Array(Schema.NonEmptyString),
  parameters: Schema.Unknown,
  sourceRefs: Schema.Array(Schema.Unknown),
})

export type SfRoutineNativeOwner = Schema.Schema.Type<typeof ownerSchema>
export type SfRoutineNativeInput = {
  purpose: string
  owner: SfRoutineNativeOwner
  input: RoutineAdmittedInput
  inputDigest: string
  sourceRefs: readonly SourceRef[]
}

/**
 * The revision's native hash covers the retained SF input. Its own ID is added only after reading it:
 * putting planRevisionId/inputDigest inside that same hashed plan would require an impossible self-reference.
 * Publication, parameters and ordered write paths still come from the exact approved workflow binding.
 */
export function readSfRoutineNativeInput(revision: NativePlan): SfRoutineNativeInput | undefined {
  const encoded = revision.workflowBinding.parameters[SF_ROUTINE_INPUT_PARAMETER]
  if (typeof encoded !== "string" || encoded.length > 256 * 1024) return undefined
  const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(encoded)
  if (Option.isNone(json)) return undefined
  const decoded = Schema.decodeUnknownOption(inputSchema)(json.value, { onExcessProperty: "error" })
  if (Option.isNone(decoded)) return undefined
  const retained = decoded.value
  const publication = revision.workflowBinding.publication
  if (retained.owner.projectId !== publication.projectID || retained.owner.authoritySessionId !== revision.sessionID ||
    retained.publishedRecipeRef !== publication.documentID) return undefined
  const operation = decodeSfOperationInput("sf_routine_prepare", {
    publishedRecipeRef: retained.publishedRecipeRef, inputRefs: retained.inputRefs, parameters: retained.parameters,
  })
  if (!operation.ok) return undefined
  // Reuse the frozen C07 decoder for every SourceRef, including its closed fields and versions.
  const result = decodeSfOperationOutput("sf_routine_status", {
    admission: "preparing", documentId: publication.documentID, publishedVersion: publication.activeVersionID,
    principalRef: retained.owner.principalRef, projectId: retained.owner.projectId, correlationId: revision.id,
    sourceRefs: retained.sourceRefs, pending: [],
  })
  if (!result.ok) return undefined
  const input: RoutineAdmittedInput = {
    ...operation.value, parameters: operation.value.parameters,
    planRevisionId: revision.id, writeScope: [...revision.workflowBinding.writePaths],
    publishedVersion: publication.activeVersionID, principalRef: retained.owner.principalRef,
    projectId: retained.owner.projectId, caseRef: { ...retained.caseRef },
  }
  return { purpose: retained.purpose, owner: { ...retained.owner }, input, inputDigest: routineInputDigest(input), sourceRefs: result.value.sourceRefs }
}

export function sameSfRoutineNativeOwner(left: SfRoutineNativeOwner, right: SfRoutineNativeOwner) {
  return digestSfValue(left) === digestSfValue(right)
}
