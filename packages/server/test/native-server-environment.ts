import { chmodSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

export function createNativeServerEnvironment(parent?: string) {
  const root = mkdtempSync(path.join(parent ?? realpathSync(tmpdir()), "sf-server-adapter-"))
  chmodSync(root, 0o700)
  const directories = ["host-data", "host-config", "host-cache", "host-state", "host-tmp"]
  directories.forEach((name) => {
    mkdirSync(path.join(root, name), { mode: 0o700 })
    chmodSync(path.join(root, name), 0o700)
  })
  return {
    root,
    environment: {
      ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
      TMPDIR: path.join(root, "host-tmp"),
      XDG_DATA_HOME: path.join(root, "host-data"),
      XDG_CONFIG_HOME: path.join(root, "host-config"),
      XDG_CACHE_HOME: path.join(root, "host-cache"),
      XDG_STATE_HOME: path.join(root, "host-state"),
    },
  }
}
