# C12 native5 original seed diagnostic

Run 44618293094; artifact 14575717381. Original failure only; no test rerun.

## test-ci-evidence/playwright-runtime.json named attachment

175 |   if (sourceCall.status !== "ok") throw new Error("C12_ORIGINAL_SOURCE_ADMISSION_FAILED")
178 |       if (!await authority.ui.revalidate(sourceCall.value)) throw new Error("C12_ORIGINAL_SOURCE_AUTHORITY_CHANGED")
180 |       if (read.status !== "ok") throw new Error("C12_ORIGINAL_SOURCE_READ_FAILED status=" + read.status)
error: C12_ORIGINAL_SOURCE_READ_FAILED status=unavailable
      at <anonymous> (/home/runner/work/Orchestra-SF/Orchestra-SF/packages/app-shell/e2e/sucafina/decisions-support/c12-host.ts:180:43)

