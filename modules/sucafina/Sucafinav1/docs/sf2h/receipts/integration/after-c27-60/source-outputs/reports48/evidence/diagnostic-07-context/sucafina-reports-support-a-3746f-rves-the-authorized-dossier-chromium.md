# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/reports-support/agenda-transport.spec.ts >> CI-UI-REPORTS · agenda transport diagnosis >> RPT-DIAG-AGENDA-01 observes actual agenda transport and preserves the authorized dossier
- Location: e2e/sucafina/reports-support/agenda-transport.spec.ts:11:3

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: Actual review-agenda POST transport failed: net::ERR_CONNECTION_REFUSED
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#content"
  - complementary [ref=e3]:
    - generic [ref=e4]:
      - strong [ref=e5]: Sucafina
      - generic [ref=e6]: Review and reports
    - navigation "Review and reports" [ref=e7]:
      - link "Dashboard" [ref=e8] [cursor=pointer]:
        - /url: /sucafina/dashboard
  - generic [ref=e9]:
    - banner [ref=e10]:
      - generic [ref=e11]: Sucafina workspace
      - navigation "Applications" [ref=e12]:
        - link "Dashboard" [ref=e13] [cursor=pointer]:
          - /url: ./dashboard
        - link "Budget Planner" [ref=e14] [cursor=pointer]:
          - /url: ./planner
        - link "Procurement" [ref=e15] [cursor=pointer]:
          - /url: ./procurement
      - generic [ref=e16]:
        - button "Refresh data" [ref=e17] [cursor=pointer]
        - button "Sign out" [ref=e18] [cursor=pointer]
    - paragraph [ref=e19]: Period and version filters apply to this application only.
    - main [ref=e20]:
      - heading "Review and reports" [level=1] [ref=e21]
      - region "Prepare review" [ref=e23]:
        - heading "Prepare review" [level=2] [ref=e24]
        - status [ref=e25]: "Selection unavailable: agenda-unavailable. Captured content is hidden until access is checked again."
        - button "Load selection" [ref=e26] [cursor=pointer]
