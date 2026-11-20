# Reports installed RPT-03 profile — CI-only

## Identity and scope

- Product parent: `9bcfc9de18a0ddd0dc00edecbddc221649db07c3`, tree `1ec90637b5ae2ee93692b31025cd712d4d1d0730`.
- Prepared for cold review only. No workflow has been triggered. No nominal success is claimed.
- Every changed runtime blob, the instrumentation module, collector, diagnostic spec and request are diagnostic-only. Never import this tree or these blobs into audit-one.
- The new spec copies the original RPT-03 test block byte for byte from `reports.spec.ts` blob `6dbbc7ca472b38c81a7a40538c58c9f1c40f423c`. Original spec, fixture, business helpers and data seed remain intact.
- Original production config, one worker, retries 0, test/fixture 180000 ms, startup 120000 ms, real operator enrollment, real CLI, trace/video/screenshots off and Omni 1 remain.
- The only existing helper change is forwarding validated numeric telemetry inside its existing stdout line consumer. Spawn, streams, awaits, readiness, tail8KiB, diagnosticTail, cleanup and assertions remain.

## Why this profile is needed

Nominal `44647936470` / snapshot `5a839065256777bc063dd1cb5cfa911aa896acfc` used the same product as fe2dfe77 (only .ci-run.json differs). Reader `44651646714` / job `136007724941` shows the final RPT-03 prior-review GET pending 107402 ms until ECONNRESET during timeout/teardown, not a completed response of that duration. RPT-04 answer-read 39514 ms was the expected 400 answer-unconfirmed before preparation.

Composition diagnostic `44655820423` / snapshot `36df01594dc23c1fee38a4c923725cb813267c9d` completed the prior GET in 4284 ms and C05 in 5247 ms with 359/383 dashboard memo hits, encoded payload2090656 and plan3507954 units. Its 971 ms rejected planning belongs to the synthetic5700000-byte case, not those real revision reads. It has no installed session, local jobs, browser UI source edit or C05 thread/reply lifecycle.

Each installed scenario has its own private installation. RPT-03 exports nothing; RPT-04 exports DOCX18871 bytes. RPT-01's PPTX does not carry into them.

## Observation design and limits

A private AsyncLocalStorage scope owns each original Request. Local maintenance and authentication maintenance start separate diagnostic scopes at their existing work invocation. No Request, header, body, authentication result, source, grant, lease, registered callback or method is replaced. No extra producer observation is made.

Observer821's measurement points are reused in review-read-integrity, source-lifecycle and local-store, but their global begin/finish counters are removed. Counts and timings belong to the current private scope. Auth session timing wraps only the existing body in try/finally. Existing await counts remain32/11/22, respectively; local entry54, local jobs22, auth maintenance3, operator identity15, review HTTP44 and installer15 remain too. SQL and lock budgets are unchanged.

Metrics are inclusive and overlapping. They must not be summed into wall time. Queue-predecessor class labels the immediately preceding queue tail, not an exclusive attribution of all time to that owner. The waiter itself has its own owner/request id. Authentication credential reads remain independent of the writer queue.

Begin, route and the existing review-read phase boundaries are emitted immediately. Progress snapshots are emitted only when an existing measurement completes and at least2000 ms have passed since that scope's last emission. This is output throttling, not a timer, wait, extra read or readiness condition. A blocked await may therefore have no subsequent progress event; its last phase and any other owners' events remain visible. Aborts and resolved/rejected promises are observed without replacing their values/errors; the owner wrapper returns the same work promise and adds no await.

No telemetry includes URL, query values, headers, credentials, identifiers from business state, bodies, source contents or error messages. Mode is an allowlisted integer; unknown values become0. The installer only forwards complete lines already assembled by its existing Stream.splitLines. It rejects lines over16384 characters, arbitrary fields, nonfinite/nonnegative-invalid numbers, unknown codes, oversized arrays and duplicate metrics. It never forwards a raw chunk; its existing8KiB tail is unchanged.

