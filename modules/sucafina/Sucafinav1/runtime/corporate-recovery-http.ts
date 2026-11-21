import path from "node:path"
import { Schema } from "effect"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { inspectSfProductRestoreFrontier } from "../product/host-binding/state-provider.ts"
import type { openCorporateRecoveryRegister } from "./corporate-recovery-register.ts"
import { createLocalBackups } from "./local-backups.ts"
import type { LocalIdentity } from "./local-contract.ts"
import { openLocalStore } from "./local-store.ts"
import type { MicrosoftConfiguration } from "./microsoft-configuration.ts"
import { restoreBackup } from "./operations.ts"
import { readRequestBody, RequestBodyError } from "./request-body.ts"
import { captureSfCorporateRestoreRetention } from "./restore-effect-frontier.ts"
import { teamProfileInstallationId } from "./team-profile-access.ts"

const decodeBody = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)
const checkpointId = /^backup-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

export function createCorporateRecoveryHttp(input: {
  config: Pick<MicrosoftConfiguration, "origin" | "mount" | "tenantId" | "clientId" | "enabledTeamIds" | "supremeAdminGroupId" | "grants">
  directory: string
  identity: Pick<LocalIdentity, "prepare" | "observeCorporateRecoveryActor">
  register: Awaited<ReturnType<typeof openCorporateRecoveryRegister>>
  now: () => Date
}) {
  const { config, directory, identity, register, now } = input
  const route = config.mount + "/api/ui/team-profile-migration/recover"
  const installationId = teamProfileInstallationId({ ...config, directory })
  const installationDigest = digestSfValue({ installationId, tenantId: config.tenantId, clientId: config.clientId })
  const enabled = new Set(config.enabledTeamIds)
  const respond = (status: number) => new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...(status === 405 ? { Allow: "POST" } : {}) },
  })

  return async (request: Request) => {
    const url = new URL(request.url)
    if (url.pathname !== route) return undefined
    if (request.method !== "POST") return respond(405)
    if (url.origin !== config.origin || request.headers.get("origin") !== config.origin || url.search ||
        request.signal.aborted || request.headers.get("sec-fetch-site") === "cross-site") return respond(403)
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return respond(415)
    if (!config.supremeAdminGroupId || !identity.observeCorporateRecoveryActor) return respond(403)

    try {
      await identity.prepare(request)
      const admission = await identity.observeCorporateRecoveryActor(request, config.supremeAdminGroupId)
      if (!admission) return respond(403)
      const grants = config.grants.filter((grant) => grant.principalRef === admission.principalId)
      if (grants.length !== 1 || !Array.isArray(grants[0]?.migrationActions) ||
          !grants[0].migrationActions.includes("recover")) return respond(403)

      const parsed = decodeBody(new TextDecoder().decode(await readRequestBody(request, 2048)))
      if (parsed._tag !== "Some" || !recoveryCommand(parsed.value)) return respond(400)
      const command = parsed.value
      if (!enabled.has(command.teamObjectId)) return respond(403)
      const partition = digestSfValue({ installationId, tenantId: config.tenantId, teamObjectId: command.teamObjectId })
      const team = path.join(directory, "business-teams", partition)
      const archiveRoot = path.join(directory, "backups-teams", partition)

      // The witness is acquired from the independently owned registry, never from the request or backup.
      const status = await register.withCurrentPin(installationDigest, partition, async (pin) => {
        request.signal.throwIfAborted()
        if (!await Bun.file(path.join(team, "installation.sqlite")).exists()) return 404
        const backups = await createLocalBackups(archiveRoot)
        const store = await openLocalStore(team)
        try {
          const result = await restoreBackup(store, backups.source, "dashboard", command.checkpointId,
            { id: admission.principalId, roles: ["admin"], canWrite: true }, true, command.expectedVersion, now().toISOString(), {
              retain(current, checkpoint, manifest) {
                if (pin.archiveDigest !== digestSfValue({ checkpointId: command.checkpointId, manifest }))
                  throw new Error("SF_RESTORE_ARCHIVE_NOT_APPROVED")
                // Matching the independent digest authenticates the exact current frontier being retained.
                const frontier = inspectSfProductRestoreFrontier(current)
                return captureSfCorporateRestoreRetention(current, checkpoint, frontier,
                  { installationDigest, generation: pin.generation, pin })
              },
              verifyCurrent: admission.verifyCurrent,
              signal: request.signal,
            })
          return result.ok ? 204 : result.status
        } finally {
          await store.dispose()
        }
      })
      return respond(status ?? 503)
    } catch (error) {
      return respond(error instanceof RequestBodyError ? error.status : 503)
    }
  }
}

function recoveryCommand(input: unknown): input is { teamObjectId: string; checkpointId: string; expectedVersion: number; confirm: true } {
  return !!input && typeof input === "object" && Object.keys(input).length === 4 &&
    "teamObjectId" in input && typeof input.teamObjectId === "string" &&
    "checkpointId" in input && typeof input.checkpointId === "string" && checkpointId.test(input.checkpointId) &&
    "expectedVersion" in input && typeof input.expectedVersion === "number" &&
    Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0 &&
    "confirm" in input && input.confirm === true
}