```

# Test source

```ts
  291 | 
  292 | export async function followBudgetSource(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus) {
  293 |   const sections = saved.sections.filter((section) => section.title === "Budget")
  294 |   expect(sections).toHaveLength(1)
  295 |   const forecast = projection(sections[0]!.content).values.filter((value) => value.id === corpus.forecastField)
  296 |   expect(forecast).toHaveLength(1)
  297 |   expect(forecast[0]!.sourceRefs).toHaveLength(1)
  298 |   const reference = forecast[0]!.sourceRefs[0]!
  299 |   expect(reference).toMatchObject({ kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: "Budget Overview", period: corpus.annual } })
  300 |   const navigation = page.getByRole("list", { name: "Preserved source navigation", exact: true })
  301 |   const link = navigation.getByRole("button", { name: `Open source ${reference.refId}`, exact: true })
  302 |   await expect(link, "The installed meeting must use the existing authorized source resolver").toBeEnabled()
  303 |   const read = page.waitForResponse(responseFor(app.dashboardURL, "review-read", "GET"))
  304 |   const resolution = page.waitForResponse(responseFor(app.dashboardURL, "review-source", "GET"))
  305 |   await link.click()
  306 |   expect(object(await (await read).json()).value).toEqual(saved)
  307 |   const resolved = await resolution
  308 |   expect(resolved.status()).toBe(200)
  309 |   expect(resolved.headers()["cache-control"]).toBe("no-store")
  310 |   const links = object(await resolved.json()).links
  311 |   expect(Array.isArray(links)).toBe(true)
  312 |   expect(links).toHaveLength(1)
  313 |   const authorized = object((links as unknown[])[0])
  314 |   const destination = new URL(text(authorized.url), app.dashboardURL)
  315 |   expect(destination.origin).toBe(app.origin)
  316 |   expect(destination.pathname).toBe(new URL(app.dashboardURL).pathname)
  317 |   expect(destination.searchParams.get("page")).toBe("Budget Overview")
  318 |   expect(destination.searchParams.get("year")).toBe(String(corpus.year))
  319 |   // The host offers the producer-authorized destination for an explicit choice.
  320 |   // Opening the evidence button alone does not navigate away from the review.
  321 |   const sources = page.getByRole("navigation", { name: "Origens autorizadas da revisão", exact: true })
  322 |   const open = sources.getByRole("link", { name: text(authorized.label), exact: true })
  323 |   await expect(open).toHaveCount(1)
  324 |   await expect(open).toHaveAttribute("href", destination.toString())
  325 |   await open.click()
  326 |   await expect(page).toHaveURL(destination.toString())
  327 |   await expect(page.locator("#content").getByRole("heading", { name: "Budget Overview", exact: true })).toBeVisible()
  328 |   const target = new URL(page.url())
  329 |   expect(target.origin).toBe(app.origin)
  330 |   expect(target.pathname).toBe(new URL(app.dashboardURL).pathname)
  331 |   expect(target.searchParams.get("page")).toBe("Budget Overview")
  332 |   expect(target.searchParams.get("year")).toBe(String(corpus.year))
  333 |   await expect(page.locator("article.metric").filter({ has: page.getByText("Known forecast — 12 months", { exact: true }) }).locator("strong"))
  334 |     .toHaveText(`$${corpus.after}`)
  335 |   expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
  336 | }
  337 | 
  338 | /** Observe transport only: never serialize headers, bodies, cookies or query values. */
  339 | function observeAgendaTransport(page: Page, app: ReportsInstallation) {
  340 |   const expected = new URL(app.dashboardURL)
  341 |   const started = Date.now()
  342 |   const entries: Record<string, unknown>[] = []
  343 |   let dropped = 0
  344 |   const add = (kind: string, value: Record<string, unknown>) => {
  345 |     if (entries.length >= 40) { dropped += 1; return }
  346 |     entries.push({ kind, elapsedMs: Date.now() - started, ...value })
  347 |   }
  348 |   const destination = (raw: string) => {
  349 |     try {
  350 |       const url = new URL(raw)
  351 |       const mode = url.searchParams.get("sf")
  352 |       return {
  353 |         sameOrigin: url.origin === expected.origin,
  354 |         samePath: url.pathname === expected.pathname,
  355 |         route: url.pathname === expected.pathname ? "dashboard" :
  356 |           /\/auth\/(?:login|logout|local)$/.test(url.pathname) ? "authentication" : "other",
  357 |         mode: mode && mode.length <= 64 && /^review(?:-[a-z]+)*$/.test(mode) ? mode : mode === null ? "absent" : "other",
  358 |       }
  359 |     } catch { return { sameOrigin: false, samePath: false, route: "invalid", mode: "other" } }
  360 |   }
  361 |   const matching = (request: Request) => {
  362 |     const route = destination(request.url())
  363 |     return route.sameOrigin && route.samePath && route.mode === "review-agenda" && request.method() === "POST"
  364 |   }
  365 |   const relevant = (request: Request) => request.method() === "POST" || destination(request.url()).mode.startsWith("review")
  366 |   const causes = (value: string) => ({
  367 |     codes: [...new Set(value.match(/\b(?:net::)?ERR_[A-Z0-9_]+\b/g) ?? [])].slice(0, 5).map((code) => code.slice(0, 80)),
  368 |     categories: [
  369 |       /content security policy|CSP|connect-src|default-src/i.test(value) ? "content-security-policy" : undefined,
  370 |       /CORS|cross-origin/i.test(value) ? "cross-origin" : undefined,
  371 |       /mixed content/i.test(value) ? "mixed-content" : undefined,
  372 |       /failed to fetch|NetworkError|load failed/i.test(value) ? "network-failure" : undefined,
  373 |       /abort/i.test(value) ? "aborted" : undefined,
  374 |       /timeout|timed out/i.test(value) ? "timeout" : undefined,
  375 |     ].filter((entry): entry is string => entry !== undefined),
  376 |   })
  377 |   let rejectFailure!: (error: Error) => void
  378 |   const failed = new Promise<never>((_resolve, reject) => { rejectFailure = reject })
  379 |   // The original response waiter remains the success oracle. This branch only
  380 |   // rejects sooner when its exact request has an observed transport failure.
  381 |   void failed.catch(() => undefined)
  382 |   const request = (value: Request) => {
  383 |     if (relevant(value)) add("request", { ...destination(value.url()), method: value.method(), resource: value.resourceType() })
  384 |   }
  385 |   const response = (value: Response) => {
  386 |     if (relevant(value.request())) add("response", { ...destination(value.url()), method: value.request().method(), status: value.status() })
  387 |   }
  388 |   const requestfailed = (value: Request) => {
  389 |     const failure = causes(value.failure()?.errorText ?? "")
  390 |     if (relevant(value)) add("requestfailed", { ...destination(value.url()), method: value.method(), ...failure })
> 391 |     if (matching(value)) rejectFailure(new Error("Actual review-agenda POST transport failed: " +
      |                                        ^ Error: Actual review-agenda POST transport failed: net::ERR_CONNECTION_REFUSED
  392 |       [...failure.codes, ...failure.categories].join(", ")))
  393 |   }
  394 |   const pageerror = (value: Error) => add("pageerror", {
  395 |     name: value.name.length <= 40 && /^[A-Za-z]*Error$/.test(value.name) ? value.name : "Error", ...causes(value.message),
  396 |   })
  397 |   const consoleEvent = (value: ConsoleMessage) => {
  398 |     if (value.type() === "error" || value.type() === "warning") add("console", { type: value.type(), ...causes(value.text()) })
  399 |   }
  400 |   const before = destination(page.url())
  401 |   page.on("request", request); page.on("response", response); page.on("requestfailed", requestfailed)
  402 |   page.on("pageerror", pageerror); page.on("console", consoleEvent)
  403 |   return {
  404 |     failed,
  405 |     finish: async (info: TestInfo) => {
  406 |       page.off("request", request); page.off("response", response); page.off("requestfailed", requestfailed)
  407 |       page.off("pageerror", pageerror); page.off("console", consoleEvent)
  408 |       await info.attach("reports-agenda-transport", { contentType: "application/json", body: JSON.stringify({
  409 |         before, after: destination(page.url()), expected: { method: "POST", mode: "review-agenda" },
  410 |         elapsedMs: Date.now() - started, entries, dropped, cli: app.diagnostics?.() ?? "diagnostics-unavailable",
  411 |       }, null, 2) }).catch(() => undefined)
  412 |     },
  413 |   }
  414 | }
  415 | 
```