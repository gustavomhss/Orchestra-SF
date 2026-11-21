import { object } from "./contract.ts"

const installationKeys = [
  "roleMap",
  "access",
  "budgetLineIds",
  "summaries",
  "assets",
  "noticeDelivery",
  "noticeClaims",
  "noticeSchedule",
]
const attachmentFields = ["docs", "documents", "attachments"]

type PreparedDashboardImport = { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[] }

export function prepareDashboardImport(
  current: Record<string, unknown>,
  imported: Record<string, unknown>,
): PreparedDashboardImport {
  const errors: string[] = []
  if (Object.hasOwn(imported, "__sfProductV1")) errors.push("Product metadata cannot be imported from a business backup.")
  const currentContracts = contracts(current.contracts, "Current", errors)
  const importedContracts = contracts(imported.contracts, "Imported", errors)
  for (const parent of currentContracts) {
    const references = attachments(parent, errors)
    if (!references.length) continue
    const matches = importedContracts.filter((candidate) => identifier(candidate.id) === identifier(parent.id))
    if (!identifier(parent.id) || matches.length !== 1)
      errors.push(
        `Contract ${identifier(parent.id) || "without ID"} has files and must remain in the import with the same ID.`,
      )
  }
  for (const parent of importedContracts) {
    const references = attachments(parent, errors)
    const matches = currentContracts.filter((candidate) => identifier(candidate.id) === identifier(parent.id))
    if (!references.length) continue
    const stored = matches.length === 1 ? matches[0] : undefined
    const trusted = stored ? attachments(stored, errors) : []
    if (
      !identifier(parent.id) ||
      !stored ||
      references.some((reference) => !trusted.some((candidate) => equivalentReference(candidate, reference)))
    )
      errors.push(
        `Contract ${identifier(parent.id) || "without ID"} introduces file references. Use a verified private restore to import files.`,
      )
  }
  if (errors.length) return { ok: false, errors }

  // Omit untrusted installation values before cloning, including indexes supplied by backups.
  const data = structuredClone(
    Object.fromEntries(Object.entries(imported).filter(([key]) => !installationKeys.includes(key) && key !== "__sfProductV1")),
  )
  for (const key of installationKeys) if (Object.hasOwn(current, key)) data[key] = structuredClone(current[key])
  if (Object.hasOwn(current, "__sfProductV1")) data.__sfProductV1 = structuredClone(current.__sfProductV1)
  if (Array.isArray(data.contracts)) {
    data.contracts = data.contracts.map((value: unknown) => {
      const parent = object(value)
      const stored = currentContracts.find((candidate) => identifier(candidate.id) === identifier(parent.id))
      for (const field of attachmentFields) {
        if (stored && Object.hasOwn(stored, field)) parent[field] = structuredClone(stored[field])
        else delete parent[field]
      }
      return parent
    })
  }
  return { ok: true, data }
}

function contracts(value: unknown, source: string, errors: string[]): Record<string, unknown>[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    errors.push(`${source} contracts must be a list.`)
    return []
  }
  const records = value.filter(
    (entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object" && !Array.isArray(entry),
  )
  if (records.length !== value.length) errors.push(`${source} contracts contain an invalid record.`)
  const ids = records.map((record) => identifier(record.id)).filter(Boolean)
  if (new Set(ids).size !== ids.length) errors.push(`${source} contracts contain duplicate IDs.`)
  return records
}

function attachments(parent: Record<string, unknown>, errors: string[]) {
  return attachmentFields.flatMap((field) => {
    const value = parent[field]
    if (value == null) return []
    if (!Array.isArray(value)) {
      errors.push(`Contract ${identifier(parent.id) || "without ID"} has an invalid ${field} list.`)
      return []
    }
    return value.map((reference: unknown) => {
      if (
        reference === null ||
        typeof reference !== "object" ||
        Array.isArray(reference) ||
        !identifier(object(reference).id)
      )
        errors.push(`Contract ${identifier(parent.id) || "without ID"} has an invalid file reference.`)
      return object(reference)
    })
  })
}

function equivalentReference(current: Record<string, unknown>, imported: Record<string, unknown>) {
  if (!identifier(current.id) || identifier(current.id) !== identifier(imported.id)) return false
  // A backup may omit private locators. A supplied locator must still match trusted storage.
  return ["key", "blobKey", "assetId", "url", "path"].every(
    (field) => !Object.hasOwn(imported, field) || imported[field] === current[field],
  )
}

function identifier(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}
