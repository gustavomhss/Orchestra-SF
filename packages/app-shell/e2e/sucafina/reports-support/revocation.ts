import { createHash } from "node:crypto"
import { expect } from "@playwright/test"
import type { APIRequestContext, Browser, Page, TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAnswer } from "./confirmation.ts"
import { expectReusedReviewAnswer, reportsCollaboration } from "./confirmation.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import { productURL, readReview } from "./model.ts"

export async function revokeReportsSession(input: {
  browser: Browser; page: Page; app: ReportsInstallation; saved: PreservedReview; answer: ReviewAnswer
  artifact: { href: string; sha256: string }; info: TestInfo
}) {
  const { browser, page, app, saved, answer, artifact, info } = input
  // A second context retains the old, real credential after logout clears the first.
  // Never persist this state or attach cookies/enrollment codes to the receipt.
  const old = await browser.newContext({ storageState: await page.context().storageState() })
  const fresh = await browser.newContext()
  try {
    expect(await readReview(old.request, app.dashboardURL, saved.id)).toEqual(saved)
    await expectReusedReviewAnswer(reportsCollaboration(old.request, app.dashboardURL), answer)
    const logout = await page.request.post(`${app.origin}${app.mount}/auth/logout`, {
      headers: { Origin: app.origin }, maxRedirects: 0,
    })
    expect(logout.status()).toBe(204)
    expect(logout.headers()["cache-control"]).toContain("no-store")
    const meeting = page.locator("section:has(> nav > button)")
    await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
    await expect(meeting.getByRole("status")).toHaveText("Review is unavailable or access has changed.")
    await expect(meeting.getByRole("heading")).toHaveCount(0)
    await expect(meeting.getByRole("listitem")).toHaveCount(0)
    await expect(meeting.getByRole("button", { name: "Next topic", exact: true })).toBeDisabled()
    await denied(old.request, app, saved, answer, artifact.href, true)

    // Positive controls distinguish actual credential revocation from an absent
    // route/artifact or a broken server. A new legitimate enrollment cannot revive it.
    const control = await fresh.newPage()
    await app.signIn(control)
    expect(await readReview(control.request, app.dashboardURL, saved.id)).toEqual(saved)
    await expectReusedReviewAnswer(reportsCollaboration(control.request, app.dashboardURL), answer)
    const download = await control.request.get(artifact.href, { maxRedirects: 0 })
    expect(download.status()).toBe(200)
    expect(download.headers()["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(createHash("sha256").update(await download.body()).digest("hex")).toBe(artifact.sha256)
    await denied(old.request, app, saved, answer, artifact.href, false)
    await info.attach("session-revocation", { body: JSON.stringify({
      reviewRef: saved.id, answerRef: answer.answerRef, oldSession: "denied before and after fresh enrollment",
      cachedMeeting: "cleared", freshSession: "same review, answer and artifact digest",
      scope: "durable operator-session revocation", selectiveTalentRevocation: "NOT_PROVEN",
    }, null, 2), contentType: "application/json" })
  } finally {
    await fresh.close()
    await old.close()
  }
}

async function denied(request: APIRequestContext, app: ReportsInstallation, saved: PreservedReview, answer: ReviewAnswer, artifactURL: string, checkExport: boolean) {
  const requests = [
    { mode: "review-read", url: productURL(app.dashboardURL, "review-read", { reviewRef: saved.id }).href },
    { mode: "review-download", url: artifactURL },
    { mode: "review-report", url: productURL(app.dashboardURL, "review-report").href,
      data: { reviewRef: saved.id, sectionRefs: saved.sections.map((section) => section.id), format: "docx" } },
    { mode: "collaboration-answer-read", url: productURL(app.dashboardURL, "collaboration-answer-read").href,
      data: { questionId: answer.questionId } },
  ]
  for (const call of requests) {
    // Probe the rejected export once; later reads verify durable denial after reenrollment.
    if (call.mode === "review-report" && !checkExport) continue
    const response = call.data
      ? await request.post(call.url, { headers: { Origin: app.origin }, data: call.data, maxRedirects: 0 })
      : await request.get(call.url, { maxRedirects: 0 })
    expect(response.status(), `${call.mode} must use the real installation's access boundary`).toBe(call.data ? 403 : 303)
    expect(response.headers()["cache-control"], call.mode).toContain("no-store")
    if (!call.data) {
      const target = new URL(call.url)
      expect(response.headers().location).toBe(`${app.mount}/auth/login?returnTo=${encodeURIComponent(target.pathname + target.search)}`)
    }
    const body = await response.text()
    for (const secret of [saved.id, answer.message.body, answer.pin.reviewDigest, "REPORTS_LONG_NOTE_END", "reports-project-01", "totalForecast", "1320"])
      expect(body, `${call.mode} must not leak captured business content`).not.toContain(secret)
  }
}
