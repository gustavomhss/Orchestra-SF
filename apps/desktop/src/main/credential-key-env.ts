import { join } from "node:path"

// An unsigned macOS build cannot keep a Keychain "Always Allow". Point the child at the existing
// key file so it does not ask for the login password on every launch. A missing file still uses the
// Keychain: inventing a new key would leave sealed credentials unreadable.
export function credentialKeyEnv(input: {
  platform: string
  signed: boolean
  dataHome: string | undefined
  home: string
  exists: (file: string) => boolean
}) {
  if (input.platform !== "darwin" || input.signed) return {}
  const root = input.dataHome || join(input.home, ".local", "share")
  const file = join(root, "orchestra", "credential.key")
  if (!input.exists(file)) return {}
  return { ORCHESTRA_CREDENTIAL_KEY_FILE: file }
}
