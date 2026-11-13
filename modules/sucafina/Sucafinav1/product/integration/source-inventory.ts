import { object, rows } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SfSourceIdentityInput } from "./source-lifecycle.ts"

/** Private lifecycle inventory, not an authorized business projection or a calculation engine. */
export function enumerateSfSources(surface: Surface, snapshot: Snapshot): readonly SfSourceIdentityInput[] {
  if (surface === "planner") {
    const versions = Array.isArray(snapshot.data.versions)
      ? rows(snapshot.data.versions).map((value) => ({ key: String(value.id ?? ""), value }))
      : Object.entries(object(snapshot.data.versions)).map(([key, value]) => ({ key: String(object(value).id ?? key), value }))
    return versions.map(({ key, value }) => ({ recordType: "planner-version", recordId: key, inputDigest: digestSfValue({ value, entities: snapshot.data.entities, allocations: snapshot.data.allocations }) }))
  }
  if (surface === "procurement") {
    const store = object(snapshot.data.store)
    return [
      ...Object.entries(object(store.requests)).map(([id, value]) => ({ recordType: "procurement-request", recordId: id, inputDigest: digestSfValue(value) })),
      ...Object.entries(object(store.suppliers)).map(([id, value]) => ({ recordType: "procurement-supplier", recordId: id, inputDigest: digestSfValue(value) })),
    ]
  }
  return Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1").flatMap(([collection, value]) => rows(value)
    .filter((record) => typeof record.id === "string" || typeof record.id === "number")
    .map((record) => ({ recordType: collection, recordId: String(record.id), inputDigest: digestSfValue(record) })))
}
