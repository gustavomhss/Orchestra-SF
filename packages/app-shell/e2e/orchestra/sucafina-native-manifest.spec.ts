import { expect, test } from "@playwright/test"

test("production build publishes the native manifest only in the native profile", async ({ request }, testInfo) => {
  expect(testInfo.config.metadata.bundle).toBe("production")
  expect(process.env.ORCHESTRA_CHANNEL).toBe("prod")

  const index = await request.get("/")
  expect(index.status()).toBe(200)
  expect(index.headers()["content-type"]).toMatch(/^text\/html(?:;|$)/i)

  const manifest = await request.get("/native-manifest.json")
  if (process.env.VITE_ORCHESTRA_SF_NATIVE === "1") {
    expect(manifest.status()).toBe(200)
    expect(manifest.headers()["content-type"]).toMatch(/^application\/json(?:;|$)/i)
    expect(await manifest.json()).toEqual({
      product: "Orchestra-SF",
      native: true,
      version: 1,
    })
    return
  }

  expect(process.env.VITE_ORCHESTRA_SF_NATIVE).toBeUndefined()
  if (manifest.status() === 404) return

  expect(manifest.status()).toBe(200)
  expect(manifest.headers()["content-type"]).toMatch(/^text\/html(?:;|$)/i)
})
