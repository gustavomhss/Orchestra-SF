import { test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { object } from "../../../runtime/contract.ts"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { createDocumentFixFixture } from "./document-fixture.ts"

test("D-OPS-01 real document workbench repeats full submissions and recovers lost schema/extract responses after commit", async () => {
  const { expect } = await import("@playwright/test")
  expectSpawn(import.meta.path)
  const fixture = await createDocumentFixFixture()
  let driver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
  let loss: "document-schema" | "document-extract" | undefined = "document-schema"
  let verified = false
  const traffic: { mode: string; key: string | null; body: string | null; originalStatus: number; deliveredStatus: number; id?: string; ref?: string; state?: string }[] = []
  try {
    driver = await launchBrowserDriver("host-response-recovery")
    const context = await driver.browser.newContext()
    const divider = fixture.cookie.indexOf("=")
    await context.addCookies([{ name: fixture.cookie.slice(0, divider), value: fixture.cookie.slice(divider + 1), url: fixture.origin }])
    // Only delivery is intercepted. Every browser request, cookie, origin, body
    // and idempotency key reaches the real document HTTP/services/SQLite path.
    await context.route(fixture.origin + "/**", async (route) => {
      const incoming = route.request()
      const headers = await incoming.allHeaders()
      const request = new Request(incoming.url(), { method: incoming.method(), headers, ...(incoming.method() === "POST" ? { body: incoming.postData() } : {}) })
      const response = await fixture.documentHttp(request, "procurement")
      if (!response) { await route.fulfill({ status: 404, body: "Route unavailable" }); return }
      const mode = new URL(incoming.url()).searchParams.get("sf") ?? ""
      const withheld = incoming.method() === "POST" && mode === loss && response.status === 200
      if (incoming.method() === "POST") {
        const result = object(await response.clone().json()), value = object(result.value)
        traffic.push({ mode, key: headers["idempotency-key"] ?? null, body: incoming.postData(), originalStatus: response.status, deliveredStatus: withheld ? 503 : response.status,
          ...(typeof value.id === "string" ? { id: value.id } : {}), ...(typeof value.ref === "string" ? { ref: value.ref } : {}), ...(typeof value.status === "string" ? { state: value.status } : {}) })
      }
      if (withheld) {
        loss = undefined
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ status: "unavailable", reason: "fixture-response-withheld" }) })
        return
      }
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
    })
    const page = await context.newPage()
    const loaded = await page.goto(fixture.origin + "/sucafina/procurement?sf=documents")
    expect(loaded?.status()).toBe(200)
    expect(loaded?.headers()["content-security-policy"]).toContain("script-src 'sha256-")
    const root = page.locator("[data-document-workbench]"), status = root.locator("[data-status]")
    await expect(root.locator("[data-source] option")).toHaveCount(2)
    await root.locator("[data-source]").selectOption({ label: "quote.txt" })
    await root.getByRole("button", { name: "Open document", exact: true }).click()
    await expect(root.locator("[data-fields]")).toBeVisible()
    const form = root.locator("[data-schema]"), submit = form.getByRole("button", { name: "Extract candidate", exact: true })
    await form.locator('[name="field"]').fill("Price")
    await form.locator('[name="type"]').selectOption("number")
    await form.locator('[name="unit"]').fill("USD")
    await submit.click()
    await expect(submit).toBeEnabled()
    await expect(status).toHaveText("fixture-response-withheld")
    const committedSchema = await fixture.material()
    expect(committedSchema).toMatchObject({ schemas: 1, candidates: 0 })
    await submit.click()
    await expect(submit).toBeEnabled()
    await expect(status).toHaveText("Candidate extracted. Review the source before confirming.")
    const schemaPosts = traffic.filter((entry) => entry.mode === "document-schema")
    expect(schemaPosts).toHaveLength(2)
    expect(schemaPosts[0]).toMatchObject({ originalStatus: 200, deliveredStatus: 503 })
    expect(schemaPosts[1]).toMatchObject({ originalStatus: 200, deliveredStatus: 200, key: schemaPosts[0]!.key, body: schemaPosts[0]!.body, ref: schemaPosts[0]!.ref })
    const firstExtract = traffic.find((entry) => entry.mode === "document-extract")!
    const firstMaterial = await fixture.material()
    expect(firstMaterial).toMatchObject({ schemas: 1, candidates: 1 })
    await submit.click()
    await expect(submit).toBeEnabled()
    await expect(status).toHaveText("Candidate extracted. Review the source before confirming.")
    const freshSchemas = traffic.filter((entry) => entry.mode === "document-schema"), freshExtracts = traffic.filter((entry) => entry.mode === "document-extract")
    expect(freshSchemas).toHaveLength(3)
    expect(freshExtracts).toHaveLength(2)
    expect(freshSchemas[2]!.key).not.toBe(freshSchemas[1]!.key)
    expect(freshSchemas[2]!.ref).toBe(freshSchemas[1]!.ref)
    expect(freshExtracts[1]!.key).not.toBe(firstExtract.key)
    expect(freshExtracts[1]!.id).toBe(firstExtract.id)
    expect(await fixture.material()).toMatchObject({ schemas: 1, candidates: 1, digest: firstMaterial.digest })
    await root.getByRole("button", { name: "Confirm this field", exact: true }).click()
    await expect(status).toHaveText("Field confirmed with its current source.")
    const confirmed = await fixture.material()
    await submit.click()
    await expect(submit).toBeEnabled()
    await expect(status).toHaveText("Candidate extracted. Review the source before confirming.")
    expect(traffic.filter((entry) => entry.mode === "document-extract").at(-1)).toMatchObject({ id: firstExtract.id, state: "confirmed" })
    expect(await fixture.material()).toMatchObject({ schemas: 1, candidates: 1, digest: confirmed.digest })
    await expect(root.locator("[data-candidates] > section")).toHaveCount(1)
    await expect(root.locator("[data-candidates]")).toContainText("confirmed")
    // A second real field lets the transport fail after a new candidate was
    // committed. Retry preserves both the original confirmation and both keys.
    await form.locator('[name="field"]').fill("Active")
    await form.locator('[name="type"]').selectOption("boolean")
    await form.locator('[name="unit"]').fill("")
    loss = "document-extract"
    await submit.click()
    await expect(submit).toBeEnabled()
    await expect(status).toHaveText("fixture-response-withheld")
    const afterLostExtract = await fixture.material()
    expect(afterLostExtract).toMatchObject({ schemas: 2, candidates: 2 })
    const original = traffic.filter((entry) => entry.mode === "document-extract").at(-1)!
    expect(original).toMatchObject({ originalStatus: 200, deliveredStatus: 503, state: "extracted" })
    await submit.click()
    await expect(submit).toBeEnabled()
    await expect(status).toHaveText("Candidate extracted. Review the source before confirming.")
    const activeSchemas = traffic.filter((entry) => entry.mode === "document-schema").slice(-2)
    const activeExtracts = traffic.filter((entry) => entry.mode === "document-extract").slice(-2)
    expect(activeSchemas[1]).toMatchObject({ key: activeSchemas[0]!.key, body: activeSchemas[0]!.body, ref: activeSchemas[0]!.ref })
    expect(activeExtracts[1]).toMatchObject({ key: activeExtracts[0]!.key, body: activeExtracts[0]!.body, id: original.id, originalStatus: 200, deliveredStatus: 200 })
    expect(await fixture.material()).toEqual(afterLostExtract)
    await expect(root.locator("[data-candidates] > section")).toHaveCount(2)
    await expect(root.locator("[data-candidates]")).toContainText("confirmed")
    expect(traffic.filter((entry) => ["document-schema", "document-extract"].includes(entry.mode)).every((entry) => /^[a-f0-9-]{36}$/.test(entry.key ?? ""))).toBe(true)
    console.info("SF_OPERATIONS_DOCUMENT_REEXTRACTION", JSON.stringify({ traffic, schemaCount: 2, candidateCount: 2, preservedConfirmation: true, transportLossAfterRealCommit: ["document-schema", "document-extract"] }))
    verified = true
  } finally {
    try { if (driver) { await driver.close(); if (verified) driver.report() } }
    finally { await fixture.dispose() }
  }
}, 60_000)

