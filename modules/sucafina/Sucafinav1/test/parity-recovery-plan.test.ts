import { expect, test } from "bun:test"
import { buildRecoveryPlan } from "../local/recovery-plan.ts"

const validInput = {
  installationDirectory: "/opt/Sucafina/install-1",
  binary: "/opt/Sucafina/bin/litestream",
  home: "/Users/operator",
  installationId: "0190ab12-3456-4789-8abc-def012345678",
  uid: 501,
}

function build(overrides: Partial<typeof validInput> = {}) {
  return buildRecoveryPlan({ ...validInput, ...overrides })
}

test("builds deterministic dedicated recovery plan paths and UUID label", () => {
  const result = build()

  expect(result).toEqual(build())
  expect(result).toMatchObject({
    label: "local.sucafina.0190ab12-3456-4789-8abc-def012345678.recovery",
    configurationPath: "/opt/Sucafina/install-1/recovery/litestream.yml",
    plistPath: "/Users/operator/Library/LaunchAgents/local.sucafina.0190ab12-3456-4789-8abc-def012345678.recovery.plist",
    databasePath: "/opt/Sucafina/install-1/business-local/installation.sqlite",
    replicaDirectory: "/opt/Sucafina/install-1/recovery/replica",
  })
  expect(Object.keys(result).sort()).toEqual(
    [
      "label",
      "configurationPath",
      "configuration",
      "plistPath",
      "plist",
      "databasePath",
      "replicaDirectory",
    ].sort(),
  )
})

test("emits the v0.5 global retention settings and one quoted local file replica", () => {
  const result = build()

  expect(result.configuration).toBe(`snapshot:
  interval: 1h
  retention: 840h
l0-retention: 840h
sync-interval: 1s
validation:
  interval: 6h
verify-compaction: true
dbs:
  - path: ${JSON.stringify(result.databasePath)}
    monitor-interval: 1s
    replica:
      path: ${JSON.stringify(result.replicaDirectory)}
`)
  expect(result.configuration).not.toContain("replicas:")
  expect(result.configuration).not.toContain("snapshot-interval:")
  expect(result.configuration).not.toContain("validation-interval:")
  expect(result.configuration).not.toMatch(/mcp|https?:|s3:|metrics|token|password|secret|credential|environment/i)
})

test("writes a dedicated LaunchAgent with exact argv, paths, runtime policy, and no injected environment", () => {
  const result = build()

  expect(result.plist).toContain(`<key>Label</key><string>${result.label}</string>`)
  expect(result.plist).toContain(
    `<key>ProgramArguments</key><array><string>${validInput.binary}</string><string>replicate</string><string>-config</string><string>${result.configurationPath}</string><string>-no-expand-env</string></array>`,
  )
  expect(result.plist).toContain(`<key>WorkingDirectory</key><string>${validInput.installationDirectory}</string>`)
  expect(result.plist).toContain("<key>RunAtLoad</key><true/>")
  expect(result.plist).toContain("<key>KeepAlive</key><true/>")
  expect(result.plist).toContain(
    `<key>StandardOutPath</key><string>${validInput.installationDirectory}/recovery/stdout.log</string>`,
  )
  expect(result.plist).toContain(
    `<key>StandardErrorPath</key><string>${validInput.installationDirectory}/recovery/stderr.log</string>`,
  )
  expect(result.plist).toContain("<key>Umask</key><integer>63</integer>")
  expect(result.plist).toContain("<key>ProcessType</key><string>Background</string>")
  expect(result.plist).toContain("<key>ThrottleInterval</key><integer>10</integer>")
  expect(result.plist).not.toContain("EnvironmentVariables")
  expect(result.plist).not.toContain("restore-if-db-not-exists")
})

test("JSON-quotes YAML paths and XML-escapes LaunchAgent values", () => {
  const result = build({
    installationDirectory: "/opt/Sucafina & Sons/<local>",
    binary: "/opt/tools/lite&stream<0.5.18>",
    home: "/Users/operator & admin",
  })

  expect(result.configuration).toContain(`path: ${JSON.stringify(result.databasePath)}`)
  expect(result.configuration).toContain(`path: ${JSON.stringify(result.replicaDirectory)}`)
  expect(result.plist).toContain("lite&amp;stream&lt;0.5.18&gt;")
  expect(result.plist).toContain("Sucafina &amp; Sons/&lt;local&gt;")
  expect(result.plistPath).toBe(
    "/Users/operator & admin/Library/LaunchAgents/local.sucafina.0190ab12-3456-4789-8abc-def012345678.recovery.plist",
  )
  expect(result.plist).not.toContain("operator")
  expect(result.plist).not.toContain("<local>")
})

test("rejects noncanonical, relative, control-character, and dollar-expanded paths", () => {
  for (const invalidPath of [
    "relative/install",
    "/opt/install/../other",
    "/opt//install",
    "/opt/install/",
    "/opt/install/$HOME",
    "/opt/install\nother",
  ]) {
    expect(() => build({ installationDirectory: invalidPath })).toThrow()
    expect(() => build({ binary: invalidPath })).toThrow()
    expect(() => build({ home: invalidPath })).toThrow()
  }
})

test("rejects malformed installation UUIDs and invalid owner UIDs", () => {
  for (const installationId of [
    "",
    "0190ab12-3456-4789-8abc-def01234567z",
    "0190ab12-3456-4789-8abc-def012345678-extra",
    "0190ab12345647898abcdef012345678",
  ]) {
    expect(() => build({ installationId })).toThrow()
  }

  for (const uid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => build({ uid })).toThrow()
  }
  expect(() => build({ uid: 0 })).not.toThrow()
})
