import type { Actor, Command, Environment, Result, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { applyDashboardPreview, simulateDashboardCommand } from "../dashboard/commands.ts"

/** Runs inside the existing authenticated HTTP transaction; the receipt commits with the domain write. */
export function handleDashboardPreview(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment, decode: (value: unknown) => Command | undefined): { commit: boolean; value: Result } | undefined {
  if (!["preview-change", "read-preview", "apply-preview"].includes(command.action)) return undefined
  if (!actor.canWrite) return { commit: false, value: { ok: false, status: 403 } }
  if (!Number.isFinite(Date.parse(environment.at))) throw new Error("SF_PREVIEW_CLOCK_UNAVAILABLE")
  if (command.action === "preview-change") {
    const target = decode(command.values.command)
    if (Object.keys(command.values).some((key) => key !== "command") || !target || target.page !== command.page || target.confirmed === true ||
      !["year-amount", "annual-entry", "save-entry"].includes(target.action) || !["OPEX Detail", "CAPEX Projects"].includes(target.page))
      return { commit: false, value: { ok: false, status: 422, errors: ["This command has no supported preview."] } }
    const ids: string[] = []
    const preview = simulateDashboardCommand(snapshot, actor, target, { ...environment, id: () => {
      if (ids.length >= 256) throw new Error("SF_PREVIEW_ID_LIMIT")
      const id = environment.id()
      if (!id || ids.includes(id)) throw new Error("SF_PREVIEW_ID_COLLISION")
      ids.push(id)
      return id
    } })
    if (preview.status !== "preview") return { commit: false, value: {
      ok: false, status: preview.status === "denied" ? 403 : preview.status === "conflict" ? 409 : 422,
      errors: preview.status === "invalid" && "errors" in preview ? [...preview.errors] : [preview.status === "conflict" ? "The stored record changed." : preview.reason],
      ...(preview.status === "conflict" ? { by: preview.by, stored: preview.stored } : {}),
    } }
    const previewRef = environment.id()
    if (!previewRef || ids.includes(previewRef) || snapshot.sfCommandPreviews?.[previewRef]) throw new Error("SF_PREVIEW_ID_COLLISION")
    const expiresAt = new Date(Date.parse(environment.at) + 5 * 60_000).toISOString()
    snapshot.sfCommandPreviews ??= {}
    snapshot.sfCommandPreviews[previewRef] = { principalRef: actor.id, actorDigest: digestSfValue(actor), command: structuredClone(target), ids,
      baseDigest: preview.baseDigest, commandDigest: preview.commandDigest, expiresAt }
    return { commit: true, value: { ok: true, value: { previewRef, expiresAt, ...preview } } }
  }
  if (Object.keys(command.values).some((key) => key !== "previewRef") || typeof command.values.previewRef !== "string")
    return { commit: false, value: { ok: false, status: 422 } }
  const previewRef = command.values.previewRef
  const saved = snapshot.sfCommandPreviews?.[previewRef]
  if (!saved || saved.principalRef !== actor.id || saved.actorDigest !== digestSfValue(actor) || saved.command.page !== command.page)
    return { commit: false, value: { ok: false, status: 403 } }
  if (saved.receipt) return { commit: false, value: structuredClone(saved.receipt) }
  if (Date.parse(saved.expiresAt) <= Date.parse(environment.at)) return { commit: false, value: { ok: false, status: 409, errors: ["Preview expired; review a new preview."] } }
  const cursor = { index: 0 }
  const reserved = { ...environment, id: () => {
    const id = saved.ids[cursor.index++]
    if (!id) throw new Error("SF_PREVIEW_ID_SEQUENCE_CHANGED")
    return id
  } }
  if (command.action === "read-preview") {
    const preview = simulateDashboardCommand(snapshot, actor, saved.command, reserved)
    if (preview.status !== "preview" || preview.baseDigest !== saved.baseDigest || preview.commandDigest !== saved.commandDigest || cursor.index !== saved.ids.length)
      return { commit: false, value: { ok: false, status: 409, errors: ["Preview is stale."] } }
    return { commit: false, value: { ok: true, value: { previewRef, expiresAt: saved.expiresAt, ...preview } } }
  }
  const auditStart = snapshot.audit.length
  const result = applyDashboardPreview(snapshot, actor, saved.command, reserved, saved.baseDigest, saved.commandDigest)
  if (!result.ok) return { commit: false, value: result }
  if (cursor.index !== saved.ids.length) throw new Error("SF_PREVIEW_ID_SEQUENCE_CHANGED")
  const name = environment.directory.find((person) => person.id === actor.id)?.name
  snapshot.audit.slice(auditStart).forEach((entry) => { entry.name = name })
  const receipt: Result = { ...result, value: { previewRef, applied: true, result: result.value } }
  saved.receipt = structuredClone(receipt)
  return { commit: true, value: receipt }
}
