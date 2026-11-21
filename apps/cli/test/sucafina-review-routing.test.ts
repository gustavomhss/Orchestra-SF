import { expect, test } from "bun:test"
import { mountSfReviewProjection } from "../src/sucafina-product/native-ui/review-routing"

const origin = "https://sf.example"
const mount = "/sf"
const projectionUrl = origin + mount + "/api/ui/projections/review"

test("the review projection reads the active producer with the original Request", async () => {
  const request = new Request(projectionUrl + "?reviewRef=review-7")
  const response = Response.json({ reviewRef: "review-7" })
  const producer = {
    operationId: "projection.review" as const,
    async handle(received: Request) {
      expect(received).toBe(request)
      return response
    },
  }
  const active: { producer?: typeof producer } = {}
  const dispatch = mountSfReviewProjection({ origin, mount, readProjection: () => active.producer })

  expect((await dispatch(request))?.status).toBe(503)
  active.producer = producer
  expect(await dispatch(request)).toBe(response)
})

test("the review projection rejects malformed requests and does not intercept report writes", async () => {
  const dispatch = mountSfReviewProjection({ origin, mount, readProjection: () => undefined })
  expect(await dispatch(new Request("https://other.example" + mount + "/api/ui/projections/review"))).toBeUndefined()
  expect(await dispatch(new Request(origin + mount + "/dashboard?sf=review-report", { method: "POST" }))).toBeUndefined()
  expect((await dispatch(new Request(projectionUrl + "?reviewRef=a&reviewRef=b")))?.status).toBe(400)
  expect((await dispatch(new Request(projectionUrl, { method: "POST" })))?.headers.get("allow")).toBe("GET")
  expect((await dispatch(new Request(projectionUrl, { headers: { "content-length": "1" } })))?.status).toBe(400)
})
