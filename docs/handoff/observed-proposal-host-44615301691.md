# Proposal gate5 original inline attachments

Read-only source run44615301691, artifact14574791796. No rerun.

Original error-context DOM sections: 0

Embedded zip payloads: 1

## Embedded report members
a35773be41704aae0faa.json
report.json

## Original attachment: proposal-host.log

[21:10:14.462] WARN (#822): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[21:10:14.979] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[21:10:14.986] INFO (#1031): project copy refresh started {
  projectID: "[redacted-hex]",
}
[21:10:14.994] INFO (#1031): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[21:10:15.253] INFO (#824): watcher backend {
  directory: "/tmp/sf-proposal-native-QNmFjF",
  platform: "linux",
  backend: "inotify",
}
[21:10:15.284] INFO (#1046): project copy refresh started {
  projectID: "global",
}
[21:10:15.285] INFO (#1046): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[21:10:15.438] INFO (#1301): all LSPs are disabled
[21:10:15.495] INFO (#2216): all LSPs are disabled
[21:10:15.562] INFO (#824): booting location services {
  directory: "/tmp/sf-proposal-native-QNmFjF",
  workspaceID: undefined,
}
[21:10:16.014] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[21:10:17.368] WARN (#2991): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/d1d37553dc716adda20e5d7913bd1c34794410a6.md'}

## Original reported error

Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })


  61 |   expect(discovered.status()).toBe(200)
  62 |   expect(object(proposalResponseBody(discovered)).status).toBe("ok")
> 63 |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
     |                                                                ^
  64 |   return written.request().postDataJSON() as Record<string, unknown>
  65 | }
  66 | function onlyDraft(observation: ProposalObservation) {
    at saveDraft (/home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:63:64)
    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:131:9

## Original attachment: proposal-host.log

[21:10:43.402] WARN (#822): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[21:10:43.944] INFO (#591): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[21:10:43.949] INFO (#1031): project copy refresh started {
  projectID: "[redacted-hex]",
}
[21:10:43.951] INFO (#1031): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[21:10:44.284] INFO (#824): watcher backend {
  directory: "/tmp/sf-proposal-native-S7pmKW",
  platform: "linux",
  backend: "inotify",
}
[21:10:44.318] INFO (#1046): project copy refresh started {
  projectID: "global",
}
[21:10:44.320] INFO (#1046): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[21:10:44.484] INFO (#1301): all LSPs are disabled
[21:10:44.546] INFO (#2216): all LSPs are disabled
[21:10:44.641] INFO (#824): booting location services {
  directory: "/tmp/sf-proposal-native-S7pmKW",
  workspaceID: undefined,
}
[21:10:45.348] INFO (#591): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[21:10:46.367] WARN (#3014): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/efc878d3b280ad714f5c8bea6572c396cb5746b6.md'}

## Original reported error

Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })


  265 |         ])
  266 |         expect(retried.status()).toBe(200)
> 267 |         await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
      |                                                                         ^
  268 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeEnabled()
  269 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
  270 |
    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:267:73

## Original attachment: proposal-host.log

[21:11:12.550] WARN (#822): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[21:11:13.012] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[21:11:13.023] INFO (#1028): project copy refresh started {
  projectID: "[redacted-hex]",
}
[21:11:13.029] INFO (#1028): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[21:11:13.289] INFO (#824): watcher backend {
  directory: "/tmp/sf-proposal-native-jy80Ln",
  platform: "linux",
  backend: "inotify",
}
[21:11:13.291] INFO (#1046): project copy refresh started {
  projectID: "global",
}
[21:11:13.292] INFO (#1046): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[21:11:13.580] INFO (#1304): all LSPs are disabled
[21:11:13.587] INFO (#1814): all LSPs are disabled
[21:11:13.726] INFO (#824): booting location services {
  directory: "/tmp/sf-proposal-native-jy80Ln",
  workspaceID: undefined,
}
[21:11:14.556] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[21:11:15.536] WARN (#3016): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/af788dd7fe9cd98f667ade3c5e8445fed88fde10.md'}

## Original reported error

Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })


  386 |         ])
  387 |         expect(read.status()).toBe(200)
