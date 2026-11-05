import { expect, test } from "bun:test"
import pinned from "../../src/backend-toolkit/packs/zizmor"

test("zizmor 1.32.0 has independently verified release artifact and license pins", () => {
  expect(pinned.version).toBe("1.32.0")
  expect(pinned.license).toBe("MIT")
  expect(pinned.upstream).toBe("zizmorcore/zizmor")
  expect(pinned.fit).toEqual({ role: "check", input: "GitHub Actions workflows", skills: [] })
  const approved = {
    "darwin-arm64": { executable: "zizmor", url: "https://github.com/zizmorcore/zizmor/releases/download/v1.32.0/zizmor-aarch64-apple-darwin.tar.gz", integrity: "sha256-bv7RjEU5pmP9PcwrovpTP9hFbE5kbZQWIG2gWRVKDTw=", format: "tar.gz", entries: [{ from: "zizmor", to: "zizmor", executable: true }] },
    "darwin-x64": { executable: "zizmor", url: "https://github.com/zizmorcore/zizmor/releases/download/v1.32.0/zizmor-x86_64-apple-darwin.tar.gz", integrity: "sha256-aYMUPEcdsmhFpprE3SsswhX5cWYu/Ni7wmc4i4zlWWk=", format: "tar.gz", entries: [{ from: "zizmor", to: "zizmor", executable: true }] },
    "linux-arm64": { executable: "zizmor", url: "https://github.com/zizmorcore/zizmor/releases/download/v1.32.0/zizmor-aarch64-unknown-linux-gnu.tar.gz", integrity: "sha256-yxUrIHuBUXbX+nwd5GFPYViAAzUTkJUJCA95ea39n9A=", format: "tar.gz", entries: [{ from: "zizmor", to: "zizmor", executable: true }] },
    "linux-x64": { executable: "zizmor", url: "https://github.com/zizmorcore/zizmor/releases/download/v1.32.0/zizmor-x86_64-unknown-linux-gnu.tar.gz", integrity: "sha256-uxEMx2Xs6s1+JLKOSpVutuV8YAB7CXB/A5+YYKCKlXs=", format: "tar.gz", entries: [{ from: "zizmor", to: "zizmor", executable: true }] },
    "win32-x64": { executable: "zizmor.exe", url: "https://github.com/zizmorcore/zizmor/releases/download/v1.32.0/zizmor-x86_64-pc-windows-msvc.zip", integrity: "sha256-0oShbgnZ30ziwAD7Xntb1TMuDpO+pXGByOIlsku1nUk=", format: "zip", entries: [{ from: "zizmor.exe", to: "zizmor.exe", executable: true }] },
  } as const
  expect(Object.keys(pinned.targets).sort()).toEqual(Object.keys(approved).sort())
  for (const [target, expected] of Object.entries(approved)) {
    expect(pinned.targets[target as keyof typeof pinned.targets]).toEqual({
      executable: expected.executable,
      artifact: { url: expected.url, integrity: expected.integrity, format: expected.format, entries: [...expected.entries] },
    })
  }
  expect(pinned.notices).toEqual([{
    url: "https://raw.githubusercontent.com/zizmorcore/zizmor/21bd300700d43d9ba04b0c1fce72a89391ac80b4/LICENSE",
    integrity: "sha256-pv0b0Y2nzsgoRjnVsNNRuQk0MXvhufnqlKB3YhxvNa8=",
    filename: "zizmor-1.32.0-license.txt",
  }])
})

test("zizmor records static-header ABI floors, not runtime qualification", () => {
  expect(pinned.floor).toEqual({
    "darwin-arm64": { macos: "11.0" },
    "darwin-x64": { macos: "26.1" },
    "linux-arm64": { glibc: "2.34" },
    "linux-x64": { glibc: "2.34" },
    "win32-x64": {},
  })
})
