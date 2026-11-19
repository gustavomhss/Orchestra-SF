# WP10 native4 original diagnostics

Original run 44626345242. Artifact 14580111530. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

## Original WP10 composition facts

{
  "stage": "authenticate-existing-operator",
  "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoBeVisible\u001b[2m(\u001b[22m\u001b[2m)\u001b[22m failed\n\nLocator: locator('[data-sf-surface=\"CAP01\"]')\nExpected: visible\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toBeVisible\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for locator('[data-sf-surface=\"CAP01\"]')\u001b[22m\n",
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
  "http": [],
  "browserEvents": [
    {
      "kind": "error",
      "message": "Failed to load resource: the server responded with a status of 400 (Bad Request)"
    }
  ]
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
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-surface="CAP01"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-surface="CAP01"]')

```


