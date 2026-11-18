import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { digest, object, requireDigest, text } from "./schema.ts"

export const receiptPrefix = "modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-acceptance"

export async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"))
}

/** Append a new attempt. Existing receipts are never replaced. No native input,
 * token, cookie, Request or protected source content belongs in this summary. */
export async function appendAttempt(repositoryRoot: string, files: Record<string, unknown>) {
  const attempt = `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`
  const root = await realpath(repositoryRoot)
  const segments = [...receiptPrefix.split("/"), "attempts", attempt]
  for (let index = 0; index < segments.length; index++) {
    const next = path.join(root, ...segments.slice(0, index + 1))
    const existing = await lstat(next).catch(() => undefined)
    if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) throw new Error("Receipt namespace contains a symlink or non-directory")
    if (!existing) await mkdir(next)
    if (!(await realpath(next)).startsWith(root + path.sep)) throw new Error("Receipt namespace escaped repository")
  }
  const directory = path.join(root, ...segments)
  for (const [name, value] of Object.entries(files)) {
    if (!/^[a-z0-9][a-z0-9.-]*\.json$/.test(name)) throw new Error("Invalid receipt filename")
    await writeFile(path.join(directory, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  }
  return directory
}

/** Hash verification establishes archive integrity, not truth or native authority. */
export async function verifyEvidenceFiles(references: unknown[], rootPath: string) {
  const root = await realpath(rootPath)
  const verified = []
  for (const reference of references) {
    const ref = object(reference, "evidence reference")
    const relative = text(ref.path, "evidence path")
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).some((part) => !part || part === "." || part === ".."))
      throw new Error("Evidence path must be contained and relative")
    const physical = await realpath(path.join(root, relative))
    if (!physical.startsWith(root + path.sep)) throw new Error("Evidence symlink escaped archive")
    const expected = requireDigest(ref.sha256, "evidence SHA256")
    if (digest(await readFile(physical)) !== expected) throw new Error(`Evidence hash mismatch: ${relative}`)
    verified.push({ path: relative, sha256: expected })
  }
  return verified
}
