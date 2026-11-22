import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { expect, test, type Browser, type TestInfo } from "@playwright/test"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"
import { createFilm, selectOriginalProject, type Film } from "./design-support/film-support"
import { withLocalModel, type LocalModelRecording } from "./design-support/local-model"

// Chat-only retake. AI3's eight observed catalog/connection/Atlas beats remain
// valid. The previous native-40k Qwen rejected the unchanged 148598-token turn;
// this uses a pinned model whose original native window can hold that class of
// request. The previous 30-minute take was still prefilling; this single retry
// has a finite 120-minute response guard and records numeric progress only.
// Workflow is deliberately not rerun. No instructions, tools or guards change.
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })
type Json = Record<string, unknown>

test("record the actual Maestro prompt and genuine local-model answer", async ({ browser }, info) => {
  test.setTimeout(7_800_000)
  await withRecording(browser, info, "C-chat-native-context", async (film) => {
    await withLocalModel(film.context.request, film.installed, (local) => chatChapters(film, local), async (name, proof) => {
      film.mark("model-evidence", name)
      film.proof({ kind: name, ...proof })
      await info.attach(name, { body: JSON.stringify(proof, null, 2), contentType: "application/json" })
    })
  })
})

async function withRecording(browser: Browser, info: TestInfo, example: string, use: (film: Film) => Promise<void>) {
  expect(info.project.metadata.bundle).toBe("production")
  await withDesignInstallation(async (installed) => {
    const context = await browser.newContext({ locale: "en-US", viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "no-preference",
      httpCredentials: { username: "orchestra", password: installed.serverPassword },
      recordVideo: { dir: info.outputPath("continuous-video"), size: { width: 1920, height: 1080 } } })
    try {
      const owner = await authenticateRecordingInstallation(context, installed, async (value) => {
        await info.attach("ai-discovery-" + value.selector, { body: JSON.stringify(value), contentType: "application/json" })
      })
      const film = await createFilm(context, info, installed, owner, example)
      try {
        await selectOriginalRecordingWorkspace(film)
        await use(film)
      } finally {
        try { await film.finish() }
        finally { await preserveTransportProof(info, example) }
      }
      expect(film.missingCritical(), "only actual completed UI evidence qualifies this focused retake").toEqual([])
    } finally { await context.close() }
  }, "four")
}

async function selectOriginalRecordingWorkspace(film: Film) {
  await selectOriginalProject(film)
  film.proof({ kind: "earlier-setup-diagnostics", historicalOnly: true, currentTakeInitializesGit: false,
    earlierTakes: [
      { runId: 45037607487, observed: "Initialize git returned HTTP 500", artifactId: 14760785731 },
      { runId: 45038621982, observed: "Chromium could not expose the git response body", artifactId: 14760573330 },
    ] })
  const projectsResponse = await film.context.request.get(film.installed.origin + "/api/project")
  expect(projectsResponse.status()).toBe(200)
  const projects = rows(await projectsResponse.json())
  const located = object((await apiObject(film, "/api/agent", true)).location)
  const selected = object(located.project)
  const project = projects.find((value) => value.id === selected.id)
  expect(typeof selected.id).toBe("string")
  expect(located.directory).toBe(film.installed.root + "/workspace")
  film.proof({ kind: "actual-project-readback", id: selected.id, vcs: project?.vcs,
    nativeOwnerProjectId: film.owner.projectId, sameProjectId: selected.id === film.owner.projectId,
    gitRequiredForCatalogsOrChat: false })

  // Preserve the native installation's explicit owner after ordinary shared
  // project selection; never assume or overwrite its project identifier.
  const discovery = new URL("/api/sucafina/installations", film.installed.origin)
  discovery.search = new URLSearchParams({ select: "ids", installationId: film.owner.installationId,
    projectId: film.owner.projectId }).toString()
  const found = await film.context.request.get(discovery.href)
  expect(found.status()).toBe(200)
  const descriptors = rows(object(await found.json()).installations)
  expect(descriptors).toHaveLength(1)
  expect(descriptors[0]?.installationId).toBe(film.owner.installationId)
  expect(descriptors[0]?.projectId).toBe(film.owner.projectId)
  expect(descriptors[0]?.publicOrigin).toBe(film.installed.origin)
  const contextURL = new URL(film.installed.mount + "/api/ui/context", film.installed.origin)
  contextURL.search = new URLSearchParams({ installationId: film.owner.installationId, projectId: film.owner.projectId,
    hostId: film.owner.hostId }).toString()
  const response = await film.context.request.get(contextURL.href)
  expect(response.status()).toBe(200)
  const native = object(await response.json())
  const stamp = object(object(native.value).stamp)
  expect(native.status).toBe("ok")
  expect(stamp.projectId).toBe(film.owner.projectId)
  expect(stamp.installationId).toBe(film.owner.installationId)
  expect(stamp.principalRef).toBe(film.installed.actorId)
  film.proof({ kind: "native-owner-preserved-after-project-selection", nativeProjectId: stamp.projectId,
    installationId: stamp.installationId, originalAuthenticatedPrincipal: true, explicitRegistrySelection: true })
}

