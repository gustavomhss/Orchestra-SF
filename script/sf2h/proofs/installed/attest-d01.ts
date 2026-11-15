/** D01 hosted artifact registrar. This is executable only INSIDE the approved
 * Actions job after a real packaged Electron artifact has been installed under
 * a private 0700 root. The receipt is private 0600 and is NOT proof of runtime
 * execution: packaged status is checked by Electron app.isPackaged at D01.
 */
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, open, realpath, rm } from "node:fs/promises"
import path from "node:path"
import { requirePrivateNativeRoot } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"

export async function registerD01PackagedArtifact(input: Readonly<{
  scratchRoot: string
  executablePath: string
  /** From the actual Actions artifact provenance, not a fixture constant. */
  buildCandidateSha: string
  /** From the official approved Actions job, not a local development run. */
  buildActionsRunId: string
}>): Promise<Readonly<{
  privateAttestationFile: string
  binarySha256: string
  candidateSha: string
  status: "ARTIFACT_HASHED_NOT_ELECTRON_TESTED"
}>> {
  const root = await requirePrivateNativeRoot(input.scratchRoot)
  if (process.env.GITHUB_ACTIONS !== "true" ||
      !process.env.GITHUB_RUN_ID || input.buildActionsRunId !== process.env.GITHUB_RUN_ID ||
      !/^[0-9a-f]{40}$/.test(input.buildCandidateSha) ||
      input.buildCandidateSha !== process.env.SF_NATIVE_CANDIDATE_SHA)
    throw new Error("D01_APPROVED_HOSTED_BUILD_PROVENANCE_REQUIRED")
  const executable = path.resolve(input.executablePath)
  if (input.executablePath !== executable ||
      !executable.startsWith(root + path.sep))
    throw new Error("D01_PACKAGED_EXECUTABLE_MUST_BE_IN_PRIVATE_RUNNER")
  const stat = await lstat(executable)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o111) === 0 ||
      await realpath(executable) !== executable)
    throw new Error("D01_REAL_PACKAGED_EXECUTABLE_NOT_INSTALLED")
  const hash = createHash("sha256")
  for await (const bytes of createReadStream(executable)) hash.update(bytes)
  const binarySha256 = hash.digest("hex")
  const target = path.join(root, "d01-packaged-electron-attestation.json")
  if (process.env.SF_NATIVE_D01_PACKAGED_ATTESTATION !== target)
    throw new Error("D01_PRIVATE_ATTESTATION_LOCATION_NOT_BOUND_TO_RUNNER")
  const record = {
    schema: "sf2h.d01.packaged-electron.v1",
    executablePath: executable,
    candidateSha: input.buildCandidateSha,
    executableSha256: binarySha256,
    actionsRunId: input.buildActionsRunId,
    packaged: true,
  }
  const handle = await open(target, "wx", 0o600)
  try {
    await handle.writeFile(JSON.stringify(record) + "\n", "utf8")
    await handle.sync()
  } catch (error) {
    await handle.close()
    await rm(target, { force: true })
    throw error
  }
  await handle.close()
  return {
    privateAttestationFile: target, binarySha256,
    candidateSha: input.buildCandidateSha,
    status: "ARTIFACT_HASHED_NOT_ELECTRON_TESTED",
  }
}
