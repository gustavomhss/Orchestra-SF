#!/usr/bin/env node
// Static admission only: calls the repository validators without collecting or running tests.
import { readFileSync, realpathSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { omniControlScope, validateRequest } from "../../test-ci-request.ts"
import { locateTestPackage } from "../../test-ci-location.ts"

const root = realpathSync(process.cwd())
const manifest = JSON.parse(readFileSync(new URL("./requests.json", import.meta.url), "utf8"))
const required = ["CI-SF", "CI-CLI", "CI-APP-SRC", "CI-APP-BROWSER", "CI-ATLAS-BUSINESS",
  "CI-UI-OPERATIONS", "CI-UI-DECISIONS", "CI-UI-REPORTS"]
if (JSON.stringify(manifest.recipes.map((recipe) => recipe.id)) !== JSON.stringify(required))
  throw new Error("REQUEST_DRIFT: eight mandatory recipes must remain explicit")
const checks = manifest.recipes.map((recipe) => {
  try {
    const request = validateRequest({ ...recipe.request, directory: recipe.directory, env: {} },
      (file) => (statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile() ?? false) &&
        realpathSync(path.join(root, file)).startsWith(root + path.sep),
      (selector) => locateTestPackage(root, selector))
    return { id: recipe.id, status: "VALID", request,
      request_sha256: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
      omni_control: omniControlScope(request), execution: "NOT_RUN" }
  } catch (error) {
    return { id: recipe.id, status: "BLOCKED", reason: error.message, execution: "NOT_RUN" }
  }
})
const blocked = checks.some((check) => check.status !== "VALID")
console.log(JSON.stringify({ schema: "sf2-final-request-preflight-v1",
  status: blocked ? "BLOCKED" : "VALID_REQUESTS_NOT_RUN",
  scope: "canonical request admission only; no test collection or execution",
  manifest: path.relative(root, fileURLToPath(new URL("./requests.json", import.meta.url))), checks }, null, 2))
process.exitCode = blocked ? 1 : 0
