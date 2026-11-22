import path from "node:path"
import { Schema } from "effect"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { inspectSfProductRestoreFrontier } from "../product/host-binding/state-provider.ts"
import type { Snapshot } from "./contract.ts"
import { BackupAuthorityError, createLocalBackups } from "./local-backups.ts"
import type { LocalIdentity } from "./local-contract.ts"
import { openLocalStore } from "./local-store.ts"
import type { MicrosoftConfiguration } from "./microsoft-configuration.ts"
import { readRequestBody, RequestBodyError } from "./request-body.ts"
import { teamProfileInstallationId } from "./team-profile-access.ts"
import type { TeamProfilePolicyStore } from "./team-profile-store.ts"

const decodeBody = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const digest = /^[0-9a-f]{64}$/

/** Produces a private checkpoint and metadata; it never writes or approves the independent recovery register. */
export function createCorporateCheckpointHttp(input: {
  config: Pick<MicrosoftConfiguration, "origin" | "mount" | "tenantId" | "clientId">
  readPolicy: () => Promise<Pick<MicrosoftConfiguration, "teams" | "supremeAdminGroupId" | "grants">>
  directory: string
  identity: Pick<LocalIdentity, "prepare" | "observeCorporateRecoveryActor">
  profilePolicy: Pick<TeamProfilePolicyStore, "read">
  now: () => Date
}) {
  const { config, readPolicy, directory, identity, profilePolicy, now } = input
  if (typeof readPolicy !== "function") throw new Error("Corporate checkpoint requires current private policy")
  const route = config.mount + "/api/ui/team-profile-migration/checkpoint"
  const installationId = teamProfileInstallationId({ ...config, directory })
  const installationDigest = digestSfValue({ installationId, tenantId: config.tenantId, clientId: config.clientId })
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  const respond = (status: number) => new Response(null, {
    status, headers: { ...headers, ...(status === 405 ? { Allow: "POST" } : {}) },
  })
  return async (request: Request) => {
    const url = new URL(request.url)
    const capture = url.pathname === route
    if (!capture && url.pathname !== route + "-observe") return undefined
    if (request.method !== "POST") return respond(405)
    if (url.origin !== config.origin || request.headers.get("origin") !== config.origin || url.search ||
        request.signal.aborted || request.headers.get("sec-fetch-site") === "cross-site") return respond(403)
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return respond(415)
    if (!identity.observeCorporateRecoveryActor) return respond(403)
    try {
      const policy = await readPolicy()
      const groupId = policy.supremeAdminGroupId
      if (policy.teams !== "direct" || !groupId) return respond(403)
      await identity.prepare(request)
      const admission = await identity.observeCorporateRecoveryActor(request, groupId)
      if (!admission) return respond(403)
      const grants = policy.grants.filter((grant) => grant.principalRef === admission.principalId)
      // Existing recover-only grants do not acquire snapshot observation or capture authority.
      if (grants.length !== 1 || !Array.isArray(grants[0]?.migrationActions) ||
          !grants[0].migrationActions.includes("checkpoint")) return respond(403)
      const parsed = decodeBody(new TextDecoder().decode(await readRequestBody(request, 2048)))
      if (parsed._tag !== "Some" || !checkpointCommand(parsed.value, capture)) return respond(400)
      const command = parsed.value
      const catalog = await profilePolicy.read()
      const enabled = catalog.profiles.filter((entry) =>
        entry.profile.installationId === installationId && entry.profile.tenantId === config.tenantId &&
        entry.profile.teamObjectId === command.teamObjectId && entry.enabled)
      if (enabled.length !== 1) return respond(403)
      const verifyCurrent = async () => {
        if (request.signal.aborted || !await admission.verifyCurrent()) return false
        const current = await profilePolicy.read()
        // Read the private file again at the publication fence; startup grants never authorize a retry.
        const currentPolicy = await readPolicy()
        const currentGrants = currentPolicy.grants.filter((grant) => grant.principalRef === admission.principalId)
        return !request.signal.aborted && currentPolicy.teams === "direct" &&
          currentPolicy.supremeAdminGroupId === groupId && currentGrants.length === 1 &&
          Array.isArray(currentGrants[0]?.migrationActions) && currentGrants[0].migrationActions.includes("checkpoint") &&
          current.configRevision === catalog.configRevision &&
          current.profiles.filter((entry) => entry.enabled && entry.profile.installationId === installationId &&
            entry.profile.tenantId === config.tenantId && entry.profile.teamObjectId === command.teamObjectId).length === 1
      }
      if (!await verifyCurrent()) return respond(403)
      const partitionDigest = digestSfValue({ installationId, tenantId: config.tenantId, teamObjectId: command.teamObjectId })
      const team = path.join(directory, "business-teams", partitionDigest)
      // Observation must not create a missing Team store or initialize business state.
      if (!await Bun.file(path.join(team, "installation.sqlite")).exists()) return respond(404)
      const store = await openLocalStore(team)
      try {
        const observed = await store.transaction("dashboard", async (snapshot) => ({
          commit: false, value: checkpointMetadata(snapshot),
        }), { signal: request.signal })
        if (!await verifyCurrent()) return respond(403)
        const binding = { installationDigest, partitionDigest, teamObjectId: command.teamObjectId,
          policyRevision: catalog.configRevision }
        if (!capture) return Response.json({
          schema: "sf-corporate-checkpoint-observation-v1", ...binding, ...observed,
          observedAt: now().toISOString(), independentApproval: false,
        }, { headers })
        if (observed.datasetVersion !== command.expectedVersion || observed.snapshotDigest !== command.expectedSnapshotDigest)
          return respond(409)
        const backups = await createLocalBackups(path.join(directory, "backups-teams", partitionDigest))
        const captured = await backups.capture(store, "dashboard", now().toISOString(), "daily", {
          signal: request.signal, verifyCurrent, retainExisting: true,
          verifySnapshot(snapshot) {
            const current = checkpointMetadata(snapshot)
            if (current.datasetVersion !== command.expectedVersion || current.snapshotDigest !== command.expectedSnapshotDigest)
              throw new CheckpointConflict()
          },
        })
        const archive = await backups.source.load("dashboard", captured.id, request.signal)
        if (!archive || digestSfValue(archive.snapshot) !== observed.snapshotDigest ||
            digestSfValue(archive.manifest) !== digestSfValue(captured.manifest))
          throw new Error("Corporate checkpoint readback differs from admitted snapshot")
        if (!await verifyCurrent()) return respond(403)
        return Response.json({
          schema: "sf-corporate-checkpoint-v1", ...binding, ...observed,
          checkpointId: captured.id, capturedAt: captured.manifest.at,
          archiveDigest: digestSfValue({ checkpointId: captured.id, manifest: captured.manifest }),
          assets: captured.manifest.blobs.length,
          bytes: captured.manifest.blobs.reduce((sum, blob) => sum + blob.bytes, 0),
          independentApproval: false,
        }, { status: 201, headers })
      } finally { await store.dispose() }
    } catch (error) {
      return respond(error instanceof RequestBodyError ? error.status :
        error instanceof CheckpointConflict ? 409 : error instanceof BackupAuthorityError ? 403 : 503)
    }
  }
}

