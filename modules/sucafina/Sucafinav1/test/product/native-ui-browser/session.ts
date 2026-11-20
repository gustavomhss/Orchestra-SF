import { expect } from "bun:test"
import type { BrowserContext } from "@playwright/test"

/** Chromium performs the actual one-use enrollment and owns Set-Cookie.
 * The isolated native host deliberately has no root page; closing this separate
 * page contains Chrome's asynchronous error navigation without losing its session.
 */
export async function enrollNativeBrowser(context: BrowserContext, origin: string, enroll: () => Promise<string>) {
  const page = await context.newPage()
  const url = new URL("/sucafina/auth/local", origin)
  url.searchParams.set("code", await enroll())
  try {
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.url() === url.href),
      page.goto(url.href, { waitUntil: "domcontentloaded" }).catch((error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes("net::ERR_HTTP_RESPONSE_CODE_FAILURE")) throw error
        return null
      }),
    ])
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe("/")
    const redirected = response.request().redirectedTo()
    expect(redirected?.url()).toBe(origin + "/")
    expect((await redirected?.response())?.status()).toBe(404)
  } finally { await page.close() }
}
