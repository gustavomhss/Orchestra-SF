import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

test("native flow fixture resolves current roles by surface rather than granting token-wide authority", async () => {
  const app = nativeWriteFlow({
    people: [{
      token: "mixed",
      id: "fixture-mixed",
      name: "Synthetic Mixed Reader",
      roles: [{ surface: "dashboard", role: "viewer" }, { surface: "procurement", role: "buyer" }],
    }],
  })
  const dashboard = await app.read("dashboard", "Executive Dashboard", "mixed")
  expect(dashboard?.status).toBe(200)
  const dashboardActor = object(object(await dashboard!.json()).actor)
  expect(dashboardActor).toMatchObject({ id: "fixture-mixed", canWrite: false })
  expect(dashboardActor.roles).toEqual(["viewer"])
  const procurement = await app.read("procurement", "Requests", "mixed")
  expect(procurement?.status).toBe(200)
  const procurementActor = object(object(await procurement!.json()).actor)
  expect(procurementActor).toMatchObject({ id: "fixture-mixed", canWrite: true })
  expect(procurementActor.roles).toEqual(["buyer"])

  app.storage.state.dashboard.data.roleMap = rows(app.storage.state.dashboard.data.roleMap)
    .map((row) => row.surface === "dashboard" && row.role === "viewer" ? { ...row, entra: null } : row)
  expect((await app.read("dashboard", "Executive Dashboard", "mixed"))?.status).toBe(403)
  expect((await app.read("procurement", "Requests", "mixed"))?.status).toBe(200)
})
