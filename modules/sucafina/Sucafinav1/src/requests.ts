// Requester vê só os próprios. Os outros papéis de procurement não ficam restringidos aos próprios.

const OPEN = ["buyer", "approver", "supplier admin", "admin", "viewer"]

export function visibleRequests<T extends { createdBy: string }>(requests: T[], actor: { id: string; roles: string[] }): T[] {
  if (actor.roles.some((role) => OPEN.includes(role))) return requests
  if (actor.roles.includes("requester")) return requests.filter((request) => request.createdBy === actor.id)
  return []
}
