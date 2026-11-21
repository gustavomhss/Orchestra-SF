import { describe, expect, test } from "bun:test"
import { readSfProjectPage, sfProjectVersion } from "./model"

describe("portfolio A01 version projection", () => {
  test("preserves each exact canonical CAS integer, including legitimate zero", () => {
    const page = readSfProjectPage({
      status: "ok",
      value: {
        data: { projects: [{ id: "existing", name: "Existing project" }, { id: "zero", name: "Zero version project" }] },
        versions: { "projects:existing": 37, "projects:zero": 0, "contracts:other": 91 },
      },
    })
    if (!page) throw new Error("The canonical project envelope must be readable")
    expect(sfProjectVersion(page, "existing")).toBe(37)
    expect(sfProjectVersion(page, "zero")).toBe(0)
    expect(page.versions).toEqual({ "projects:existing": 37, "projects:zero": 0 })
  })

  test("keeps a readable project without a source version unavailable for editing", () => {
    for (const value of [
      { data: { projects: [{ id: "missing", name: "Missing version project" }] } },
      { data: { projects: [{ id: "missing", name: "Missing version project" }] }, versions: {} },
    ]) {
      const page = readSfProjectPage({ status: "ok", value })
      if (!page) throw new Error("Missing CAS must not remove the readable record")
      expect(page.records[0]?.id).toBe("missing")
      expect(sfProjectVersion(page, "missing")).toBeNull()
      expect(page.versions).toEqual({})
    }
  })

  test("does not unwrap, coerce or default malformed CAS values", () => {
    for (const version of [{ version: 37 }, "37", -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, undefined]) {
      const page = readSfProjectPage({
        status: "ok",
        value: {
          data: { projects: [{ id: "invalid", name: "Invalid version project" }] },
          versions: { "projects:invalid": version },
        },
      })
      if (!page) throw new Error("A bad CAS must not remove the readable record")
      expect(sfProjectVersion(page, "invalid")).toBeNull()
      expect(page.versions).toEqual({})
    }
  })
})