class CheckpointConflict extends Error {}
function checkpointMetadata(snapshot: Readonly<Snapshot>) {
  const frontier = inspectSfProductRestoreFrontier(snapshot)
  const datasetVersion = snapshot.versions.dataset?.version ?? 0
  if (!frontier || !Number.isSafeInteger(datasetVersion) || datasetVersion < 0)
    throw new Error("Corporate checkpoint requires an existing valid product frontier")
  return { datasetVersion, snapshotDigest: digestSfValue(snapshot), frontierDigest: digestSfValue(frontier),
    productIncarnation: frontier.incarnation, productRevision: frontier.revision }
}
function checkpointCommand(input: unknown, capture: boolean): input is {
  teamObjectId: string; expectedVersion?: number; expectedSnapshotDigest?: string; confirm?: true
} {
  if (!input || typeof input !== "object" || Array.isArray(input) || !("teamObjectId" in input) ||
      typeof input.teamObjectId !== "string" || !uuid.test(input.teamObjectId)) return false
  if (!capture) return Object.keys(input).length === 1
  return Object.keys(input).length === 4 && "expectedVersion" in input && typeof input.expectedVersion === "number" &&
    Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0 &&
    "expectedSnapshotDigest" in input && typeof input.expectedSnapshotDigest === "string" &&
    digest.test(input.expectedSnapshotDigest) && "confirm" in input && input.confirm === true
}
