import { appendFileSync, readFileSync } from "node:fs"

// The workflow owns this capability. No request-supplied endpoint or new env key is admitted.
const request = JSON.parse(readFileSync(".ci-run.json", "utf8"))
const branch = process.env.GITHUB_REF_NAME ?? ""
const args = request.args ?? []
const liveFile = "Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts"
const liveArgs = args[0]?.replace(/^\.\//, "") === liveFile &&
  (args.length === 1 || (args.length === 3 && args[1] === "--timeout" && args[2] === "120000"))
const live = request.package === "sucafina" && request.directory === "modules/sucafina" &&
  request.runner === "bun" && liveArgs && request.config === undefined
const nominal = request.package === "app" && request.directory === "packages/app-shell" &&
  request.runner === "playwright" && request.config === "e2e/playwright.production.config.ts" &&
  args.length === 1 && args[0] === "e2e/sucafina/operations.spec.ts"
const selected = /^ci-run-linux-operations63-[a-z0-9-]+$/.test(branch) &&
  request.env?.ORCHESTRA_CHANNEL === "prod" && (live || nominal)
appendFileSync(process.env.GITHUB_OUTPUT, `selected=${selected}\nkind=${selected ? (live ? "live" : "nominal") : "none"}\n`)
