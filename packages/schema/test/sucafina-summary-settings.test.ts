import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfDomain, SfLocalSummaryRead, SfLocalSummaryConfigure } from "../src/sucafina/domain"
import { SfOperationRegistry } from "../src/sucafina/operation-registry"
import { DASHBOARD_PAGES } from "../../../modules/sucafina/Sucafinav1/src/nav"

const context = { installationId: "install", projectId: "project", hostId: "host",
  principalRef: "operator", policyVersion: "policy", accessRevision: "access" }
const valid = { context, version: 0, pages: ["IT Risks"] }
test("summary codecs retain one schema identity and only the original closed page selection", () => {
  expect(SfDomain.operations["local-admin.summary-read"]).toBe(SfLocalSummaryRead)
  expect(SfDomain.operations["local-admin.summary-configure"]).toBe(SfLocalSummaryConfigure)
  const decode = Schema.decodeUnknownSync(SfLocalSummaryConfigure.input, { onExcessProperty: "error" })
  for (const page of DASHBOARD_PAGES) expect(decode({ ...valid, pages: [page] }).pages).toEqual([page])
  expect(decode({ ...valid, pages: [] })).toEqual({ ...valid, pages: [] })
  for (const input of [
    { context, version: 0 }, { ...valid, pages: undefined }, { ...valid, pages: null },
    { ...valid, pages: ["private-page"] }, { ...valid, pages: ["IT Risks", 7] },
    { ...valid, pages: { "IT Risks": true } }, { ...valid, version: -1 },
    { ...valid, context: { projectId: "project" } }, { ...valid, actor: "forged" },
  ]) expect(() => decode(input)).toThrow()
  expect(Schema.encodeSync(SfLocalSummaryConfigure.input)(decode(valid))).toEqual(valid)
})
test("summary registry exposes only bounded original read and configure paths", () => {
  expect(SfOperationRegistry["local-admin.summary-read"]).toEqual({
    method: "GET", pathTemplate: "{mount}/api/ui/local-admin/summary-settings", effect: "read", responseMode: "json",
  })
  expect(SfOperationRegistry["local-admin.summary-configure"]).toEqual({
    method: "POST", pathTemplate: "{mount}/api/ui/local-admin/configure-summaries",
    effect: "mutation", responseMode: "json", maxRequestBytes: 16384,
  })
  expect(Schema.decodeUnknownSync(SfLocalSummaryRead.output)({
    status: "ok", context, value: { pages: [], availablePages: [...DASHBOARD_PAGES], version: 0, canConfigure: true },
  }).status).toBe("ok")
  for (const status of ["denied", "unauthenticated"]) expect(Schema.decodeUnknownSync(SfLocalSummaryRead.output)({ status })).toEqual({ status })
  expect(Schema.decodeUnknownSync(SfLocalSummaryConfigure.output)({ ok: false, status: 409 })).toEqual({ ok: false, status: 409 })
})
