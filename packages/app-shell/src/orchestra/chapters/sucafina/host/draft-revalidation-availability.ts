import type { SfReadableContext } from "../context/contracts"

/** Operational evidence is not an authorization grant; missing evidence is retryable. */
export function draftAvailability(
  fresh: SfReadableContext, family: string, resourceId: string, operations: readonly string[],
): Readonly<{ status: "denied" }> | Readonly<{ status: "unavailable" }> | undefined {
  const resources = fresh.availability.filter((resource) => resource.family === family && resource.resource === resourceId)
  if (resources.length !== 1) return { status: "unavailable" }
  const resource = resources[0]!
  if (resource.state === "denied") return { status: "denied" }
  if (resource.state !== "ready" && resource.state !== "partial") return { status: "unavailable" }
  const observations = operations.map((id) => resource.operations.filter((operation) => operation.operationId === id))
  if (observations.some((matches) => matches.length !== 1)) return { status: "unavailable" }
  if (observations.some((matches) => matches[0]?.state === "unavailable")) return { status: "unavailable" }
  if (observations.some((matches) => matches[0]?.state === "denied")) return { status: "denied" }
  if (observations.some((matches) => matches[0]?.state !== "ready" || matches[0]?.operational !== true))
    return { status: "unavailable" }
  return
}
