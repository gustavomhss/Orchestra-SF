import { expect, test } from "bun:test"
import pinned from "../../src/backend-toolkit/packs/oxlint"

test("oxlint 1.91.0 pins the independently verified artifact and license bytes", () => {
  expect(pinned.version).toBe("1.91.0")
  expect(pinned.license).toBe("MIT")
  expect(pinned.upstream).toBe("oxc-project/oxc")
  expect(pinned.fit).toEqual({ role: "check", input: "JavaScript and TypeScript sources", skills: [] })
  const approved = {
    "darwin-arm64": { executable: "oxlint", url: "https://github.com/oxc-project/oxc/releases/download/oxlint_v1.91.0/oxlint-aarch64-apple-darwin.tar.gz", integrity: "sha256-0fYDeHik1dFKNtgQgDhZrmkaUDL3iYgRq/23X5AfkOk=", format: "tar.gz", entries: [{ from: "oxlint", to: "oxlint", executable: true }] },
    "darwin-x64": { executable: "oxlint", url: "https://github.com/oxc-project/oxc/releases/download/oxlint_v1.91.0/oxlint-x86_64-apple-darwin.tar.gz", integrity: "sha256-tCKmpf/nU7EX1zaISOctLKNRPusba5hvbw3hR0d3KiY=", format: "tar.gz", entries: [{ from: "oxlint", to: "oxlint", executable: true }] },
    "linux-arm64": { executable: "oxlint", url: "https://github.com/oxc-project/oxc/releases/download/oxlint_v1.91.0/oxlint-aarch64-unknown-linux-musl.tar.gz", integrity: "sha256-MOuDi5S5tUPktSJXKv/OAzfOmcqQ8j6W2GQB/4sucJc=", format: "tar.gz", entries: [{ from: "oxlint", to: "oxlint", executable: true }] },
    "linux-x64": { executable: "oxlint", url: "https://github.com/oxc-project/oxc/releases/download/oxlint_v1.91.0/oxlint-x86_64-unknown-linux-musl.tar.gz", integrity: "sha256-K4F7c5V32dSl0tcvEZIzNU2US+kMrzgLuJqbou3ojGw=", format: "tar.gz", entries: [{ from: "oxlint", to: "oxlint", executable: true }] },
    "win32-x64": { executable: "oxlint-x86_64-pc-windows-msvc.exe", url: "https://github.com/oxc-project/oxc/releases/download/oxlint_v1.91.0/oxlint-x86_64-pc-windows-msvc.zip", integrity: "sha256-Tvqmn7XkU6WH2bS6Idh6Ulo1M2Lf14e8yz5u11T04Og=", format: "zip", entries: [{ from: "oxlint-x86_64-pc-windows-msvc.exe", to: "oxlint-x86_64-pc-windows-msvc.exe", executable: true }] },
  } as const
  expect(Object.keys(pinned.targets).sort()).toEqual(Object.keys(approved).sort())
  for (const [target, expected] of Object.entries(approved)) {
    expect(pinned.targets[target as keyof typeof pinned.targets]).toEqual({
      executable: expected.executable,
      artifact: { url: expected.url, integrity: expected.integrity, format: expected.format, entries: [...expected.entries] },
    })
  }
  expect(pinned.notices).toEqual([{
    url: "https://raw.githubusercontent.com/oxc-project/oxc/f3fcdcc61b08e9880476279ba21a363967940fa4/LICENSE",
    integrity: "sha256-lc7V7PETP79B1Am1VVyGw0T4PzsBmSYFfdvAfP3MJ7M=",
    filename: "oxlint-1.91.0-license.txt",
  }])
})

test("oxlint records measured platform requirements without inventing Linux or Windows floors", () => {
  expect(pinned.floor).toEqual({
    "darwin-arm64": { macos: "11.0" },
    "darwin-x64": { macos: "10.12" },
    "linux-arm64": {},
    "linux-x64": {},
    "win32-x64": {},
  })
})
