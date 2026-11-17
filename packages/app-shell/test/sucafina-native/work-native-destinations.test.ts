import { describe, expect, test } from "bun:test"
import { admittedProducerWorkHref } from "../../src/orchestra/chapters/sucafina/work"

const origin = "https://sf.example"
const mount = "/sucafina"
const selection = { selectionRef: "work-selection:abc", period: { start: "2026-11-01", end: "2026-11-30" } }
const actionRef = "work-action:123"
const url = () => "/sucafina/dashboard?" + new URLSearchParams({
  sf: "work-item", selectionRef: selection.selectionRef,
  start: selection.period.start, end: selection.period.end, actionRef,
}).toString()
const admitted = (href: string, binding = { origin, mount }) =>
  admittedProducerWorkHref(href, binding.origin, binding.mount, selection, actionRef)

describe("WS-2 native work destination: exact original producer witness", () => {
  test("admits an exact legacy producer witness, not a guessed native href", () => {
    expect(admitted(url())).toBe(true)
    expect(admitted(origin + url())).toBe(true)
    expect(admitted("/orchestra/sf-work/threads/thread1")).toBe(false)
  })
  test("rejects origin, credentials, fragments, path escapes and untrusted mounts", () => {
    for (const href of [
      "//other.example/sucafina/dashboard", "https://sf.example.evil.test" + url(),
      "https://user@sf.example" + url(), url() + "#other",
      "/sucafina/../dashboard" + url().slice("/sucafina/dashboard".length),
      "/sucafina/%2Fdashboard" + url().slice("/sucafina/dashboard".length),
      "javascript:alert(1)", "data:text/html,hi", "\\\\evil.example/sucafina/dashboard",
      "https://sf.example/sucafina/dashboard\\n", "",
    ]) expect(admitted(href)).toBe(false)
    expect(admitted(url(), { origin, mount: "/sucafina/../other" })).toBe(false)
    expect(admitted(url(), { origin: "https://user@sf.example", mount })).toBe(false)
  })
  test("rejects stale selection, changed period, changed action and extra keys", () => {
    for (const href of [
      url().replace("work-selection%3Aabc", "work-selection%3Aother"),
      url().replace("2026-11-01", "2026-10-01"),
      url().replace("2026-11-30", "2026-12-01"),
      url().replace("work-action%3A123", "work-action%3Aother"),
      url() + "&server=unexpected", url() + "&sf=work-item",
      url() + "&actionRef=work-action%3A123",
      url().replace("sf=work-item", "sf=workbench-case"),
    ]) expect(admitted(href)).toBe(false)
  })
})
