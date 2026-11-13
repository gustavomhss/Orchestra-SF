import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult, SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../contracts/state.ts"
import { documentAsset, documentSourceCurrent } from "./source-fence.ts"

type Field = { id: string; type: "string" | "number" | "boolean" | "date"; unit?: string }
type Schema = { schema: "sf-field-schema-v1"; id: string; version: number; documentRef: string; documentId: string; incarnation: string; revision: number; blobDigest: string; principalRef: string; accessRevision: string; policyVersion: string; installationId: string; projectId: string; fields: readonly Field[] }
export type DocumentSchemaInput = { documentRef: string; fields: readonly Field[]; id?: string; expectedVersion?: number }

/** Schemas are explicit human-authored extraction definitions; they never confirm extracted facts. */
export function createSfDocumentSchemas(input: { state: SfProductStatePort; documents: SfDocumentReadPort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string }; operationIdentity: (context: TrustedDomainContext) => string | undefined; confirm: (payload: DocumentSchemaInput, context: TrustedDomainContext) => Promise<boolean> }) {
  const valid = (fields: readonly Field[]) => Array.isArray(fields) && fields.length > 0 && fields.length <= 100 && fields.every((field) => !!field && typeof field === "object" && Object.keys(field).every((key) => ["id", "type", "unit"].includes(key)) && typeof field.id === "string" && !!field.id.trim() && field.id.length <= 120 && ["string", "number", "boolean", "date"].includes(field.type) && (field.unit === undefined || (typeof field.unit === "string" && field.unit.length <= 40))) && new Set(fields.map((field) => field.id)).size === fields.length
  const visible = (value: unknown, context: TrustedDomainContext): value is Schema => {
    if (!value || typeof value !== "object") return false
    const row = value as Schema
    return row.schema === "sf-field-schema-v1" && !!row.id && Number.isSafeInteger(row.version) && row.version > 0 && row.principalRef === context.binding.principalRef && row.accessRevision === context.binding.accessRevision && row.policyVersion === context.binding.policyVersion && row.installationId === context.binding.installationId && row.projectId === context.binding.projectId && valid(row.fields)
  }
  const resolve = async (ref: string, context: TrustedDomainContext, documentRef: string): Promise<PortResult<{ id: string; version: string; fields: readonly Field[] }>> => {
    const match = /^schema:(schema_[a-f0-9]{40}):([1-9]\d*)$/.exec(ref)
    const id = match?.[1]
    const request = input.host.requestFor(context)
    if (!request || !id || !await input.host.revalidate(context)) return { status: "denied", reason: "schema-access-unavailable" }
    const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[`schema:${id}`] : undefined)
    if (loaded.status !== "ok" || !visible(loaded.value, context) || loaded.value.id !== id || loaded.value.version !== Number(match?.[2]) || loaded.value.documentRef !== documentRef) return { status: "unavailable", reason: "schema-unavailable" }
    const row = loaded.value
    const source = await input.documents.read(row.documentRef, context)
    if (source.status !== "ok" || source.value.documentId !== row.documentId || source.value.incarnation !== row.incarnation || source.value.revision !== row.revision || source.value.blobDigest.value !== row.blobDigest || !await input.documents.revalidate(row.documentRef, { incarnation: row.incarnation, revision: row.revision, blobDigest: row.blobDigest }, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "schema-source-changed" }
    return { status: "ok", value: { id: row.id, version: String(row.version), fields: structuredClone(row.fields) } }
  }
  return {
    resolve,
    verify: (state: Readonly<SfProductState>, expected: { id: string; version: string; fields: readonly Field[] }, documentRef: string, context: TrustedDomainContext) => {
      const value = state.documents[`schema:${expected.id}`]
      return visible(value, context) && value.documentRef === documentRef && String(value.version) === expected.version && digestSfValue(value.fields) === digestSfValue(expected.fields)
    },
    list: async (documentRef: string, context: TrustedDomainContext): Promise<PortResult<readonly { id: string; version: number; ref: string; fields: readonly Field[] }[]>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "schema-access-unavailable" }
      const source = await input.documents.read(documentRef, context)
      if (source.status !== "ok") return source
      const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(state.documents) : [])
      if (loaded.status !== "ok") return { status: "unavailable", reason: "schema-unavailable" }
      const matches = loaded.value.filter((value): value is Schema => visible(value, context) && value.documentRef === documentRef && value.documentId === source.value.documentId && value.incarnation === source.value.incarnation && value.revision === source.value.revision && value.blobDigest === source.value.blobDigest.value)
      if (!await input.documents.revalidate(documentRef, { incarnation: source.value.incarnation, revision: source.value.revision, blobDigest: source.value.blobDigest.value }, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "schema-source-changed" }
      return { status: "ok", value: matches.map((row) => ({ id: row.id, version: row.version, ref: `schema:${row.id}:${row.version}`, fields: structuredClone(row.fields) })) }
    },
    register: async (payload: DocumentSchemaInput, context: TrustedDomainContext): Promise<PortResult<{ id: string; version: number; ref: string; fields: readonly Field[] }>> => {
      const request = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (context.kind !== "ui" || !request || !operation || !payload || typeof payload.documentRef !== "string" || !payload.documentRef || !valid(payload.fields) || Object.keys(payload).some((key) => !["documentRef", "fields", "id", "expectedVersion"].includes(key)) || (payload.id === undefined ? payload.expectedVersion !== undefined : typeof payload.id !== "string" || !/^schema_[a-f0-9]{40}$/.test(payload.id) || !Number.isSafeInteger(payload.expectedVersion) || Number(payload.expectedVersion) < 1)) return { status: "needs-input", reason: "invalid-schema" }
      if (!await input.confirm(payload, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "human-confirmation-required" }
      const document = await input.documents.read(payload.documentRef, context)
      if (document.status !== "ok") return document
      const identity = { incarnation: document.value.incarnation, revision: document.value.revision, blobDigest: document.value.blobDigest.value }
      const id = payload.id ?? `schema_${digestSfValue({ principal: context.binding.principalRef, operation }).slice(0, 40)}`
      const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? { previous: state.documents[`schema:${id}`], asset: documentAsset(state, payload.documentRef) } : undefined)
      if (loaded.status !== "ok" || !loaded.value?.asset) return { status: "unavailable", reason: "schema-unavailable" }
      const previous = loaded.value.previous
      const asset = loaded.value.asset
      if (visible(previous, context) && previous.documentRef === payload.documentRef && previous.incarnation === identity.incarnation && previous.revision === identity.revision && previous.blobDigest === identity.blobDigest && previous.version === (payload.id ? Number(payload.expectedVersion) + 1 : 1) && digestSfValue(previous.fields) === digestSfValue(payload.fields) && await input.documents.revalidate(payload.documentRef, identity, context) && await input.confirm(payload, context) && await input.host.revalidate(context)) return { status: "ok", value: { id, version: previous.version, ref: `schema:${id}:${previous.version}`, fields: structuredClone(previous.fields) } }
      if (payload.id ? !visible(previous, context) || previous.version !== payload.expectedVersion || previous.documentRef !== payload.documentRef || previous.incarnation !== identity.incarnation || previous.revision !== identity.revision || previous.blobDigest !== identity.blobDigest : previous !== undefined) return { status: "conflict", reason: "schema-changed" }
      const row: Schema = { schema: "sf-field-schema-v1", id, version: payload.id ? Number(payload.expectedVersion) + 1 : 1, documentRef: payload.documentRef, documentId: document.value.documentId, ...identity, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, installationId: context.binding.installationId, projectId: context.binding.projectId, fields: structuredClone(payload.fields) }
      if (!await input.documents.revalidate(payload.documentRef, identity, context) || !await input.confirm(payload, context)) return { status: "stale", reason: "schema-source-changed" }
      const saved = await input.state.transaction(request, { namespace: "documents", domainSurface: asset.surface, expectedStorageVersion: loaded.storageVersion, targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation, idempotencyKey: operation, commandDigest: digestSfValue(payload) }, async (state, authority, snapshot) => {
        if (!documentSourceCurrent(state, snapshot, payload.documentRef, identity, asset.surface) || !await input.documents.revalidate(payload.documentRef, identity, context) || authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || digestSfValue(state.documents[`schema:${id}`]) !== digestSfValue(previous) || !await input.confirm(payload, context)) return { commit: false, value: false }
        state.documents[`schema:${id}`] = row
        return { commit: true, value: true }
      })
      if (saved.status !== "ok" || !saved.value) return { status: "conflict", reason: "schema-changed" }
      if (!await input.documents.revalidate(payload.documentRef, identity, context) || !await input.confirm(payload, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "schema-source-changed" }
      return { status: "ok", value: { id, version: row.version, ref: `schema:${id}:${row.version}`, fields: structuredClone(row.fields) } }
    },
  }
}
