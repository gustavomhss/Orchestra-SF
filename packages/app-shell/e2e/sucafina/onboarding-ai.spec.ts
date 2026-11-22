import { createHash } from "node:crypto"
import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"
import { createFilm, selectOriginalProject, type Film } from "./design-support/film-support"
import { withLocalModel, type LocalModelRecording } from "./design-support/local-model"

// Recording-only. Original production UI, original private installation, actual
// project/configuration APIs and actual inference. No routes or answers mocked.
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })

const residentIds = ["sf_maestro", "sf_finance", "sf_procurement", "sf_portfolio", "sf_reviewer"]
const skillNames = [
  "sf-enquadrar-decisao", "sf-preparar-revisao-executiva", "sf-coordenar-perguntas",
  "sf-explicar-forecast", "sf-comparar-cenarios", "sf-avaliar-sensibilidade",
  "sf-comparar-sourcing", "sf-revisar-condicoes-contratuais", "sf-preparar-compra",
  "sf-revisar-dependencias", "sf-compor-portfolio", "sf-reavaliar-compromissos",
  "sf-contestar-decisao", "sf-revisar-evidencias", "sf-extrair-evidencias",
  "sf-produzir-bi-contextual", "sf-produzir-material-reuniao", "sf-consultar-memoria-decisoria",
]
type Json = Record<string, unknown>

test("record actual shared AI catalogs, a workflow draft, and a genuine local-model Chat answer", async ({ browser }, info) => {
  test.setTimeout(1_800_000)
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
      const film = await createFilm(context, info, installed, owner, "C-shared-ai")
      try {
        await selectOriginalGitProject(film)
        await catalogChapters(film)
        await workflowChapter(film)
        await atlasChapter(film)
        await connectionsChapter(film)
        await expect(film.page.locator('[data-slot="orchestra-profile"] small[title]'))
          .toHaveAttribute("title", installed.root + "/workspace")
        // All independent catalog/setup footage is complete before the model
        // download, process start or inference can fail.
        try {
          await withLocalModel(context.request, installed, async (local) => {
            await chatChapters(film, local)
          }, async (name, proof) => {
            film.mark("model-evidence", name)
            film.proof({ kind: name, ...proof })
            await info.attach(name, { body: JSON.stringify(proof, null, 2), contentType: "application/json" })
          })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Actual model setup failed"
          if (!film.beats.some((beat) => beat.id === "04-chat-request"))
            await film.cue("04-chat-request", async () => { throw new Error(message) }, true)
          if (!film.beats.some((beat) => beat.id === "06-chat-response"))
            await film.cue("06-chat-response", async () => { throw new Error("No qualified actual AI response: " + message) }, true)
          throw error
        }
      } finally { await film.finish() }
      expect(film.missingCritical(), "actual catalogs, saved draft and genuine UI response must qualify").toEqual([])
    } finally { await context.close() }
  }, "four")
})

/** Same original picker, but explicitly accept its real git setup in this AI-only
 * empty workspace. Other recording installations keep the shared default. */
async function selectOriginalGitProject(film: Film) {
  const page = film.page
  await film.go("/orchestra/agents")
  const empty = page.locator('[data-slot="orchestra-chapter-empty"]')
  const agents = page.getByRole("list", { name: "Configured agents", exact: true })
  await expect.poll(async () => await empty.isVisible() || await agents.isVisible(), { timeout: 40_000 }).toBe(true)
  if (await empty.isVisible()) {
    await film.click(empty.getByRole("button", { name: "Open project", exact: true }), "Choose the actual isolated workspace")
    const directory = film.installed.root + "/workspace"
    await film.input(page.getByPlaceholder("Search folders", { exact: true }), directory, "Find the original runtime workspace")
    await film.click(page.locator('[data-directory-path=' + JSON.stringify(directory) + ']'), "Select the verified workspace")
    const initialize = page.getByRole("button", { name: "Initialize git", exact: true })
    await expect.poll(async () => await initialize.isVisible() || await agents.isVisible(), { timeout: 40_000 }).toBe(true)
    if (await initialize.isVisible()) {
      const initialized = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/project/git" &&
        response.request().method() === "POST", { timeout: 60_000 })
      await film.click(initialize, "Initialize git in this empty demonstration workspace")
      const response = await initialized
      const body = await response.text()
      if (response.status() === 200) {
        const project = object(object(JSON.parse(body)).data)
        expect(typeof project.id).toBe("string")
        expect(project.worktree).toBe(directory)
        film.proof({ kind: "actual-project-initialization", mechanism: "original Initialize git UI",
          projectId: project.id, vcs: project.vcs, directory: "verified private workspace", initialCommitCreatedByProduct: true })
      } else {
        // Preserve the actual refusal/error before continuing the independent
        // catalog and Chat chapters. Do not weaken or retry a denied operation.
        film.proof({ kind: "actual-project-initialization-failed", status: response.status(),
          response: safeBody(body, film), initializedClaimed: false, operationRetried: false })
        await film.pause(1000)
        await film.snap("setup-actual-git-failure")
      }
    }
  }
  await selectOriginalProject(film)
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

  // Git creates a new shared project identity. Preserve the native installation's
  // explicit original owner; never assume or overwrite its project identifier.
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
  film.proof({ kind: "native-owner-preserved-after-git", nativeProjectId: stamp.projectId,
    installationId: stamp.installationId, originalAuthenticatedPrincipal: true, explicitRegistrySelection: true })
}

