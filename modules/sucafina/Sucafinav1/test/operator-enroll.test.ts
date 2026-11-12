import { afterEach, expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm, stat } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import path from "node:path"
import { prepareLocalConfiguration, loadLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "operator-enroll-"))
  roots.push(root)
  await chmod(root, 0o700)
  return { root, file: await prepareLocalConfiguration(root) }
}

test("actual enrollment helper publishes only a private replacement-navigation artifact and a validated owner profile", async () => {
  const f = await fixture()
  const result = await prepareOperatorAccess(f.file, true)
  const loaded = await loadLocalConfiguration(f.file)
  expect(loaded.config.authentication).toBe("local-operator")
  expect(loaded.config.localOperator?.uid).toBe(userInfo().uid)
  expect((await stat(result.artifact)).mode & 0o777).toBe(0o600)
  expect((await stat(f.file)).mode & 0o777).toBe(0o600)
  const html = await Bun.file(result.artifact).text()
  expect(html).toContain('name="referrer" content="no-referrer"')
  const encoded = html.match(/location\.replace\(("[^\n]+")\)/)?.[1]
  expect(encoded).toBeDefined()
  const target = new URL(JSON.parse(encoded!))
  expect(target.origin).toBe("http://localhost:4110")
  expect(target.pathname).toBe("/sucafina/auth/local")
  const code = target.searchParams.get("code")!
  expect(code).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(result)).not.toContain(code)
  expect(Object.keys(result)).toEqual(["artifact"])
})

for (const operator of [
  { installationId: "a8cbe9d2-a35a-4db3-a333-305311c40972", uid: userInfo().uid + 1 },
  { installationId: "not-an-installation-id", uid: userInfo().uid },
]) {
  test("failed activation preserves inactive configuration and publishes no credential artifact", async () => {
    const f = await fixture()
    const config = await Bun.file(f.file).json()
    config.localOperator = operator
    await Bun.write(f.file, JSON.stringify(config))
    const before = await Bun.file(f.file).text()
    await expect(prepareOperatorAccess(f.file, true)).rejects.toThrow("actual installation owner")
    expect(await Bun.file(f.file).text()).toBe(before)
    expect(await Bun.file(path.join(f.root, "open-local.html")).exists()).toBe(false)
    expect(await Bun.file(path.join(f.root, "business-local", "installation.sqlite")).exists()).toBe(false)
  })
}

test("enrollment is never implicitly enabled by a helper invocation", async () => {
  const f = await fixture()
  const before = await Bun.file(f.file).text()
  await expect(prepareOperatorAccess(f.file)).rejects.toThrow("Explicit local operator profile")
  expect(await Bun.file(f.file).text()).toBe(before)
})
