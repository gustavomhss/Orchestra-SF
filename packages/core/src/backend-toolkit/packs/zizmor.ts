import type { Pack } from "../manifest"

const RELEASE = "https://github.com/zizmorcore/zizmor/releases/download/v1.32.0"
const artifact = (asset: string, integrity: `sha256-${string}`, executable = "zizmor") => ({
  artifact: {
    url: `${RELEASE}/${asset}`,
    integrity,
    format: asset.endsWith(".zip") ? ("zip" as const) : ("tar.gz" as const),
    entries: [{ from: executable, to: executable, executable: true }],
  },
  executable,
})

export default {
  id: "zizmor",
  version: "1.32.0",
  license: "MIT",
  upstream: "zizmorcore/zizmor",
  fit: { role: "check", input: "GitHub Actions workflows", skills: [] },
  targets: {
    "darwin-arm64": artifact("zizmor-aarch64-apple-darwin.tar.gz", "sha256-bv7RjEU5pmP9PcwrovpTP9hFbE5kbZQWIG2gWRVKDTw="),
    "darwin-x64": artifact("zizmor-x86_64-apple-darwin.tar.gz", "sha256-aYMUPEcdsmhFpprE3SsswhX5cWYu/Ni7wmc4i4zlWWk="),
    "linux-arm64": artifact("zizmor-aarch64-unknown-linux-gnu.tar.gz", "sha256-yxUrIHuBUXbX+nwd5GFPYViAAzUTkJUJCA95ea39n9A="),
    "linux-x64": artifact("zizmor-x86_64-unknown-linux-gnu.tar.gz", "sha256-uxEMx2Xs6s1+JLKOSpVutuV8YAB7CXB/A5+YYKCKlXs="),
    "win32-x64": artifact("zizmor-x86_64-pc-windows-msvc.zip", "sha256-0oShbgnZ30ziwAD7Xntb1TMuDpO+pXGByOIlsku1nUk=", "zizmor.exe"),
  },
  floor: {
    "darwin-arm64": { macos: "11.0" },
    "darwin-x64": { macos: "26.1" },
    "linux-arm64": { glibc: "2.34" },
    "linux-x64": { glibc: "2.34" },
    "win32-x64": {},
  },
  notices: [{
    url: "https://raw.githubusercontent.com/zizmorcore/zizmor/21bd300700d43d9ba04b0c1fce72a89391ac80b4/LICENSE",
    integrity: "sha256-pv0b0Y2nzsgoRjnVsNNRuQk0MXvhufnqlKB3YhxvNa8=",
    filename: "zizmor-1.32.0-license.txt",
  }],
} as const satisfies Pack