async function catalogChapters(film: Film) {
  const page = film.page
  await film.cue("07-platform-agents", async () => {
    await openAgent(film, "maestro")
    await agentTab(film, "overview", "Maestro / Overview")
    await film.pause(2500)
    await agentTab(film, "tools", "Inspect Maestro's actual tools")
    await film.snap("07-maestro-tools")
    await film.pause(2500)
    await agentTab(film, "skills", "Inspect Maestro's actual skill tree")
    const branch = page.locator(".agent-tree details > summary").first()
    if (await branch.count() && await branch.isVisible()) await film.click(branch, "Expand the first actual skill branch")
    film.proof({ kind: "platform-agent-inspected", id: "maestro", chatAgentIsMaestro: true,
      visibleSkillTree: (await page.locator(".agent-screen").innerText()).slice(0, 12000) })
  }, true)

  await film.cue("09-skills-catalog", async () => {
    await film.go("/orchestra/skills")
    const skills = await locationRows(film, "/api/skill/catalog")
    const actual = skills.filter((value) => typeof value.name === "string" && value.name.startsWith("sf-"))
    expect(actual.map((value) => value.name).sort()).toEqual([...skillNames].sort())
    film.proof({ kind: "actual-sucafina-skills", count: actual.length,
      skills: actual.map((value) => ({ name: value.name, description: value.description,
        sourcePathSha256: digest(String(value.location ?? "")) })) })
    await expect(page.getByRole("list", { name: "Registered skills", exact: true })).toBeVisible()
    await film.input(page.getByRole("textbox", { name: "Search skills", exact: true }), "sf-", "Filter actual Sucafina skills")
    await expect(page.locator(".skills-card")).toHaveCount(18)
    await film.snap("09-actual-eighteen-skills")
    await film.pause(3000)
    await readSkill(film, "sf-enquadrar-decisao")
  }, true)

  await film.cue("10-native-residents", async () => {
    await closeSkill(film)
    const agents = await locationRows(film, "/api/agent")
    const actual = agents.filter((value) => typeof value.id === "string" && value.id.startsWith("sf_"))
    expect(actual.map((value) => value.id).sort()).toEqual([...residentIds].sort())
    expect(actual.every((value) => value.hidden === false && value.engine === "orchestra")).toBe(true)
    await film.go("/orchestra/agents")
    await film.input(page.getByRole("searchbox", { name: "Search agents", exact: true }), "sf_", "Show the five installed Sucafina profiles")
    await expect(page.getByRole("list", { name: "Configured agents", exact: true }).locator("li.agent")).toHaveCount(5)
    film.proof({ kind: "actual-sucafina-residents", count: actual.length,
      agents: actual.map((value) => ({ id: value.id, name: value.name, description: value.description,
        mode: value.mode, engine: value.engine })), nativeContributionProjectionUsed: false })
    await film.pause(4000)
    await film.snap("10-five-resident-cards")
    await openAgent(film, "sf_maestro")
    await agentTab(film, "overview", "Sucafina coordinator / actual mission")
  }, true)

  await film.cue("11-finance-portfolio", async () => {
    await openAgent(film, "sf_finance")
    await inspectPrompt(film, "sf_finance")
    await film.snap("11-finance-system-prompt")
    await film.pause(2500)
    await agentTab(film, "tools", "Finance / permitted tools")
    await film.pause(2000)
    await agentTab(film, "skills", "Finance / installed skill tree")
    await film.snap("11-finance-skills")
    await film.pause(3000)
    await openAgent(film, "sf_portfolio")
    await agentTab(film, "overview", "Portfolio / actual mission and model")
    film.proof({ kind: "resident-profiles-inspected", ids: ["sf_finance", "sf_portfolio"], noAnalysisExecuted: true })
  }, true)

  await film.cue("12-procurement-reviewer", async () => {
    await openAgent(film, "sf_procurement")
    await inspectPrompt(film, "sf_procurement")
    await film.snap("12-procurement-system-prompt")
    await film.pause(2500)
    await agentTab(film, "tools", "Procurement / permitted tools")
    await film.pause(2000)
    await agentTab(film, "skills", "Procurement / installed skill tree")
    await film.snap("12-procurement-skills")
    await film.pause(3000)
    await openAgent(film, "sf_reviewer")
    await agentTab(film, "overview", "Reviewer / separate actual mission")
    film.proof({ kind: "resident-profiles-inspected", ids: ["sf_procurement", "sf_reviewer"], noApprovalExecuted: true })
  }, true)

  await film.cue("13-contribution-proof", async () => {
    await film.go("/orchestra/skills")
    await readSkill(film, "sf-comparar-sourcing")
    film.proof({ kind: "source-instructions-inspected", skill: "sf-comparar-sourcing",
      actualSkillBodyRead: true, skillExecutionClaimed: false, contributionRunClaimed: false })
  }, true)
  await closeSkill(film)
}

