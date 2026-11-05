import { expect } from "bun:test"
import path from "node:path"
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises"
import { Effect } from "effect"
import { BackendToolkit } from "../../src/backend-toolkit"
import { LayerNode } from "../../src/effect/layer-node"
import { AppProcess } from "../../src/process"
import { ReviewCatalog } from "../../src/review/catalog"
import { ReviewAnalyze } from "../../src/review-toolkit/analyze"
import { ReviewPackSquawk } from "../../src/review-toolkit/packs/squawk"
import { testEffect } from "../lib/effect"
import { jail } from "../lib/sandbox-host"
import { expectSpawn } from "../fixture/omni-expect"
import { git } from "../fixture/git"
import { provision } from "../fixture/lucy-squawk/host"
import { tmpdir } from "../fixture/tmpdir"

// Binary integration runs only inside the host jail. Provisioning is outside the review; locate stays status-only.
// A missing jail skips this file's binary case the same way the other analyzer tests do. Not a Windows shell proof.

const it = testEffect(LayerNode.compile(LayerNode.group([AppProcess.node])))
const live = jail ? it.live : it.live.skip
const UNSAFE = "-- café\nALTER TABLE \"core_recipe\" ADD COLUMN \"foo\" integer NOT NULL;\n"
const BENIGN = "SELECT 1;\n"
const INVALID = "ALTER TABLE foo ALTER CONSTRAINT bar RENAME TO quux;\n"
const CHANGED = { "db/a.sql": [{ start: 1, end: 20 }] }

const squawkPack = {
  id: "squawk",
  tool: "squawk",
  version: "2.67.0",
  licence: "pinned",
  backend: "pinned",
  languages: ["sql"],
  detection: { manifests: [], extensions: [".sql"], absent: [] },
  lane: "no-build",
  tiers: ["standard", "deep"],
  output: { format: "json", parser: "squawk" },
  cost: "low",
  network: { kind: "none" },
  scratchWrites: false,
  template: "squawk-json",
  lenses: ["contracts"],
  status: "probation",
} satisfies ReviewCatalog.Catalog["packs"][number]

function catalog(): ReviewCatalog.Catalog {
  return {
    ...ReviewCatalog.current,
    packs: [...ReviewCatalog.current.packs, squawkPack],
    rules: [
      ...ReviewCatalog.current.rules,
      ...ReviewPackSquawk.RULES.map((rule) => ({
        pack: "squawk",
        rule,
        class: "contracts.data",
        lens: "contracts",
        severity: { "*": "P2" as const },
        triage: "warns candidate not confirmed",
        status: "probation" as const,
      })),
    ],
  }
}

it.live("an absent squawk is not-run and is not installed", () =>
  Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const made = yield* held()
    const root = yield* Effect.promise(() => repo(made.path, BENIGN, BENIGN))
    const before = yield* Effect.promise(() => shot(path.join(root, "db", "a.sql")))
    const result = yield* ReviewAnalyze.run(runInput(made, root)).pipe(Effect.provideService(BackendToolkit.Root, made.toolkit))
    expect(result.checks[0]).toMatchObject({ pack: "squawk", status: "not-run", reason: "squawk absent", workspaceExecuted: false })
    expect(result.checks[0].status).not.toBe("pass")
    expect(result.items).toEqual([])
    expect(yield* Effect.promise(() => shot(path.join(root, "db", "a.sql")))).toBe(before)
  }),
)

