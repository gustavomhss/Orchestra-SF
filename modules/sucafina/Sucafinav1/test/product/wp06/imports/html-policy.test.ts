import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { htmlPolicy } from "../../../../runtime/application.ts"
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

