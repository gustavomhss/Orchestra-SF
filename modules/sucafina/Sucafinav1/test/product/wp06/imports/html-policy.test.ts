import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { createApplication, htmlPolicy } from "../../../../runtime/application.ts"
import { domain, pages, render } from "../../../../runtime/dashboard-portfolio.ts"
import { testPersistence } from "../../../fixture/persistence.ts"

const hash = (script: string) => `'sha256-${createHash("sha256").update(script).digest("base64")}'`

test("CSP hashes every inline script, including scripts with attributes", () => {
  const policy = htmlPolicy('<script>first()</script><script data-src="example">second()</script><script src="/external.js"></script>')
  expect(policy).toContain(hash("first()"))
  expect(policy).toContain(hash("second()"))
  expect(policy).not.toContain(hash(""))
  expect(policy.split(";").find((directive) => directive.trim().startsWith("script-src"))).not.toContain("'unsafe-inline'")
  expect(htmlPolicy("<p>no scripts</p>")).toContain("script-src 'none'")
})

test("HTML decoration runs after authorization and the final response CSP covers its script", async () => {
  const storage = testPersistence()
  let called = 0
  const application = { persistence: storage.persistence, environment: async () => ({ at: "2026-11-13T04:01:10Z", id: () => "id", directory: [] }), domains: { dashboard: [{ domain, pages, render }], planner: [], procurement: [] }, maxJsonBytes: 100000, product: async () => undefined, productHtml: (html: string, surface: string, page: string) => {
    called++
    expect(surface).toBe("dashboard")
    expect(page).toBe("IT Risks")
    expect(html).toContain("Business intelligence")
    return html.replace("</body>", "<script>decorated()</script></body>")
  } }
  const allowed = createApplication("/sucafina", { ...application, authenticate: async () => ({ id: "admin", canWrite: true, roles: [{ surface: "dashboard" as const, role: "admin" }] }) })
  const response = await allowed(new Request("https://example.test/sucafina/dashboard?page=IT%20Risks"))
  expect(response?.status).toBe(200)
  expect(await response?.text()).toContain("<script>decorated()</script>")
  expect(response?.headers.get("Content-Security-Policy")).toContain(hash("decorated()"))
  const denied = createApplication("/sucafina", { ...application, authenticate: async () => null })
  expect((await denied(new Request("https://example.test/sucafina/dashboard?page=IT%20Risks")))?.status).toBe(401)
  expect(called).toBe(1)
})
