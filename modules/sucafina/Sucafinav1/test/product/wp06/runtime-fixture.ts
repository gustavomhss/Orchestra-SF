import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfDocumentServices } from "../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfDocumentHttp } from "../../../product/interface/document-http.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

/** Real SQLite, persisted local credentials and product authority; not a native Session or scanner witness. */
export async function createWp06Runtime() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp06-runtime-"))
  const driver = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) }) }
  const origin = "http://localhost:4110"
  const operator = { installationId: randomUUID(), uid: 1000, name: "Document operator", buyer: true }
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const otherIdentity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { ...operator, uid: 1001, name: "Other operator" }, secrets: driver.secrets, key: randomBytes(32) })
  const authenticate: typeof identity.authenticate = async (request, context) => await identity.authenticate(request, context) ?? await otherIdentity.authenticate(request, context)
  const environment = async () => ({ at, id: randomUUID, directory: [] })
  const assets = { persistence: store, services: { signingKey: randomBytes(32), scan: async () => true } }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
  const enroll = async (value: typeof identity) => {
    const response = await value.handle(new Request(`${origin}/sucafina/auth/local?code=${await value.enroll()}`))
    const cookie = response?.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("Local credential was not issued")
    return cookie
  }
  const cookie = await enroll(identity)
  const otherCookie = await enroll(otherIdentity)
  const principal = await identity.person(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie } }))
  const otherPrincipal = await otherIdentity.person(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie: otherCookie } }))
  if (!principal || !otherPrincipal) throw new Error("Local principal missing")
  const installation = { installationId: operator.installationId, hostId: "test-host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => installation, installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate, environment,
    grants: [principal, otherPrincipal].map((person) => ({ principalRef: person.id, namespaces: ["documents", "receipts"] as const, operations: ["sf_document_extract", "sf_knowledge_search", "sf_evidence_get", "sf_import_preview"], humanActions: ["documents.schema", "documents.confirm", "imports.admit", "imports.apply"] as const })),
    createId: randomUUID, now: () => Date.parse(at), commandIdentity: async (request, operation) => { if (request.method === "GET" || request.method === "HEAD") return randomUUID(); const key = request.headers.get("Idempotency-Key"); return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: createSfDocumentTargetAuthority({ persistence: store, authenticate, environment, assets }) })
  const runtime = { installationId: operator.installationId, directory, sourceRoot: directory, origin, mount: "/sucafina", persistence: store, authenticate, environment, assets }
  const documents = createSfDocumentServices({ runtime, authority })
  if (!documents) throw new Error("Document services unavailable")
  const documentHttp = createSfDocumentHttp({ origin, mount: "/sucafina", runtime: () => ({ ui: authority.ui, human: authority.human, ...documents }) })
  const request = (surface = "dashboard") => new Request(`${origin}/sucafina/${surface}`, { method: "POST", headers: { cookie, origin, "Idempotency-Key": randomUUID() } })
  const uiCall = async <T>(operation: string, payload: unknown, work: (context: TrustedUiContext) => Promise<T>) => {
    const digest = digestSfValue(payload)
    const access = await authority.ui.admit(request(), operation, digest)
    if (access.status !== "ok" || !await authority.ui.validate(access.value, operation, digest)) throw new Error("UI grant unavailable")
    try { return await work(access.value) } finally { authority.ui.finish(access.value) }
  }
  const documentRequest = async (mode: string, payload?: unknown, query: Record<string, string> = {}, selectedCookie = cookie) => {
    const url = new URL(`${origin}/sucafina/procurement`)
    url.searchParams.set("sf", mode)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await documentHttp(new Request(url, payload === undefined ? { headers: { cookie: selectedCookie } } : { method: "POST", headers: { cookie: selectedCookie, origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(payload) }), "procurement")
    if (!response) throw new Error("Document route missing")
    return response
  }
  return { directory, driver, store, at, origin, operator, installation, identity, otherIdentity, cookie, otherCookie, principal, otherPrincipal, authority, runtime, documents, documentHttp, documentRequest, uiCall, request,
    dispose: async () => { documents.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
