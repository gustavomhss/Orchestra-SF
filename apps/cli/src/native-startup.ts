export * as NativeStartup from "./native-startup"

import { Flag } from "@orchestra/core/flag/flag"

export type Admission = {
  configuration: string
  origin: string
  webRoot: string
}

export type VerifyInput = {
  configuration?: string
  argv: readonly string[]
  environment: Readonly<Record<string, string | undefined>>
  webRoot?: string
}

const startup: { result?: Promise<Admission | undefined> } = {}

export function admit() {
  return startup.result ??= verify({
    configuration: Flag.ORCHESTRA_SF_INSTALLATION,
    argv: process.argv.slice(2),
    environment: process.env,
    webRoot: Flag.ORCHESTRA_WEB_UI_DIR,
  })
}

export async function verify(input: VerifyInput): Promise<Admission | undefined> {
  if (input.configuration === undefined) return
  // Fail closed until the native startup acceptance suite qualifies this admission boundary.
  throw new Error("Native installation startup is not implemented")
}
