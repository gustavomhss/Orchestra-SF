# BI7 original diagnostics

Original run 44623291504. Artifact 14578773040. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

## Original attachment bi62-regression-canonical-setup.json

[
  {
    "stage": "planner-command-response",
    "page": "Versions",
    "action": "save",
    "version": "0",
    "httpStatus": 200,
    "contentType": "application/json; charset=utf-8"
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/pages/CAP23",
    "queryKeys": []
  },
  {
    "stage": "planner-command",
    "action": "save",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-response",
    "path": "/sucafina/api/ui/pages/CAP23",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-request",
    "path": "/api/sucafina/installations",
    "queryKeys": [
      "installationId",
      "projectId",
      "select"
    ]
  },
  {
    "stage": "planner-admission-response",
    "path": "/api/sucafina/installations",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/context",
    "queryKeys": [
      "hostId",
      "installationId",
      "projectId"
    ]
  },
  {
    "stage": "planner-admission-response",
    "path": "/sucafina/api/ui/context",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/pages/CAP23",
    "queryKeys": [
      "year"
    ]
  },
  {
    "stage": "planner-admission-response",
    "path": "/sucafina/api/ui/pages/CAP23",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-request",
    "path": "/api/sucafina/installations",
    "queryKeys": [
      "installationId",
      "projectId",
      "select"
    ]
  },
  {
    "stage": "planner-admission-response",
    "path": "/api/sucafina/installations",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/context",
    "queryKeys": [
      "hostId",
      "installationId",
      "projectId"
    ]
  },
  {
    "stage": "planner-admission-response",
    "path": "/sucafina/api/ui/context",
    "httpStatus": 200
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/pages/CAP23",
    "queryKeys": [
      "year"
    ]
  },
  {
    "stage": "planner-admission-response",
    "path": "/sucafina/api/ui/pages/CAP23",
    "httpStatus": 200
  },
  {
    "stage": "planner-authorized-created-record",
    "action": "save",
    "year": 2027
  },
  {
    "stage": "planner-command-response",
    "page": "Versions",
    "action": "save",
    "version": "1",
    "httpStatus": 200,
    "contentType": "application/json; charset=utf-8"
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/pages/CAP23",
    "queryKeys": [
      "year"
    ]
  },
  {
    "stage": "planner-command",
    "action": "save",
    "httpStatus": 200
  },
  {
    "stage": "planner-command-response",
    "page": "OPEX",
    "action": "save",
    "version": "0",
    "httpStatus": 200,
    "contentType": "application/json; charset=utf-8"
  },
  {
    "stage": "planner-command-request-failed",
    "page": "OPEX",
    "action": "save",
    "version": "0",
    "failure": "net::ERR_ABORTED"
  },
  {
    "stage": "planner-command-unconfirmed",
    "page": "OPEX",
    "action": "save",
    "version": "0",
    "outcome": "request-failed",
    "retried": false
  },
  {
    "stage": "planner-terminal-route",
    "path": "/orchestra/sf-planner/opex",
    "queryKeys": [
      "version",
      "year"
    ],
    "year": "2027",
    "ownerTriplet": false,
    "f01": [
      {
        "discovery": "ready",
        "provider": "ready",
        "reason": null,
        "view": "ready"
      }
    ],
    "count": 1
  },
  {
    "stage": "planner-terminal-response",
    "originalOk": true
  }
]

## Original attachment bi62-installed-observations.json

[
  {
    "stage": "planner-command-response",
    "page": "Versions",
    "action": "save",
    "version": "0",
    "httpStatus": 200,
    "contentType": "application/json; charset=utf-8"
  },
  {
    "stage": "planner-command-request-failed",
    "page": "Versions",
    "action": "save",
    "version": "0",
    "failure": "net::ERR_ABORTED"
  },
  {
    "stage": "planner-admission-request",
    "path": "/sucafina/api/ui/pages/CAP23",
    "queryKeys": []
  },
  {
    "stage": "planner-command-unconfirmed",
    "page": "Versions",
    "action": "save",
    "version": "0",
    "outcome": "request-failed",
    "retried": false
  },
  {
    "stage": "planner-terminal-route",
    "path": "/orchestra/sf-planner/versions/new",
    "queryKeys": [],
    "ownerTriplet": false,
    "f01": [
      {
        "discovery": "ready",
        "provider": "ready",
        "reason": null,
        "view": "ready"
      }
    ],
    "count": 1
  },
  {
    "stage": "planner-terminal-response",
    "originalOk": true
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
Error: Planner OPEX/save was not confirmed (net::ERR_ABORTED); the command was not resent.
```


