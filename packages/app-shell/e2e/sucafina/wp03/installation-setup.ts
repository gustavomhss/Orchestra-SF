import path from "node:path"
import { writeFile } from "node:fs/promises"
import { prepareSfLocalWorkspace } from "../../../../../modules/sucafina/Sucafinav1/local/workspace.ts"
import { prepareLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../../modules/sucafina/Sucafinav1/local/enroll.ts"

// Run only in the Bun child used by the browser fixture. Production preparation owns
// directory permissions, independent encryption keys and the single-use enrollment.
const directory = process.argv[2]
if (!directory || !path.isAbsolute(directory) || process.argv.length !== 4)
  throw new Error("An absolute temporary installation directory is required")
const file = await prepareLocalConfiguration(directory, process.argv[3])
await prepareOperatorAccess(file, true)
// The host's canonical producer owns this path. Node fixtures consume its private
// receipt instead of treating the installation's private state directory as a project.
const workspace = await prepareSfLocalWorkspace(directory)
await writeFile(path.join(directory, "wp03-workspace.json"), JSON.stringify({ workspace }) + "\n", { flag: "wx", mode: 0o600 })