> 388 |         await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
      |                                                                         ^
  389 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  390 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Unsaved operator wording")
  391 |         const preservedRecord = await context.newPage()
    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:388:73

## Original attachment: proposal-host.log

[21:11:40.427] WARN (#822): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[21:11:40.927] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[21:11:41.115] INFO (#1031): project copy refresh started {
  projectID: "[redacted-hex]",
}
[21:11:41.117] INFO (#1031): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[21:11:41.120] INFO (#824): watcher backend {
  directory: "/tmp/sf-proposal-native-HcVa8P",
  platform: "linux",
  backend: "inotify",
}
[21:11:41.123] INFO (#1043): project copy refresh started {
  projectID: "global",
}
[21:11:41.123] INFO (#1043): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[21:11:41.283] INFO (#1298): all LSPs are disabled
[21:11:41.371] INFO (#2216): all LSPs are disabled
[21:11:41.430] INFO (#824): booting location services {
  directory: "/tmp/sf-proposal-native-HcVa8P",
  workspaceID: undefined,
}
[21:11:41.960] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[21:11:43.190] WARN (#2991): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/de41547f6311ebd5b9b655e437860069b5c0272f.md'}

## Original reported error

Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })


  61 |   expect(discovered.status()).toBe(200)
  62 |   expect(object(proposalResponseBody(discovered)).status).toBe("ok")
> 63 |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
     |                                                                ^
  64 |   return written.request().postDataJSON() as Record<string, unknown>
  65 | }
  66 | function onlyDraft(observation: ProposalObservation) {
    at saveDraft (/home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:63:64)
    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:425:9

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/5821597db0b756579bead31c2e66a80844bddbf4.md'}

## Original reported error

Error: "route.fetch: Target page, context or browser has been closed
Call log:
  - → POST http://127.0.0.1:3000/sucafina/dashboard?sf=dashboard-workbench
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36
    - accept: application/json
    - accept-encoding: gzip,deflate,br
    - accept-language: en-US
    - content-type: application/json
    - origin: http://127.0.0.1:3000
    - referer: http://127.0.0.1:3000/orchestra/sf-dashboard/hot-topics/r_dG9waWM?year=2026
    - sec-ch-ua: "HeadlessChrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"
    - sec-ch-ua-mobile: ?0
    - sec-ch-ua-platform: "Windows"
    - content-length: 82
" while running route callback.
Consider awaiting `await page.unrouteAll({ behavior: 'ignoreErrors' })`
before the end of the test to ignore remaining routes in flight.

   at sucafina/proposals-support/installation.ts:113

  111 |     (url.pathname === "/sucafina/dashboard" && modes.has(url.searchParams.get("sf") ?? "") ||
  112 |       url.pathname === "/sucafina/api/ui/projections/review"), async (route) => {
> 113 |     const original = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      |                                  ^
  114 |     await retainProposalResponse(route, original)
  115 |     await route.fulfill({ response: original })
  116 |   })
    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/proposals-support/installation.ts:113:34

## Original attachment: proposal-host.log

{'name': 'proposal-host.log', 'contentType': 'text/plain'}

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/d1d37553dc716adda20e5d7913bd1c34794410a6.md'}

## Original attachment: proposal-host.log

{'name': 'proposal-host.log', 'contentType': 'text/plain'}

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/efc878d3b280ad714f5c8bea6572c396cb5746b6.md'}

## Original attachment: proposal-host.log

{'name': 'proposal-host.log', 'contentType': 'text/plain'}

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/af788dd7fe9cd98f667ade3c5e8445fed88fde10.md'}

## Original attachment: proposal-host.log

{'name': 'proposal-host.log', 'contentType': 'text/plain'}

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/de41547f6311ebd5b9b655e437860069b5c0272f.md'}

## Original attachment: error-context

{'name': 'error-context', 'contentType': 'text/markdown', 'path': 'data/5821597db0b756579bead31c2e66a80844bddbf4.md'}

