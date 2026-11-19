# C12 native7 original diagnostics

Original run 44622862017. Artifact 14577212886. No test rerun. Visible synthetic corpus state and bounded observer counters only; no headers or authentication material.

## bi / packages/app-shell/e2e/test-results/sucafina-decisions-native--e92ba-nd-a-new-SQLite-composition-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/decisions-native-recovery.spec.ts >> C12 native UI recovers the original receipt after lost response concurrent edit reload and a new SQLite composition
- Location: e2e/sucafina/decisions-native-recovery.spec.ts:7:1

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: locator('[data-component="sf-change-review"]').getByRole('button', { name: 'Apply reviewed change', exact: true })
Expected: enabled
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" with timeout 10000ms
  - waiting for locator('[data-component="sf-change-review"]').getByRole('button', { name: 'Apply reviewed change', exact: true })

```


