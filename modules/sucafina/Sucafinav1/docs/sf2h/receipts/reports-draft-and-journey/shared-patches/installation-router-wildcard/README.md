# Mission36: proposed installation router correction

Status: **PROPOSED_NOT_APPLIED**. Consumption and integration review belong to **session33**.

## Observed failure

[Run 43646916265, job 132606651286](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646916265/job/132606651286) executed the four named Reports cases from source W `83d7102664c9983a06fabffcc61334165cba756d`, snapshot S `624bfe326a7a11f8509541eb254501c28e6ee3f9`. Each case started and failed while waiting for its real CLI installation fixture to become ready:

```text
Reports CLI exited 1 before readiness:
Method 'ACL' already declared for route '/sucafina'
```

The stack reaches `find-my-way-ts@0.1.6`, Effect `4.0.0-beta.83` `HttpRouter`, and the actual `serveForever`. The four cases did not reach their business journey assertions. This is evidence of four failed executions, not evidence that any nominal journey passed.

## Exact cause

C6 `apps/cli/src/sucafina-product/installation.ts` builds two route-registration layers: one for `installation.mount` and another for `${installation.mount}/*`. The same file has Git blob `30ffcb8353cdf478808fbb8d6bc67b48b10a6109` in both C6 and the observed snapshot.

The installed Effect version already expands a trailing `/*` into both the wildcard route and its exact base. Its `HttpRouter.addAll` performs `router.all(route.path, route)` and then `router.all(route.path.slice(0, -2), route)`. Adding the exact mount separately therefore registers `/sucafina` twice for all methods. The error reports the method at which the underlying router detects the duplicate.

Primary source: [Effect HttpRouter at cd7ab658994104bd6fe8f841f1440bea32c387f5](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/unstable/http/HttpRouter.ts), Git blob `3a52c4acd7938674bc209059212efd745cff9715`. The version tag `effect@4.0.0-beta.83` resolved to that commit during this investigation. A short source excerpt and the minimal failure evidence are preserved under `evidence/`.

This cause lies in the production installation loader. It does not require changing the Reports fixture, replacing the router, bypassing admission, or changing permissions.

## Proposed correction

The complete patch affects one shared file:

`apps/cli/src/sucafina-product/installation.ts`

It removes the redundant exact-mount registration and keeps the existing wildcard `HttpRouter.add` for all methods. It also removes the now-unused `Layer` import and explains why one registration handles both forms.

| Property | Result of the proposed change |
| --- | --- |
| Exact mount | Registered by Effect's existing wildcard expansion. |
| Mount descendants | Registered by the same existing wildcard. |
| Installation handler | Identical source bytes before and after the patch. |
| Host and origin checks | Remain before handler invocation and retain HTTP 403. |
| Cancellation | The original request signal is still forwarded to the real handler. |
| Handler result | Existing response conversion, undefined-to-404 and error-to-503 behavior is preserved. |
| Factory and configuration | Absolute factory path, realpath resolution, mount validation, host contributions and disposal remain unchanged. |
| Authority | No principal, provider, ACL, capability or credential changes. |

The complete preimage and postimage end in `.ts.txt`, so they are documentation artifacts rather than source inputs. The real application target remains `.ts` in the manifest and unified diff.

## Provenance

| Input | Commit or snapshot | Git blob |
| --- | --- | --- |
| Installation loader | C6 `52add8433f8ecf9d361ee635cda484142131ef84` | `30ffcb8353cdf478808fbb8d6bc67b48b10a6109` |
| Installation loader in failing run | S `624bfe326a7a11f8509541eb254501c28e6ee3f9` | `30ffcb8353cdf478808fbb8d6bc67b48b10a6109` |
| CLI serve composition | C6 `52add8433f8ecf9d361ee635cda484142131ef84` | `6bfe580422d8b36f7b0ca68f42b3aa42c61d08c4` |
| Effect HttpRouter | `cd7ab658994104bd6fe8f841f1440bea32c387f5` | `3a52c4acd7938674bc209059212efd745cff9715` |
| Proposed installation loader | Inert postimage only | `edc4d574854a39583fb6847e4e8bb135ede93cc1` |

The patch SHA256 is `c8a32901dd900eab75afefe20e18cb1991595a8b404c8f6144be7dbc5b4c86dd`. The manifest includes full paths, image byte lengths, Git blobs, SHA256 values and immutable source references.

## Owner review and required evidence

Session33 must compare the target's current blob with the recorded preimage in one coherent candidate. A different preimage requires reconciliation before consumption; the bundle is not authorization to overwrite shared changes.

After consumption, the existing GitHub Actions interface must establish that the real CLI installation reaches readiness and that the exact mount and descendants still use the original handler. Host/origin rejection and handler cancellation/error behavior need to remain intact. The four existing nominal Reports E2Es must then execute on that candidate with their original assertions.

No local test, server, remote write, timeout increase, sleep, assertion removal or router substitute was used to prepare this bundle. The patch has not been applied or executed. Its cause is established from source and the failed run; runtime acceptance remains pending.

Successful startup would remove this specific prerequisite failure. It would not satisfy the separate review-discussion binding patch dependency, create a distinct real recipient, provide external C05 source authority, or prove a Reports journey green.
