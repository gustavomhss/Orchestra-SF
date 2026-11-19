import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decisionCreationScope } from "../../../product/ui/decision-create.ts"
import { workbenchFixture } from "../http-body-limit-fix/workbench-fixture.ts"

test("Authenticated Workbench binds decision creation to the current host identity without persisting on GET", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const request = new Request(`${f.origin}/sucafina/dashboard?sf=workbench`, {
      headers: { cookie: f.cookie, "idempotency-key": randomUUID() },
    })
    const admitted = await f.authority.ui.admit(request, "sf_case_read", digestSfValue({}))
    if (admitted.status !== "ok") throw new Error("Workbench read admission unavailable")
    const expectedScope = decisionCreationScope(admitted.value.binding)
    f.authority.ui.finish(admitted.value)

    const response = await f.product(request, "dashboard")
    expect(response?.status).toBe(200)
    expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8")
    const html = await response!.text()
    expect(html).toContain(`<form data-decision-create data-creation-scope="${expectedScope}">`)
    expect(expectedScope).toMatch(/^[a-f0-9]{64}$/)
    expect(await f.snapshot()).toEqual(before)
    expect(f.observed.dispatches).toHaveLength(0)

    const anonymous = await f.product(new Request(request.url, {
      headers: { "idempotency-key": randomUUID() },
    }), "dashboard")
    expect(anonymous?.status).toBe(403)
    expect(await anonymous!.text()).not.toContain("data-creation-scope")

    expect((await f.logout())?.status).toBe(204)
    const revoked = await f.product(new Request(request.url, {
      headers: { cookie: f.cookie, "idempotency-key": randomUUID() },
    }), "dashboard")
    expect(revoked?.status).toBe(403)
    expect(await revoked!.text()).not.toContain("data-creation-scope")
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.close() }
})
