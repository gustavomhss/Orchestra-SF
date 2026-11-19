import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig, type Plugin } from "vite"
import desktopPlugin from "@orchestra/app/vite"
import { fileURLToPath } from "node:url"

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      })
    : false

// Browser fixtures stay with the shared shell in packages/app-shell/e2e. Specs load them from this dev server
// at /e2e/, as they did when the web entry and the shell were one package; /@fs/ keeps Vite's HTML and module
// transforms, and needs forward slashes with no leading slash before a Windows drive letter.
const shellE2E = fileURLToPath(new URL("../../packages/app-shell/e2e", import.meta.url)).replaceAll("\\", "/").replace(/^\//, "")
const shellFixtures: Plugin = {
  name: "orchestra-web:shell-fixtures",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith("/e2e/")) req.url = `/@fs/${shellE2E}${req.url.slice("/e2e".length)}`
      next()
    })
  },
}

const requestsPage = fileURLToPath(new URL("../../modules/sucafina/Sucafinav1/runtime/requests-page.ts", import.meta.url))
const requestsForm: Plugin = {
  name: "orchestra-web:requests-form",
  configureServer(server) {
    server.middlewares.use(requestsFormMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use(requestsFormMiddleware)
  },
}
function requestsFormMiddleware(req: { method?: string; url?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, next: (error?: unknown) => void) {
  const pathname = req.url?.split("?")[0]
  if ((req.method !== "GET" && req.method !== "HEAD") || (pathname !== "/orchestra/sf-procurement/requests/new" && pathname !== "/orchestra/sf-procurement/requests")) {
    next()
    return
  }
  void import(requestsPage).then((page) => {
    const html = page.requestsRouteDocument(pathname.endsWith("/new") ? "new" : "list")
    res.statusCode = 200
    res.setHeader("content-type", "text/html; charset=utf-8")
    res.setHeader("cache-control", "no-store")
    res.end(req.method === "HEAD" ? undefined : html)
  }).catch(next)
}

export default defineConfig({
  publicDir: fileURLToPath(new URL("../../packages/app-shell/public", import.meta.url)),
  plugins: [desktopPlugin, shellFixtures, requestsForm, sentry] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
