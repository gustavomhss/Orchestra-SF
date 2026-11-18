import { Context } from "effect"
import type {
  SfInstallationDescriptor, SfInstallationList, SfInstallationSelector,
} from "@orchestra/schema/sucafina/context"

type SfInstalledRuntime = Readonly<{
  publicOrigin: string
  mount: string
  authMode: "microsoft" | "local-operator"
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
  const query = new URL(url).search
  if (/%(?![\da-fA-F]{2})/.test(query)) throw new SfInvalidInstallationSelector()
  const pairs = new URLSearchParams(query)
  const entries = [...pairs.entries()]
  const seen = new Set<string>()
  const allowed = new Set(["select", "installationId", "projectId", "location[directory]", "location[workspace]"])
  if (entries.some(([key]) => !allowed.has(key) || seen.has(key) || !seen.add(key)))
    throw new SfInvalidInstallationSelector()
  const choice = pairs.get("select")
  const present = (key: string) => pairs.has(key) && Boolean(pairs.get(key))
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
  return Object.freeze({
    installationId: identity.installationId,
    projectId: identity.projectId,
    hostId: identity.hostId,
    publicOrigin: runtime.publicOrigin,
    mount: runtime.mount,
    contractRevision: "sf-native-ui/1" as const,
    authMode: runtime.authMode,
  })
}

export async function readSfInstallations(
  source: SfTrustedInstallationSource,
  selector: SfInstallationSelector,
  signal: AbortSignal,
): Promise<SfInstallationList> {
  if (signal.aborted) return { installations: [] }
  if (selector.select === "ids") {
    // No LocationMiddleware, stored Location, first server, cwd or alternate runtime.
    const loaded = await source.current(signal)
    const descriptor = loaded && toDescriptor(loaded)
    if (!descriptor || signal.aborted ||
        descriptor.installationId !== selector.installationId ||
        descriptor.projectId !== selector.projectId) return { installations: [] }
    return { installations: [descriptor] }
  }
  const admitted = await source.forAdmittedLocation(selector.location, signal)
  if (signal.aborted) return { installations: [] }
  const installations: SfInstallationDescriptor[] = []
  for (const runtime of admitted) {
    const descriptor = toDescriptor(runtime)
    if (!descriptor) continue
    const exists = installations.some((existing) =>
      existing.installationId === descriptor.installationId &&
      existing.projectId === descriptor.projectId && existing.hostId === descriptor.hostId)
    if (!exists) installations.push(descriptor)
  }
  return { installations }
}
