export * as BackendToolkitNativeNotices from "./native-notices"

import { createHash } from "crypto"
import path from "path"
import { lstat, readFile } from "fs/promises"
import { Effect } from "effect"
import type { PinnedArtifact } from "../pinned-artifact"
import type { NativeEngine } from "./manifest"

type Notice = NonNullable<NativeEngine["notices"]>[number]

const FILENAME = /^[a-z0-9][a-z0-9.-]{0,127}\.txt$/

/** Map declared notices to raw artifacts, or `notice-invalid`. Never drops a bad list and installs without it. */
export function noticeArtifacts(notices: ReadonlyArray<Notice> | undefined): ReadonlyArray<PinnedArtifact.Artifact> | "notice-invalid" {
  if (notices === undefined) return []
  if (!Array.isArray(notices)) return "notice-invalid"
  const names = new Set<string>()
  const artifacts: PinnedArtifact.Artifact[] = []
  for (const notice of notices) {
    const source = noticeSource(notice)
    if (!source || names.has(notice.filename)) return "notice-invalid"
    names.add(notice.filename)
    artifacts.push({
      url: notice.url,
      integrity: notice.integrity,
      format: "raw",
      entries: [{ from: source, to: `notices/${notice.filename}` }],
    })
  }
  return artifacts
}

/** Observe installed notices. A completed cache is not repaired here. */
export function noticeReadiness(directory: string, notices: ReadonlyArray<Notice>): Effect.Effect<string | undefined> {
  return Effect.gen(function* () {
    for (const notice of notices) {
      if (!FILENAME.test(notice.filename)) return "notice-invalid"
      const info = yield* Effect.promise(() => lstat(path.join(directory, "notices", notice.filename)).catch(() => undefined))
      if (!info) return "notice-missing"
      if (info.isSymbolicLink()) return "notice-symlink"
      if (!info.isFile()) return "notice-missing"
      const bytes = yield* Effect.promise(() => readFile(path.join(directory, "notices", notice.filename)))
      if (`sha256-${createHash("sha256").update(bytes).digest("base64")}` !== notice.integrity) return "notice-modified"
    }
    return undefined
  })
}

function noticeSource(notice: Notice) {
  if (notice === null || typeof notice !== "object") return
  if (typeof notice.filename !== "string" || !FILENAME.test(notice.filename)) return
  if (!sha256(notice.integrity)) return
  if (typeof notice.url !== "string" || notice.url.length === 0) return
  try {
    const base = path.posix.basename(new URL(notice.url).pathname)
    if (base.length === 0 || base === "." || base === "..") return
    return base
  } catch {
    return
  }
}

function sha256(integrity: string) {
  if (!integrity.startsWith("sha256-")) return false
  const body = integrity.slice("sha256-".length)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return false
  const decoded = Buffer.from(body, "base64")
  return decoded.length === 32 && decoded.toString("base64") === body
}