async function workflowChapter(film: Film) {
  const page = film.page
  let directory = film.installed.root + "/workspace"
  let separateProject = false
  try { await film.cue("41-shared-workflows", async () => {
    const current = object(object((await apiObject(film, "/api/agent", true)).location).project)
    if (current.id === "global") {
      // This job's checkout is already a real git repository. Use the normal
      // picker for this draft only, then return to the original runtime
      // workspace before Atlas, providers or Chat. No git status is invented.
      const checkout = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.."))
      if (!process.env.CI || !process.env.GITHUB_WORKSPACE || checkout !== await realpath(process.env.GITHUB_WORKSPACE))
        throw new Error("Workflow fallback is restricted to this isolated Actions checkout")
      if (!(await stat(path.join(checkout, ".git"))).isDirectory()) throw new Error("Actions checkout has no actual git directory")
      separateProject = true
      await selectProjectThroughUI(film, checkout)
      directory = checkout
      const response = await film.context.request.get(film.installed.origin + "/api/project")
      expect(response.status()).toBe(200)
      const project = rows(await response.json()).find((value) => value.worktree === checkout)
      expect(project?.vcs).toBe("git")
      expect(project?.id).not.toBe("global")
      film.proof({ kind: "workflow-project-selected", projectId: project?.id, vcs: project?.vcs,
        scope: "this recording job's ephemeral checkout", mechanism: "normal project picker", nativeWorkspaceChanged: false })
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
  }, true) } finally {
    if (separateProject) {
      await page.keyboard.press("Escape")
      await selectProjectThroughUI(film, film.installed.root + "/workspace")
      await film.go("/orchestra/agents")
      const current = object((await apiObject(film, "/api/agent", true)).location)
      expect(current.directory).toBe(film.installed.root + "/workspace")
      film.proof({ kind: "returned-to-original-workspace", actualSharedProjectId: object(current.project).id,
        nativeInstallationId: film.owner.installationId, modelPromptWillUseThisDirectory: true })
    }
  }
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

async function atlasChapter(film: Film) {
  await film.cue("42-atlas", async () => {
    await film.go("/orchestra/atlas")
    const atlas = film.page.locator('[data-component="orchestra-atlas"]')
    await expect(atlas).toBeVisible()
    const main = atlas.locator(".atlas-main")
    await expect(main).not.toContainText("Loading Atlas…", { timeout: 40_000 })
    await film.focus(main, "Atlas / actual state of this selected project")
    const initial = await main.innerText()
    const empty = initial.includes("Atlas has no store in this project")
    const unavailable = initial.includes("This server does not provide Atlas.")
    film.proof({ kind: "actual-atlas-state", empty, unavailable, noMemoryFabricated: true,
      visibleText: initial.slice(0, 12000) })
    if (!empty && !unavailable) {
      const memory = atlas.locator(".atlas-context").getByRole("link", { name: "Memory", exact: true })
      if (await memory.count() === 1 && await memory.isVisible()) {
        await film.pause(3000)
        await film.click(memory, "Read the real Atlas memory view")
        film.proof({ kind: "actual-atlas-memory-view", visibleText: (await main.innerText()).slice(0, 12000) })
      }
    }
  })
}

async function connectionsChapter(film: Film) {
  await film.cue("43-connections", async () => {
    await film.go("/orchestra/providers")
    await expect(film.page.getByRole("heading", { name: "Providers", level: 1, exact: true })).toBeVisible()
    const engine = film.page.locator("[data-providers-claude-engine]")
    await expect(engine).toBeVisible()
    const previous = await engine.inputValue()
    if (previous !== "orchestra") {
      await film.select(engine, { value: "orchestra" }, "Use the supported Orchestra engine for this demonstration")
      await expect(engine).toHaveValue("orchestra")
      await expect(engine).toBeEnabled()
    }
    await expect.poll(async () => {
      const agents = await locationRows(film, "/api/agent")
      const maestro = agents.find((value) => value.id === "maestro")
      return !!maestro && (maestro.engine === undefined || maestro.engine === "orchestra")
    }, { timeout: 30_000 }).toBe(true)
    film.proof({ kind: "actual-maestro-engine-setup", previous, selected: "orchestra",
      changedThroughSupportedUI: previous !== "orchestra", credentialsEntered: false })
    await film.snap("43-providers-before-local-model")
    await film.pause(4000)
    await film.go("/orchestra/integrations")
    await expect(film.page.getByRole("heading", { name: "Integrations", level: 1, exact: true })).toBeVisible()
    await expect(film.page.getByText("Loading integrations…", { exact: true })).toHaveCount(0, { timeout: 30_000 })
    film.proof({ kind: "actual-integration-state", configuredExternalServiceClaimed: false,
      visibleText: (await film.page.locator(".integrations-list").innerText().catch(() => "No account list displayed")).slice(0, 8000) })
  }, true)
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
    const permission = page.locator('[data-action="prompt-permissions"]')
    await expect(permission).toHaveText("Ask")
    await expect(permission).toHaveAttribute("aria-pressed", "false")
    await film.input(prompt, local.prompt, "Enter explicit example inputs and keep human approval", true)
    await film.snap("04-prompt-and-permission-before-send")
    await film.pause(4000)
    film.mark("send-actual-prompt", "Submit the visible example to actual inference")
    await prompt.press("Enter")
    await expect.poll(() => new URL(page.url()).pathname.match(/\/session\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1],
      { timeout: 60_000 }).toBeTruthy()
    sessionId = new URL(page.url()).pathname.match(/\/session\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
    film.proof({ kind: "actual-chat-submission", sessionId, providerId: local.providerId, modelId: local.modelId,
      agentId: local.agentId, prompt: local.prompt, permission: "Ask", inputsSuppliedExplicitly: true,
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
    await expect(page.locator('[data-action="prompt-permissions"]')).toHaveText("Ask")
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

async function agentTab(film: Film, tab: string, label: string) {
  const target = film.page.locator("#agent-tab-" + tab)
  await film.click(target, label)
  await expect(target).toHaveAttribute("aria-selected", "true")
}

async function inspectPrompt(film: Film, id: string) {
  await agentTab(film, "prompt", id + " / inspect actual instructions")
  const field = film.page.locator('.agent-screen textarea[name="system"]')
  await expect(field).not.toHaveValue("")
  await film.focus(field, "Read the profile's source instructions")
  const content = await field.inputValue()
  film.proof({ kind: "actual-agent-prompt-read", id, chars: content.length, sha256: digest(content), edited: false })
}

async function closeSkill(film: Film) {
  const dialog = film.page.locator("dialog.orchestra-skills-dialog[open]")
  if (await dialog.count()) await film.click(dialog.getByRole("button", { name: "Close dialog", exact: true }), "Close the actual skill instructions")
}

async function readSkill(film: Film, name: string) {
  await closeSkill(film)
  await film.input(film.page.getByRole("textbox", { name: "Search skills", exact: true }), name, "Find actual instruction / " + name)
  const card = film.page.locator(".skills-card").filter({ has: film.page.getByRole("heading", { name, level: 3, exact: true }) })
  await film.click(card.getByRole("button", { name: /^Read(?: & edit)?$/ }), "Read the installed skill")
  const dialog = film.page.locator("dialog.orchestra-skills-dialog[open]")
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input[name="name"]')).toHaveValue(name)
  const instructions = dialog.locator('textarea[name="instructions"]')
  await expect(instructions).not.toHaveValue("")
  const content = await instructions.inputValue()
  await film.focus(instructions, "Inspect real instructions and source")
  film.proof({ kind: "actual-skill-read", name, instructionSha256: digest(content), characters: content.length,
    sourceExplanation: (await dialog.innerText()).slice(0, 1500).replaceAll(film.installed.root, "[installation]"),
    readOnly: await instructions.getAttribute("readonly") !== null, edited: false })
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
function safeBody(value: string, film: Film) {
  return value.replaceAll(film.installed.root, "[installation]").replaceAll(film.installed.serverPassword, "[credential]")
    .replace(/(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "[authorization removed]")
    .replace(/((?:api[_-]?key|token|password|authorization)\s*[=:]\s*)[^\s,;]+/gi, "$1[removed]")
    .slice(0, 1500)
}
