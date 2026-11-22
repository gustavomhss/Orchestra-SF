// Controlled integration of the original route helper with the group coordinator. No host/browser is attached.
import { test, expect } from "bun:test"
import { expectedInstalledTargets } from "./g08-installed-evidence.mjs"
const uuid = (last: number) => "00000000-0000-4000-8000-" + String(last).padStart(12, "0")
function target(installationId = "synthetic-installation", teamObjectId = uuid(2)) {
  const value = { serverKey: "https://qa.example.invalid", discoveryOrigin: "https://qa.example.invalid",
    shellOrigin: "https://qa.example.invalid", publicOrigin: "https://qa.example.invalid",
    installationId, tenantId: uuid(1), teamObjectId, projectId: "synthetic-project", hostId: "synthetic-host",
    mount: "/sucafina", chapterHref: "" }
  value.chapterHref = "/orchestra/sf-home?" + new URLSearchParams({ contractRevision: "sf-team-profile/1",
    server: value.serverKey, installationId, tenantId: value.tenantId, teamObjectId }).toString()
  return value
}
const plan = () => ({ target: target(), teamB: target("synthetic-installation", uuid(3)),
  foreignInstallation: target("synthetic-foreign") })
for (const [kind, pathname, year] of [
  ["U15", "/orchestra/sf-procurement/contracts", null],
  ["U39", "/orchestra/sf-dashboard/opex", "2026"],
  ["U40", "/orchestra/sf-dashboard/capex", "2026"],
] as const) {
  test("coordinator derives " + kind + " from the shipped route without changing the reserved owner", async () => {
    const before = plan(), observed = await expectedInstalledTargets(kind, before)
    for (const [name, original] of [["target", before.target], ["wrongTeam", before.teamB],
      ["wrongInstallation", before.foreignInstallation]] as const) {
      const { chapterHref, ...placement } = observed[name]
      const { chapterHref: originalHome, ...expected } = original
      expect(placement).toEqual(expected)
      expect(originalHome.startsWith("/orchestra/sf-home?")).toBe(true)
      const url = new URL(chapterHref, original.shellOrigin)
      expect(url.pathname).toBe(pathname)
      expect(url.searchParams.get("year")).toBe(year)
      expect(url.searchParams.get("server")).toBe(original.serverKey)
      expect(url.searchParams.get("installationId")).toBe(original.installationId)
      expect(url.searchParams.get("tenantId")).toBe(original.tenantId)
      expect(url.searchParams.get("teamObjectId")).toBe(original.teamObjectId)
      expect(url.searchParams.get("contractRevision")).toBe("sf-team-profile/1")
      expect([...url.searchParams.keys()].sort()).toEqual(
        ["contractRevision", "server", "installationId", "tenantId", "teamObjectId", ...(year ? ["year"] : [])].sort())
    }
  })
}
test("F04 preserves the original home target for its separate no-CDP process", async () => {
  const p = plan()
  expect(await expectedInstalledTargets("F04", p)).toEqual({ target: p.target, wrongTeam: p.teamB,
    wrongInstallation: p.foreignInstallation })
})
test("a foreign coordinator kind cannot acquire a native target", async () => {
  await expect(expectedInstalledTargets("TEAMS", plan())).rejects.toThrow("G08_NATIVE_KIND_REQUIRED")
})
