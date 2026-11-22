import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { Effect, Schema } from "effect"
import { withNativeInstallation } from "./fixture/sucafina-native-installation"

const it = testEffect(LayerNode.compile(AppProcess.node))

// Exercise the installed CLI and I00/F01 composition, not just isolated health
// callbacks. The original enrollment creates the operator; no context, source
// identity, ready result, role or grant is supplied by this test.
it.live.skipIf(process.platform !== "linux")(
  "the installed host starts and admits work and search from its original sources",
  () => Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const serverPassword = randomUUID()
    const installed = yield* withNativeInstallation({ serverPassword, seed: async () => {} })

    yield* Effect.promise(async () => {
      const discovery = new URL("/api/sucafina/installations", installed.origin)
      discovery.search = new URLSearchParams({
        select: "location", "location[directory]": installed.root,
      }).toString()
      expect((await fetch(discovery)).status).toBe(401)
      const authorized = await fetch(discovery, {
        headers: { Authorization: "Basic " + Buffer.from(`orchestra:${serverPassword}`).toString("base64") },
      })
      expect(authorized.status).toBe(200)
      const result = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await authorized.json())
      expect(result.installations).toHaveLength(1)
      const descriptor = result.installations[0]!
      expect(descriptor).toMatchObject({
        authMode: "local-operator", mount: installed.mount, publicOrigin: installed.origin,
      })
      const query = new URLSearchParams({
        installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
      })
      const contextPath = "/api/ui/context?" + query.toString()
      expect((await fetch(installed.origin + installed.mount + contextPath)).status).toBe(401)
      const response = await installed.request(contextPath)
      expect(response.status).toBe(200)
      const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await response.json())
      expect(context.status).toBe("ok")
      if (context.status !== "ok") throw new Error("The installed host did not return an admitted native context")
      expect(context.value.stamp).toMatchObject({
        principalRef: installed.actorId, hostId: descriptor.hostId,
      })
      const operations = context.value.availability.flatMap((resource) => resource.operations)
      for (const operationId of [
        "projection.work-selection", "collaboration.work-list", "projection.search",
        "decisions.choice.read", "decisions.command.sf_question_prepare",
        "intelligence.analysis.choices", "intelligence.analysis.list",
      ] as const) {
        expect(operations.find((operation) => operation.operationId === operationId), operationId).toEqual({
          operationId, state: "ready", reason: null, operational: true,
        })
      }
    })
  })),
  120_000,
)