async function chatChapters(film: Film, local: LocalModelRecording) {
  const page = film.page
  let sessionId: string | undefined
  await film.cue("04-chat-request", async () => {
    expect(local.agentId).toBe("maestro")
    await openAgent(film, "maestro")
    await film.click(page.locator(".agent-screen").getByRole("button", { name: "Open Chat", exact: true }), "Open a real Maestro Chat draft")
    const prompt = page.getByRole("textbox", { name: "Prompt", exact: true })
    await expect(prompt).toBeVisible({ timeout: 40_000 })
    const model = page.locator('[data-action="prompt-model"]')
    await expect(model).toBeEnabled()
    await film.click(model, "Inspect and select the actual local demonstration model")
    await film.input(page.getByPlaceholder("Search models", { exact: true }), "Qwen3.5-0.8B", "Find the admitted demonstration model")
    await film.click(page.locator('[data-option-key=' + JSON.stringify(local.providerId + ":" + local.modelId) + ']'), "Choose the real Qwen3.5 local model")
    await expect(model).toContainText(local.modelName)
    // AI3 observed this exact draft UI: it has model/subagent controls and
    // Send, but the session permission footer does not exist before submission.
    film.proof({ kind: "actual-chat-draft", actualPath: new URL(page.url()).pathname,
      model: await model.innerText(), permissionControlInDraft: await page.locator('[data-action="prompt-permissions"]').count(),
      permissionModeChanged: false, draftPolicyBasis: "fresh original context; no auto-accept action" })
    await film.input(prompt, local.prompt, "Enter explicit example inputs and keep human approval", true)
    await film.snap("04-visible-prompt-and-model-before-send")
    await film.pause(4000)
    film.mark("send-actual-prompt", "Submit the visible example to actual inference")
    await film.click(page.getByRole("button", { name: "Send", exact: true }), "Send the displayed prompt to the real model")
    await expect.poll(() => new URL(page.url()).pathname.match(/\/session\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1],
      { timeout: 60_000 }).toBeTruthy()
    sessionId = new URL(page.url()).pathname.match(/\/session\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
    film.proof({ kind: "actual-chat-submission", sessionId, providerId: local.providerId, modelId: local.modelId,
      agentId: local.agentId, prompt: local.prompt, permissionModeChanged: false, inputsSuppliedExplicitly: true,
      businessSystemReadClaimed: false })
  }, true)

  await film.cue("06-chat-response", async () => {
    if (!sessionId) throw new Error("No actual UI session identity was observed after sending")
    film.mark("inference-wait-start", "Waiting for the real model response")
    const startedWaiting = Date.now()
    const deadline = startedWaiting + 7_200_000
    let nextProgress = startedWaiting
    let stopReason = "response-deadline"
    try {
      while (Date.now() < deadline) {
        const messages = rows((await apiObject(film, "/api/session/" + encodeURIComponent(sessionId) + "/message?order=asc&limit=200")).data)
        const assistants = messages.filter((value) => value.type === "assistant")
        const last = assistants.at(-1)
        if (last && (last.error !== undefined || typeof object(last.time).completed === "number")) {
          stopReason = last.error !== undefined ? "persisted-assistant-error" : "persisted-assistant-completed"
          break
        }
        if (Date.now() >= nextProgress) {
          // The helper only returns numeric process/server facts. A title's
          // generated tokens never stand in for this session's actual answer.
          const progress = await local.readProgress().catch(() => undefined)
          const observation = { sessionId, elapsedSeconds: Math.round((Date.now() - startedWaiting) / 1000),
            assistantMessages: assistants.length, completed: false,
            partialTextCharacters: Array.isArray(last?.content) ? rows(last.content).filter((part) => part.type === "text").reduce((sum, part) => sum + String(part.text ?? "").length, 0) : 0,
            ...(progress ? { modelProgress: progress } : { telemetryUnavailable: true }) }
          console.log("SF_MODEL_PROGRESS", JSON.stringify(observation))
          film.proof({ kind: "actual-inference-progress", ...observation })
          nextProgress = Date.now() + 60_000
          if (progress?.process.running === false) { stopReason = "model-process-exited"; break }
          if (progress?.stall.suspected === true) { stopReason = "stall-observation-with-no-progress-and-no-cpu-advance"; break }
        }
        await film.pause(5000)
      }
    } catch {
      // Preserve the real final model/message evidence even if a diagnostic
      // read fails. captureProof remains the exact-session success authority.
      stopReason = "message-readback-unavailable"
    }
    film.proof({ kind: "actual-inference-wait-ended", sessionId, stopReason,
      elapsedSeconds: Math.round((Date.now() - startedWaiting) / 1000), responseGuardSeconds: 7200,
      outputSubstituted: false, policyChanged: false })
    // captureProof records bounded failure diagnostics as well as success.
    const proof = await local.captureProof(sessionId)
    const answer = String(proof.answer ?? "")
    const fragments = answer.split("\n").map(normalizeVisible).filter((value) => value.length > 20).slice(0, 3)
    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments)
      await expect.poll(async () => normalizeVisible(await page.locator("body").innerText()), { timeout: 30_000 }).toContain(fragment.slice(0, 120))
    film.mark("inference-wait-end", "Actual answer persisted and visible in Chat")
    const permission = page.locator('[data-slot="orchestra-compose-tools"] [data-action="prompt-permissions"]')
    await expect(permission).toHaveText("Ask")
    await expect(permission).toHaveAttribute("aria-pressed", "false")
    film.proof({ kind: "actual-session-permission-mode", label: await permission.innerText(),
      autoAccept: await permission.getAttribute("aria-pressed"), changedByRecording: false })
    const rendered = page.locator('[data-component="orchestra-turn"][data-role="assistant"] [data-slot="orchestra-turn-body"]').last()
    await expect(rendered).toBeVisible()
    await expect.poll(async () => normalizeVisible(await rendered.innerText())).toContain(fragments[0]!.slice(0, 120))
    await film.focus(rendered, "Read the actual completed Maestro answer")
    film.proof({ kind: "actual-chat-answer-visible", sessionId, persistedAnswerSha256: digest(answer),
      visibleFragments: fragments, responseSubstituted: false, productionProviderClaimed: false,
      modelLabel: "Local demonstration model" })
  }, true)
}

