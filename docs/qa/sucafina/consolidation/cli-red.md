# CLI red

Evidence: job `134890490527` (`sf/test-CI-CLI`) of run `44329483839`, head `2e5839eebb`. No test or CI was launched for this note. `--log-failed` ends during the second assertion failure in the same file, so later failures in that step are not in the captured log.

## First failure

- Spec: `apps/cli/test/sucafina-native-phase-wiring.test.ts`
- Test: `host composes original contributions with the native phase services and owner hook`
- Site: line 58, `expect(host).toContain(...)`
- Error: `expect(received).toContain(expected)`
- Expected: `ownerHook: () => ({ run: nativePhases.phase.withInvocation })`
- Received: the body of `apps/cli/src/sucafina-product/host-context.ts` (first line is the `createCurrentChoiceFence` re-export). The path `../src/sucafina-product/host-context.ts` resolved. The expected fragment is absent.

## Not a mechanical spec edit

Same mismatch on `sf-red-clusters` @ `ff80f419f5`. `host-context.ts` has `ownerHook: () => routineAdmission`, not a renamed `nativePhases.phase.withInvocation`. `nativePhases` does not occur in that file. Retargeting the assertion to `routineAdmission` would drop the native-phase composition check. No spec edit.

The same log already shows the next test, `native catalog and prepare retain consumed Request and refuse new run without human`, failing at line 72 because `authorizeRun: authorizeNativeHumanRun` is also absent. The function is passed as `authorizeIntent`, which is a different property, not a stale path.

## Proposed patch

None applied. A real fix is a host-composition change, not a spec string swap, and it cannot be proved without a new CLI run. Parent runs that once after lanes land.
