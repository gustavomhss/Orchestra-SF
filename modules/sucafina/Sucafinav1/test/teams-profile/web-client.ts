import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContextQuery, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { createSfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"
import { createSfTeamContextClient } from "../../../../../packages/client/src/sucafina/context.ts"
import { createSfTeamProfileClient } from "../../../../../packages/client/src/sucafina/team-profile.ts"
import { createSfDomainClient } from "../../../../../packages/client/src/sucafina/domain.ts"
import { SfNativeOperationBindings } from "../../../../../packages/client/src/sucafina/bindings.ts"

function connect(input: { descriptor: unknown; selector: unknown }) {
  const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)(input.descriptor)
  const selector = Schema.decodeUnknownSync(TeamProfile.Selector)(input.selector)
  let generation = 1
  const transport = createSfTransport({
    binding, teamSelector: selector, generation, currentGeneration: () => generation,
    operations: SfNativeOperationBindings, fetch: (input, init) => fetch(input, init),
  })
  const context = createSfTeamContextClient(transport)
  const admin = createSfTeamProfileClient({ binding, generation, currentGeneration: () => generation,
    fetch: (input, init) => fetch(input, init) })
  const domain = createSfDomainClient(transport)
  const query = Schema.decodeUnknownSync(SfTeamContextQuery)({
    contractRevision: "sf-team-profile/1", installationId: binding.installationId,
    tenantId: binding.tenantId, hostId: binding.hostId, kind: selector.kind,
    ...(selector.kind === "team" ? { teamObjectId: selector.profile.teamObjectId } : {}),
  })
  const call = () => ({ signal: new AbortController().signal })
  return {
    context: () => context["ctx.context"](query, call()),
    contextInput: (input: unknown) => context["ctx.context"](Schema.decodeUnknownSync(SfTeamContextQuery)(input), call()),
    list: () => admin.list(call()),
    configure: (input: unknown) => admin.configure(Schema.decodeUnknownSync(TeamProfile.AdminCommand)(input), call()),
    page: () => domain["domain.page.CAP01"](Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP01"].input)({}), call()),
    invalidate: () => { generation++ },
  }
}

// Per-document fixture state for exercising the actual exported clients in
// Chromium. No process-wide browser globals, token access or replacement SDK.
let connection: ReturnType<typeof connect> | undefined
export function open(input: Parameters<typeof connect>[0]) { connection = connect(input) }
export function readContext() { if (!connection) throw new Error("Connection required"); return connection.context() }
export function readContextInput(input: unknown) { if (!connection) throw new Error("Connection required"); return connection.contextInput(input) }
export function listProfiles() { if (!connection) throw new Error("Connection required"); return connection.list() }
export function configureProfile(input: unknown) { if (!connection) throw new Error("Connection required"); return connection.configure(input) }
export function readPage() { if (!connection) throw new Error("Connection required"); return connection.page() }
export function invalidate() { if (!connection) throw new Error("Connection required"); connection.invalidate() }
