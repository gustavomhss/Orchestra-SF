import { expect, test } from "bun:test"
import { createSfLiveContext } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
const binding = Object.freeze({ installationId: "installation-a", projectId: "project-a", hostId: "host-a" })
const stamp = Object.freeze({ ...binding, principalRef: "person", policyVersion: "policy", accessRevision: "revision" })
const contextUrl = origin + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a"

test("CAP25 preflight rechecks original authority independently of other surface health", async () => {
  const request = new Request(origin + mount + "/api/ui/pages/CAP25?request=PR-2026-0001")
  let checks = 0
  let revoked = false
  let probes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (original) => {
      if (original === request) checks++
      return { status: "ok", stamp: { ...stamp, accessRevision: revoked && checks > 3 ? "revoked" : stamp.accessRevision },
        authMode: "microsoft", destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests",
          canRead: true, allowedActionIds: ["select_quote"] }] }
    },
    operational: async () => { probes++; throw new Error("Unrelated producer unavailable") },
  })
  expect(await live.readRequestContext(request, binding)).toMatchObject({ status: "ok", value: {
    stamp, destinations: [{ capabilityId: "CAP25", allowedActionIds: ["select_quote"] }],
  } })
  expect(checks).toBe(3)
  expect(probes).toBe(0)
  expect((await live.readContext(new Request(contextUrl), binding)).status).toBe("unavailable")
  expect(probes).toBe(1)
  const approvals = new Request(origin + mount + "/api/ui/pages/CAP26")
  expect((await live.readRequestContext(approvals, binding)).status).toBe("unavailable")
  expect(probes).toBe(2)
  revoked = true
  checks = 2
  expect(await live.readRequestContext(request, binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
  expect(probes).toBe(2)
})
