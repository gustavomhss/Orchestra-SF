import { describe, expect, test } from "bun:test"
import { safeBiDestination } from "../../src/orchestra/chapters/sucafina/bi/safe-destination"

describe("BI source destination", () => {
  const binding = { publicOrigin: "https://sf.example", mount: "/tenant" }
  test("accepts only the authenticated origin and the three exact producer paths", () => {
    expect(safeBiDestination("?sf=workbench-case&caseRef=x", binding)).toBe("https://sf.example/tenant/dashboard?sf=workbench-case&caseRef=x")
    expect(safeBiDestination("/tenant/planner?page=Overview&version=v1", binding)).toBe("https://sf.example/tenant/planner?page=Overview&version=v1")
    expect(safeBiDestination("https://sf.example/tenant/procurement?page=Suppliers&supplier=s1", binding)).toBe("https://sf.example/tenant/procurement?page=Suppliers&supplier=s1")
  })
  test("blocks hostile schemes, origins, credentials, fragments, paths and malformed input", () => {
    for (const value of [
      "javascript:alert(1)", "data:text/html,x", "//evil.example/tenant/dashboard",
      "https://sf.example.evil.test/tenant/dashboard", "https://user@sf.example/tenant/dashboard",
      "https://sf.example/tenant/dashboard#secret", "/tenant/dashboard/extra", "/other/dashboard",
      "/tenant/../dashboard", "/tenant/%64ashboard", "\\\\evil.example/tenant/dashboard",
      "https://sf.example/tenant/dashboard\n", "http://[", "",
      "/tenant/dashboard?sf=workbench-case&caseRef=x&server=evil",
      "/tenant/dashboard?sf=workbench-case&caseRef=x&returnTo=https%3A%2F%2Fevil.test",
      "/tenant/dashboard?sf=workbench-case&caseRef=x&caseRef=y",
      "/tenant/planner?page=Overview&version=v1&project=other",
      "/tenant/planner?page=Overview&version=v1&redirect=https%3A%2F%2Fevil.test",
      "/tenant/procurement?page=Requests&filter=Other",
      "/tenant/procurement?page=Suppliers&supplier=s1&request=r1",
      "/tenant/dashboard?page=Executive+Dashboard&execYear=2026&executiveMonth=13",
    ]) expect(safeBiDestination(value, binding)).toBeUndefined()
  })
  test("accepts producer-shaped query families", () => {
    expect(safeBiDestination("/tenant/dashboard?page=IT+Operations&opsYear=2026&operationsMonth=5&year=2026", binding)).toBeDefined()
    expect(safeBiDestination("/tenant/procurement?page=Requests&filter=All&year=2026", binding)).toBeDefined()
    expect(safeBiDestination("/tenant/procurement?page=Requests&request=r1", binding)).toBeDefined()
  })
  test("rejects untrusted malformed bindings", () => {
    expect(safeBiDestination("/tenant/dashboard", { ...binding, publicOrigin: "https://user@sf.example" })).toBeUndefined()
    expect(safeBiDestination("/tenant/dashboard", { ...binding, publicOrigin: "javascript:alert(1)" })).toBeUndefined()
    expect(safeBiDestination("/tenant/dashboard", { ...binding, mount: "/tenant/../other" })).toBeUndefined()
  })
})
