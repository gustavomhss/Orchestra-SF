import { randomUUID } from "node:crypto"
import type { BrowserWindow, WebContents, WebFrameMain } from "electron"
import type { SfConnectionCandidate, SfRegisterConnectionResult } from "@orchestra/client/sucafina/transport"
import { SF_DESKTOP_COPY, SF_DESKTOP_COPY_BR } from "./copy"

export type SfDesktopOwner = Readonly<{ window: BrowserWindow; sender: WebContents; frame: WebFrameMain }>
export type SfApprovedConnection = Readonly<{
  candidate: SfConnectionCandidate
  origin: string
  owner: SfDesktopOwner
  generation: number
  transportIdentity: string
}>

const CONTROL = /[\x00-\x1f\x7f]/
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const closed = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key))
const text = (v: unknown, max = 2048): v is string => typeof v === "string" && v.length > 0 && v.length <= max && !CONTROL.test(v)

/** No URL from bind, invoke, login, returnRoute or remote response ever registers a connection. */
export function validateSfCandidate(value: unknown, owned: Pick<SfConnectionCandidate, "serverKey" | "baseUrl" | "credentials"> | undefined): SfConnectionCandidate | undefined {
  if (!isRecord(value) || !closed(value, ["serverKey", "projectId", "baseUrl", "location", "credentials"]))
    return
  if (!text(value.serverKey) || !text(value.projectId) || !text(value.baseUrl) || !isRecord(value.credentials))
    return
  if (!closed(value.credentials, ["kind", "username", "password"])) return
  if (value.credentials.kind !== "none" && value.credentials.kind !== "basic") return
  if (value.credentials.kind === "none" && Object.keys(value.credentials).length !== 1) return
  if (value.credentials.kind === "basic" && (
    !text(value.credentials.username) || !text(value.credentials.password, 8192)
    || Object.keys(value.credentials).length !== 3
  )) return
  if (value.location !== undefined && (
    !isRecord(value.location) || !closed(value.location, ["directory", "workspace"])
    || !text(value.location.directory, 8192)
    || (value.location.workspace !== undefined && !text(value.location.workspace, 8192))
  )) return
  let url: URL
  try { url = new URL(value.baseUrl) } catch { return }
  if (
    value.baseUrl !== url.origin || !!url.username || !!url.password || url.pathname !== "/"
    || !!url.search || !!url.hash || !url.hostname
  ) return
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) return

  // The ordinary SDK HTTP server key is exactly its canonical HttpBase.url.
  // sidecar/WSL/SSH keys may be exempt only for an exact main-owned child configuration.
  const exactOwned = !!owned && value.serverKey === owned.serverKey && value.baseUrl === owned.baseUrl
    && JSON.stringify(value.credentials) === JSON.stringify(owned.credentials)
  if (value.serverKey !== value.baseUrl && !exactOwned) return
  return value as SfConnectionCandidate
}

const identical = (a: SfConnectionCandidate, b: SfConnectionCandidate) =>
  a.serverKey === b.serverKey && a.projectId === b.projectId && a.baseUrl === b.baseUrl
  && a.location?.directory === b.location?.directory && a.location?.workspace === b.location?.workspace
  && a.credentials.kind === b.credentials.kind
  && (a.credentials.kind !== "basic" || b.credentials.kind === "basic" && a.credentials.username === b.credentials.username && a.credentials.password === b.credentials.password)

const recordKey = (owner: SfDesktopOwner, serverKey: string, projectId: string) =>
  JSON.stringify([owner.sender.id, serverKey, projectId])

