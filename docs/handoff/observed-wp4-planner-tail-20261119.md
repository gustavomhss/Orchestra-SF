# WP4 diagnostics from the original Actions artifact

Original run 44602654358; artifact 14569559143. No test rerun. Only bounded failure text, visible page snapshot and fixed observer fields are retained. No headers, authentication material or request/response bodies.

## packages/app-shell/e2e/test-results/sucafina-wp03-planner-moun-120b4-d-official-version-controls-chromium/error-context.md

                  - heading "OPEX" [level=1] [ref=e248]
                - button "Review changes" [disabled] [ref=e251]
                      - combobox "Version" [ref=e266]:
                      - combobox "Closed through" [ref=e269]:
                    - button "Review changes" [ref=e270] [cursor=pointer]
                    - heading "Monthly plan" [level=2] [ref=e272]
                          - rowheader "WP03 License A" [ref=e293]
                          - rowheader "USD" [ref=e294]
                          - rowheader "WP03 License B" [ref=e512]
                          - rowheader "USD" [ref=e513]
                        - heading "Paste monthly values" [level=3] [ref=e731]
                        - textbox "Paste tab-separated values" [ref=e734]
                        - button "Review pasted values" [ref=e735] [cursor=pointer]
                    - heading "Lines" [level=2] [ref=e737]
                          - row "WP03 License A macos:229ea7cd-dea1-4b86-897c-0e6595091d53:1001 licenses USD 1200 8d08866b-1a3a-4a46-91ac-f9ab559a1a3a Manage" [ref=e750]:
                            - cell "WP03 License A" [ref=e751]
                          - row "WP03 License B macos:229ea7cd-dea1-4b86-897c-0e6595091d53:1001 licenses USD 2400 14ef5d63-4521-4483-80e0-320e5b3920b5 Manage" [ref=e760]:
                            - cell "WP03 License B" [ref=e761]
                      - textbox "Name" [ref=e772]
                      - combobox "Owner" [ref=e774]:
                      - combobox "Element" [ref=e776]:
                      - combobox "Currency" [ref=e778]:
                      - textbox "Annual budget" [ref=e780]
                    - button "Save" [ref=e781] [cursor=pointer]
                    - heading "Elements and structure" [level=2] [ref=e783]
                        - button "Review changes" [ref=e787] [cursor=pointer]
                        - button "Review changes" [ref=e790] [cursor=pointer]
                        - button "Review changes" [ref=e793] [cursor=pointer]
                        - button "Review changes" [ref=e796] [cursor=pointer]
                        - button "Review changes" [ref=e799] [cursor=pointer]
                        - button "Review changes" [ref=e802] [cursor=pointer]
                        - button "Review changes" [ref=e805] [cursor=pointer]

## packages/app-shell/e2e/test-results/sucafina-wp10-composition--44d22-rough-the-real-installation-chromium/error-context.md



JSON files inspected: 4
WP10 observers found: 1

## test-ci-evidence/playwright-runtime.json named attachment

{
  "schema": "wp10-real-composition-v1",
  "executedSnapshotCommit": "9f766ac329f50589dc348ae1a75fdb169a894a10",
  "productCommit": "15388053117883174329454207e60e2a878f5426",
  "workflowRunId": "44602654358",
  "workflowRunAttempt": "1",
  "startedAt": "2026-11-19T20:02:23.159Z",
  "stage": "extended-ui",
  "authenticated": true,
  "serverExitCode": null,
  "failure": "All fibers interrupted without error",
  "observations": [
    {
      "flow": "dashboard-budget",
      "outcome": "failed",
      "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoHaveValue\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m failed\n\nLocator: locator('[data-sf-surface=\"CAP03\"]').getByLabel('Year', { exact: true })\nExpected: \u001b[32m\"2026\"\u001b[39m\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toHaveValue\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for locator('[data-sf-surface=\"CAP03\"]').getByLabel('Year', { exact: true })\u001b[22m"
    },
    {
      "flow": "workbench-create-reopen",
      "outcome": "failed",
      "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoHaveCount\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m failed\n\nLocator:  locator('.sf-n24-create')\nExpected: \u001b[32m1\u001b[39m\nReceived: \u001b[31m0\u001b[39m\nTimeout:  10000ms\n\nCall log:\n\u001b[2m  - Expect \"toHaveCount\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for locator('.sf-n24-create')\u001b[22m\n\u001b[2m    14 × locator resolved to 0 elements\u001b[22m\n\u001b[2m       - unexpected value \"0\"\u001b[22m"
    },
    {
      "flow": "procurement-requests",
      "outcome": "failed",
      "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoContainText\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m failed\n\nLocator: locator('.sf-u12-root').locator('p[data-request-summary=\"synthetic-po-1\"]')\nExpected substring: \u001b[32m\"WP00 sourcing comparison\"\u001b[39m\nTimeout: 10000ms\nError: element(s) not found\n\nCall log:\n\u001b[2m  - Expect \"toContainText\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for locator('.sf-u12-root').locator('p[data-request-summary=\"synthetic-po-1\"]')\u001b[22m"
    },
    {
      "flow": "bi-table",
      "outcome": "failed",
      "failure": "\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoHaveCount\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m failed\n\nLocator:  locator('[data-sf-catalog=\"UI46\"]').getByRole('table', { name: 'Authorized values and source references', exact: true }).getByRole('row')\nExpected: \u001b[32m49\u001b[39m\nReceived: \u001b[31m37\u001b[39m\nTimeout:  10000ms\n\nCall log:\n\u001b[2m  - Expect \"toHaveCount\" with timeout 10000ms\u001b[22m\n\u001b[2m  - waiting for locator('[data-sf-catalog=\"UI46\"]').getByRole('table', { name: 'Authorized values and source references', exact: true }).getByRole('row')\u001b[22m\n\u001b[2m    14 × locator resolved to 37 elements\u001b[22m\n\u001b[2m       - unexpected value \"37\"\u001b[22m"
    },
    {
      "flow": "extended-ui",
      "outcome": "failed",
      "failure": "Target page, context or browser has been closed"
    },
    {
      "flow": "bi-revocation",
      "outcome": "not-reached",
      "failure": "None"
    }
  ],
  "http": [
    {
      "method": "GET",
      "route": "/orchestra/sf-dashboard/budget",
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
      "route": "/sucafina/api/ui/pages/CAP03",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/orchestra/sf-decisions/new",
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
      "route": "/sucafina/dashboard?sf=bi-options",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/dashboard?sf=bi-data",
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
      "route": "/sucafina/dashboard?sf=bi-options",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/dashboard?sf=bi-data",
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
      "route": "/sucafina/dashboard?sf=bi-options",
      "status": 200
    },
    {
      "method": "GET",
      "route": "/sucafina/dashboard?sf=bi-data",
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
      "message": "GET /sucafina/dashboard?sf=bi-data&viewId=BI05&start=2027-01-01&end=2027-12-31: net::ERR_ABORTED"
    }
  ]
}

## Original Playwright failure messages

[31mTest timeout of 180000ms exceeded.[39m

Error: All fibers interrupted without error

  425 |   } catch (error) {
  426 |     state.failure = redact(error instanceof Error ? error.message : String(error))
> 427 |     throw new Error(state.failure)
      |           ^
  428 |   } finally {
  429 |     try {
  430 |       await mkdir(testInfo.outputDir, { recursive: true })
    at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:427:11

