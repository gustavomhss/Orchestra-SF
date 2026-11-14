import { expect, test } from "bun:test"
import { generateKeyPairSync } from "node:crypto"
import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { NO_SCANNER_NAME } from "@orchestra/atlas-boundary/native-memory"
import { createSfAtlasScanner, probeSfAtlasScanner } from "../../../../product/host-binding/atlas-scanner.ts"

test("scanner probe pins an observed executable and version", async () => {
  expectSpawn(import.meta.path)
  const probed = await Effect.runPromise(AppProcess.Service.use((process) => Effect.promise(() => probeSfAtlasScanner(process))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  expect(probed).toBeDefined()
  if (!probed) throw new Error("A working Atlas scanner is required")
  expect(probed.version.trim()).not.toBe("")
  expect(path.isAbsolute(probed.spec.command)).toBe(true)
  const scanner = createSfAtlasScanner({ scanners: [probed.spec] })
  expect(scanner.name).toBe(probed.spec.name)
  const clean = { owner: "sf-case-v1:synthetic", kind: "task" as const, entry: { taskId: "sf-work:synthetic:event", attempted: ["Compare synthetic alternatives"], failedWith: [], stoppedAt: "reviewed", lesson: "Use current authorized evidence." } }
  expect(scanner.scan(clean)).toBe(false)
  const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } }).privateKey
  expect(scanner.scan({ ...clean, entry: { ...clean.entry, lesson: privateKey } })).toBe(true)
  const missing = createSfAtlasScanner({ scanners: [{ ...probed.spec, command: `${probed.spec.command}.missing-wp10` }] })
  expect(() => missing.scan(clean)).toThrow("scanner unavailable")
}, 180_000)

test("an absent scanner fails closed", () => {
  const scanner = createSfAtlasScanner({ scanners: [] })
  expect(scanner.name).toBe(NO_SCANNER_NAME)
  expect(() => scanner.scan({ owner: "test", kind: "task", entry: { taskId: "test", attempted: [], failedWith: [], stoppedAt: "test", lesson: "test" } })).toThrow()
})
