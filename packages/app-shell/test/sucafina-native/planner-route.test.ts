import { describe, expect, test } from "bun:test"
import type { SfContext, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { resolveSfUrlSelection } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { parsePlannerRouteQuery, plannerRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/planner-route"

const versions = matchSfNativeRoutePath("/orchestra/sf-planner/versions")!
const compare = matchSfNativeRoutePath("/orchestra/sf-planner/versions/compare")!
const selection: SfOwnerSelection = {
  serverKey: "server-a" as SfServerKey, projectId: "project-a" as SfRef, installationId: "install-a" as SfRef,
}
const context = (read23: boolean, read17: boolean, operational = true) => ({
  destinations: [
    { capabilityId: "CAP23", canRead: read23 }, { capabilityId: "CAP17", canRead: read17 },
  ],
  availability: ["CAP23", "CAP17"].map((id) => ({
    family: "planner", resource: id, operations: [{ operationId: `domain.page.${id}`, state: "ready", operational }],
  })),
}) as unknown as SfContext

describe("Planner route admission", () => {
  test("query is closed and year obeys the producer input schema", () => {
    expect(parsePlannerRouteQuery(new URLSearchParams("year=2026"), versions)).toEqual({ year: 2026 })
    for (const query of ["year=2023", "year=2028", "year=2026&year=2027", "year=2e3", "filter=secret", "project=project-b"]) {
      expect(parsePlannerRouteQuery(new URLSearchParams(query), versions)).toBeUndefined()
    }
  })
  test("selector tuple is a hint, never a grant or a fallback from partial selection", () => {
    const destination = "/orchestra/sf-planner/versions?server=server-b&project=project-b&installation=install-b&year=2026"
    const resolved = resolveSfUrlSelection(destination, "/orchestra/sf-home", selection)
    expect(resolved.status).toBe("selected")
    if (resolved.status === "selected") {
      expect(resolved.selection.projectId).toBe("project-b")
      expect(resolved.selection.installationId).toBe("install-b")
    }
    expect(resolveSfUrlSelection("/orchestra/sf-planner/versions?project=project-b", "/orchestra/sf-home", selection).status).toBe("invalid-link")
  })
  test("accepts valid encoded server URLs and rejects malformed escapes", () => {
    const query = new URLSearchParams({ server: "http://127.0.0.1:4096", project: "project-a", installation: "install-a" })
    const destination = "/orchestra/sf-planner/versions?" + query.toString()
    expect(resolveSfUrlSelection(destination, "/orchestra/sf-home", selection).status).toBe("selected")
    expect(resolveSfUrlSelection("/orchestra/sf-planner/versions?server=%G0&project=p&installation=i", "/orchestra/sf-home", selection).status).toBe("invalid-link")
  })
  test("reads require the matching destination and operational producer", () => {
    expect(plannerRouteAvailable(context(true, true), versions)).toBe(true)
    expect(plannerRouteAvailable(context(false, true), versions)).toBe(false)
    expect(plannerRouteAvailable(context(true, false), compare)).toBe(false)
    expect(plannerRouteAvailable(context(true, true, false), compare)).toBe(false)
    expect(plannerRouteAvailable(context(true, true), compare)).toBe(true)
  })
})
