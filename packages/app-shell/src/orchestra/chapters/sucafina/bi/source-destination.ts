import type { SfInstallationDescriptor, SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import { matchSfNativeRoutePath } from "../route-registry"

/**
 * Original BI producers also publish native Orchestra destinations. Carry that
 * exact path and its source filters into the current owner's native shell.
 * This is only a route request: F01 still validates the resource query and
 * reauthorizes the destination. It grants no access and changes no registry.
 */
export function sfBiNativeDestinationRequest(
  value: string,
  binding: Pick<SfInstallationDescriptor, "publicOrigin" | "projectId" | "installationId">,
  selection: SfOwnerSelection,
): string | undefined {
  if (!value || [...value].some((ch) =>
    ch.charCodeAt(0) <= 32 || ch.charCodeAt(0) === 127 || ch === "\\" || ch === "#")) return
  if (!URL.canParse(value) || !URL.canParse(binding.publicOrigin)) return
  const origin = new URL(binding.publicOrigin)
  if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== binding.publicOrigin ||
      origin.username || origin.password) return
  const target = new URL(value)
  if (target.href !== value || target.origin !== origin.origin || target.username || target.password || target.hash ||
      !matchSfNativeRoutePath(target.pathname)) return
  // A producer cannot choose an owner. Only the live F01 selection below may.
  const keys = [...target.searchParams.keys()]
  if (new Set(keys).size !== keys.length ||
      keys.some((key) => ["server", "project", "installation"].includes(key) ||
        !/^[a-zA-Z][a-zA-Z0-9._\[\]-]*$/.test(key)) ||
      [...target.searchParams.values()].some((item) =>
        !item || item.length > 4096 || /[\u0000-\u001f\u007f]/.test(item))) return
  if (selection.projectId !== binding.projectId ||
      selection.installationId !== undefined && selection.installationId !== binding.installationId ||
      ![selection.serverKey, binding.projectId, binding.installationId].every((part) =>
        typeof part === "string" && !!part.trim() && !/[\u0000-\u001f\u007f]/.test(part))) return
  target.searchParams.set("server", selection.serverKey)
  target.searchParams.set("project", binding.projectId)
  target.searchParams.set("installation", binding.installationId)
  return target.pathname + target.search
}
