import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import path from "node:path"
import { SF_PROCUREMENT_CREATE_KEY_PREFIX } from "@orchestra/schema/sucafina/procurement"
import { SF_PROCUREMENT_CREATE_RECEIPTS } from "../../product/integration/public-state.ts"
import { object } from "../../runtime/contract.ts"
import { other } from "../microsoft-login/oidc-fixture.ts"
import { profileA, profileB } from "./installation-fixture.ts"
import { nativeProcurementWebFixture } from "./native-web-fixture.ts"

test("CAP25 commits the request and its retry receipt under the same Team authority", async () => {
  await using fixture = await nativeProcurementWebFixture([profileA, profileB])
  const send = (key: string, title: string, profile = profileA, cookie = fixture.cookie) =>
    fixture.handle(fixture.request("/procurement?page=Requests", cookie, {
      method: "POST",
      headers: {
        origin: fixture.binding.origin,
        "content-type": "application/json",
        "idempotency-key": SF_PROCUREMENT_CREATE_KEY_PREFIX + key,
        "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }),
      },
      body: JSON.stringify({
        page: "Requests", action: "create", version: 0,
        values: { pr: { title, estAmount: 100, recurring: false, expenseType: "OPEX" } },
      }),
    }))
  const read = () => fixture.store.transaction("procurement", async (snapshot) => ({
    commit: false,
    value: {
      requests: Object.values(object(object(snapshot.data.store).requests)).map((entry) => object(object(entry).request)),
      receiptCount: Object.keys(object(snapshot.data[SF_PROCUREMENT_CREATE_RECEIPTS])).length,
      datasetVersion: snapshot.versions.dataset?.version,
    },
  }))

  const originalKey = crypto.randomUUID()
  // Simulate the caller losing the response after the SQLite transaction commits.
  expect((await send(originalKey, "Lost response")).status).toBe(200)
  const saved = await read()
  expect(saved.requests).toHaveLength(1)
  expect(saved.receiptCount).toBe(1)
  const replay = await send(originalKey, "Lost response")
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual({ ok: true })
  expect((await send(originalKey, "Changed payload")).status).toBe(409)
  expect((await send(originalKey, "Lost response", profileB)).status).toBe(409)
  const otherCookie = await fixture.login(other)
  expect((await send(originalKey, "Lost response", profileA, otherCookie)).status).toBe(409)
  expect(await read()).toEqual(saved)

  const failedKey = crypto.randomUUID()
  const sql = new Database(path.join(fixture.directory, "installation.sqlite"), { strict: true })
  try {
    sql.exec("CREATE TRIGGER reject_purchase_snapshot BEFORE INSERT ON snapshots WHEN NEW.surface = 'procurement' BEGIN SELECT RAISE(ABORT, 'test purchase commit failure'); END")
    await expect(send(failedKey, "Uncommitted request")).rejects.toThrow("test purchase commit failure")
  } finally {
    sql.exec("DROP TRIGGER IF EXISTS reject_purchase_snapshot")
    sql.close()
  }
  expect(await read()).toEqual(saved)
  expect((await send(failedKey, "Uncommitted request")).status).toBe(200)
  const retried = await read()
  expect(retried.requests).toHaveLength(2)
  expect(retried.receiptCount).toBe(2)

  expect((await fixture.logout(fixture.cookie))?.status).toBe(204)
  expect((await send(originalKey, "Lost response")).status).toBeGreaterThanOrEqual(400)
  expect(await read()).toEqual(retried)
}, 30_000)
