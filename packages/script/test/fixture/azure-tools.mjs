import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

export const root = path.resolve(import.meta.dirname, "../../../..")

export const expectedPins = {
  bicep: {
    version: "v0.49.2",
    url: "https://github.com/Azure/bicep/releases/download/v0.49.2/bicep-linux-x64",
    sha256: "0ab9de90c2493f206f8281bae74f9ee2d5ed3605548dab1adf41fef185e1f7c5",
  },
  actionlint: {
    version: "v1.7.12",
    url: "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz",
    sha256: "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8",
  },
  yaml: {
    version: "2.9.1",
    url: "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz",
    sha256: "4ef6c54cf559b8a207b7b518378230805a1c84af239b14960e8c67c7d59de5d3",
  },
}

// Download is refused outside hosted Linux x64. A 200 response is not acceptance; the pin hash is.
export function requireHostedLinux() {
  assert.equal(process.env.GITHUB_ACTIONS, "true")
  assert.equal(process.platform, "linux")
  assert.equal(process.arch, "x64")
}

export function pins() {
  return JSON.parse(readFileSync(path.join(root, "infra/azure/tools.json"), "utf8"))
}

export function source(relative) {
  const full = path.join(root, relative)
  assert.equal(existsSync(full), true, `missing ${relative}`)
  return full
}

export async function tool(pin, name) {
  requireHostedLinux()
  const response = await fetch(pin.url)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(response.ok, true, `${name} download HTTP ${response.status}`)
  assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.sha256)
  const file = path.join(mkdtempSync(path.join(tmpdir(), "azure-tool-")), name)
  writeFileSync(file, bytes)
  chmodSync(file, 0o755)
  return file
}

export function compileBicep(bin, file) {
  const stdout = execFileSync(bin, ["build", file, "--stdout"], { encoding: "utf8" })
  const start = stdout.indexOf("{")
  assert.ok(start >= 0)
  return JSON.parse(stdout.slice(start))
}

export function runActionlint(archive, workflow) {
  const dir = path.dirname(archive)
  execFileSync("tar", ["-xzf", archive, "-C", dir, "actionlint"])
  const bin = path.join(dir, "actionlint")
  chmodSync(bin, 0o755)
  // actionlint 1.7.12 uses -config-file instead of .github/actionlint.yaml, so a repo paths.ignore cannot hide this workflow.
  const config = path.join(dir, "actionlint.yaml")
  writeFileSync(config, "{}\n")
  execFileSync(bin, ["-no-color", "-config-file", config, workflow], { encoding: "utf8" })
}
