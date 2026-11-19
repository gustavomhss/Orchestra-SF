# BI6 original diagnostics

Original run 44620048170. Artifact 14577067308. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

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


