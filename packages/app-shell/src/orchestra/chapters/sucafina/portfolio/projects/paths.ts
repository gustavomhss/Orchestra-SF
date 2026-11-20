import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../navigation-state"

/**
 * The input is a previously resolved, same-owner F01 route; copy only its
 * complete explicit owner triplet (or none), never infer a new owner.
 * Every resulting URL still passes through F01 route authorization.
 */
export function sfProjectHref(
  from: SfResolvedRoute<"CAP09" | "CAP10">,
  kind: "overview" | "projects" | "imports" | "new" | "detail" | "edit" | "milestones",
  originalProjectRef?: string,
): string | null {
  const owner = new URL(String(from.href), "http://orchestra.invalid")
  const values = ["server", "project", "installation"].map((key) => owner.searchParams.getAll(key))
  if (values.some((items) => items.length > 1) ||
    (!values.every((items) => items.length === 0) &&
     !values.every((items) => items.length === 1 && !!items[0]))) return null
  const query = new URLSearchParams()
  if (values.every((items) => items.length === 1)) {
    query.set("server", values[0]![0]!)
    query.set("project", values[1]![0]!)
    query.set("installation", values[2]![0]!)
  }
  if (from.query.year !== undefined) query.set("year", String(from.query.year))
  if (kind === "overview" || kind === "projects") {
    if (from.query.status !== undefined) query.set("status", from.query.status)
    if (from.query.filter !== undefined) query.set("filter", from.query.filter)
  }
  let path = "/orchestra/sf-portfolio/"
  if (kind === "overview") path += "overview"
  else if (kind === "projects") path += "projects"
  else if (kind === "imports") path = "/orchestra/sf-imports/new"
  else if (kind === "new") path += "projects/new"
  else {
    if (!originalProjectRef) return null
    path += "projects/" + encodeSfRouteRef(originalProjectRef)
    if (kind === "edit") path += "/edit"
    if (kind === "milestones") path += "/milestones"
  }
  const tail = query.toString()
  return path + (tail ? "?" + tail : "")
}
