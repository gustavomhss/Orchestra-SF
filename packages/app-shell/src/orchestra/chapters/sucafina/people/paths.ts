import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"

/** The semantic return retains the admitted owner; F01 still authorizes the destination. */
export function sfPeopleCollectionHref(
  from: SfResolvedRoute<"CAP07" | "CAP08">,
  status?: string,
): string | undefined {
  const owner = from.ownerSelection
  if (!owner.serverKey || !owner.projectId || !owner.installationId) return undefined
  const query = new URLSearchParams({
    server: owner.serverKey, project: owner.projectId, installation: owner.installationId,
  })
  if (from.query.year !== undefined) query.set("year", String(from.query.year))
  if (from.query.month !== undefined) query.set("month", String(from.query.month))
  if (from.surfaceId === "CAP08") {
    const filter = status ?? from.query.status
    if (filter !== undefined) query.set("status", filter)
  }
  return (from.surfaceId === "CAP07" ? "/orchestra/sf-people/structure" : "/orchestra/sf-people/talent") + "?" + query.toString()
}
