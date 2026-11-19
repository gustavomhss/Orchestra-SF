import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"

const directory = process.argv[2]
if (!directory) throw new Error("Usage: bun local/prepare.ts /absolute/private/directory [public-origin]")
const file = await prepareLocalConfiguration(directory, process.argv[3])
console.log(`Prepared private installation configuration: ${file}`)
console.log("No tenant, account or group has been created. No server has been started.")
