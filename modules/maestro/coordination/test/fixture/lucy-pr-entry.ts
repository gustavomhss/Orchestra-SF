import fs from "node:fs/promises"
import path from "node:path"
import { eq, inArray } from "drizzle-orm"
import { DateTime, Effect, Layer, Option } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { Board } from "@orchestra/schema/board"
import { BoardIssueTable, BoardNoteTable, BoardProjectTable } from "@orchestra/core/board/sql"
import { Config } from "@orchestra/core/config"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { GitCli } from "@orchestra/core/git-cli"
import { Global } from "@orchestra/core/global"
import { Location } from "@orchestra/core/location"
import { ModelV2 } from "@orchestra/core/model"
import { Project } from "@orchestra/core/project"
import { ProjectTable } from "@orchestra/core/project/sql"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema, SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionTable } from "@orchestra/core/session/sql"
import { SkillV2 } from "@orchestra/core/skill"
import { ReadTool } from "@orchestra/core/tool/read"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { ToolOutputStore } from "@orchestra/core/tool-output-store"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { SeatSkillContent } from "@orchestra/maestro/seat-skill-content"
import { Seats } from "@orchestra/maestro/seats"
import { GovernanceBackgroundV2 } from "../../src/v2/governance/background"
import { WriteRootsV2 } from "../../src/v2/governance/write-roots"
import { FSUtil } from "@orchestra/core/fs-util"
import { ResearchAllowance } from "@orchestra/core/research/allowance"
import { ResearchRecords } from "@orchestra/core/research/records"
import { SystemContextRegistry } from "@orchestra/core/system-context"
import { MaestroGovernanceV2 } from "../../src/v2/governance"
import { MaestroResearchInquiryV2 } from "../../src/v2/research-inquiry-source"
import { MaestroToolsV2 } from "../../src/v2/tools"
import { MaestroReviewTools } from "../../src/v2/tools/review"
import { event, session, worktree } from "./v2-governance"

// Real lucy/team skill files via SeatSkillContent.read. No placeholder nodes.
export async function authoredSkills() {
  const own = Seats.find("lucy")?.skills.filter((skill) => !skill.startsWith("team-")) ?? []
  const lucyRoot = Seats.skillSource("lucy")
  const lucy = await SeatSkillContent.read("lucy", lucyRoot, own)
  const team = Seats.shared()
  const shared = team.length === 0 ? {} : await SeatSkillContent.read("team", Seats.sharedSource(), team)
  return [
    ...listed(lucyRoot, lucy),
    ...listed(Seats.sharedSource(), shared),
  ]
}

function listed(root: string, files: Readonly<Record<string, string>>) {
  return Object.keys(files)
    .filter((file) => file.endsWith("/SKILL.md"))
    .map((file) => ({
      name: file.slice(0, -"/SKILL.md".length).split("/").join("-"),
      location: AbsolutePath.make(path.join(root, file)),
      content: files[file] ?? "",
    }))
}

export type Touches = { git: number; children: string[]; prompts: string[] }

const time = { created: DateTime.makeUnsafe(1_700_000_000_000) }
const model = { id: ModelV2.ID.make("model"), providerID: ProviderV2.ID.make("provider") }

