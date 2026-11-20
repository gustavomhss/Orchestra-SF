import { plugin } from "bun"
import path from "node:path"

const renderer = path.join(import.meta.dir, "installed-console.ts")

plugin({
  name: "installed-console",
  setup(build) {
    build.onLoad({ filter: /\/runtime\/application\.ts$/ }, async (args) => {
      const source = await Bun.file(args.path).text()
      const product = `if (request.method !== "POST" && product.headers.get("content-type")?.toLowerCase().includes("text/html")) return decommissioned()`
      const retired = `if (request.method !== "POST" && !queueProjection && !url.searchParams.has("asset") && !url.searchParams.has("asset-link"))
      return decommissioned()`
      if (!source.includes(product) || !source.includes(retired)) return { contents: source, loader: "ts" }
      const contents = `import { renderInstalledConsole } from ${JSON.stringify(renderer)}\n` + source
        .replace(product, "")
        .replace(retired, `if (request.method !== "POST" && !queueProjection && !url.searchParams.has("asset") && !url.searchParams.has("asset-link")) {
        const rendered = await renderInstalledConsole(request, surface, application)
        if (rendered) return rendered
        return decommissioned()
      }`)
      return { contents, loader: "ts" }
    })
  },
})
