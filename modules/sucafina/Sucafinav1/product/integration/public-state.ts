/** Legacy views and backups never carry the private product authority or receipts. */
export function publicSfData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__sfProductV1").map(([key, value]) => [key, publicSfValue(value)]))
}

function publicSfValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicSfValue)
  if (value !== null && typeof value === "object") return publicSfData(value as Record<string, unknown>)
  return value
}