/** Host with the real registry, store, and event log. Sessions and execution are deterministic; git is the real CLI. */
export function host(directory: string, skills: Awaited<ReturnType<typeof authoredSkills>>, touches: Touches) {
  const admitted: { sessionID: string; id: SessionMessage.ID; text: string }[] = []
  const sessions = {
    create: (input: { id: SessionSchema.ID; parentID: SessionSchema.ID }) =>
      Effect.gen(function* () {
        touches.children.push(input.id)
        const database = yield* Database.Service
        yield* database.db
          .insert(ProjectTable)
          .values({ id: Project.ID.global, worktree: AbsolutePath.make(directory), sandboxes: [] })
          .onConflictDoNothing()
          .run()
          .pipe(Effect.orDie)
        yield* database.db
          .insert(SessionTable)
          .values({
            id: input.id,
            project_id: Project.ID.global,
            parent_id: input.parentID,
            slug: input.id,
            directory,
            title: input.id,
            version: "test",
            agent: "lucy",
          })
          .run()
          .pipe(Effect.orDie)
        return { id: input.id }
      }),
    prompt: (input: { id: SessionMessage.ID; sessionID: SessionSchema.ID; prompt: { text: string } }) =>
      Effect.sync(() => {
        touches.prompts.push(input.prompt.text)
        admitted.push({ sessionID: input.sessionID, id: input.id, text: input.prompt.text })
      }),
    messages: (input: { sessionID: SessionSchema.ID }) =>
      Effect.succeed(
        admitted
          .filter((item) => item.sessionID === input.sessionID)
          .flatMap((item) => [
            SessionMessage.User.make({ id: item.id, type: "user", text: item.text, time }),
            SessionMessage.Assistant.make({
              id: SessionMessage.ID.make(`${item.id}_reply`),
              type: "assistant",
              agent: "lucy",
              model,
              content: [{ type: "text", id: "text", text: cardReply() }],
              time: { created: time.created, completed: time.created },
              finish: "stop",
            }),
          ]),
      ),
  } as unknown as SessionV2.Interface
  const execution = { resume: () => Effect.void } as unknown as SessionExecution.Interface
  const git = Layer.effect(
    GitCli.Service,
    Effect.gen(function* () {
      const real = yield* GitCli.Service
      return GitCli.Service.of({
        ...real,
        run: (args, options) => {
          touches.git += 1
          return real.run(args, options)
        },
      })
    }),
  ).pipe(Layer.provide(AppNodeBuilder.build(GitCli.node) as Layer.Layer<GitCli.Service>))
  return AppNodeBuilder.build(
    LayerNode.group([
      MaestroToolsV2.node,
      MaestroGovernanceV2.node,
      MaestroResearchInquiryV2.node,
      SystemContextRegistry.node,
      ToolRegistry.node,
      ReadTool.node,
      AgentV2.node,
      SessionStore.node,
      Database.node,
      FSUtil.node,
      EventV2.node,
      GitCli.node,
      ResearchAllowance.node,
      ResearchRecords.node,
    ]),
    [
      [ToolSafety.node, WriteRootsV2.safetyNode],
      [
        Location.node,
        Layer.succeed(
          Location.Service,
          Location.Service.of({
            directory: AbsolutePath.make(directory),
            project: { id: Project.ID.global, directory: AbsolutePath.make(directory) },
          }),
        ),
      ],
      [Database.node, Database.layerFromPath(":memory:")],
      [Global.node, Layer.unwrap(worktree.pipe(Effect.map((data) => Global.layerWith({ data }))))],
      [ToolOutputStore.node, ToolOutputStore.nodeWithoutConfig],
      [Config.node, Layer.mock(Config.Service, { entries: () => Effect.succeed([]) })],
      [SkillV2.node, Layer.mock(SkillV2.Service, { list: () => Effect.succeed(skills as SkillV2.Info[]) })],
      [
        AgentV2.node,
        Layer.mock(AgentV2.Service, {
          get: (id) => Effect.succeed(["maestro", "backend", "lucy"].includes(id) ? AgentV2.Info.empty(id) : undefined),
        }),
      ],
      [GitCli.node, git],
      [GovernanceBackgroundV2.sessionsNode, Layer.succeed(GovernanceBackgroundV2.Sessions, Option.some(sessions))],
      [MaestroReviewTools.executionNode, Layer.succeed(MaestroReviewTools.Execution, Option.some(execution))],
    ],
  ) as Layer.Layer<ToolRegistry.Service | Database.Service | GitCli.Service | SessionStore.Service>
}

export function call(
  registry: ToolRegistry.Service,
  agent: string,
  sessionID: SessionSchema.ID,
  input: unknown,
) {
  return registry.materialize().pipe(
    Effect.flatMap((materialized) =>
      materialized.settle({
        sessionID,
        agent: AgentV2.ID.make(agent),
        assistantMessageID: SessionMessage.ID.make("msg_pr_entry"),
        call: { type: "tool-call", id: `call_${agent}`, name: "maestro_request_review", input },
      }),
    ),
    Effect.map((settled) => ({ type: settled.result.type, text: String(settled.result.value) })),
  )
}

export const reviewTypes = [1, 2].map((version) => EventV2.versionedType(MaestroEvent.Review.Received.type, version))

export function reviewRows() {
  return Effect.gen(function* () {
    const database = yield* Database.Service
    return yield* database.db
      .select()
      .from(EventV2.EventTable)
      .where(inArray(EventV2.EventTable.type, reviewTypes))
      .all()
      .pipe(Effect.orDie)
  })
}

