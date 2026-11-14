import path from "node:path"
import { prepareLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../../modules/sucafina/Sucafinav1/local/enroll.ts"

// Run only in the Bun child used by the browser fixture. Production preparation owns
// directory permissions, independent encryption keys and the single-use enrollment.
const directory = process.argv[2]
if (!directory || !path.isAbsolute(directory) || process.argv.length !== 3)
  throw new Error("An absolute temporary installation directory is required")
const file = await prepareLocalConfiguration(directory)
await prepareOperatorAccess(file, true)
