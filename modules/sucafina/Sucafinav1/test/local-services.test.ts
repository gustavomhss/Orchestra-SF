import { afterEach, expect, test } from "bun:test"
import { chmod, lstat, mkdir, mkdtemp, readdir, realpath, rm, symlink } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import path from "node:path"
import { servicePlan } from "../local/service-plan.ts"

const input = {
  directory: "/private/var/sucafina/installation",
  moduleDirectory: "/opt/Sucafinav1",
  orchestraCheckout: "/opt/orchestra",
  uid: 501,
  installationId: "12ec06d9-4201-4370-a3e9-e9a72f213dc9",
  bunPath: "/opt/bun/bin/bun",
}

// Independent standard-library plist decoder, not a copy of generator escaping logic.
// CI only: this starts a parser, never launchctl or a service.
function plist(xml: string) {
  const parsed = Bun.spawnSync(["python3", "-c", "import plistlib,json,sys; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))"], {
    stdin: Buffer.from(xml),
  })
  expect(parsed.exitCode).toBe(0)
  return JSON.parse(parsed.stdout.toString()) as {
    Label: string; ProgramArguments: string[]; RunAtLoad: boolean; KeepAlive: boolean
    StandardOutPath: string; StandardErrorPath: string; WorkingDirectory: string
    EnvironmentVariables: Record<string, string>
  }
}

test("pure deterministic three-service contract with installation-specific labels", () => {
  const plans = servicePlan(input)
  expect(plans).toEqual(servicePlan(input))
  expect(plans.map((plan) => plan.kind).sort()).toEqual(["scanner", "server", "updater"])
  expect(new Set(plans.map((plan) => plan.file)).size).toBe(3)
  const other = servicePlan({ ...input, installationId: "22ec06d9-4201-4370-a3e9-e9a72f213dc9" })
  for (const plan of plans) {
    expect(plan.label).toBe(`local.sucafina.${input.installationId}.${plan.kind}`)
    expect(path.isAbsolute(plan.file)).toBe(true)
    expect(path.basename(plan.file)).toBe(`${plan.label}.plist`)
    expect(other.some((entry) => entry.label === plan.label || entry.file === plan.file)).toBe(false)
    const decoded = plist(plan.xml)
    expect(decoded.Label).toBe(plan.label)
    expect(decoded.RunAtLoad).toBe(true)
    expect(decoded.KeepAlive).toBe(true)
    for (const log of [decoded.StandardOutPath, decoded.StandardErrorPath]) {
      expect(path.isAbsolute(log)).toBe(true)
      expect(log.startsWith(`${input.directory}/`)).toBe(true)
      expect(path.normalize(log)).toBe(log)
    }
    expect(decoded.EnvironmentVariables.PATH).toBe("/opt/bun/bin:/usr/bin:/bin:/usr/sbin:/sbin")
    expect(decoded.EnvironmentVariables.ORCHESTRA_INHERIT_CREDENTIALS).toBe("0")
    expect(decoded.EnvironmentVariables.HOME).toBeUndefined()
    expect(Object.keys(decoded.EnvironmentVariables).some((key) => /TOKEN|PASSWORD|SECRET|AWS_|AZURE_|GOOGLE_|ANTHROPIC_|OPENAI_/.test(key))).toBe(false)
    const expected = plan.kind === "scanner"
      ? [`${input.directory}/tools/clamav/sbin/clamd`, "--foreground=yes", `--config-file=${input.directory}/clamd.conf`]
      : plan.kind === "updater"
        ? [`${input.directory}/tools/clamav/bin/freshclam`, "--daemon", "--foreground=yes", `--config-file=${input.directory}/freshclam.conf`]
        : [`${input.moduleDirectory}/local/start.command`, input.orchestraCheckout, input.directory]
    expect(decoded.ProgramArguments).toEqual(expected)
  }
})

test("plist parser round-trips XML metacharacters and shell-looking arguments literally", () => {
  const special = {
    ...input,
    directory: `/private/var/space & <tag> "quote" 'single' $(touch NEVER)`,
    moduleDirectory: "/opt/module & < >",
    orchestraCheckout: "/opt/checkout ' & < >",
    bunPath: "/opt/bun & tools/bin/bun",
  }
  const plans = servicePlan(special)
  for (const plan of plans) {
    const decoded = plist(plan.xml)
    expect(decoded.EnvironmentVariables.PATH).toBe("/opt/bun & tools/bin:/usr/bin:/bin:/usr/sbin:/sbin")
    if (plan.kind === "server") expect(decoded.ProgramArguments).toEqual([
      `${special.moduleDirectory}/local/start.command`, special.orchestraCheckout, special.directory,
    ])
    if (plan.kind === "scanner") expect(decoded.ProgramArguments[2]).toBe(`--config-file=${special.directory}/clamd.conf`)
    if (plan.kind === "updater") expect(decoded.ProgramArguments[3]).toBe(`--config-file=${special.directory}/freshclam.conf`)
  }
})

