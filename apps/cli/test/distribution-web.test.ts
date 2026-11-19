import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, link, lstat, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { WebUi } from "@orchestra/server/web-ui"
import { prepareDistribution, verifyDistribution } from "../script/distribution-payload"
import { requireDistributionHost } from "./fixture/distribution-host"
import { payloadFixture, payloadSnapshot, tuple } from "./fixture/distribution-payload"

// Inert headers and strings qualify admission only. This file does not claim a runtime or native build.
const roots: string[] = []
const indexHtml = Buffer.from("<!doctype html><title>orchestra</title>\n")
const appJs = Buffer.from("export const app = 1\n")
const ownedBytes = Buffer.from("owned-outside\n")
requireDistributionHost()
afterEach(() => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

test("publishes native payload and web assets together", async () => {
  const value = await fixture()
  const before = await seal(value.source, value.web)
  const input = { ...value.input, web: value.web }
  const manifest = await prepareDistribution(input)
  expect(await verifyDistribution(input.out)).toEqual(manifest)
  const paths = manifest.files.map((file) => file.path)
  expect(paths).toEqual([...paths].sort())
  expect(paths).toEqual(expect.arrayContaining([`bin/${tuple.executable}`, `bin/${tuple.supervisor}`, "bin/hugr_omni.node", "bin/web/index.html", "bin/web/assets/app.js"]))
  const index = await readFile(join(input.out, "bin/web/index.html"))
  const script = await readFile(join(input.out, "bin/web/assets/app.js"))
  expect(index).toEqual(indexHtml)
  expect(script).toEqual(appJs)
  expect(sha256(index)).toBe(sha256(indexHtml))
  expect(sha256(script)).toBe(sha256(appJs))
  expect(manifest.files.find((file) => file.path === "bin/web/index.html")).toEqual({ path: "bin/web/index.html", sha256: sha256(indexHtml), executable: false })
  expect(manifest.files.find((file) => file.path === "bin/web/assets/app.js")).toEqual({ path: "bin/web/assets/app.js", sha256: sha256(appJs), executable: false })
  const published = await payloadSnapshot(input.out)
  for (const name of [`bin/${tuple.executable}`, `bin/${tuple.supervisor}`]) {
    const from = before.source.find((entry) => entry.path === name)
    expect(Boolean((published.find((entry) => entry.path === name)?.mode ?? 0) & 0o111)).toBe(Boolean((from?.mode ?? 0) & 0o111))
    expect(manifest.files.find((file) => file.path === name)?.executable).toBe(Boolean((from?.mode ?? 0) & 0o111))
  }
  expect((published.find((entry) => entry.path === "bin/web/index.html")?.mode ?? 0) & 0o111).toBe(0)
  const table = await readFile(join(input.out, "checksums.sha256"), "utf8")
  expect(table).toContain(`${sha256(indexHtml)}  bin/web/index.html\n`)
  expect(table).toContain(`${sha256(appJs)}  bin/web/assets/app.js\n`)
  expect(await WebUi.resolveRoot([join(input.out, "bin/web")])).toBe(join(input.out, "bin/web"))
  expect(await seal(value.source, value.web)).toEqual(before)
})

test("omitted web keeps the cli publication", async () => {
  const value = await payloadFixture(roots)
  const source = await payloadSnapshot(value.source)
  const manifest = await prepareDistribution(value.input)
  expect(await verifyDistribution(value.input.out)).toEqual(manifest)
  const paths = manifest.files.map((file) => file.path)
  expect(paths).toEqual(expect.arrayContaining([`bin/${tuple.executable}`, `bin/${tuple.supervisor}`]))
  expect(paths.some((file) => file === "bin/web" || file.startsWith("bin/web/"))).toBe(false)
  await expect(lstat(join(value.input.out, "bin/web"))).rejects.toMatchObject({ code: "ENOENT" })
  expect(await payloadSnapshot(value.source)).toEqual(source)
})

test("invalid web rejects before publication", async () => {
  const cases = [
    { error: "Missing web entrypoint: index.html", arrange: async (web: string) => { await rm(join(web, "index.html")) } },
    { web: "", arrange: async () => {} },
    { arrange: async (web: string, root: string) => { await plant(web, root, "symlink") } },
    { arrange: async (web: string, root: string) => { await plant(web, root, "hardlink") } },
  ]
  for (const item of cases) {
    const value = await fixture()
    await item.arrange(value.web, value.root)
    const before = await seal(value.source, value.web)
    const input = { ...value.input, web: "web" in item ? item.web : value.web }
    const message = "error" in item ? item.error : undefined
    await (message ? expect(prepareDistribution(input)).rejects.toThrow(message) : expect(prepareDistribution(input)).rejects.toThrow())
    await expect(lstat(value.input.out)).rejects.toMatchObject({ code: "ENOENT" })
    expect(await seal(value.source, value.web)).toEqual(before)
  }
})

test("explicit web rejects a cli path that already owns bin/web", async () => {
  for (const relative of ["bin/web/index.html", "bin/web"]) {
    const value = await fixture()
    const planted = join(value.source, relative)
    const bytes = Buffer.from(`existing ${relative}\n`)
    await mkdir(dirname(planted), { recursive: true })
    await writeFile(planted, bytes)
    await chmod(planted, 0o644)
    const before = await seal(value.source, value.web)
    const input = { ...value.input, web: value.web }
    await expect(prepareDistribution(input)).rejects.toThrow("Distribution web path conflict")
    await expect(lstat(value.input.out)).rejects.toMatchObject({ code: "ENOENT" })
    expect(await readFile(planted)).toEqual(bytes)
    expect(await seal(value.source, value.web)).toEqual(before)
  }
})

test("descendant web output overlap rejects before nested publication", async () => {
  const value = await fixture()
  const before = await seal(value.source, value.web)
  const input = { ...value.input, out: join(value.web, "nested", "prepared"), web: value.web }
  await expect(prepareDistribution(input)).rejects.toThrow("Distribution source/output overlap")
  await expect(lstat(join(value.web, "nested"))).rejects.toMatchObject({ code: "ENOENT" })
  expect(await seal(value.source, value.web)).toEqual(before)
  for (const place of ["web", "root"] as const) {
    const item = await fixture()
    const prior = await seal(item.source, item.web)
    const control = { ...item.input, out: item[place], web: item.web }
    await expect(prepareDistribution(control)).rejects.toThrow()
    expect(await seal(item.source, item.web)).toEqual(prior)
  }
})

test("republish rejects a changed web asset", async () => {
  const value = await fixture()
  const input = { ...value.input, web: value.web }
  const manifest = await prepareDistribution(input)
  expect(await prepareDistribution(input)).toEqual(manifest)
  const published = await payloadSnapshot(input.out)
  await writeFile(join(value.web, "assets", "app.js"), Buffer.concat([appJs, Buffer.from("// edited\n")]))
  await chmod(join(value.web, "assets", "app.js"), 0o644)
  const before = await seal(value.source, value.web)
  await expect(prepareDistribution(input)).rejects.toThrow("Distribution publication conflict")
  expect(await payloadSnapshot(input.out)).toEqual(published)
  expect(await seal(value.source, value.web)).toEqual(before)
})

test("verify rejects a published web asset whose bytes diverge", async () => {
  const value = await fixture()
  const input = { ...value.input, web: value.web }
  const manifest = await prepareDistribution(input)
  const source = await payloadSnapshot(value.source)
  const file = join(input.out, "bin/web/assets/app.js")
  const bytes = await readFile(file)
  const recorded = manifest.files.find((entry) => entry.path === "bin/web/assets/app.js")?.sha256 ?? ""
  expect(sha256(bytes)).toBe(recorded)
  const flipped = Buffer.from(bytes)
  flipped[flipped.length - 1] ^= 0xff
  await writeFile(file, flipped)
  expect(sha256(flipped)).not.toBe(recorded)
  await expect(verifyDistribution(input.out)).rejects.toThrow("Distribution file mismatch: bin/web/assets/app.js")
  expect(await payloadSnapshot(value.source)).toEqual(source)
})

async function fixture() {
  const value = await payloadFixture(roots)
  const web = join(value.root, "web")
  await mkdir(join(web, "assets"), { recursive: true })
  await writeFile(join(web, "index.html"), indexHtml)
  await writeFile(join(web, "assets", "app.js"), appJs)
  await chmod(join(web, "index.html"), 0o644)
  await chmod(join(web, "assets", "app.js"), 0o644)
  return { ...value, web }
}

async function plant(web: string, root: string, kind: "symlink" | "hardlink") {
  const owned = join(root, "owned.bin")
  const asset = join(web, "assets", "app.js")
  await writeFile(owned, ownedBytes)
  await chmod(owned, 0o644)
  await rm(asset)
  if (kind === "symlink") await symlink(owned, asset)
  if (kind === "hardlink") await link(owned, asset)
}

async function seal(source: string, web: string) {
  const asset = join(web, "assets", "app.js")
  const info = await lstat(asset)
  const sourceSnap = await payloadSnapshot(source)
  if (info.isSymbolicLink()) return {
    source: sourceSnap,
    index: await payloadSnapshot(join(web, "index.html")),
    owned: await payloadSnapshot(join(dirname(web), "owned.bin")),
    link: await readlink(asset),
    directory: (await lstat(web)).isDirectory() && (await lstat(join(web, "assets"))).isDirectory(),
  }
  return {
    source: sourceSnap,
    web: await payloadSnapshot(web),
    nlink: info.nlink,
    owned: info.nlink > 1 ? await payloadSnapshot(join(dirname(web), "owned.bin")) : undefined,
  }
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}
