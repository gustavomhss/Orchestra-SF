import { expect, test } from "bun:test"
import { projectMyWork } from "../../../product/collaboration/work.ts"

test("work is projected once per canonical action and does not infer ownership", () => {
  const action = { actionRef: "hot-topic:1", ownerRef: "person-A", state: "open", sourceRefs: [] }
  expect(projectMyWork("person-A", [action, action, { ...action, actionRef: "hot-topic:2", ownerRef: "person-B" }])).toEqual({ status: "ok", value: { items: [action] } })
  expect(projectMyWork("person-A", [action, { ...action, state: "done" }])).toEqual({ status: "stale", reason: "work-source-conflict" })
  expect(projectMyWork("", [action])).toEqual({ status: "denied", reason: "principal-unavailable" })
})