for (const field of ["directory", "moduleDirectory", "orchestraCheckout", "bunPath"] as const) {
  for (const value of ["", "relative/path", "~/private", "/tmp/../private", "/tmp/./private", "/tmp/bad\0path", "/tmp/bad\npath"]) {
    test(`reject unsafe ${field} ${JSON.stringify(value)}`, () => {
      expect(() => servicePlan({ ...input, [field]: value })).toThrow()
    })
  }
}
for (const uid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`reject invalid owner uid ${uid}`, () => expect(() => servicePlan({ ...input, uid })).toThrow())
}
for (const installationId of ["", "other.app", "../escape", "12ec06d9-4201-4370-a3e9-e9a72f213dc9.server"]) {
  test(`reject invalid installation UUID ${installationId}`, () => expect(() => servicePlan({ ...input, installationId })).toThrow())
}
test("uid zero is a valid numeric contract input; actual ownership is an installation concern", () => {
  expect(servicePlan({ ...input, uid: 0 })).toHaveLength(3)
})

for (const name of ["ensure.command", "install-startup.command"]) {
  test(`${name} parses as POSIX shell without executing it`, async () => {
    const file = path.join(import.meta.dir, "../local", name)
    expect((await Bun.file(file).text()).startsWith("#!/bin/sh\n")).toBe(true)
    const checked = Bun.spawnSync(["/bin/sh", "-n", file])
    expect(checked.stderr.toString()).toBe("")
    expect(checked.exitCode).toBe(0)
  })
}

