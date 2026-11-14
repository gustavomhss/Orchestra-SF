import { expect } from "bun:test"
import { randomBytes } from "node:crypto"
import type { AssetServices } from "../../../runtime/assets.ts"
import { object } from "../../../runtime/contract.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12ProcurementSources, WP12_CONTRACT_ID } from "./native-procurement-preparation.ts"

export const WP12_DOCUMENT_TEXT = "Price: 42\nRenewal: annual\nNotice: 90\n"
export const WP12_DOCUMENT_NAME = "wp12-contract-terms.txt"

/** These tests start with an already persisted domain attachment. Upload and
 * malware scanning are outside their scope; an accidental upload is refused. */
export function wp12PersistedDocumentServices(): AssetServices {
  return { signingKey: randomBytes(32), scan: async () => false }
}

export async function initializeWp12DocumentSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await initializeWp12ProcurementSources(persistence)
  await persistence.transaction("dashboard", async (snapshot, blobs) => {
    const records = Array.isArray(snapshot.data.contracts) ? snapshot.data.contracts.map(object) : []
    const contract = records.find((entry) => entry.id === WP12_CONTRACT_ID)
    if (!contract) throw new Error("The explicit attachment fixture has no domain contract")
    const bytes = new TextEncoder().encode(WP12_DOCUMENT_TEXT)
    const id = "wp12-native-contract-asset", key = `contracts/${WP12_CONTRACT_ID}/${id}`
    const metadata = { id, key, name: WP12_DOCUMENT_NAME, type: "text/plain", bytes: bytes.byteLength, size: bytes.byteLength }
    contract.docs = [metadata]
    snapshot.data.contracts = records
    snapshot.data.assets = [{ ...metadata, kind: "contract", record: WP12_CONTRACT_ID }]
    await blobs.put(key, bytes, "text/plain")
    return { commit: true, value: undefined }
  })
}

/** Actual host discovery, admission, private parser and schema registry produce
 * the document selection. No DocumentEvidence or RAG record is seeded. */
export async function prepareWp12Document(context: Wp12NativeMissionContext) {
  const productHttp = context.services.productHttp
  if (!productHttp) throw new Error("The installed document routes are missing")
  const get = async (query: string) => {
    const response = await productHttp(context.request(undefined, `/sucafina/dashboard?sf=${query}`, "GET"), "dashboard")
    if (!response) throw new Error("A real document discovery route is missing")
    const result = object(await response.json())
    if (response.status !== 200 || result.status !== "ok") throw new Error(`Real document discovery failed: ${String(result.reason)}`)
    return result.value
  }
  const post = async (mode: string, payload: unknown) => {
    const response = await productHttp(context.request(payload, `/sucafina/dashboard?sf=${mode}`), "dashboard")
    if (!response) throw new Error(`The real ${mode} route is missing`)
    const result = object(await response.json())
    if (response.status !== 200 || result.status !== "ok") throw new Error(`Real ${mode} failed: ${String(result.reason)}`)
    return object(result.value)
  }
  const available = await get("document-sources")
  if (!Array.isArray(available)) throw new Error("The host did not enumerate its authorized persisted attachments")
  const sources = available.map(object).filter((entry) => entry.label === WP12_DOCUMENT_NAME && entry.surface === "dashboard")
  if (sources.length !== 1 || typeof sources[0]?.selectionRef !== "string") throw new Error("The exact persisted contract attachment is not uniquely discoverable")
  const admitted = await post("document-admit", { selectionRef: sources[0].selectionRef })
  if (typeof admitted.documentRef !== "string") throw new Error("The real document admission has no document reference")
  const fields = [{ id: "Price", type: "number" as const, unit: "USD" }]
  const schema = await post("document-schema", { documentRef: admitted.documentRef, fields })
  if (typeof schema.id !== "string" || typeof schema.ref !== "string" || schema.version !== 1 || schema.ref !== `schema:${schema.id}:1`)
    throw new Error("The actual human schema registry returned no canonical reference")
  expect(schema.fields).toEqual(fields)
  const registered = await get(`document-schemas&documentRef=${encodeURIComponent(admitted.documentRef)}`)
  expect(registered).toEqual([{ id: schema.id, ref: schema.ref, version: 1, fields }])
  expect(await get(`document-candidates&documentRef=${encodeURIComponent(admitted.documentRef)}`)).toEqual([])
  return { documentRef: admitted.documentRef, schemaId: schema.id, schemaRef: schema.ref, schemaVersion: "1", fields }
}
