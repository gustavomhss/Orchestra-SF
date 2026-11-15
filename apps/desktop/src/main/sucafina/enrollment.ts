import { constants } from "node:fs"
import { open } from "node:fs/promises"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"

/** The original local/enroll.ts literal template. Parse it as data: never execute HTML or open file://. */
const PREFIX = '<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Abrindo homologação local</title><p>Abrindo homologação local…</p><script>location.replace('
const SUFFIX = ')</script>'
const HEX64 = /^[a-f0-9]{64}$/

export type SfLocalEnrollment = Readonly<{
  installationId: string; projectId: string; publicOrigin: string; mount: string; url: string; expiresAt: number
}>
export type SfNativeEnrollmentReply = SfLocalEnrollment & Readonly<{
  kind: "sf-native-local-enrollment"; launchId: string; requestId: string
}>

export function requireSfEnrollmentUrl(urlText: string, descriptor: SfInstallationDescriptor): string {
  if (descriptor.authMode !== "local-operator" || typeof urlText !== "string" || urlText.length > 2048)
    throw new Error("Invalid enrollment")
  const origin = new URL(descriptor.publicOrigin)
  if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
    throw new Error("Invalid enrollment")
  const url = new URL(urlText)
  if (
    url.origin !== origin.origin || url.pathname !== descriptor.mount + "/auth/local"
    || url.username || url.password || url.hash || url.searchParams.size !== 1
    || url.searchParams.getAll("code").length !== 1 || !HEX64.test(url.searchParams.get("code") ?? "")
  ) throw new Error("Invalid enrollment")
  return url.href
}

export function requireSfManagedEnrollment(
  payload: SfNativeEnrollmentReply,
  descriptor: SfInstallationDescriptor,
  requestId: string,
  launchId: string,
): string {
  if (
    !payload || payload.kind !== "sf-native-local-enrollment"
    || payload.launchId !== launchId || payload.requestId !== requestId
    || payload.installationId !== descriptor.installationId || payload.projectId !== descriptor.projectId
    || payload.mount !== descriptor.mount || payload.publicOrigin !== descriptor.publicOrigin
    || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Date.now()
    || payload.expiresAt > Date.now() + 600_000
  ) throw new Error("Invalid enrollment")
  return requireSfEnrollmentUrl(payload.url, descriptor)
}

export async function readSfUnmanagedEnrollment(filePath: string, descriptor: SfInstallationDescriptor) {
  // Unmanaged local enrollment is supported only where the OS exposes a real uid (macOS/Unix).
  const owner = process.getuid?.()
  if (owner === undefined) throw new Error("Local enrollment owner cannot be verified")
  const handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.uid !== owner || (info.mode & 0o077) !== 0 || info.size < PREFIX.length + SUFFIX.length + 2 || info.size > 4096)
      throw new Error("Local enrollment file rejected")
    const data = await handle.readFile({ encoding: "utf8" })
    if (!data.startsWith(PREFIX) || !data.endsWith(SUFFIX)) throw new Error("Local enrollment file rejected")
    const quoted = data.slice(PREFIX.length, -SUFFIX.length)
    const value: unknown = JSON.parse(quoted)
    if (typeof value !== "string" || JSON.stringify(value) !== quoted) throw new Error("Local enrollment file rejected")
    return requireSfEnrollmentUrl(value, descriptor)
  } finally {
    await handle.close()
  }
}
