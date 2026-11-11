export * as ReviewLspDiagnostics from "./lsp-diagnostics"

import path from "path"
import { lstat, realpath } from "fs/promises"
import { Effect } from "effect"
import { FSUtil } from "../fs-util"
import { Module } from "../util/module"
import { ResearchProcess } from "../research-toolkit/process"
import { confined } from "../lsp/launch"
import { LSPReadDiagnostics } from "../lsp/read-diagnostics"

// The project's own typescript-language-server, resolved inside the scratch copy. No download, no host binary.
// A symlink whose target leaves the copy is absence: the review must not run a tool the repository did not ship.

export const ABSENT = LSPReadDiagnostics.ABSENT

export const read = Effect.fn("ReviewLspDiagnostics.read")(function* (input: {
  readonly root: string
  readonly files: readonly string[]
}) {
  return yield* LSPReadDiagnostics.readDiagnostics({
    root: input.root,
    files: input.files,
    spawn: projectServer,
  })
})

async function projectServer(root: string) {
  const tsserver = Module.resolve("typescript/lib/tsserver.js", root)
  if (!tsserver) return
  const bin = path.join(root, "node_modules", ".bin", "typescript-language-server")
  if (!(await lstat(bin).catch(() => undefined))) return
  const rootReal = await realpath(root).catch(() => undefined)
  const binary = await realpath(bin).catch(() => undefined)
  const server = await realpath(tsserver).catch(() => undefined)
  if (!rootReal || !binary || !server) return
  if (!FSUtil.contains(rootReal, binary) || !FSUtil.contains(rootReal, server)) return
  return {
    process: await confined(bin, ["--stdio"], { cwd: rootReal, env: ResearchProcess.environment() }),
    initialization: { tsserver: { path: server } },
  }
}
