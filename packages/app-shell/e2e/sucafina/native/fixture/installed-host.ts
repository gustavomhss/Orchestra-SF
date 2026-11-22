/** Reuse the original G07/G08 validators, then observe Linux again. Inputs are not LIVE proof. */
import { readFile, readlink, realpath } from "node:fs/promises"
import { digest, privateText, readPlan, validateHost, validatePackage, validatePlan } from "../../../../../../script/sf-ci/g08-private-evidence.mjs"
import type { NativeTarget } from "./manifest-contract.ts"
import type { InstalledNativeManifest as NativeManifest } from "./g08-manifest-contract.ts"

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("F04_INSTALLED_OBSERVATION_REQUIRED")
  return value as Record<string, unknown>
}
export async function readNativeInstalledHost(root: string) {
  const plan = await readPlan(root)
  const planRaw = await privateText(root, "plan.json", 65536)
  if (JSON.stringify(JSON.parse(planRaw)) + "\n" !== planRaw ||
    digest(JSON.stringify(validatePlan(JSON.parse(planRaw)))) !== digest(JSON.stringify(plan)))
    throw new Error("F04_PRIVATE_PLAN_CHANGED_DURING_READ")
  const raw = await privateText(root, "package-receipt.json")
  if (digest(raw) !== plan.packageReceiptSha256) throw new Error("F04_ORIGINAL_G07_BYTES_CHANGED")
  const receipt = validatePackage(JSON.parse(raw), plan)
  const hostRaw = await privateText(root, "host-before.json")
  const host = validateHost(JSON.parse(hostRaw), plan, receipt)
  const running = record(host.process), binding = record(host.binding)
  if (process.platform !== "linux" || process.arch !== "x64") throw new Error("F04_ORIGINAL_LINUX_HOST_REQUIRED")
  const pid = running.pid
  if (!Number.isSafeInteger(pid) || Number(pid) < 1) throw new Error("F04_ORIGINAL_PID_REQUIRED")
  const proc = "/proc/" + String(pid), release = "/opt/orchestra-sf/releases/" + plan.candidate.sha
  const expected = release + "/bin/orchestra"
  const stat = async () => (await readFile(proc + "/stat", "utf8")).split(") ").slice(1).join(") ").split(" ")
  const before = await stat()
  const argv = (await readFile(proc + "/cmdline", "utf8")).split("\0")
  const group = await readFile(proc + "/cgroup", "utf8")
  const uid = (await readFile(proc + "/status", "utf8")).split("\n")
    .find((line) => line.startsWith("Uid:"))?.trim().split(/\s+/).slice(1)
  if (before[19] !== String(running.startTicks) || before[0] === "Z" ||
    (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim() !== running.bootId ||
    await readlink(proc + "/exe") !== expected || !uid || uid.length !== 4 || Number(uid[0]) <= 0 ||
    uid.some((value) => value !== uid[0]) || !group.split("\n").some((line) =>
      line.split(":").slice(2).join(":") === "/system.slice/orchestra-sf.service") ||
    argv.pop() !== "" || argv.length !== 8 ||
    JSON.stringify(argv.slice(1, 7)) !== JSON.stringify(["serve", "--hostname", "127.0.0.1", "--port", "4096", "--installation"]) ||
    await realpath(argv[0]!) !== expected || await realpath(argv[7]!) !== release + "/bin/local/entry.mjs" ||
    digest(await readFile(argv[7]!)) !== record(receipt.factory).sha256)
    throw new Error("F04_INSTALLED_PROCESS_OR_FACTORY_CHANGED")
  const after = await stat()
  if (before[19] !== after[19] || await readlink(proc + "/exe") !== expected)
    throw new Error("F04_INSTALLED_PROCESS_CHANGED_DURING_READ")
  const addresses = binding.ingressAddresses
  if (!Array.isArray(addresses) || !addresses.every((item): item is string => typeof item === "string"))
    throw new Error("F04_OBSERVED_INGRESS_REQUIRED")
  return { plan, receipt, host, addresses, planSha256: digest(planRaw),
    actorsReferenceSha256: digest(plan.approvals.actorsReference), packageSha256: digest(raw), hostSha256: digest(hostRaw),
    proofClass: "CURRENT_PROCESS_AND_PACKAGE_PREREQUISITE_NOT_JOURNEY_PASS" as const }
}
export type NativeHost = Awaited<ReturnType<typeof readNativeInstalledHost>>
const placement = ["serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin", "installationId",
  "tenantId", "teamObjectId", "projectId", "hostId", "mount"] as const
/** The chapter comes from the observed F01 link; it cannot create a new reserved Team. */
export function nativeTargetInReservation(host: NativeHost, target: NativeTarget) {
  const match = [host.plan.target, host.plan.teamB].filter((entry) =>
    placement.every((key) => entry[key] === target[key]))
  if (match.length !== 1) throw new Error("F04_CASE_OWNER_OUTSIDE_RESERVED_TEAMS")
  return match[0]!
}
export async function requireNativeInstalledHost(manifest: NativeManifest) {
  const host = await readNativeInstalledHost(manifest.scratchRoot)
  nativeTargetInReservation(host, manifest.target)
  if (manifest.candidateSha !== host.plan.candidate.sha || manifest.invocation.treeSha !== host.plan.candidate.tree ||
    manifest.invocation.archiveSha256 !== record(host.receipt.archive).sha256 ||
    manifest.invocation.runId !== host.plan.invocation.runId || manifest.invocation.runAttempt !== host.plan.invocation.runAttempt ||
    manifest.invocation.invocationId !== host.plan.invocation.id ||
    JSON.stringify(manifest.actors) !== JSON.stringify(host.plan.actors))
    throw new Error("F04_HOST_TAR_RUN_MANIFEST_BINDING_CHANGED")
  return host
}