/** Materialize only the original proof attachment bytes for the post-test media
 * transport. No report rewriting, arbitrary attachment copying or auth files.
 * The original full Playwright report/video remain in the ordinary artifact. */
async function preserveTransportProof(info: TestInfo, example: string) {
  if (example !== "C-chat-native-context") throw new Error("Unexpected focused Chat capture identity")
  const allowed = new Set([example + "-film-report", example + "-video-source",
    "local-model-setup-started", "local-model-ready", "local-model-chat-proof", "local-model-failure"])
  const selected = info.attachments.filter((attachment) => allowed.has(attachment.name) && attachment.contentType === "application/json")
  if (new Set(selected.map((attachment) => attachment.name)).size !== selected.length)
    throw new Error("Ambiguous original proof attachments")
  await mkdir(info.outputPath("transport-proof"), { recursive: true })
  for (const attachment of selected) {
    if (!Buffer.isBuffer(attachment.body) || attachment.body.length > 16 * 1024 ** 2)
      throw new Error("Expected bounded original JSON attachment bytes")
    await writeFile(info.outputPath("transport-proof", attachment.name + ".json"), attachment.body, { flag: "wx" })
  }
}

async function openAgent(film: Film, id: string) {
  await film.go("/orchestra/agents")
  const search = film.page.getByRole("searchbox", { name: "Search agents", exact: true })
  await film.input(search, id, "Find actual profile / " + id)
  await film.click(film.page.locator("#agent-" + id), "Open actual profile / " + id)
  await expect(film.page.locator(".agent-screen")).toBeVisible()
  film.proof({ kind: "actual-agent-opened", id, name: await film.page.locator("#agents-title").innerText(),
    mission: await film.page.locator(".agent-hero-desc").innerText() })
}

async function apiObject(film: Film, route: string, location = false, directory = film.installed.root + "/workspace"): Promise<Json> {
  const url = new URL(route, film.installed.origin)
  if (location) url.searchParams.set("location[directory]", directory)
  const response = await film.context.request.get(url.href, { timeout: 30_000 })
  if (response.status() !== 200) throw new Error("Actual readback failed: " + url.pathname + " (" + response.status() + ")")
  return object(await response.json())
}
function object(value: unknown): Json { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {} }
function rows(value: unknown): Json[] { if (!Array.isArray(value)) throw new Error("Expected an actual API array"); return value.map(object) }
function digest(value: string) { return createHash("sha256").update(value).digest("hex") }
function normalizeVisible(value: string) { return value.replace(/[*_`#]/g, "").replace(/^\s*(?:[-•]|\d+[.)])\s*/gm, "").replace(/\s+/g, " ").trim() }
