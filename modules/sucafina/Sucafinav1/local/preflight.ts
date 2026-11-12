import path from "node:path"
import { loadLocalConfiguration, requireLocalIsolation } from "../runtime/local-configuration.ts"

const file = process.env.SUCAFINA_LOCAL_CONFIG
if (!file) throw new Error("Explicit private installation configuration required")
await loadLocalConfiguration(file)
await requireLocalIsolation(path.dirname(file))
