import { expect, test } from "bun:test"
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
  expect(createSfAtlasScanner({ scanners: [probed.spec] }).name).toBe(probed.spec.name)
})

test("an absent scanner fails closed", () => {
  const scanner = createSfAtlasScanner({ scanners: [] })
  expect(scanner.name).toBe(NO_SCANNER_NAME)
  expect(() => scanner.scan({ owner: "test", kind: "task", entry: { taskId: "test", attempted: [], failedWith: [], stoppedAt: "test", lesson: "test" } })).toThrow()
})
