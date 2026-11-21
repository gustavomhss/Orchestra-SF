import { expect, test } from "bun:test"
import { mountSfFilesOriginalRoutes } from "../../../modules/sucafina/Sucafinav1/runtime/native-files/routing.ts"

const origin = "https://sf.example"
const mount = "/sf"

test("Files routes preserve the producer request and response and fall through on another surface", async () => {
  const request = new Request(origin + mount + "/planner?sf=import-admit", {
    method: "POST",
    body: "source bytes",
  })
  const response = new Response("accepted")
  const dispatch = mountSfFilesOriginalRoutes({
    origin,
    mount,
    sources: {
      imports: async (received, surface) => {
        expect(received).toBe(request)
        expect(surface).toBe("planner")
        expect(await received.text()).toBe("source bytes")
        return response
      },
    },
  })

  expect(await dispatch(request)).toBe(response)
  expect(await dispatch(new Request(origin + mount + "/planner/other?sf=import-targets"))).toBeUndefined()
  expect(await dispatch(new Request("https://other.example" + mount + "/planner?sf=import-targets"))).toBeUndefined()
})

test("Files routes reject ambiguous selectors and wrong methods and fail closed without a producer", async () => {
  const dispatch = mountSfFilesOriginalRoutes({ origin, mount, sources: {} })
  const planner = origin + mount + "/planner"
  expect((await dispatch(new Request(planner + "?sf=import-targets&sf=import-targets")))?.status).toBe(400)
  expect((await dispatch(new Request(planner + "?sf=import-targets&download=xlsx")))?.status).toBe(400)
  expect((await dispatch(new Request(planner + "?sf=import-admit")))?.headers.get("allow")).toBe("POST")
  expect((await dispatch(new Request(planner + "?sf=import-targets")))?.status).toBe(503)
  expect(await dispatch(new Request(planner + "?sf=constructor"))).toBeUndefined()
})