export function createSfConnectionRegistry(options: Readonly<{
  app: Pick<typeof import("electron").app, "getLocale">
  dialog: Pick<typeof import("electron").dialog, "showMessageBox">
  ownedConnection: () => Pick<SfConnectionCandidate, "serverKey" | "baseUrl" | "credentials"> | undefined
  validOwner: (owner: SfDesktopOwner) => boolean
  onReplaced: (connection: SfApprovedConnection, reason: "owner-changed" | "server-removed") => Promise<void>
}>) {
  const approved = new Map<string, SfApprovedConnection>()
  const pending = new Set<number>()
  let counter = 0

  const get = (owner: SfDesktopOwner, serverKey: string, projectId: string) => {
    if (!options.validOwner(owner)) return
    const entry = approved.get(recordKey(owner, serverKey, projectId))
    if (entry && entry.owner.frame === owner.frame && entry.owner.sender === owner.sender) return entry
  }
  const drop = async (entry: SfApprovedConnection, reason: "owner-changed" | "server-removed" = "owner-changed") => {
    const key = recordKey(entry.owner, entry.candidate.serverKey, entry.candidate.projectId)
    if (approved.get(key) !== entry) return
    approved.delete(key)
    await options.onReplaced(entry, reason)
  }
  return Object.freeze({
    get,
    async register(raw: unknown, owner: SfDesktopOwner): Promise<SfRegisterConnectionResult> {
      if (!options.validOwner(owner)) return { status: "unavailable", reason: "owner-rejected" }
      const candidate = validateSfCandidate(raw, options.ownedConnection())
      if (!candidate) return { status: "unavailable", reason: "invalid-connection" }
      const key = recordKey(owner, candidate.serverKey, candidate.projectId)
      const old = approved.get(key)
      if (old && old.owner.frame === owner.frame && identical(old.candidate, candidate))
        return { status: "approved", serverKey: candidate.serverKey, projectId: candidate.projectId,
          generation: old.generation, transportIdentity: old.transportIdentity }
      if (pending.has(owner.sender.id)) return { status: "unavailable", reason: "owner-rejected" }
      pending.add(owner.sender.id)
      try {
        const mainOwned = options.ownedConnection()
        const trustedOwned = mainOwned && candidate.serverKey === mainOwned.serverKey
          && candidate.baseUrl === mainOwned.baseUrl && JSON.stringify(candidate.credentials) === JSON.stringify(mainOwned.credentials)
        if (!trustedOwned) {
          const copy = options.app.getLocale().toLowerCase().startsWith("pt") ? SF_DESKTOP_COPY_BR : SF_DESKTOP_COPY
          const result = await options.dialog.showMessageBox(owner.window, {
            type: "question", title: copy.connectionTitle, message: copy.connectionPrompt,
            detail: copy.connectionDetail(candidate.baseUrl, candidate.projectId),
            buttons: [copy.cancel, copy.connect], defaultId: 0, cancelId: 0, noLink: true,
          })
          if (result.response !== 1) return { status: "cancelled" }
        }
        if (!options.validOwner(owner)) return { status: "unavailable", reason: "owner-rejected" }
        if (old) await drop(old)
        const entry: SfApprovedConnection = {
          candidate, origin: new URL(candidate.baseUrl).origin,
          owner, generation: ++counter, transportIdentity: randomUUID(),
        }
        approved.set(key, entry)
        return { status: "approved", serverKey: candidate.serverKey, projectId: candidate.projectId,
          transportIdentity: entry.transportIdentity, generation: entry.generation }
      } finally { pending.delete(owner.sender.id) }
    },
    async remove(owner: SfDesktopOwner, serverKey: string, projectId: string, generation: number) {
      const entry = get(owner, serverKey, projectId)
      if (entry && entry.generation === generation) await drop(entry, "server-removed")
    },
    async invalidateServer(serverKey: string) {
      for (const entry of [...approved.values()]) {
        if (entry.candidate.serverKey === serverKey) await drop(entry, "server-removed")
      }
    },
    async invalidateOwner(owner: SfDesktopOwner) {
      for (const entry of [...approved.values()]) {
        if (entry.owner.sender === owner.sender) await drop(entry)
      }
    },
    async dispose() {
      for (const entry of [...approved.values()]) await drop(entry)
    },
  })
}
