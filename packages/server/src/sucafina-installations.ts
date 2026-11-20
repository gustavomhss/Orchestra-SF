import { Context, Option, Schema } from "effect"
import {
  SfInstallationDescriptor, SfInstallationSelector, type SfInstallationList,
} from "@orchestra/schema/sucafina/context"

type SfInstalledRuntime = Readonly<{
  publicOrigin: string
  mount: string
  authMode: "microsoft" | "local-operator"
  /** Immutable configured resource tenant; never inferred from a project or request. */
  tenantId?: string
  /** Must return the identity of this particular already-loaded runtime, never a fresh project lookup. */
  identity(): Readonly<{ installationId: string; projectId: string; hostId: string }> | undefined
}>
/** Supplied by CLI factory through the selected ServerConnection only. No global registry or cwd fallback. */
export type SfTrustedInstallationSource = Readonly<{
  current(signal: AbortSignal): Promise<SfInstalledRuntime | undefined>
  /** I00 must delegate to the existing admitted LocationMiddleware for this Location.Ref. */
  forAdmittedLocation(
    location: Readonly<{ directory: string; workspace?: string }>,
    signal: AbortSignal,
  ): Promise<readonly SfInstalledRuntime[]>
}>
export class SfInstallationSource extends Context.Service<SfInstallationSource, SfTrustedInstallationSource>()(
  "@orchestra/ServerSucafinaInstallations",
) {}

export class SfInvalidInstallationSelector extends Error {
  constructor() { super("Invalid Sucafina installation selector") }
}

/** Validate raw URL before SDK decoding: no mixed branches, duplicates, unknowns or partial input. */
export function parseSfInstallationSelector(url: string): SfInstallationSelector {
  const query = new URL(url, "http://localhost").search
  if (/%(?![\da-fA-F]{2})/.test(query)) throw new SfInvalidInstallationSelector()
  const pairs = new URLSearchParams(query)
  const entries = [...pairs.entries()]
  const seen = new Set<string>()
  const allowed = new Set(["select", "contractRevision", "installationId", "tenantId", "projectId", "location[directory]", "location[workspace]"])
  if (entries.some(([key]) => !allowed.has(key) || seen.has(key) || !seen.add(key)))
    throw new SfInvalidInstallationSelector()
  const choice = pairs.get("select")
  const present = (key: string) => pairs.has(key) && Boolean(pairs.get(key))
  if (choice === "current" && entries.length === 2 &&
      pairs.get("contractRevision") === "sf-team-profile/1") {
    return { select: "current", contractRevision: "sf-team-profile/1" }
  }
  if (choice === "installation" && entries.length === 4 &&
      entries.every(([key]) => ["select", "contractRevision", "installationId", "tenantId"].includes(key))) {
    const decoded = Schema.decodeUnknownOption(SfInstallationSelector)(Object.fromEntries(entries))
    if (Option.isSome(decoded) && decoded.value.select === "installation") return decoded.value
    throw new SfInvalidInstallationSelector()
  }
  if (choice === "ids" && entries.length === 3 &&
      present("installationId") && present("projectId") &&
      !pairs.has("location[directory]") && !pairs.has("location[workspace]")) {
    return { select: "ids", installationId: pairs.get("installationId")!, projectId: pairs.get("projectId")! }
  }
  if (choice === "location" && present("location[directory]") &&
      !pairs.has("installationId") && !pairs.has("projectId") &&
      (!pairs.has("location[workspace]") || present("location[workspace]")) &&
      entries.length === (pairs.has("location[workspace]") ? 3 : 2)) {
    return { select: "location", location: {
      directory: pairs.get("location[directory]")!,
      ...(pairs.has("location[workspace]") ? { workspace: pairs.get("location[workspace]")! } : {}),
    } }
  }
  throw new SfInvalidInstallationSelector()
}

function canonicalOrigin(value: string, mode: SfInstalledRuntime["authMode"]): boolean {
  if (!URL.canParse(value)) return false
  const parsed = new URL(value)
  if (parsed.origin !== value || parsed.username || parsed.password ||
      parsed.pathname !== "/" || parsed.search || parsed.hash) return false
  if (mode === "microsoft")
    return parsed.protocol === "https:" && !parsed.hostname.endsWith(".localhost") &&
      parsed.hostname !== "localhost" && parsed.port === ""
  return parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]")
}
function toDescriptor(runtime: SfInstalledRuntime): SfInstallationDescriptor | undefined {
  const identity = runtime.identity()
  if (!identity || !identity.installationId || !identity.projectId || !identity.hostId ||
      !canonicalOrigin(runtime.publicOrigin, runtime.authMode) ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(runtime.mount))
    return undefined
  const decoded = Schema.decodeUnknownOption(SfInstallationDescriptor)({
    installationId: identity.installationId,
    projectId: identity.projectId,
    hostId: identity.hostId,
    publicOrigin: runtime.publicOrigin,
    mount: runtime.mount,
    contractRevision: runtime.authMode === "microsoft" ? "sf-team-profile/1" : "sf-native-ui/1",
    authMode: runtime.authMode,
    ...(runtime.authMode === "microsoft" ? { tenantId: runtime.tenantId } : {}),
  })
  return Option.isSome(decoded) ? Object.freeze(decoded.value) : undefined
}

export async function readSfInstallations(
  source: SfTrustedInstallationSource,
  selector: SfInstallationSelector,
  signal: AbortSignal,
): Promise<SfInstallationList> {
  if (signal.aborted) return { installations: [] }
  if (selector.select === "current" || selector.select === "installation") {
    const loaded = await source.current(signal)
    const descriptor = loaded && toDescriptor(loaded)
    if (!descriptor || signal.aborted || descriptor.contractRevision !== "sf-team-profile/1" ||
      selector.select === "installation" &&
        (descriptor.installationId !== selector.installationId || descriptor.tenantId !== selector.tenantId))
      return { installations: [] }
    return { installations: [descriptor] }
  }
  if (selector.select === "ids") {
    // No LocationMiddleware, stored Location, first server, cwd or alternate runtime.
    const loaded = await source.current(signal)
    const descriptor = loaded && toDescriptor(loaded)
    if (!descriptor || signal.aborted || descriptor.authMode !== "local-operator" ||
        descriptor.installationId !== selector.installationId ||
        descriptor.projectId !== selector.projectId) return { installations: [] }
    return { installations: [descriptor] }
  }
  const admitted = await source.forAdmittedLocation(selector.location, signal)
  if (signal.aborted) return { installations: [] }
  const installations: SfInstallationDescriptor[] = []
  for (const runtime of admitted) {
    const descriptor = toDescriptor(runtime)
    if (!descriptor || descriptor.authMode !== "local-operator") continue
    const exists = installations.some((existing) =>
      existing.installationId === descriptor.installationId &&
      existing.projectId === descriptor.projectId && existing.hostId === descriptor.hostId)
    if (!exists) installations.push(descriptor)
  }
  return { installations }
}
