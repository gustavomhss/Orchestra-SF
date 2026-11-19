# C12 native2 original seed diagnostic

Run 44608278049; artifact 14572510453. Original failure only; no test rerun.

## test-ci-evidence/playwright-runtime.json named attachment

163 |     throw new Error(`C12_REAL_CASE_CREATION_FAILED status=${draftResponse?.status ?? "unmounted"} outcome=${typeof rejected.status === "string" ? rejected.status : "unknown"}`)
error: C12_REAL_CASE_CREATION_FAILED status=503 outcome=unavailable
      at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/decisions-support/c12-host.ts:163:15

