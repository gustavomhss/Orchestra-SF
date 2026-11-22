import { describe, expect, test } from "bun:test"
import type { SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { sfBiNativeDestinationRequest } from "./source-destination"
import { safeBiDestination } from "./safe-destination"

const binding = {
  publicOrigin: "http://127.0.0.1:43117",
  mount: "/sucafina",
  projectId: "structural-project",
  installationId: "structural-installation",
}
const selection: SfOwnerSelection = {
  serverKey: "structural-server" as SfServerKey,
  projectId: binding.projectId as SfRef,
  installationId: binding.installationId as SfRef,
}

// Structural URLs exercise source-to-shell composition only. These values do
// not create an installation, grant, session, evidence record or response.
describe("original BI native source destinations", () => {
  test("preserves the original source path and filters with the current owner", () => {
    const original = binding.publicOrigin + "/orchestra/sf-dashboard/opex?year=2026"
    const href = sfBiNativeDestinationRequest(original, binding, selection)
    expect(href).toBe("/orchestra/sf-dashboard/opex?year=2026&server=structural-server&project=structural-project&installation=structural-installation")
  })

  test("retains a producer's Planner version without inferring another source", () => {
    const source = new URL(binding.publicOrigin + "/orchestra/sf-planner/overview")
    source.searchParams.set("version", "original version & revision")
    source.searchParams.set("year", "2026")
    const href = sfBiNativeDestinationRequest(source.href, binding, selection)!
    const target = new URL(href, "https://shell.example")
    expect(target.pathname).toBe(source.pathname)
    expect(target.searchParams.get("version")).toBe("original version & revision")
    expect(target.searchParams.get("year")).toBe("2026")
    expect([...target.searchParams.keys()].sort()).toEqual(["installation", "project", "server", "version", "year"])
  })

  test("uses the admitted installation when the shell selection was implicit", () => {
    expect(sfBiNativeDestinationRequest(binding.publicOrigin + "/orchestra/sf-procurement/requests",
      binding, { serverKey: selection.serverKey, projectId: selection.projectId }))
      .toBe("/orchestra/sf-procurement/requests?server=structural-server&project=structural-project&installation=structural-installation")
  })

  test("keeps original canonical opaque references", () => {
    const path = "/orchestra/sf-procurement/suppliers/r_c3VwcGxpZXItMQ"
    expect(sfBiNativeDestinationRequest(binding.publicOrigin + path, binding, selection)?.split("?")[0]).toBe(path)
    expect(sfBiNativeDestinationRequest(binding.publicOrigin + "/orchestra/sf-procurement/suppliers/not-canonical",
      binding, selection)).toBeUndefined()
  })

  test("rejects another origin, credentials, non-native paths and malformed paths", () => {
    for (const url of [
      "https://other.example/orchestra/sf-dashboard/opex?year=2026",
      "http://user:password@127.0.0.1:43117/orchestra/sf-dashboard/opex",
      "javascript:alert(1)", "/orchestra/sf-dashboard/opex",
      binding.publicOrigin + "/unregistered/source",
      binding.publicOrigin + "/orchestra/sf-dashboard/unknown",
      binding.publicOrigin + "/orchestra/sf-dashboard/opex/",
      binding.publicOrigin + "/orchestra/sf-dashboard/other/../opex",
      binding.publicOrigin + "/orchestra/sf-dashboard/other/%2e%2e/opex",
      binding.publicOrigin + "/orchestra/sf-dashboard/%6fpex",
      binding.publicOrigin + "/orchestra//sf-dashboard/opex",
      binding.publicOrigin + "/orchestra/sf-dashboard/opex#source",
      binding.publicOrigin + "/orchestra/sf-dashboard/opex?year=2026\n",
      binding.publicOrigin + "/orchestra\\sf-dashboard/opex",
    ]) expect(sfBiNativeDestinationRequest(url, binding, selection)).toBeUndefined()
  })

  test("rejects producer-selected owners and duplicate or malformed query fields", () => {
    for (const query of [
      "server=another", "project=another", "installation=another",
      "server=structural-server", "year=2026&year=2027", "year=", "year=%00",
      "%0Akey=2026", "year=" + "x".repeat(4097),
    ]) expect(sfBiNativeDestinationRequest(binding.publicOrigin + "/orchestra/sf-dashboard/opex?" + query,
      binding, selection)).toBeUndefined()
  })

  test("rejects a selection that no longer matches the admitted binding", () => {
    const source = binding.publicOrigin + "/orchestra/sf-dashboard/opex"
    for (const owner of [
      { ...selection, projectId: "another-project" as SfRef },
      { ...selection, installationId: "another-installation" as SfRef },
      { ...selection, serverKey: "" as SfServerKey },
    ]) expect(sfBiNativeDestinationRequest(source, binding, owner)).toBeUndefined()
    for (const publicOrigin of ["https://source.example/path", "https://user:pass@source.example", "file:///tmp"]) {
      expect(sfBiNativeDestinationRequest(source, { ...binding, publicOrigin }, selection)).toBeUndefined()
    }
  })

  test("leaves the original mounted-source validator unchanged", () => {
    const source = binding.publicOrigin + binding.mount + "/dashboard?page=OPEX+Detail&year=2026"
    expect(safeBiDestination(source, binding)).toBe(source)
    expect(sfBiNativeDestinationRequest(source, binding, selection)).toBeUndefined()
    expect(safeBiDestination(binding.publicOrigin + "/orchestra/sf-dashboard/opex?year=2026", binding))
      .toBeUndefined()
  })
})
