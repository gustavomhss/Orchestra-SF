import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { expect, test, type Browser, type TestInfo } from "@playwright/test"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"
import { createFilm, selectOriginalProject, type Film } from "./design-support/film-support"
import { withLocalModel, type LocalModelRecording } from "./design-support/local-model-restricted"
import { configureRestrictedMaestro, type RestrictedMaestro } from "./design-support/restricted-agent"

// A distinct recording of an explicit, standard operator configuration: the
// original Maestro role/system/steps/engine with tool access denied in one
// trusted private workspace. Permission-dependent guidance and descriptors
// change through ordinary product behavior. No runtime or payload is patched.
// Twenty-minute response guard; no Workflow or other chapter is rerun.
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })
type Json = Record<string, unknown>

test("record actual tool-restricted Maestro input and genuine answer", async ({ browser }, info) => {
  test.setTimeout(1_800_000)
  await withRecording(browser, info, "C-chat-restricted-context", async (film) => {
    const record = async (name: string, proof: object) => {
      film.mark("setup-or-model-evidence", name)
      film.proof({ kind: name, ...proof })
      await info.attach(name, { body: JSON.stringify(proof, null, 2), contentType: "application/json" })
    }
    const restricted = await configureRestrictedMaestro(film.context.request, film.installed, record)
    await withLocalModel(film.context.request, film.installed,
      (local) => chatChapters(film, local, restricted, record), record)
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

async function chatChapters(film: Film, local: LocalModelRecording, restricted: RestrictedMaestro,
  record: (name: string, proof: object) => Promise<void>) {
  const page = film.page
  let sessionId: string | undefined
  await film.cue("04-chat-request", async () => {
    expect(local.agentId).toBe("maestro")
    await openAgent(film, "maestro")
    const configured = await restricted.verify()
    await film.click(page.locator("#agent-tab-tools"), "Inspect the actual restricted tool access")
    const toolsPanel = page.locator('[role="tabpanel"][aria-labelledby="agent-tab-tools"]')
    await expect(toolsPanel).toBeVisible()
    await expect(page.locator("#agent-tab-tools .agent-tab-count")).toHaveText(String(configured.advertisedToolNames.length))
    await expect(toolsPanel.locator("ul.agent-list code")).toHaveText(configured.advertisedToolNames)
    const visiblePermissionRows: { name: string; selectedLabel: string }[] = []
    for (const name of ["read", "edit", "bash", "task", "skill"]) {
      const control = toolsPanel.locator('select[name="perm-' + name + '"]')
      await expect(control).toHaveValue("inherit")
      await expect.poll(() => control.locator("option:checked").innerText()).toMatch(/deny/i)
      visiblePermissionRows.push({ name, selectedLabel: await control.locator("option:checked").innerText() })
    }
    await film.focus(toolsPanel.locator('select[name="perm-task"]'), "Tool access is denied for this provided-facts example")
    await film.snap("04-standard-tool-access-denied")
    film.proof({ kind: "actual-restricted-tools-ui", advertisedToolNames: configured.advertisedToolNames,
      availableSkillNames: configured.availableSkillNames, residualSkillDescriptor: configured.residualSkillDescriptor,
      visiblePermissionRows, allToolExecutionDenied: true, originalCoreRolePreserved: true,
      badge: "Provided facts · Tool access denied" })
    await film.pause(6000)
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
      permissionModeChanged: false, draftPolicyBasis: "fresh original context; publicly configured project tool denial; no auto-accept action",
      operatorConfiguredToolRestriction: true })
    await film.input(prompt, local.prompt, "Enter explicit example inputs and keep human approval", true)
    await film.snap("04-visible-prompt-and-model-before-send")
    await film.pause(4000)
    const beforeSend = await restricted.verify()
    await record("restricted-agent-confirmation", { phase: "immediately-before-actual-UI-send", ...beforeSend,
      originalCoreRolePreserved: true, permissionDependentGuidanceAndSchemasMayChange: true,
      sessionPermissionModeChanged: false, advertisedDescriptorsEdited: false })
    film.mark("send-actual-prompt", "Submit the visible example to actual inference")
    await film.click(page.getByRole("button", { name: "Send", exact: true }), "Send the displayed prompt to the real model")
    await expect.poll(() => new URL(page.url()).pathname.match(/\/session\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1],
      { timeout: 60_000 }).toBeTruthy()
    sessionId = new URL(page.url()).pathname.match(/\/session\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
    film.proof({ kind: "actual-chat-submission", sessionId, providerId: local.providerId, modelId: local.modelId,
      agentId: local.agentId, prompt: local.prompt, permissionModeChanged: false, inputsSuppliedExplicitly: true,
      businessSystemReadClaimed: false, operatorConfiguredToolRestriction: true,
      originalCoreRolePreserved: true, restrictionPermissionsSha256: beforeSend.permissionsSha256 })
  }, true)

  await film.cue("06-chat-response", async () => {
    if (!sessionId) throw new Error("No actual UI session identity was observed after sending")
    film.mark("inference-wait-start", "Waiting for the real model response")
    const startedWaiting = Date.now()
    const deadline = startedWaiting + 1_200_000
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
      elapsedSeconds: Math.round((Date.now() - startedWaiting) / 1000), responseGuardSeconds: 1200,
      outputSubstituted: false, operatorConfiguredToolRestriction: true, permissionsChangedAfterSubmission: false })
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
      modelLabel: "Local demonstration model", toolAccessLabel: "Provided facts · Tool access denied" })
  }, true)
}

/** Materialize only the original proof attachment bytes for the post-test media
 * transport. No report rewriting, arbitrary attachment copying or auth files.
 * The original full Playwright report/video remain in the ordinary artifact. */
async function preserveTransportProof(info: TestInfo, example: string) {
  if (example !== "C-chat-restricted-context") throw new Error("Unexpected focused Chat capture identity")
  const allowed = new Set([example + "-film-report", example + "-video-source",
    "local-model-setup-started", "local-model-ready", "local-model-chat-proof", "local-model-failure",
    "restricted-agent-configuration", "restricted-agent-confirmation"])
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
  // The supported API write reloads the server's agents. A normal document
  // reload also refreshes this page's otherwise persistent roster/detail cache.
  film.mark("reload", "Refresh the actual profile after operator configuration")
  await film.page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 })
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
