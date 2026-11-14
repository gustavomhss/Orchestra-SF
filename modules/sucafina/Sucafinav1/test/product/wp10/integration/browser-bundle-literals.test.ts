import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { createSfBiHttp } from "../../../../product/integration/bi-http.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { createSfReviewServices } from "../../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import { createSfExtendedAssets } from "../../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

async function expectScript(response: Response | undefined, script: string) {
  expect(response?.status).toBe(200)
  expect(response?.headers.get("content-type")).toContain("text/html")
  const html = await response!.text()
  const expected = script.replace(/<\/script/gi, "<\\/script")
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  expect(scripts.at(-1)?.[1]).toBe(expected)
  expect(response!.headers.get("content-security-policy")).toContain("'sha256-" + createHash("sha256").update(expected).digest("base64") + "'")
  return html
}

test("BI and review HTTP preserve literal dollar tokens, actual compiled bundle bytes and matching CSP", async () => {
  const fixture = await financialCompositionFixture(), assets = createSfExtendedAssets()
  const { authority, business, portfolio, persistence } = fixture
  try {
    const bi = createSfBiServices({ authority, business, portfolio })
    const reviews = createSfReviewServices({ authority, business, portfolio, bi, persistence, origin: "https://example.test" }).application
    if (!reviews) throw new Error("Real review producers were not composed")
    // A valid minified identifier followed by && is itself a $& replacement
    // token. The strings also cover prefix, suffix and dollar substitutions.
    const script = "const $ = true; if ($&&$) document.body.dataset.sfBundleTokens = " + JSON.stringify(["$&", "$`", "$'", "$$"].join("|")) + ";"
    const literal = { bi: async () => script, reviews: async () => script }
    for (const source of [literal, assets]) {
      const http = createSfExtendedHttp({ authority, business, bi, reviews, persistence, origin: "https://example.test", assets: source })
      const biResponse = await http(new Request("https://example.test/dashboard?sf=bi&start=2026-01-01&end=2026-12-31"), "dashboard")
      await expectScript(biResponse, await source.bi())
      const reviewResponse = await http(new Request("https://example.test/dashboard?sf=review&page=OPEX+Detail&start=2026-01-01&end=2026-12-31"), "dashboard")
      const reviewHtml = await expectScript(reviewResponse, await source.reviews())
      const bootstrap = /<script type="application\/json" data-sf-review-bootstrap>([\s\S]*?)<\/script>/.exec(reviewHtml)?.[1]
      expect(bootstrap).toBeDefined()
      expect(JSON.parse(bootstrap!)).toMatchObject({ items: [{ kind: "dashboard", topic: "opex-detail" }] })
    }
    const local = createSfBiHttp({ installationId: "installation", projectId: "project", policyVersion: "policy", origin: "https://example.test", mount: "/product",
      persistence, authenticate: authority.host.authenticate, environment: authority.host.environment, browserScript: async () => script })
    const localResponse = await local(new Request("https://example.test/product/dashboard?sf=bi"), "dashboard")
    await expectScript(localResponse, script)
  } finally { assets.dispose(); await fixture.dispose() }
}, 120_000)

