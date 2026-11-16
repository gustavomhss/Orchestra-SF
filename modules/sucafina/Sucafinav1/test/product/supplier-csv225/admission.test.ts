/**
 * 225 contract-only fail-closed checks; not an authorized producer proof.
 * No fake grant, no generated CSV bytes, no local secret or fixture credentials.
 */
import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfSupplierCsvExportRequest } from "@orchestra/schema/sucafina/procurement"
import {
  exportSfSupplierCsv, sfSupplierCsvBindingInstalled,
} from "@orchestra/client/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

describe("mission 225 supplier CSV admission boundary", () => {
  const noByteBinding: SfTransport = {
    execute: async () => ({ kind: "transport-error", reason: "contract-unavailable" }),
  }
  test("canonical request is exactly procurement, not a role or URL grant", () => {
    const decode = Schema.decodeUnknownOption(
      Schema.toType(SfSupplierCsvExportRequest), { onExcessProperty: "error" },
    )
    expect(Option.isSome(decode({ surface: "procurement" }))).toBe(true)
    expect(Option.isNone(decode({ surface: "dashboard" }))).toBe(true)
    expect(Option.isNone(decode({ surface: "procurement", role: "supplier admin" }))).toBe(true)
    expect(Option.isNone(decode({ surface: "procurement", url: "https://other.test" }))).toBe(true)
  })
  test("closed catalog/JSON transport alone never makes an export available", async () => {
    expect(sfSupplierCsvBindingInstalled(noByteBinding)).toBe(false)
    const signal = new AbortController().signal
    expect(await exportSfSupplierCsv(noByteBinding, { surface: "procurement" }, { signal }))
      .toEqual({ status: "unavailable" })
  })
  test("caller may not promote a different surface or extra credentials to export", async () => {
    const signal = new AbortController().signal
    const rogue = { surface: "procurement", token: "not-accepted" }
    expect(await exportSfSupplierCsv(noByteBinding, rogue as never, { signal }))
      .toEqual({ status: "invalid" })
    expect(await exportSfSupplierCsv(noByteBinding, { surface: "planner" } as never, { signal }))
      .toEqual({ status: "invalid" })
  })
})
