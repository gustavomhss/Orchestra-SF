import { createHash } from "node:crypto"
import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test, type Browser, type TestInfo } from "@playwright/test"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"
import { createFilm, selectOriginalProject, type Film } from "./design-support/film-support"
import { withLocalModel, type LocalModelRecording } from "./design-support/local-model"

// Focused retake only. AI3's eight observed catalog/connection/Atlas beats and
// original video remain valid; this file records no replacements for them.
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })
type Json = Record<string, unknown>

test("record the actual Maestro prompt and genuine local-model answer", async ({ browser }, info) => {
  test.setTimeout(1_200_000)
  await withRecording(browser, info, "C-chat-repair", async (film) => {
    await withLocalModel(film.context.request, film.installed, (local) => chatChapters(film, local), async (name, proof) => {
      film.mark("model-evidence", name)
      film.proof({ kind: name, ...proof })
      await info.attach(name, { body: JSON.stringify(proof, null, 2), contentType: "application/json" })
    })
  })
})

test("record a real regional review workflow draft in the job's existing project", async ({ browser }, info) => {
  test.setTimeout(600_000)
  await withRecording(browser, info, "C-workflow-repair", workflowChapter)
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
      } finally { await film.finish() }
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

async function workflowChapter(film: Film) {
  const page = film.page
  let directory = film.installed.root + "/workspace"
  let separateProject = false
  await film.cue("41-shared-workflows", async () => {
    const current = object(object((await apiObject(film, "/api/agent", true)).location).project)
    if (current.id === "global") {
      // This job's checkout is already a real git repository. Use the normal
      // picker for this draft in its own recording; Chat has a separate
      // original installation and cannot inherit this selection. No git status is invented.
      const checkout = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.."))
      if (!process.env.CI || !process.env.GITHUB_WORKSPACE || checkout !== await realpath(process.env.GITHUB_WORKSPACE))
        throw new Error("Workflow fallback is restricted to this isolated Actions checkout")
      if (!(await stat(path.join(checkout, ".git"))).isDirectory()) throw new Error("Actions checkout has no actual git directory")
      separateProject = true
      await selectProjectThroughUI(film, checkout)
      directory = checkout
      // The UI's project.current delegates to this exact endpoint. It resolves
      // AND records the opened project; the process-wide catalog alone does not.
      const location = await apiObject(film, "/api/location", true, checkout)
      expect(location.directory).toBe(checkout)
      const currentProject = object(location.project)
      const response = await film.context.request.get(film.installed.origin + "/api/project")
      expect(response.status()).toBe(200)
      const catalog = rows(await response.json())
      const project = catalog.find((value) => value.id === currentProject.id)
      film.proof({ kind: "workflow-project-readback", actualLocation: location,
        catalog: catalog.map((value) => ({ id: value.id, worktree: value.worktree, vcs: value.vcs })),
        physicalCheckoutVerified: true, projectResolvedVia: "/api/location" })
      await film.go("/orchestra/workflows")
      if (currentProject.id === "global") {
        await film.snap("41-actual-workflow-admission")
        throw new Error("The actual location still resolves the physical Actions repository as global; Workflow admission is preserved")
      }
      expect(currentProject.directory).toBe(checkout)
      expect(project?.vcs).toBe("git")
      film.proof({ kind: "workflow-project-selected", projectId: currentProject.id, vcs: project?.vcs,
        scope: "this recording job's ephemeral checkout", mechanism: "normal project picker and actual location readback", nativeWorkspaceChanged: false })
    }
    await film.go("/orchestra/workflows")
    const create = page.getByRole("button", { name: "New workflow", exact: true })
    await expect(create).toBeEnabled({ timeout: 40_000 })
    await film.click(create, "Create an actual regional review workflow draft")
    const dialog = page.getByRole("dialog", { name: "New workflow", exact: true })
    await expect(dialog.getByRole("radio", { name: /Start from scratch/ })).toHaveAttribute("aria-checked", "true")
    const name = "Regional operating review brief"
    await film.input(dialog.getByRole("textbox", { name: "Name", exact: true }), name, "Name the review draft")
    await film.input(dialog.getByRole("textbox", { name: /What is it for/ }),
      "Prepare staffing and purchase questions from evidence supplied by the reviewer; keep approval with the human.", "Describe the draft's purpose")
    await film.click(dialog.getByRole("button", { name: "Create and open", exact: true }), "Save and open the real draft")
    const canvas = page.locator('[data-component="relay-canvas"]')
    await expect(canvas).toBeVisible({ timeout: 40_000 })
    await film.click(canvas.getByRole("button", { name: "Add step (N)", exact: true }), "Add an instruction step")
    await film.click(page.locator('[data-component="relay-add-panel"]').getByRole("option", { name: /Agent step/ }), "Choose the real Agent step")
    const details = page.locator('[data-component="relay-node-details"]')
    await film.input(details.getByRole("textbox", { name: "Name", exact: true }), "Prepare review questions", "Name the agent step")
    const instructions = "Use only evidence explicitly supplied by the reviewer. Identify the staffing decision, compare the selected quotation with its alternatives, and list missing evidence and the next human approval. Do not access external systems or change business records. Return a short review brief and label unknowns."
    await film.input(details.getByRole("textbox", { name: "Instructions", exact: true }), instructions, "Enter the draft review instructions")
    await expect(details.locator('[data-save="saved"]')).toBeVisible({ timeout: 40_000 })
    await film.snap("41-agent-receives-and-instructions")
    await film.pause(4000)
    await page.keyboard.press("Escape")
    await expect(details).toHaveCount(0)
    await expect(page.locator(".wf-head .wf-save")).toHaveText("Saved")
    const workflowUrl = page.url()
    const id = new URL(workflowUrl).pathname.match(/^\/orchestra\/workflows\/([^/]+)$/)?.[1]
    if (!id) throw new Error("The actual workflow editor omitted its document identity")
    const document = object((await apiObject(film, "/api/relay/document/" + encodeURIComponent(id), true, directory)).data)
    expect(document.name).toBe(name)
    const node = rows(document.nodes).find((value) => object(value.parameters).instructions === instructions)
    if (!node) throw new Error("The saved workflow readback omitted the actual instruction step")
    await film.click(page.getByRole("link", { name: "Back to Workflows", exact: true }), "Reopen the saved draft from its library")
    await film.click(page.locator('[data-document=' + JSON.stringify(id) + ']'), "Open the same regional review draft")
    await expect(canvas).toBeVisible()
    film.proof({ kind: "actual-workflow-draft", id, name, step: node.name, instructionSha256: digest(instructions),
      freshAPIReadback: true, navigationAwayAndReopen: true, published: false, executed: false,
      projectScope: separateProject ? "ephemeral Actions checkout" : "original runtime workspace" })
  }, true)
}

async function selectProjectThroughUI(film: Film, directory: string) {
  await film.click(film.page.locator('[data-slot="orchestra-profile"]'), "Choose project through the original sidebar")
  const menu = film.page.locator('[data-component="orchestra-profile-picker"]')
  await film.click(menu.getByRole("menuitem", { name: "Add project", exact: true }), "Open the actual project folder picker")
  await film.input(film.page.getByPlaceholder("Search folders", { exact: true }), directory, "Find the explicit demonstration project")
  await film.click(film.page.locator('[data-directory-path=' + JSON.stringify(directory) + ']'), "Select the actual demonstration folder")
  const skip = film.page.getByRole("button", { name: "Add without git", exact: true })
  const selected = film.page.locator('[data-slot="orchestra-profile"] small[title]')
  await expect.poll(async () => await skip.isVisible() || await selected.getAttribute("title").catch(() => undefined) === directory,
    { timeout: 40_000 }).toBe(true)
  if (await skip.isVisible()) await film.click(skip, "Use the existing workspace without another git initialization")
  await expect(selected).toHaveAttribute("title", directory, { timeout: 40_000 })
  film.proof({ kind: "actual-project-picker-selection", mechanism: "Choose project / Add project / Search folders",
    selectedDirectory: directory === film.installed.root + "/workspace" ? "original private workspace" : "verified isolated Actions checkout" })
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
    await film.input(page.getByPlaceholder("Search models", { exact: true }), "Qwen3-0.6B", "Find the admitted demonstration model")
    await film.click(page.locator('[data-option-key=' + JSON.stringify(local.providerId + ":" + local.modelId) + ']'), "Choose the real Qwen3 local model")
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
    const deadline = Date.now() + 600_000
    while (Date.now() < deadline) {
      const messages = rows((await apiObject(film, "/api/session/" + encodeURIComponent(sessionId) + "/message?order=asc&limit=200")).data)
      const assistants = messages.filter((value) => value.type === "assistant")
      const last = assistants.at(-1)
      if (last && (last.error !== undefined || typeof object(last.time).completed === "number")) break
      await film.pause(2000)
    }
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
async function locationRows(film: Film, route: string) { return rows((await apiObject(film, route, true)).data) }
function object(value: unknown): Json { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {} }
function rows(value: unknown): Json[] { if (!Array.isArray(value)) throw new Error("Expected an actual API array"); return value.map(object) }
function digest(value: string) { return createHash("sha256").update(value).digest("hex") }
function normalizeVisible(value: string) { return value.replace(/[*_`#]/g, "").replace(/^\s*(?:[-•]|\d+[.)])\s*/gm, "").replace(/\s+/g, " ").trim() }
