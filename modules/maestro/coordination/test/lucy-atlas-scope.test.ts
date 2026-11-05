import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { publishTerritoryCatalog } from "@orchestra/atlas-boundary"
import { materializeStaticOwnSnapshot, parseOwnSnapshot } from "@orchestra/atlas-boundary/materialize"
import { AgentV2 } from "@orchestra/core/agent"
import { Config } from "@orchestra/core/config"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { GitCli } from "@orchestra/core/git-cli"
import { Location } from "@orchestra/core/location"
import { PermissionSaved } from "@orchestra/core/permission/saved"
import { PermissionV2 } from "@orchestra/core/permission"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { ReviewSeatTools } from "@orchestra/core/review/seat-tools"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionScope } from "@orchestra/core/session/scope"
import { SessionV2 } from "@orchestra/core/session"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionTable } from "@orchestra/core/session/sql"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { ToolOutputStore } from "@orchestra/core/tool-output-store"
import { Effect, Layer } from "effect"
import { expectSpawn } from "../../../../packages/core/test/fixture/omni-expect"
import { nativeProfiles } from "../src/roster"
import { MaestroAtlasSourceV2 } from "../src/v2/atlas-source"
import { MaestroSeatsV2 } from "../src/v2/seats"
import { MaestroSeats } from "../src/v2/seats-service"
import { MaestroAtlasToolV2 } from "../src/v2/tools/atlas"

// K11 floor and stage grant. Scope admission is SessionStore.charge, the function the runner calls
// (packages/core/src/session/runner/llm.ts settle). This file does not drive that closure, and it does not run fan-out.

const projectID = Project.ID.make("prj_lucy_atlas_scope")
const unit = "packages/alpha/shared"
const rulesOf = (id: string) => [...MaestroSeatsV2.floor(nativeProfiles[id]), ...MaestroSeatsV2.visibility(id)]

function stageScope(tools: readonly string[]): SessionScope.Scope {
  return {
    skills: { entry: "lucy-review", allow: [] },
    tools: [...tools],
    budgets: { loads: 1, toolCalls: 8 },
  }
}

