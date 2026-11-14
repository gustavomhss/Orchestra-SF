/** Logical records in keyed dashboard maps. Invalid persisted shapes fail closed. */
export function normalizeDashboardRecords(collection: string, value: unknown): Record<string, unknown>[] | undefined {
  if (value === undefined) return []
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (collection === "budgetYtd") {
    if (entries.some(([kind, group]) => !["opex", "capex"].includes(kind) || !group || typeof group !== "object" || Array.isArray(group))) return undefined
    const records = entries.flatMap(([kind, group]) => Object.entries(group as Record<string, unknown>).map(([key, data]) => {
      const match = /^(\d{4}):(.+)$/.exec(key)
      if (!match || !data || typeof data !== "object" || Array.isArray(data)) return undefined
      return { ...data, id: JSON.stringify([kind, key]), kind, year: Number(match[1]), ownerId: match[2] }
    }))
    return records.every((record) => record !== undefined) ? records : undefined
  }
  if (collection === "deviations") {
    const records = entries.map(([id, data]) => {
      const match = /^(opex|capex)-(.+)-(\d{4})-(\d{1,2})$/.exec(id)
      if (!match || Number(match[4]) < 1 || Number(match[4]) > 12 || !data || typeof data !== "object" || Array.isArray(data)) return undefined
      return { ...data, id, kind: match[1], ownerId: match[2], year: Number(match[3]), month: Number(match[4]) }
    })
    return records.every((record) => record !== undefined) ? records : undefined
  }
  if (collection === "budgetCurrentMonth" || collection === "revenueByYear") {
    const records = entries.map(([id, amount]) => /^\d{4}$/.test(id) && typeof amount === "number" && Number.isFinite(amount) ? { id, year: Number(id), value: amount } : undefined)
    return records.every((record) => record !== undefined) ? records : undefined
  }
  return undefined
}
