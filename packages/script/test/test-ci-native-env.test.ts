import { expect, test } from "bun:test"
import { parseOptions, validateRequest } from "../../../script/test-ci-request.ts"

const nativeKey = "VITE_ORCHESTRA_SF_NATIVE"
const omniKey = "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER"
const channelKey = "ORCHESTRA_CHANNEL"
const production = "e2e/playwright.production.config.ts"
const spec = "e2e/native-server-pin.spec.ts"

function playwrightRequest(env: Record<string, string>) {
  return { package: "app", runner: "playwright", config: production, args: [spec], env }
}

function parseEnv(...entries: string[]) {
  return parseOptions(["app", ...entries.flatMap((entry) => ["--env", entry])])
}

test("native browser opt-in passes the actual CLI parser and request validator with finite existing values", () => {
  const parsed = parseEnv(`${nativeKey}=1`, `${omniKey}=strict`, `${channelKey}=prod`)
  expect(parsed.env).toEqual({ [nativeKey]: "1", [omniKey]: "strict", [channelKey]: "prod" })
  const result = validateRequest(playwrightRequest(parsed.env), () => true)
  expect(result).toMatchObject({
    package: "app",
    runner: "playwright",
    config: production,
    args: [spec],
    env: { [nativeKey]: "1", [omniKey]: "strict", [channelKey]: "prod" },
  })
})

test("native browser flag rejects every value except exact one in CLI and normalized requests", () => {
  for (const value of ["0", "", "true", "typo", "1\n", "1\r", "1\nORCHESTRA_CHANNEL=prod"]) {
    expect(() => parseEnv(`${nativeKey}=${value}`)).toThrow()
    expect(() => validateRequest(playwrightRequest({ [nativeKey]: value }), () => true)).toThrow()
  }
})

test("unknown VITE keys remain rejected instead of becoming an environment passthrough", () => {
  for (const key of ["VITE_SF_NATIVE", "VITE_ORCHESTRA_SF_NATIVE_EXTRA", "VITE_ORCHESTRA_SF_NATIVE_ANYTHING"]) {
    expect(() => parseEnv(`${key}=1`)).toThrow()
    expect(() => validateRequest(playwrightRequest({ [key]: "1" }), () => true)).toThrow()
  }
})

test("existing omni and production channel finite values remain unchanged", () => {
  for (const value of ["1", "strict"]) {
    const parsed = parseEnv(`${omniKey}=${value}`)
    expect(parsed.env).toEqual({ [omniKey]: value })
    expect(validateRequest(playwrightRequest(parsed.env), () => true).env).toEqual({ [omniKey]: value })
  }
  const parsed = parseEnv(`${channelKey}=prod`)
  expect(parsed.env).toEqual({ [channelKey]: "prod" })
  expect(validateRequest(playwrightRequest(parsed.env), () => true).env).toEqual({ [channelKey]: "prod" })
  for (const value of ["0", "typo", "strict", "prod\n", "prod\r", "prod\nSECRET=bad"]) {
    const key = value === "0" || value === "typo" ? omniKey : channelKey
    expect(() => parseEnv(`${key}=${value}`)).toThrow()
    expect(() => validateRequest(playwrightRequest({ [key]: value }), () => true)).toThrow()
  }
})

test("native env acceptance leaves the existing Playwright runner, config and spec-path restrictions intact", () => {
  expect(() => validateRequest({ ...playwrightRequest({ [nativeKey]: "1" }), runner: "shell" }, () => true)).toThrow("cannot run shell")
  expect(() => validateRequest({ ...playwrightRequest({ [nativeKey]: "1" }), config: "e2e/other.config.ts" }, () => true)).toThrow("config must be")
  expect(() => validateRequest({ ...playwrightRequest({ [nativeKey]: "1" }), args: ["../e2e/native-server-pin.spec.ts"] }, () => true)).toThrow("invalid spec path")
  expect(() => validateRequest({ ...playwrightRequest({ [nativeKey]: "1" }), args: ["e2e/performance/native-server-pin.spec.ts"] }, () => true)).toThrow("invalid spec path")
})
