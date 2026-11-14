import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"

export type Account = { baseURL: string; principal: string; origin: string }
type EnrolledAccount = Omit<Account, "origin"> & { enrollments: Record<string, string> }
type Manifest = {
  origin: string
  accounts: Record<"first" | "second" | "viewer", EnrolledAccount>
  records: { supplier: string; comparison: string }
}

/** The existing host owns SQLite, authentication and fixture lifecycle. No server is started here. */
export async function readManifest(): Promise<Manifest> {
  const filename = path.join(import.meta.dirname, "../wp04/.host-manifest.json")
  const source = await readFile(filename, "utf8").catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("CI-UI-OPERATIONS requires the existing Sucafina host to be mounted for operations.spec.ts. The production selection currently starts it only for wp04/procurement.spec.ts; see the Operations dependency receipt. No synthetic fallback is permitted.")
    }
    throw error
  })
  const manifest = JSON.parse(source) as Manifest
  const origin = new URL(manifest.origin)
  expect(origin.protocol, "Operations must use the isolated local Actions fixture").toBe("http:")
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname)
  expect(origin.origin).toBe(manifest.origin)
  for (const key of ["first", "second", "viewer"] as const) {
    const account = manifest.accounts[key]
    const base = new URL(account.baseURL)
    expect(base.origin).toBe(manifest.origin)
    expect(base.pathname).toBe("/wp04/" + key)
    expect(base.search).toBe("")
    expect(base.hash).toBe("")
    expect(account.principal).toMatch(/^macos:.+:\d+$/)
  }
  expect(new Set(Object.values(manifest.accounts).map((account) => account.principal)).size).toBe(3)
  expect(manifest.records.supplier).not.toBe("")
  expect(manifest.records.comparison).toMatch(/^PR-2026-\d+$/)
  return manifest
}

export async function login(page: Page, key: "first" | "second" | "viewer", scenario: string): Promise<Account> {
  const manifest = await readManifest()
  const selected = manifest.accounts[key]
  const enrollment = selected.enrollments[scenario]
  if (!enrollment) throw new Error("The existing real-host enrollment is missing for " + key + "/" + scenario)
  const url = new URL(enrollment)
  expect(url.origin).toBe(manifest.origin)
  expect(url.pathname).toBe(new URL(selected.baseURL).pathname + "/auth/local")
  const admitted = await page.request.get(enrollment, { maxRedirects: 0, maxRetries: 0 })
  expect(admitted.status(), "The real local-operator enrollment must succeed once").toBe(303)
  const account = { baseURL: selected.baseURL, principal: selected.principal, origin: manifest.origin }
  const response = await page.goto(account.baseURL + "/procurement?page=Requests")
  expect(response?.status(), "The authenticated Procurement application must be mounted").toBe(200)
  await expect(page.locator("body")).toHaveAttribute("data-surface", "procurement")
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toHaveCount(1)
  await expect(page.locator("form[data-command='create'][data-page='Requests']").getByRole("button", { name: "Create request", exact: true })).toHaveCount(key === "viewer" ? 0 : 1)
  if (key !== "viewer") await expect(page.getByRole("button", { name: "Create request", exact: true })).toBeEnabled()
  return account
}

export function modeURL(account: Account, surface: "planner" | "dashboard" | "procurement", mode: string, query: Record<string, string> = {}) {
  const url = new URL(account.baseURL + "/" + surface)
  url.search = new URLSearchParams({ sf: mode, ...query }).toString()
  return url
}

export async function observation(info: TestInfo, name: string, value: Record<string, unknown>) {
  await info.attach(name + ".json", {
    body: Buffer.from(JSON.stringify({ selection: "CI-UI-OPERATIONS", testId: info.testId, ...value, humanTimingMeasured: false, nativeParityMeasured: false })),
    contentType: "application/json",
  })
}
