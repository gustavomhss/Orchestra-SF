import { generateKeyPairSync } from "node:crypto"
import path from "node:path"
import { expect, test } from "bun:test"
import { createMemoryEmit } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { NO_SCANNER_NAME, runScanner } from "@orchestra/atlas-boundary/native-memory"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { createSfAtlasDurableMemory } from "../../../../product/host-binding/atlas-store.ts"
import { createSfAtlasScanner, probeSfAtlasScanner } from "../../../../product/host-binding/atlas-scanner.ts"

/**
 * AM05 gap: scanner-probe.test.ts already proves binary clean/hit/missing,
 * atlas-recovery.test.ts already proves the SF transaction and process reopen.
 * This is the missing correlation at the REAL Atlas write door: each refusal
 * must leave even the staged SF snapshot untouched. No fake scanner or ledger.
 */
test("AM05 actual scanner hit, timeout and absence never append at the Atlas write door", async () => {
  expectSpawn(import.meta.path)
  const probed = await Effect.runPromise(
    AppProcess.Service.use((process) => Effect.promise(() => probeSfAtlasScanner(process)))
      .pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
  )
  if (!probed) throw new Error("AM05 requires the host-provisioned real gitleaks binary")
  expect(path.isAbsolute(probed.spec.command)).toBe(true)
  expect(probed.version.trim()).not.toBe("")
  expect(probed.spec.name).toBe("gitleaks")

  const owner = "sf-case-v1:am05-scanner-boundary"
  const safe: MemoryRecord = {
    owner,
    kind: "task",
    entry: {
      taskId: "sf-work:am05:scanner",
      attempted: ["Compare current authorized evidence"],
      failedWith: [],
      stoppedAt: "reviewed",
      lesson: "Only previously authorized and verified context may be recalled.",
    },
  }
  const partition: Parameters<typeof createSfAtlasDurableMemory>[0] = { events: [] }
  const durable = createSfAtlasDurableMemory(partition)
  const before = structuredClone(partition)

  const missing = createSfAtlasScanner({ scanners: [] })
  expect(missing.name).toBe(NO_SCANNER_NAME)
  const absentVerdict = createMemoryEmit({ store: durable, actor: owner, scanner: missing }).emit(safe.entry)
  expect(absentVerdict.ok).toBe(false)
  if (absentVerdict.ok) throw new Error("Missing scanner unexpectedly admitted a write")
  expect(absentVerdict.refusal).toBe("scanner-unavailable")
  expect(partition).toEqual(before)

  // This is a benign generated private-key test canary, never an actual secret.
  const canary = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey
  const pinned = createSfAtlasScanner({ scanners: [probed.spec] })
  expect(pinned.name).toBe(probed.spec.name)
  const hitVerdict = createMemoryEmit({ store: durable, actor: owner, scanner: pinned })
    .emit({ ...safe.entry, lesson: canary })
  expect(hitVerdict.ok).toBe(false)
  if (hitVerdict.ok) throw new Error("A scanner hit unexpectedly admitted a write")
  expect(hitVerdict.refusal).toBe("scanner-blocked")
  expect(partition).toEqual(before)

  // The REAL binary is invoked under a one-millisecond deadline with a large
  // harmless payload, rather than substituting a fake timeout implementation.
  const timeoutRecord: MemoryRecord = {
    ...safe,
    entry: { ...safe.entry, lesson: "Verified benign context. ".repeat(45_000) },
  }
  expect(runScanner(probed.spec, timeoutRecord, 1)).toBe("could-not-run")
  const timed = createSfAtlasScanner({ scanners: [probed.spec], timeoutMs: 1 })
  const timeoutVerdict = createMemoryEmit({ store: durable, actor: owner, scanner: timed }).emit(timeoutRecord.entry)
  expect(timeoutVerdict.ok).toBe(false)
  if (timeoutVerdict.ok) throw new Error("The timed-out scanner unexpectedly admitted a write")
  expect(timeoutVerdict.refusal).toBe("scanner-unavailable")
  expect(partition).toEqual(before)

  // A successful scanner result reaches only this transaction's STAGED snapshot;
  // a durable SF commit/reopen remains the existing atlas-recovery.test.ts's job.
  const admitted = createMemoryEmit({ store: durable, actor: owner, scanner: pinned }).emit(safe.entry)
  expect(admitted.ok).toBe(true)
  if (!admitted.ok) throw new Error(`The pinned real scanner refused benign content: ${admitted.refusal}`)
  expect(partition.events).toHaveLength(1)
  expect(durable.read().rejected).toBe(0)
  expect(durable.read().store).toEqual([admitted.record])
}, 180_000)
