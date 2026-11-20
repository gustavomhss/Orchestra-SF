// The SF packager uses the CLI workspace dependencies and the canonical process service.
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
const processLayer = LayerNode.compile(AppProcess.node)
const outputLimit = 16 * 1024 * 1024
export async function run(cmd, cwd, env, stream = false) {
  const result = await Effect.runPromise(AppProcess.Service.use((app) => app.run(
    ChildProcess.make(cmd[0], cmd.slice(1), { cwd, env, extendEnv: false, stdin: "ignore" }),
    stream ? {
      combineOutput: true,
      maxOutputBytes: outputLimit,
      inspect: (chunk) => process.stdout.write(chunk),
    } : { maxOutputBytes: outputLimit, maxErrorBytes: outputLimit },
  )).pipe(Effect.provide(processLayer)))
  if (result.exitCode !== 0)
    throw new Error(`SF_ORCHESTRA_WEB_COMMAND_FAILED: ${cmd.join(" ")}`)
  return result
}
