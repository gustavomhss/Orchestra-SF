import { isDeepStrictEqual } from "node:util"
import type { NativeAdmission } from "./routine-native-records.ts"

/** Internal observation adapter; this issues NO Source, approval, permission, or execution capability.
 * Its inputs must come from the canonical native records reader, which verifies event/Task/Relay bindings.
 */
export function captureSfRoutineApprovedChain(record: NativeAdmission) {
  if (record.state !== "preparing" || record.reservation || record.bound || record.parent.revert || !approved(record)) return undefined
  const before = freeze(structuredClone(record))
  const progress: { reservation?: NativeAdmission["reservation"]; bound?: NativeAdmission["bound"] } = {}
  return {
    before,
    accept: (after: NativeAdmission) => {
      if (!approved(after) || !isDeepStrictEqual(immutable(before), immutable(after)) || after.parent.time.archived || after.parent.revert) return false
      if (progress.reservation && !isDeepStrictEqual(progress.reservation, after.reservation) ||
        progress.bound && !isDeepStrictEqual(progress.bound, after.bound)) return false
      if (!after.reservation) return after.state === "preparing" && !after.bound &&
        after.reference === before.reference && after.version === before.version
      if (after.reference !== after.reservation.id || after.version !== after.reservation.seq || after.version <= before.version ||
        !(after.state === "preparing" && !after.bound || after.state === "admitted" && !!after.bound)) return false
      // Native reservation -> workflow binding may be observed on separate fences. Neither may regress or change.
      progress.reservation ??= freeze(structuredClone(after.reservation))
      if (after.bound) progress.bound ??= freeze(structuredClone(after.bound))
      return true
    },
  }
}

function immutable(value: NativeAdmission) {
  return { authorizationID: value.authorizationID, revision: value.revision, authorization: value.authorization,
    validation: value.validation, context: value.context, review: value.review, approval: value.approval,
    presentation: value.presentation, parent: { id: value.parent.id, parentID: value.parent.parentID,
      projectID: value.parent.projectID, agent: value.parent.agent, model: value.parent.model, location: value.parent.location } }
}
function approved(value: NativeAdmission) {
  return value.review?.verdict === "APPROVE" && value.approval?.outcome === "APPROVED" && !!value.presentation
}
function freeze<A>(value: A): A {
  if (!value || typeof value !== "object") return value
  Object.values(value).forEach(freeze)
  return Object.freeze(value)
}