Instrumentation and logging add overhead. This run would diagnose phases and ownership, not establish an uninstrumented performance improvement. A timeout remains a timeout; completed and censored spans must be reported separately.

## Numeric wire schema

Prefix: `SF_REPORTS_INSTALLED_DIAGNOSTIC `. Fields: v,event,id,owner,mode,method,phase,elapsedMs,active,metrics. Version1.

- owner1=request,2=local maintenance,3=authentication maintenance.
- event1=begin,2=phase,3=progress,4=abort,5=resolved,6=rejected.
- method0=other,1=GET,2=POST,3=HEAD.
- mode0=other;1=review-read;2=review-agenda;3=review-preserve;4=review;5=workbench;6=review-current-thread;7=review-thread-context;8=collaboration-storage-version;9=collaboration-thread-read;10=collaboration-answer-read.
- active=[request scopes,local maintenance scopes,authentication maintenance scopes].
- Each metrics entry=[code,call count,inclusive milliseconds,maximum units]. Units are existing string/plan lengths, not extra serialization.
- ids are ephemeral monotonic diagnostic scope numbers; no product identifiers are emitted.

### Phase codes

1. route
2. entry-person-enter
3. entry-person-done
4. entry-native-enter
5. entry-native-done
6. entry-business-enter
7. entry-business-done
8. HTTP_READ_ENTER
9. HTTP_READ_ADMIT_DONE
10. HTTP_READ_VALIDATE_DONE
11. HTTP_READ_PORT_DONE
12. HTTP_READ_POST_AUTH_ENTER
13. HTTP_READ_POST_AUTH_DONE
14. HTTP_READ_JSON_ENTER
15. HTTP_READ_JSON_DONE

### Metric codes

1. storage.memo-hit-dashboard
2. storage.memo-hit-planner
3. storage.memo-hit-procurement
4. storage.memo-miss-dashboard
5. storage.memo-miss-planner
6. storage.memo-miss-procurement
7. storage.plan-inclusive
8. storage.plan-accepted
9. storage.plan-rejected
10. storage.current-snapshot-via-plan
11. storage.current-snapshot-via-clone
12. storage.queue-wait-inclusive
13. storage.queue-empty
14. storage.write-lock-inclusive
15. storage.read-without-lock
16. storage.decode-snapshot
17. storage.clone-snapshot
18. storage.encode-snapshot
19. storage.plan-payload-budget
20. storage.plan-unit-budget
21. storage.plan-node-or-depth-budget
22. storage.plan-missing-budget
23. storage.materialize-plan
24. storage.queue-predecessor-request
25. storage.queue-predecessor-local-maintenance
26. storage.queue-predecessor-auth-maintenance
27. storage.queue-predecessor-unattributed
28. source.full-snapshot-before-digest
29. source.first-authorize-inclusive
30. source.projection-snapshot-clone
31. source.project-scope-inclusive
32. source.second-authorize-inclusive
33. source.full-snapshot-after-digest
34. source.observe-inclusive
35. source.prepare-snapshot-clone
36. review.current-snapshots-copy
37. review.current-snapshots-empty
38. review.review-and-receipt-digests
39. review.live-full-snapshot-digest
40. review.captured-full-snapshot-digest
41. review.access-digest
42. review.full-snapshot-fence-digest
43. review.scope-state-read-inclusive
44. review.canonical-producer-read
45. review.legacy-state-read-inclusive
46. review.producer-result-clone
47. auth.session-inclusive
48. auth.request-mismatch

## Gate request prepared, not triggered

`.ci-run.json`: app / playwright / e2e/playwright.production.config.ts; exact sole file `e2e/sucafina/reports-installed-profile.spec.ts`; ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=1.

Root must review the full diff and choose any compiler/diagnostic gates. No sf-ci, PR, external comments or integration is part of this candidate.
