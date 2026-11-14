import { expect, test } from "bun:test"
import { prepareDossierEvidence, prepareSourcingDossier } from "../../../product/routines/dossier.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { binding: { installationId: "i", projectId: "p", accessRevision: "a" } } as TrustedDomainContext
const ref = { kind: "document", refId: "source", refDigest: "forged" } as Extract<BusinessEvidenceRef, { kind: "document" }>

test("dossier rejects an unsealed document ref before asking WP06 for document data", async () => {
  let reads = 0
  const result = await prepareDossierEvidence({
    refs: [ref],
    context,
    reader: async () => {
      reads += 1
      return { status: "denied", accessRevision: "rev-1" }
    },
    revalidate: async () => true,
  })

  expect(reads).toBe(0)
  expect(result.status === "ok" && result.value.entries).toEqual([{ state: "unavailable" }])
  expect(JSON.stringify(result)).not.toContain("source")
})

test("dossier suppresses resolved material when access changes before egress", async () => {
  const result = await prepareDossierEvidence({
    refs: [ref],
    context,
    reader: async () => ({ status: "unavailable", accessRevision: "rev-1" }),
    revalidate: async (refs, checkedContext) => refs[0] === ref && checkedContext === context ? false : true,
  })

  expect(result).toEqual({ status: "denied", reason: "access-changed" })
})

test("sourcing dossier does not return procurement material after access changes", async () => {
  const result = await prepareSourcingDossier({
    requestRef: "request",
    context,
    prepareProcurement: async () => ({ status: "ok", value: { request: { version: 1, values: [] } as never, comparison: null, limitations: [] } }),
    selectedDocuments: async () => ({ status: "ok", value: [] }),
    reader: async () => ({ status: "unavailable", accessRevision: "rev-1" }),
    revalidate: async () => true,
    revalidateProcurement: async () => false,
  })
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
})

test("sourcing dossier refuses a changed document selection", async () => {
  let reads = 0
  const result = await prepareSourcingDossier({
    requestRef: "request",
    context,
    prepareProcurement: async () => ({ status: "ok", value: { request: { version: 1, values: [] } as never, comparison: null, limitations: [] } }),
    selectedDocuments: async () => ({ status: "ok", value: reads++ === 0 ? [ref] : [] }),
    reader: async () => ({ status: "unavailable", accessRevision: "rev-1" }),
    revalidate: async () => true,
    revalidateProcurement: async () => true,
  })
  expect(result).toEqual({ status: "stale", reason: "document-selection-changed" })
})

test("procurement evidence does not implicitly select a document for the dossier", async () => {
  const result = await prepareSourcingDossier({
    requestRef: "request", context,
    prepareProcurement: async () => ({ status: "ok", value: { request: { version: 1, values: [{ sourceRefs: [ref], drilldown: null }] } as never, comparison: null, limitations: [] } }),
    selectedDocuments: async () => ({ status: "ok", value: [] }),
    reader: async () => { throw new Error("unselected document must not be read") },
    revalidate: async (refs) => refs.length === 0,
    revalidateProcurement: async () => true,
  })
  expect(result.status === "ok" && result.value.documents).toEqual([])
})

