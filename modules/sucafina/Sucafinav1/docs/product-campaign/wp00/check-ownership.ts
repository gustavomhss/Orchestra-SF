export type OwnershipGrant = { owner: string; kind: "exact" | "prefix"; path: string }
export type OwnershipConflict = { left: OwnershipGrant; right: OwnershipGrant }
export type OwnershipTransfer = { from: string; to: string; prefix: string; source: string }

/** Review-time ownership check; it never grants runtime or business authority. */
export function findOwnershipConflicts(grants: readonly OwnershipGrant[], transfers: readonly OwnershipTransfer[] = []): OwnershipConflict[] {
  for (const grant of grants) {
    const components = grant.path.replace(/\/$/, "").split("/")
    if (!grant.owner.trim() || !["exact", "prefix"].includes(grant.kind) ||
      grant.path.includes("\\") || grant.path.includes(":") || /[\x00-\x1f\x7f]/.test(grant.path) ||
      components.some((part) => !part || part === "." || part === "..") ||
      (grant.kind === "prefix") !== grant.path.endsWith("/"))
      throw new Error("Invalid ownership path")
  }
  for (const transfer of transfers) {
    findOwnershipConflicts([{ owner: transfer.to, kind: "prefix", path: transfer.prefix }])
    if (!transfer.from.trim() || transfer.from === transfer.to || !transfer.source.trim() ||
      !grants.some((grant) => grant.owner === transfer.to && grant.kind === "prefix" && grant.path === transfer.prefix) ||
      !grants.some((grant) => grant.owner === transfer.from && grant.kind === "prefix" && grant.path !== transfer.prefix && transfer.prefix.startsWith(grant.path)))
      throw new Error("Invalid ownership transfer")
  }
  return grants.flatMap((left, index) => grants.slice(index + 1)
    .filter((right) => left.owner !== right.owner && (
      left.path === right.path ||
      (left.kind === "prefix" && right.path.startsWith(left.path)) ||
      (right.kind === "prefix" && left.path.startsWith(right.path))
    ) && !transfers.some((transfer) => transferred(left, right, transfer) || transferred(right, left, transfer)))
    .map((right) => ({ left, right })))
}

export function resolveOwnership(file: string, input: {
  grants: readonly OwnershipGrant[]
  exactExceptions: readonly OwnershipGrant[]
  excludedPrefixes: readonly string[]
  transfers?: readonly OwnershipTransfer[]
}) {
  // Validate the lookup too: normalization must never widen a trusted prefix.
  findOwnershipConflicts([{ owner: "lookup", kind: "exact", path: file }])
  const exception = input.exactExceptions.filter((grant) => grant.kind === "exact" && grant.path === file)
  if (exception.length) return [...new Set(exception.map((grant) => grant.owner))]
  if (input.excludedPrefixes.some((prefix) => file.startsWith(prefix))) return []
  return [...new Set(input.grants.filter((grant) => (grant.kind === "exact" ? grant.path === file : file.startsWith(grant.path)) &&
    !input.transfers?.some((transfer) => grant.kind === "prefix" && grant.owner === transfer.from && transfer.prefix.startsWith(grant.path) && file.startsWith(transfer.prefix)))
    .map((grant) => grant.owner))]
}

function transferred(parent: OwnershipGrant, child: OwnershipGrant, transfer: OwnershipTransfer) {
  return parent.kind === "prefix" && parent.owner === transfer.from && child.owner === transfer.to &&
    transfer.prefix.startsWith(parent.path) && child.path.startsWith(transfer.prefix)
}
