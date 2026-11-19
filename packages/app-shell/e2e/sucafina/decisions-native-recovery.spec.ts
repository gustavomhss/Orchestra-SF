import { test } from "@playwright/test"
import { interruptedC12Recovery, successfulC12ResponseLoss } from "./decisions-support/c12-recovery"

test.use({ trace: "off", video: "off" })
test.describe.configure({ mode: "serial", retries: 0 })

test("C12 native UI recovers the original receipt after lost response concurrent edit reload and a new SQLite composition", async ({ browser }, info) => {
  test.setTimeout(120_000)
  await interruptedC12Recovery(browser, info)
})

test("C12 native UI recovers a successful committed Apply whose 200 response was lost", async ({ browser }, info) => {
  test.setTimeout(90_000)
  await successfulC12ResponseLoss(browser, info)
})