async function fixture() {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "lucy-atlas-scope-")))
  const git = (args: string[]) =>
    Effect.gen(function* () {
      const cli = yield* GitCli.Service
      const result = yield* cli.run(
        ["-c", "user.email=atlas@example.com", "-c", "user.name=Atlas", "-c", "commit.gpgsign=false", ...args],
        { cwd: directory },
      )
      if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`)
      return result.text().trim()
    })
  await fs.mkdir(path.join(directory, "src"), { recursive: true })
  await Bun.write(path.join(directory, "src/alpha.ts"), "export const alpha = 1\n")
  const [revision, blob] = await Effect.runPromise(
    Effect.gen(function* () {
      yield* git(["init", "-q"])
      yield* git(["add", "src"])
      yield* git(["commit", "-q", "-m", "source fixture"])
      return [yield* git(["rev-parse", "HEAD"]), yield* git(["hash-object", "--no-filters", "--", "src/alpha.ts"])] as const
    }).pipe(Effect.provide(AppNodeBuilder.build(GitCli.node) as Layer.Layer<GitCli.Service>)),
  )
  const snapshot = parseOwnSnapshot(
    JSON.stringify({
      schemaVersion: 1,
      snapshot: "lucy-scope-fixture",
      sourceRevision: revision,
      units: [
        {
          unit: { level: "module", id: unit, grounding: null },
          sourceBlobs: { "src/alpha.ts": blob },
          pack: {
            unit: `${unit} owns bounded behavior.`,
            invariants: [
              { nodeId: `${unit}:contract`, tier: "T1", claim: `${unit} stays deterministic.`, freshness: "FRESH" },
            ],
            shape: { contents: ["src/alpha.ts"], owner: "atlas", tier: "T1" },
            edges: { dependents: [], dependencies: [] },
            gotchas: [],
            memory: null,
            drill: { finer: [], refresh: { pull: `poke:${unit}` }, complement: { pull: `relate:${unit}` } },
            grounding: { source: "tree" },
            tokenEstimate: 20,
            manifest: { pointers: [], truncated: false },
            pullReachable: [],
            advisory: [],
            advisoryDropped: 0,
          },
        },
      ],
    }),
  )
  if (!snapshot) throw new Error("canonical fixture refused")
  await Bun.write(
    path.join(directory, "TERRITORY-CATALOG.json"),
    JSON.stringify(publishTerritoryCatalog(projectID, [{ name: "backend", owner: "backend", tier: "T1", globs: ["src/**"] }])),
  )
  await Bun.write(path.join(directory, "OWN-SNAPSHOT.json"), JSON.stringify(snapshot))
  const output = materializeStaticOwnSnapshot(snapshot)
  await Promise.all(
    [...output.skills, output.coverage].map(async (file) => {
      await fs.mkdir(path.dirname(path.join(directory, file.path)), { recursive: true })
      await Bun.write(path.join(directory, file.path), file.content)
    }),
  )
  return directory
}

describe("lucy atlas stage scope", () => {
  test("verifier does not inherit lead, and the floor does not open memory", () => {
    const inherited = [...ReviewSeatTools.lead, "review_probe"]
    expect(inherited).toContain("atlas_context")
    expect(ReviewSeatTools.verifier).toEqual([...ReviewSeatTools.READ, "review_probe"])
    expect(ReviewSeatTools.verifier).not.toContain("atlas_context")
    expect(nativeProfiles.lucy.atlas_context).toBe("allow")
    expect(nativeProfiles.lucy.atlas_memory_recall).toBeUndefined()
    expect(nativeProfiles.lucy.atlas_memory_emit).toBeUndefined()
    expect(PermissionV2.evaluate("atlas_context", "lucy", rulesOf("lucy")).effect).toBe("allow")
    expect(PermissionV2.evaluate("atlas_memory_recall", "*", rulesOf("lucy")).effect).toBe("deny")
    expect(MaestroAtlasSourceV2.owner("lucy", MaestroSeats.make(["lucy", "backend", "archie", "live"]))).toBeUndefined()
    const stages = new Set<string>([
      ...ReviewSeatTools.OWN,
      ...ReviewSeatTools.lead,
      ...ReviewSeatTools.lens,
      ...ReviewSeatTools.verifier,
      ...ReviewSeatTools.final,
    ])
    expect(stages.has("atlas_memory_recall")).toBe(false)
    expect(stages.has("atlas_memory_emit")).toBe(false)
  })

  test("a registered atlas_context call is admitted for lead and lens and refused for the verifier by SessionStore.charge", async () => {
    expectSpawn(import.meta.path)
    const directory = await fixture()
    const root = AbsolutePath.make(directory)
    const layer = AppNodeBuilder.build(
      LayerNode.group([
        MaestroAtlasToolV2.node,
        ToolRegistry.node,
        ToolRegistry.toolsNode,
        PermissionV2.node,
        SessionStore.node,
        Database.node,
        EventV2.node,
        AgentV2.node,
        PermissionSaved.node,
      ]),
      [
        [Database.node, Database.layerFromPath(":memory:")],
        [
          Location.node,
          Layer.succeed(Location.Service, Location.Service.of({ directory: root, project: { id: projectID, directory: root } })),
        ],
        [
          Config.node,
          Layer.mock(Config.Service, {
            entries: () =>
              Effect.succeed([
                new Config.Document({
                  type: "document",
                  info: new Config.Info({ maestro: { atlas: { projectID, directory: "." } } }),
                }),
              ]),
          }),
        ],
        [MaestroSeats.node, Layer.succeed(MaestroSeats.Service, MaestroSeats.make(["backend", "archie", "lucy"]))],
        [SkillV2.node, Layer.mock(SkillV2.Service, { list: () => Effect.succeed([]) })],
        [ToolOutputStore.node, ToolOutputStore.nodeWithoutConfig],
      ],
    )
    const lead = SessionV2.ID.make("ses_lucy_scope_lead")
    const lens = SessionV2.ID.make("ses_lucy_scope_lens")
    const verifier = SessionV2.ID.make("ses_lucy_scope_verifier")
    const inherited = SessionV2.ID.make("ses_lucy_scope_inherited")
    const alias = SessionV2.ID.make("ses_lucy_scope_alias")

    await Effect.runPromise(
      Effect.gen(function* () {
        const db = (yield* Database.Service).db
        yield* db
          .insert(ProjectTable)
          .values({ id: projectID, worktree: root, sandboxes: [] })
          .run()
          .pipe(Effect.orDie)
        yield* Effect.forEach([lead, lens, verifier, inherited, alias], (id) =>
          db
            .insert(SessionTable)
            .values({
              id,
              project_id: projectID,
              slug: id,
              directory: root,
              title: "lucy scope",
              version: "test",
              agent: "lucy",
            })
            .run()
            .pipe(Effect.orDie),
        )
        const agents = yield* AgentV2.Service
        yield* agents.transform((draft) => {
          for (const id of ["lucy", "upstream", "review"])
            draft.update(AgentV2.ID.make(id), (agent) => {
              agent.permissions = rulesOf("lucy")
            })
        })
        const store = yield* SessionStore.Service
        const registry = yield* ToolRegistry.Service
        const materialized = yield* registry.materialize()
        expect(materialized.definitions.map((tool) => tool.name)).toContain("atlas_context")

        const settle = (sessionID: SessionV2.ID, agent: string, input: Record<string, unknown>) =>
          materialized.settle({
            sessionID,
            agent: AgentV2.ID.make(agent),
            assistantMessageID: SessionMessage.ID.make("msg_lucy_scope"),
            call: { type: "tool-call", id: `call_${agent}_${String(input.action)}`, name: "atlas_context", input },
          })

        yield* store.narrow(lead, stageScope(ReviewSeatTools.lead))
        expect(yield* store.charge(lead, { type: "tool", name: "atlas_context" })).toEqual({ admitted: true })
        const catalog = yield* settle(lead, "lucy", { action: "catalog" })
        const catalogText = catalog.result.type === "text" ? String(catalog.result.value) : ""
        expect(JSON.parse(catalogText).coverage).toMatchObject({ state: "complete", bodiesLoaded: false })
        expect(yield* store.charge(lead, { type: "tool", name: "atlas_context" })).toEqual({ admitted: true })
        const loaded = yield* settle(lead, "lucy", { action: "unit", unit })
        const loadedText = loaded.result.type === "text" ? String(loaded.result.value) : ""
        expect(JSON.parse(loadedText).coverage).toMatchObject({ state: "complete", freshness: "FRESH" })

        yield* store.narrow(lens, stageScope(ReviewSeatTools.lens))
        expect(yield* store.charge(lens, { type: "tool", name: "atlas_context" })).toEqual({ admitted: true })
        const lensCatalog = yield* settle(lens, "lucy", { action: "catalog" })
        expect(lensCatalog.result.type).toBe("text")

        yield* store.narrow(verifier, stageScope(ReviewSeatTools.verifier))
        const refused = yield* store.charge(verifier, { type: "tool", name: "atlas_context" })
        expect(refused).toMatchObject({
          admitted: false,
          deviation: { kind: "tool-outside-scope", name: "atlas_context" },
        })
        expect(yield* store.scope(verifier)).toMatchObject({
          toolCalls: 0,
          deviations: [{ kind: "tool-outside-scope", name: "atlas_context" }],
        })

        yield* store.narrow(inherited, stageScope([...ReviewSeatTools.lead, "review_probe"]))
        expect(yield* store.charge(inherited, { type: "tool", name: "atlas_context" })).toEqual({ admitted: true })

        yield* store.narrow(alias, stageScope(ReviewSeatTools.lead))
        expect(yield* store.charge(alias, { type: "tool", name: "atlas_context" })).toEqual({ admitted: true })
        const aliased = yield* settle(alias, "upstream", { action: "catalog" })
        expect(aliased.result.type === "text" ? JSON.parse(String(aliased.result.value)) : undefined).toEqual({
          status: "unavailable",
          reason: "native-atlas-owner-required",
        })
        expect(yield* store.charge(lead, { type: "tool", name: "atlas_memory_recall" })).toMatchObject({
          admitted: false,
          deviation: { kind: "tool-outside-scope", name: "atlas_memory_recall" },
        })
      }).pipe(Effect.scoped, Effect.provide(layer as Layer.Layer<Database.Service | SessionStore.Service | AgentV2.Service | ToolRegistry.Service>)),
    )
  })
})
