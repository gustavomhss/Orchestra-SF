import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

const origin = "https://example.test"
const caseRef = { id: "first-save-case", incarnation: "first-save-incarnation", version: 1 }

function harness(options: { authorize?: boolean; commandIdentity?: boolean } = {}) {
  const calls = { runtime: 0, authorize: 0, commandIdentity: 0 }
  const ui = createSfUiAuthority({
    authorize: async () => {
      calls.authorize++
      return options.authorize === false ? undefined : {
        installationId: "installation", projectId: "project", principalRef: "admin",
        policyVersion: "1", accessRevision: "1",
      }
    },
    commandIdentity: async () => {
      calls.commandIdentity++
      return options.commandIdentity === false ? undefined : "stable-original-command"
    },
    createId: randomUUID, now: () => Date.now(), privateCommands: ["sf-human:decisions.edit"],
  })
  const human = createSfHumanAuthority({ origin, ui })
  // These negative admission tests never enter dispatch. Full C08/SQLite lookup
  // and zero-write controls remain in minimal-first-save/first-save-recovery.test.ts.
  const runtime = { authority: { ui, human } } as unknown as
    NonNullable<ReturnType<Parameters<typeof createSfDashboardHttp>[0]["runtime"]>>
  const handle = createSfDashboardHttp({ origin, mount: "/sf", runtime: () => {
    calls.runtime++
    return runtime
  } })
  const outcome = async (key?: string) => {
    const response = await handle(new Request(origin + "/sf/dashboard?sf=dashboard-hot-topic-draft-outcome", {
      method: "POST",
      headers: { origin, authorization: "admin", "content-type": "application/json",
        ...(key === undefined ? {} : { "idempotency-key": key }) },
      body: JSON.stringify({ caseRef }),
    }), "dashboard")
    if (!response) throw new Error("Missing first-save outcome route")
    return { code: response.status, body: await response.json() as { status: string; value?: unknown } }
  }
  return { outcome, calls }
}

test("first-save outcome rejects absent, malformed and ambiguous keys before runtime or domain lookup", async () => {
  const f = harness()
  for (const key of [undefined, "", "short", "has spaces key", "invalid,key-001", "!invalid-key", "x".repeat(129)]) {
    const response = await f.outcome(key)
    expect(response.code).toBe(403)
    expect(response.body.status).toBe("denied")
    expect(response.body).not.toHaveProperty("value")
  }
  expect(f.calls).toEqual({ runtime: 0, authorize: 0, commandIdentity: 0 })
})

test("valid-key admission still distinguishes actual identity outage (503) from revoked authority (403)", async () => {
  const unavailable = harness({ commandIdentity: false })
  const infra = await unavailable.outcome("first-save-key-101")
  expect(infra.code).toBe(503)
  expect(infra.body.status).toBe("unavailable")
  expect(infra.body).not.toHaveProperty("value")
  expect(unavailable.calls).toEqual({ runtime: 1, authorize: 1, commandIdentity: 1 })

  const revoked = harness({ authorize: false })
  const denied = await revoked.outcome("first-save-key-102")
  expect(denied.code).toBe(403)
  expect(denied.body.status).toBe("denied")
  expect(denied.body).not.toHaveProperty("value")
  expect(revoked.calls).toEqual({ runtime: 1, authorize: 1, commandIdentity: 0 })
})
