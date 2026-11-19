# BI6 original diagnostics

Original run 44620048170. Artifact 14577067308. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

## Original artifact members

test-ci-evidence/benchmark-runtime.json
test-ci-evidence/playwright-selection.json
test-ci-evidence/playwright-runtime.json
test-ci-evidence/request.json
packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-86b20-urces-and-current-authority-chromium/error-context.md
packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-86b20-urces-and-current-authority-chromium/test-failed-1.png
packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-b2bc6-e-crop-across-a-real-reload-chromium/error-context.md
packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-b2bc6-e-crop-across-a-real-reload-chromium/test-failed-1.png
packages/app-shell/e2e/playwright-report/data/4bae113552c36437487dab874b98eefac2568af6.md
packages/app-shell/e2e/playwright-report/data/c288c4ed6eb5f689914017f7daec9d2c16d5abc0.png
packages/app-shell/e2e/playwright-report/data/e626bcfff46accdbda3176671cb9b5cdbb13774d.png
packages/app-shell/e2e/playwright-report/data/f7c0869306eebe3d67453ae6b4c556f985e5f29d.md
packages/app-shell/e2e/playwright-report/index.html

## Original attachment bi62-regression-canonical-setup.json

[
  {
    "stage": "planner-command-response",
    "page": "Versions",
    "action": "save",
    "record": "",
    "version": "0",
    "httpStatus": 200,
    "contentType": "application/json; charset=utf-8"
  },
  {
    "stage": "planner-command-request-failed",
    "page": "Versions",
    "action": "save",
    "record": "",
    "version": "0",
    "failure": "net::ERR_ABORTED"
  },
  {
    "stage": "planner-command-unconfirmed",
    "page": "Versions",
    "action": "save",
    "record": "",
    "version": "0",
    "outcome": "request-failed",
    "retried": false
  }
]

## Original attachment bi62-installed-observations.json

[
  {
    "stage": "planner-command-response",
    "page": "Versions",
    "action": "save",
    "record": "",
    "version": "0",
    "httpStatus": 200,
    "contentType": "application/json; charset=utf-8"
  },
  {
    "stage": "planner-command-request-failed",
    "page": "Versions",
    "action": "save",
    "record": "",
    "version": "0",
    "failure": "net::ERR_ABORTED"
  },
  {
    "stage": "planner-command-unconfirmed",
    "page": "Versions",
    "action": "save",
    "record": "",
    "version": "0",
    "outcome": "request-failed",
    "retried": false
  }
]

## bi / packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-86b20-urces-and-current-authority-chromium/error-context.md

- main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - status [ref=e242]: Sucafina route not admitted
  - generic:
    - region "Notifications alt+T"
```


## bi / packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-b2bc6-e-crop-across-a-real-reload-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/bi-installed/installed-bi-regressions.spec.ts >> BI62 native chapter preserves the human date crop across a real reload
- Location: e2e/sucafina/bi-installed/installed-bi-regressions.spec.ts:42:1

# Error details

```
Error: Planner Versions/save was not confirmed (net::ERR_ABORTED); the command was not resent.
```


