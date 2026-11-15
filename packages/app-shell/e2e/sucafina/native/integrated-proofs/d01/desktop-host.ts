/** D01: prerequisite for the REAL packaged Electron executable supplied by
 * the authorized hosted runner. No build, server spawn, Azure provisioning, or
 * local app restart occurs while constructing this descriptor.
 */
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import type { NativeManifest } from "../../fixture/readiness.ts"
import { requirePrivateNativeRoot } from "../../fixture/readiness.ts"

type RecordValue = Record<string, unknown>
function record(input: unknown): input is RecordValue {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}
async function privateFile(file: string, root: string, maxSize: number) {
  if (!path.isAbsolute(file) || path.dirname(path.resolve(file)) !== root)
    throw new Error("D01_ATTESTATION_OUTSIDE_PRIVATE_INSTALLATION_ROOT")
  const stat = await lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink() ||
      stat.size === 0 || stat.size > maxSize ||
      (stat.mode & 0o077) !== 0 || await realpath(file) !== file ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()))
    throw new Error("D01_PRIVATE_ATTESTATION_FILE_REQUIRED")
  return stat
}

export type D01PackagedHost = Readonly<{
  executablePath: string
  candidateSha: string
  executableSha256: string
  actionsRunId: string
  executableFromPackagedArtifact: true
  /** Connection request is non-secret. Actual approval is main-owned IPC. */
  publicConnection: Readonly<{
    serverKey: string
    baseUrl: string
    projectId: string
    credentials: Readonly<{ kind: "none" }>
  }>
}>

export async function requireD01PackagedHost(manifest: NativeManifest): Promise<D01PackagedHost> {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("D01_ACTIONS_ONLY_REAL_ELECTRON_REQUIRED")
  const root = await requirePrivateNativeRoot(manifest.scratchRoot)
  const file = process.env.SF_NATIVE_D01_PACKAGED_ATTESTATION
  if (!file) throw new Error("D01_HOSTED_PACKAGED_ELECTRON_ATTESTATION_FILE_REQUIRED")
  await privateFile(file, root, 8192)
  const raw: unknown = JSON.parse(await readFile(file, "utf8"))
  if (!record(raw) || Object.keys(raw).length !== 6 ||
      raw.schema !== "sf2h.d01.packaged-electron.v1" ||
      typeof raw.executablePath !== "string" ||
      typeof raw.candidateSha !== "string" ||
      typeof raw.executableSha256 !== "string" ||
      typeof raw.actionsRunId !== "string" ||
      raw.packaged !== true)
    throw new Error("D01_ORIGINAL_PACKAGED_ARTIFACT_ATTESTATION_INVALID")
  if (!process.env.GITHUB_RUN_ID || raw.actionsRunId !== process.env.GITHUB_RUN_ID ||
      raw.candidateSha !== manifest.candidateSha ||
      raw.candidateSha !== process.env.SF_NATIVE_CANDIDATE_SHA ||
      !/^[0-9a-f]{64}$/i.test(raw.executableSha256))
    throw new Error("D01_PACKAGED_BINARY_CANDIDATE_OR_RUN_NOT_MATCHED")
  const executablePath = raw.executablePath
  if (!path.isAbsolute(executablePath) ||
      !path.resolve(executablePath).startsWith(root + path.sep))
    throw new Error("D01_PACKAGED_BINARY_OUTSIDE_PRIVATE_RUNNER_ROOT")
  const meta = await lstat(executablePath)
  if (!meta.isFile() || meta.isSymbolicLink() ||
      (meta.mode & 0o111) === 0 ||
      await realpath(executablePath) !== executablePath ||
      (typeof process.getuid === "function" && meta.uid !== process.getuid()))
    throw new Error("D01_REAL_PACKAGED_EXECUTABLE_MISSING")
  const digest = createHash("sha256")
  for await (const bytes of createReadStream(executablePath)) digest.update(bytes)
  if (digest.digest("hex") !== raw.executableSha256.toLowerCase())
    throw new Error("D01_EXECUTABLE_SHA256_MISMATCH")
  const { serverKey, discoveryOrigin, projectId } = manifest.target
  // Original serverKey may be a main-owned sidecar key rather than the URL.
  // D01 passes only these non-secret selectors. The real renderer retrieves
  // any owned credentials internally and main's registry verifies approval.
  return {
    executablePath, candidateSha: manifest.candidateSha,
    executableSha256: raw.executableSha256.toLowerCase(),
    actionsRunId: raw.actionsRunId,
    executableFromPackagedArtifact: true,
    publicConnection: {
      serverKey, baseUrl: discoveryOrigin, projectId, credentials: { kind: "none" },
    },
  }
}

/** Use only an isolated packaged test profile; never pass CI secrets or
 * Azure/agent tokens as child environment variables. The app itself decides
 * its supported owned sidecar mode. This prepares process args but does not
 * start anything locally. */
export function d01IsolatedDesktopEnvironment(): Record<string, string> {
  const clean = Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => typeof value === "string" &&
      !/TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIAL|AUTHORIZATION|PRIVATE|KEY$/i.test(name) &&
      !/^SF_NATIVE_|^AZURE_|^GITHUB_|^GH_|^AWS_|^GOOGLE_/i.test(name))) as Record<string, string>
  return { ...clean, ORCHESTRA_TEST_ONBOARDING: "1", ORCHESTRA_DB: ":memory:" }
}
