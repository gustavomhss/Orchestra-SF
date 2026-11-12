import path from "node:path"

export function buildRecoveryPlan(input: {
  installationDirectory: string
  binary: string
  home: string
  installationId: string
  uid: number
}): {
  label: string
  configurationPath: string
  configuration: string
  plistPath: string
  plist: string
  databasePath: string
  replicaDirectory: string
} {
  requireCanonicalPath(input.installationDirectory)
  requireCanonicalPath(input.binary)
  requireCanonicalPath(input.home)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.installationId))
    throw new Error("Canonical installation UUID required")
  if (!Number.isSafeInteger(input.uid) || input.uid < 0) throw new Error("Nonnegative integer owner UID required")

  const label = `local.sucafina.${input.installationId}.recovery`
  const configurationPath = path.join(input.installationDirectory, "recovery", "litestream.yml")
  const databasePath = path.join(input.installationDirectory, "business-local", "installation.sqlite")
  const replicaDirectory = path.join(input.installationDirectory, "recovery", "replica")
  const plistPath = path.join(input.home, "Library", "LaunchAgents", `${label}.plist`)
  const configuration = `snapshot:
  interval: 1h
  retention: 840h
l0-retention: 840h
sync-interval: 1s
validation:
  interval: 6h
verify-compaction: true
dbs:
  - path: ${JSON.stringify(databasePath)}
    monitor-interval: 1s
    replica:
      path: ${JSON.stringify(replicaDirectory)}
`
  const arguments_ = [input.binary, "replicate", "-config", configurationPath, "-no-expand-env"]
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${escapeXml(label)}</string>
<key>ProgramArguments</key><array>${arguments_.map((argument) => `<string>${escapeXml(argument)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${escapeXml(input.installationDirectory)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${escapeXml(path.join(input.installationDirectory, "recovery", "stdout.log"))}</string>
<key>StandardErrorPath</key><string>${escapeXml(path.join(input.installationDirectory, "recovery", "stderr.log"))}</string>
<key>Umask</key><integer>63</integer>
<key>ProcessType</key><string>Background</string>
<key>ThrottleInterval</key><integer>10</integer>
</dict></plist>
`

  return { label, configurationPath, configuration, plistPath, plist, databasePath, replicaDirectory }
}

function requireCanonicalPath(value: string) {
  if (!path.isAbsolute(value) || path.resolve(value) !== value || /[\x00-\x1f\x7f$]/.test(value))
    throw new Error("Canonical absolute path without control characters or dollar expansion required")
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