/** A decodable V1 receipt on a sibling session, so an empty PR query is not a blind table. */
export function seedReceipt(directory: string) {
  return Effect.gen(function* () {
    const sibling = yield* session({ directory, agent: "lucy" })
    const hex = "ab".repeat(32)
    const data = {
      sessionID: sibling,
      projectID: Project.ID.global,
      validationRecordID: "val_seed",
      workCardHash: hex,
      routedMemberID: "backend",
      rosterHash: hex,
      grantHash: hex,
      reviewPolicyHash: hex,
      actor: { version: "rfc8785-v1" as const, bytes: "{}", sha256: hex },
      reviewerID: "lucy" as const,
      reviewMethodVersion: "review-v1",
      artifact: {
        workCardHash: hex,
        sha256: hex,
        baseSHA: "a".repeat(40),
        headSHA: "b".repeat(40),
        worktree: directory,
        changedPaths: ["src/app.ts"],
        bytes: "diff",
      },
      verdict: "APPROVE" as const,
      findings: [{ path: "src/app.ts", line: 1, message: "seeded sibling receipt" }],
    }
    yield* event(`evt_seed_${sibling}`, sibling, EventV2.versionedType(MaestroEvent.Review.Received.type, 1), data)
    const project = Board.ProjectID.create()
    const issue = Board.IssueID.create()
    const database = yield* Database.Service
    yield* database.db
      .insert(BoardProjectTable)
      .values({
        id: project,
        key: "PR",
        name: "PR",
        goal: "PR entry.",
        status: "active",
        github_state: "off",
        next_issue_number: 2,
        next_epic_number: 1,
      })
      .run()
      .pipe(Effect.orDie)
    yield* database.db
      .insert(BoardIssueTable)
      .values({
        id: issue,
        project_id: project,
        number: 1,
        title: "Seed",
        body: "",
        type: "feature",
        stage: "building",
        position: 1,
        stage_entered_at: 0,
      })
      .run()
      .pipe(Effect.orDie)
    yield* database.db
      .insert(BoardNoteTable)
      .values({ id: Board.NoteID.create(), issue_id: issue, author: "lucy", kind: "review", body: "seeded review note" })
      .run()
      .pipe(Effect.orDie)
    return sibling
  })
}

export function reviewNotes() {
  return Effect.gen(function* () {
    const database = yield* Database.Service
    return yield* database.db
      .select({ id: BoardNoteTable.id })
      .from(BoardNoteTable)
      .where(eq(BoardNoteTable.kind, "review"))
      .all()
      .pipe(Effect.orDie)
  })
}

export function repo(directory: string) {
  return Effect.gen(function* () {
    const cli = yield* GitCli.Service
    const git = (...args: string[]) =>
      cli
        .run(["-c", "user.email=review@example.com", "-c", "user.name=Review", "-c", "commit.gpgsign=false", ...args], {
          cwd: directory,
        })
        .pipe(
          Effect.flatMap((result) =>
            result.exitCode === 0 ? Effect.succeed(result.text().trim()) : Effect.die(new Error(result.stderr.toString())),
          ),
        )
    yield* Effect.promise(() => fs.mkdir(path.join(directory, "src"), { recursive: true }))
    yield* Effect.promise(() => fs.writeFile(path.join(directory, "REVIEW.md"), "BASE-RULE-TOKEN\n"))
    yield* Effect.promise(() => fs.writeFile(path.join(directory, "src", "app.ts"), "export const value = 1\n"))
    yield* git("init", "-q", "-b", "main")
    yield* git("add", "-A")
    yield* git("commit", "-q", "-m", "base")
    const base = yield* git("rev-parse", "HEAD")
    yield* Effect.promise(() => fs.writeFile(path.join(directory, "REVIEW.md"), "HEAD-RULE-TOKEN\n"))
    yield* Effect.promise(() => fs.writeFile(path.join(directory, "src", "app.ts"), "export const value = 2\n"))
    yield* git("add", "-A")
    yield* git("commit", "-q", "-m", "head")
    const head = yield* git("rev-parse", "HEAD")
    return { base, head }
  })
}

function cardReply() {
  const card = {
    outcome: "done",
    verdict: "APPROVE",
    profile: "pr",
    tier: "standard",
    overlays: [],
    routing: {
      version: "route-v1",
      catalog: "ab".repeat(32),
      profile: { id: "pr", source: "request" },
      tier: { id: "standard", source: "request", signals: [] },
      overlays: [],
      languages: [],
      lenses: [],
      packs: [],
      budget: {
        lensChildren: 0,
        samples: 1,
        verifiers: 0,
        itemsPerLens: 5,
        loadsPerSession: 2,
        candidatesPerChild: 5,
        candidatesPerVerifier: 0,
        toolCallsPerSession: 15,
        probeAttempts: 0,
      },
      deviations: [],
    },
    scope: { base: "model-base", head: "model-head", files: 1, changedLines: 1 },
    findings: [],
    questions: [],
    checks: [],
    coverage: { examined: [], notExamined: [] },
    handoffs: [],
    blockers: [],
    risks: [],
    nextActions: [],
  }
  return ["```review-result", JSON.stringify(card), "```"].join("\n")
}
