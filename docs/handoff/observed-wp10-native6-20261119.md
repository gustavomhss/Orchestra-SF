# WP10 native6 original diagnostics

Original run 44630493615. Artifact 14582460843. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

## Original WP10 composition facts

{
  "stage": "authenticate-existing-operator",
  "failure": "page.waitForResponse: Timeout 30000ms exceeded while waiting for event \"response\"",
  "observations": [
    {
      "flow": "dashboard-budget",
      "outcome": "not-reached",
      "failure": null,
      "screenshots": [],
      "facts": {}
    },
    {
      "flow": "workbench-create-reopen",
      "outcome": "not-reached",
      "failure": null,
      "screenshots": [],
      "facts": {}
    },
    {
      "flow": "procurement-requests",
      "outcome": "not-reached",
      "failure": null,
      "screenshots": [],
      "facts": {}
    },
    {
      "flow": "bi-table",
      "outcome": "not-reached",
      "failure": null,
      "screenshots": [],
      "facts": {}
    },
    {
      "flow": "extended-ui",
      "outcome": "not-reached",
      "failure": null,
      "screenshots": [],
      "facts": {}
    },
    {
      "flow": "bi-revocation",
      "outcome": "not-reached",
      "failure": null,
      "screenshots": [],
      "facts": {}
    }
  ],
  "http": [
    {
      "method": "GET",
      "route": "/orchestra/sf-dashboard/executive",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/api/ui/context",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/api/ui/context",
      "status": 200
    }
  ],
  "browserEvents": []
}

## wp4 / packages/app-shell/e2e/test-results/sucafina-wp10-composition--44d22-rough-the-real-installation-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/wp10/composition.spec.ts >> WP10 composes Dashboard, persisted Workbench decisions, Requests and BI through the real installation
- Location: e2e/sucafina/wp10/composition.spec.ts:35:1

# Error details

```
Error: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"
```