live("a new squawk warning is an item, an unchanged one is not, and a hostile config is not the scan", () =>
  Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const made = yield* held()
    yield* provision(made.toolkit)
    const run = (name: string, baseSql: string, headSql: string, extra: Partial<ReviewAnalyze.RunInput> = {}) =>
      Effect.gen(function* () {
        const root = yield* Effect.promise(() => repo(path.join(made.path, name), baseSql, headSql))
        return yield* ReviewAnalyze.run({ ...runInput(made, root), ...extra }).pipe(Effect.provideService(BackendToolkit.Root, made.toolkit))
      })
    const fresh = yield* run("fresh", BENIGN, UNSAFE, { changed: CHANGED })
    expect(fresh.checks[0]).toMatchObject({ status: "fail", workspaceExecuted: false, version: "2.67.0" })
    expect(fresh.items.some((item) => item.pack === "squawk" && item.class === "contracts.data" && item.severity === "P2" && item.lens === "contracts")).toBe(true)
    const same = yield* run("same", UNSAFE, UNSAFE, { changed: CHANGED })
    expect(same.items).toEqual([])
    expect(same.debt.total).toBeGreaterThan(0)
    const clean = yield* run("clean", BENIGN, BENIGN)
    expect(clean.checks[0]).toMatchObject({ status: "pass", workspaceExecuted: false })
    expect(clean.items).toEqual([])
    const hostileRoot = yield* Effect.promise(() => repo(path.join(made.path, "hostile"), BENIGN, UNSAFE, true))
    const before = yield* Effect.promise(() => shot(path.join(hostileRoot, "db", "a.sql")))
    const hostile = yield* ReviewAnalyze.run({ ...runInput(made, hostileRoot), changed: CHANGED }).pipe(
      Effect.provideService(BackendToolkit.Root, made.toolkit),
    )
    expect(hostile.checks[0].status).toBe("fail")
    expect(hostile.checks[0].reason).not.toBe("configuration-error")
    expect(hostile.items.some((item) => item.pack === "squawk")).toBe(true)
    expect(yield* Effect.promise(() => shot(path.join(hostileRoot, "db", "a.sql")))).toBe(before)
    const broken = yield* run("broken", BENIGN, INVALID)
    expect(broken.checks[0]).toMatchObject({ status: "acquisition-error", reason: "syntax-error", workspaceExecuted: false })
    expect(broken.items).toEqual([])
    const raw = broken.checks[0].uri
    expect(raw).toMatch(/^review:[0-9a-f-]{36}\/raw\/squawk-head\.json$/)
    expect(yield* Effect.promise(() => readFile(path.join(made.store, raw!.slice("review:".length)), "utf8"))).toContain("syntax-error")
    const empty = yield* Effect.promise(() => plain(path.join(made.path, "empty")))
    const none = yield* ReviewAnalyze.run(runInput(made, empty)).pipe(Effect.provideService(BackendToolkit.Root, made.toolkit))
    expect(none.checks[0]).toMatchObject({ status: "not-run", reason: "no-input" })
    expect(none.checks[0].status).not.toBe("pass")
    const escaped = yield* run("escaped", BENIGN, UNSAFE, { scope: "files", files: ["../outside.sql"] })
    expect(escaped.checks[0]).toMatchObject({ status: "not-run", reason: "path-outside" })
    expect(escaped.items).toEqual([])
  }), 600_000,
)

function held() {
  return Effect.acquireRelease(Effect.promise(async () => {
    const dir = await tmpdir()
    await mkdir(path.join(dir.path, "toolkit"), { recursive: true })
    await mkdir(path.join(dir.path, "store"), { recursive: true })
    return { path: dir.path, toolkit: path.join(dir.path, "toolkit"), store: path.join(dir.path, "store"), dir }
  }), (made) => Effect.promise(() => made.dir[Symbol.asyncDispose]()))
}

function runInput(made: { store: string }, root: string): ReviewAnalyze.RunInput {
  return {
    worktree: root, base: "base", tier: "standard", store: made.store, changed: {}, trusted: true,
    lane: "no-build", packs: ["squawk"], scope: "diff", catalog: catalog(),
  }
}

async function repo(dir: string, baseSql: string, headSql: string, hostile = false) {
  const root = path.join(dir, "repo")
  await mkdir(path.join(root, "db"), { recursive: true })
  await git(root, "init", "-q")
  await git(root, "config", "user.email", "squawk@example.com")
  await git(root, "config", "user.name", "Squawk")
  await writeFile(path.join(root, "db", "a.sql"), baseSql)
  if (hostile) await writeFile(path.join(root, ".squawk.toml"), "included_rules = [\n")
  await git(root, "add", ".")
  await git(root, "commit", "-q", "-m", "base")
  await git(root, "tag", "base")
  await writeFile(path.join(root, "db", "a.sql"), headSql)
  await git(root, "add", ".")
  await git(root, "commit", "-q", "-m", "head")
  return root
}

async function plain(dir: string) {
  const root = path.join(dir, "repo")
  await mkdir(root, { recursive: true })
  await git(root, "init", "-q")
  await git(root, "config", "user.email", "squawk@example.com")
  await git(root, "config", "user.name", "Squawk")
  await writeFile(path.join(root, "README.md"), "no sql\n")
  await git(root, "add", ".")
  await git(root, "commit", "-q", "-m", "base")
  await git(root, "tag", "base")
  return root
}

async function shot(file: string) {
  const info = await lstat(file)
  return `${info.mode}:${info.nlink}:${await readFile(file, "utf8")}`
}