// Hosted only: fixtures contain synthetic public identity metadata, never real private config.
const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })
async function preparation() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-services-"))
  temporary.push(root)
  const directory = path.join(root, "private")
  const checkout = path.join(root, "checkout")
  await mkdir(directory, { mode: 0o700 })
  await mkdir(checkout, { mode: 0o700 })
  await Bun.write(path.join(directory, "installation.json"), JSON.stringify({
    authentication: "local-operator", localOperator: { installationId: input.installationId, uid: userInfo().uid },
    scanner: { host: "127.0.0.1", port: 43310 }, origin: "http://localhost:4110", mount: "/sucafina",
  }))
  await chmod(path.join(directory, "installation.json"), 0o600)
  const script = path.join(import.meta.dir, "../local/service-plan.ts")
  // No --activate or --ensure in CI. The child only prepares fixture files.
  const run = (target = directory, product = checkout, executable = process.execPath) => Bun.spawnSync([
    executable, "run", script, "--prepare", product, target,
  ], { env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" } })
  return { root, directory, checkout, run }
}

test("portable --prepare produces three private reviewable plists and exact metadata idempotently", async () => {
  const fixture = await preparation()
  const result = fixture.run()
  expect(result.stderr.toString()).toBe("")
  expect(result.exitCode).toBe(0)
  expect(result.stdout.toString()).toContain("No services changed")
  const file = path.join(fixture.directory, "service-installation.json")
  const metadata = await Bun.file(file).json() as {
    uid: number; orchestraCheckout: string; installationId: string; bunPath: string
    services: { label: string; file: string; target: string; kind: string }[]
  }
  expect(metadata.uid).toBe(userInfo().uid)
  expect(metadata.bunPath).toBe(await realpath(process.execPath))
  expect(metadata.installationId).toBe(input.installationId)
  expect(metadata.orchestraCheckout).toBe(fixture.checkout)
  expect(metadata.services).toHaveLength(3)
  expect((await lstat(file)).mode & 0o777).toBe(0o600)
  for (const service of metadata.services) {
    expect(service.target).toBe(path.join(userInfo().homedir, "Library/LaunchAgents", `${service.label}.plist`))
    expect(service.file).toBe(path.join(fixture.directory, "launch-agents", `${service.label}.plist`))
    expect((await lstat(service.file)).mode & 0o777).toBe(0o600)
    expect(plist(await Bun.file(service.file).text()).Label).toBe(service.label)
    for (const suffix of ["out", "err"]) expect((await lstat(path.join(fixture.directory, "service-logs", `${service.kind}.${suffix}.log`))).mode & 0o777).toBe(0o600)
  }
  const before = await Bun.file(file).text()
  expect(fixture.run().exitCode).toBe(0)
  expect(await Bun.file(file).text()).toBe(before)
})

test("prepare rejects relative inputs, exposed private directories and foreign owner identity", async () => {
  const fixture = await preparation()
  expect(fixture.run("relative").exitCode).not.toBe(0)
  expect(fixture.run(fixture.directory, "relative").exitCode).not.toBe(0)
  await chmod(fixture.directory, 0o755)
  expect(fixture.run().exitCode).not.toBe(0)
  await chmod(fixture.directory, 0o700)
  await Bun.write(path.join(fixture.directory, "installation.json"), JSON.stringify({
    authentication: "local-operator", localOperator: { installationId: input.installationId, uid: userInfo().uid + 1 },
  }))
  expect(fixture.run().exitCode).not.toBe(0)
  expect(await Bun.file(path.join(fixture.directory, "service-installation.json")).exists()).toBe(false)
})

test("prepare rejects symlinked private path, config, plist directory and metadata", async () => {
  const fixture = await preparation()
  const alias = path.join(fixture.root, "alias")
  await symlink(fixture.directory, alias)
  expect(fixture.run(alias).exitCode).not.toBe(0)
  const config = path.join(fixture.directory, "installation.json")
  const saved = await Bun.file(config).text()
  await rm(config)
  const outside = path.join(fixture.root, "outside.json")
  await Bun.write(outside, saved)
  await chmod(outside, 0o600)
  await symlink(outside, config)
  expect(fixture.run().exitCode).not.toBe(0)
  await rm(config)
  await Bun.write(config, saved)
  await chmod(config, 0o600)
  await symlink(fixture.checkout, path.join(fixture.directory, "launch-agents"))
  expect(fixture.run().exitCode).not.toBe(0)
  await rm(path.join(fixture.directory, "launch-agents"))
  await symlink(outside, path.join(fixture.directory, "service-installation.json"))
  expect(fixture.run().exitCode).not.toBe(0)
  expect(await Bun.file(outside).text()).toBe(saved)
})

test("prepare refuses altered reviewed plist and metadata instead of overwriting", async () => {
  const fixture = await preparation()
  expect(fixture.run().exitCode).toBe(0)
  const file = path.join(fixture.directory, "launch-agents", `local.sucafina.${input.installationId}.scanner.plist`)
  await Bun.write(file, "foreign-content")
  expect(fixture.run().exitCode).not.toBe(0)
  expect(await Bun.file(file).text()).toBe("foreign-content")
  const metadata = path.join(fixture.directory, "service-installation.json")
  await Bun.write(metadata, "{}")
  expect(fixture.run().exitCode).not.toBe(0)
  expect(await Bun.file(metadata).text()).toBe("{}")
})


test("prepare through a Bun executable symlink records its canonical executable and PATH", async () => {
  const fixture = await preparation()
  const executable = path.join(fixture.root, "linked-bun")
  await symlink(await realpath(process.execPath), executable)
  const result = fixture.run(fixture.directory, fixture.checkout, executable)
  expect(result.stderr.toString()).toBe("")
  expect(result.exitCode).toBe(0)
  const metadata = await Bun.file(path.join(fixture.directory, "service-installation.json")).json() as {
    bunPath: string; services: { file: string }[]
  }
  expect(metadata.bunPath).toBe(await realpath(process.execPath))
  for (const service of metadata.services) {
    const decoded = plist(await Bun.file(service.file).text())
    expect(decoded.EnvironmentVariables.PATH).toBe(`${path.dirname(await realpath(process.execPath))}:/usr/bin:/bin:/usr/sbin:/sbin`)
    expect(decoded.EnvironmentVariables.HOME).toBeUndefined()
  }
})


test("prepare rejects scanner HTTP port collision before any plan, log or metadata write", async () => {
  const fixture = await preparation()
  await Bun.write(path.join(fixture.directory, "installation.json"), JSON.stringify({
    authentication: "local-operator", localOperator: { installationId: input.installationId, uid: userInfo().uid },
    scanner: { host: "127.0.0.1", port: 4110 }, origin: "http://localhost:4110", mount: "/sucafina",
  }))
  const result = fixture.run()
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr.toString()).toContain("Scanner port 4110 conflicts")
  expect(await readdir(fixture.directory)).toEqual(["installation.json"])
})
