# WP4 native3 original diagnostics

Original run 44620053356. Artifact 14575944394. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

## Original WP10 composition facts

{
  "stage": "bi-table",
  "failure": "All fibers interrupted without error",
  "observations": [
    {
      "flow": "dashboard-budget",
      "outcome": "failed",
      "failure": "page.waitForResponse: Timeout 30000ms exceeded while waiting for event \"response\"",
      "screenshots": [
        "dashboard-budget-failed.png"
      ],
      "facts": {
        "renderedRoute": "/orchestra/sf-dashboard/budget?year=2026"
      },
      "layout": {
        "viewport": {
          "width": 1440,
          "height": 900
        },
        "document": {
          "width": 1440,
          "scrollWidth": 1440
        },
        "main": {
          "width": 1166,
          "scrollWidth": 1166
        }
      }
    },
    {
      "flow": "workbench-create-reopen",
      "outcome": "failed",
      "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoBeEnabled\u001b[2m(\u001b[22m\u001b[2m)\u001b[22m failed\n\nLocator: getByRole('button', { name: 'Sign out', exact: true })\nExpected: enabled\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toBeEnabled\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for getByRole('button', { name: 'Sign out', exact: true })\u001b[22m\n",
      "screenshots": [
        "workbench-create-reopen-failed.png"
      ],
      "facts": {
        "renderedRoute": "/orchestra/sf-decisions"
      },
      "layout": {
        "viewport": {
          "width": 1440,
          "height": 900
        },
        "document": {
          "width": 1440,
          "scrollWidth": 1440
        },
        "main": {
          "width": 1166,
          "scrollWidth": 1166
        }
      }
    },
    {
      "flow": "procurement-requests",
      "outcome": "failed",
      "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoContainText\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m failed\n\nLocator: locator('.sf-u12-root').locator('p[data-request-summary=\"synthetic-po-1\"]')\nExpected substring: \u001b[32m\"WP00 sourcing comparison\"\u001b[39m\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toContainText\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for locator('.sf-u12-root').locator('p[data-request-summary=\"synthetic-po-1\"]')\u001b[22m\n",
      "screenshots": [
        "procurement-requests-failed.png"
      ],
      "facts": {
        "openHttp": 200,
        "contextHttp": 200,
        "contextStatus": "ok",
        "cap25Destinations": "[{\"capabilityId\":\"CAP25\",\"canRead\":true,\"allowedActionIds\":[\"create\",\"save\",\"submit_sourcing\",\"select_quote\",\"cancel\"]}]",
        "cap25Availability": "[{\"family\":\"procurement\",\"resource\":\"CAP25\",\"state\":\"partial\",\"operations\":[{\"operationId\":\"domain.command.CAP25.approve\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"domain.command.CAP25.cancel\",\"state\":\"ready\",\"reason\":null,\"operational\":true},{\"operationId\":\"domain.command.CAP25.create\",\"state\":\"ready\",\"reason\":null,\"operational\":true},{\"operationId\":\"domain.command.CAP25.delete\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"domain.command.CAP25.issue\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"domain.command.CAP25.reject\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"domain.command.CAP25.save\",\"state\":\"ready\",\"reason\":null,\"operational\":true},{\"operationId\":\"domain.command.CAP25.select_quote\",\"state\":\"ready\",\"reason\":null,\"operational\":true},{\"operationId\":\"domain.command.CAP25.submit_po\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"domain.command.CAP25.submit_pr\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"domain.command.CAP25.submit_sourcing\",\"state\":\"ready\",\"reason\":null,\"operational\":true},{\"operationId\":\"domain.page.CAP25\",\"state\":\"ready\",\"reason\":null,\"operational\":true},{\"operationId\":\"procurement.procurement-scenario-controls\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"procurement.procurement-scenario-preview\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false},{\"operationId\":\"procurement.sourcing.prepare\",\"state\":\"unavailable\",\"reason\":\"operational-source-unavailable\",\"operational\":false}]}]",
        "renderedRoute": "/orchestra/sf-procurement/requests/:ref/sourcing/compare"
      },
      "layout": {
        "viewport": {
          "width": 1440,
          "height": 900
        },
        "document": {
          "width": 1440,
          "scrollWidth": 1440
        },
        "main": {
          "width": 1166,
          "scrollWidth": 1166
        }
      }
    },
    {
      "flow": "bi-table",
      "outcome": "failed",
      "failure": "Target page, context or browser has been closed",
      "screenshots": [],
      "facts": {
        "evidenceFailure": "Browser closed before its evidence could be captured"
      }
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
      "route": "/orchestra/sf-dashboard/budget?year=2026",
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
    },
    {
      "method": "GET",
      "route": "/orchestra/sf-decisions",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/orchestra/sf-procurement/requests/:ref/sourcing/compare",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/api/ui/context",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/orchestra/sf-bi/:ref",
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
    },
    {
      "method": "GET",
      "route": "/sucafina/dashboard?sf=bi-options&viewId=BI01&start=2027-01-01&end=2027-12-31",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/dashboard?sf=bi-data&viewId=BI01&start=2027-01-01&end=2027-12-31",
      "status": 200
    }
  ],
  "browserEvents": [
    {
      "kind": "requestfailed",
      "message": "GET /sucafina/api/ui/context: net::ERR_ABORTED"
    },
    {
      "kind": "requestfailed",
      "message": "GET /sucafina/dashboard?sf=bi-data&viewId=BI01&start=2027-01-01&end=2027-12-31: net::ERR_ABORTED"
    }
  ]
}

## wp4 / packages/app-shell/e2e/test-results/sucafina-wp03-planner-moun-120b4-d-official-version-controls-chromium/error-context.md

- main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region "OPEX" [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]:
                  - generic [ref=e247]: ⁨sf-wp03-browser-Id6mXZ⁩ · OPEX
                  - heading "OPEX" [level=1] [ref=e248]
                - button "Review changes" [disabled] [ref=e251]
              - generic [ref=e252]:
                - generic [ref=e253]:
                  - generic [ref=e254]:
                    - term [ref=e255]: Year
                    - definition [ref=e256]: "2027"
                  - generic [ref=e257]:
                    - term [ref=e258]: Version
                    - definition [ref=e259]: WP03 Browser Plan
                - generic [ref=e260]:
                  - region "The response was lost. Check the outcome before trying again." [ref=e261]:
                    - status [ref=e262]:
                      - paragraph [ref=e263]: The response was lost. Check the outcome before trying again.
                      - button "Checking the outcome…" [ref=e265] [cursor=pointer]
                  - status [ref=e266]: The response was lost. Check the outcome before trying again.
  - generic:
    - region "Notifications alt+T"
```

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
Error: All fibers interrupted without error
```


