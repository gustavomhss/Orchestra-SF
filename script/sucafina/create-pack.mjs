import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const template = fileURLToPath(new URL("./pack-template/", import.meta.url))
const packs = fileURLToPath(new URL("../../modules/sucafina/Sucafinav1/product/ai/packs/", import.meta.url))

export async function createPack(slug, destination = packs) {
  if (typeof slug !== "string" || slug.length > 24 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Use a pack slug of up to 24 lowercase letters, digits and single hyphens, starting with a letter.")
  }
  const ids = slug.replaceAll("-", "_")
  const variables = {
    SLUG: slug,
    SKILL: `sf-read-${slug}`,
    SERVER: `sf-${slug}`,
    PLUGIN: `sf-${slug}-gateway`,
    MCP_TOOL: `sf_read_${ids}`,
    GATEWAY_TOOL: `sf-${slug}__sf_read_${ids}`,
    TOKEN_ENV: `SF_${ids.toUpperCase()}_TOKEN`,
    MCP_PATH: `/sucafina/api/claw/${slug}/mcp`,
  }
  const render = (value) => value.replace(/__([A-Z_]+)__/g, (placeholder, key) => {
    if (!Object.hasOwn(variables, key)) throw new Error(`Unknown pack template variable ${placeholder}`)
    return variables[key]
  })
  const output = resolve(destination, slug)
  const files = await readdir(template, { recursive: true, withFileTypes: true })
  await mkdir(output)
  try {
    for (const entry of files.filter((entry) => entry.isFile())) {
      const source = join(entry.parentPath, entry.name)
      const relative = source.slice(template.length).replace(/\.template$/, "")
      const target = join(output, render(relative))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, render(await readFile(source, "utf8")), { flag: "wx" })
    }
    return output
  } catch (error) {
    await rm(output, { recursive: true, force: true })
    throw error
  }
}

if (import.meta.main) {
  const [slug, ...extra] = process.argv.slice(2)
  if (!slug || extra.length) throw new Error("Usage: bun script/sucafina/create-pack.mjs <pack-slug>")
  console.log(await createPack(slug))
}
