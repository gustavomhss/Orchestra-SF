import type { Environment, Snapshot } from "../../runtime/contract.ts"

/** Preview IDs stay local and cannot replace live or revision-only records. */
export function createPlannerPreviewEnvironment(snapshot: Snapshot, environment: Environment, prefix = "planner-preview"): Environment {
  const occupied = new Set(Object.keys(snapshot.versions).flatMap((key) => [key, key.split(":").at(-1)!]))
  const visited = new Set<object>()
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      occupied.add(value)
      return
    }
    if (!value || typeof value !== "object" || visited.has(value)) return
    visited.add(value)
    for (const [key, entry] of Object.entries(value)) {
      occupied.add(key)
      visit(entry)
    }
  }
  // Include legacy dictionary keys and all version/HR/catalog collections.
  visit(snapshot.data)
  const sequence = { value: 0 }
  return { ...environment, id: () => {
    while (occupied.has(`${prefix}-${sequence.value}`)) sequence.value++
    const id = `${prefix}-${sequence.value++}`
    occupied.add(id)
    return id
  } }
}

