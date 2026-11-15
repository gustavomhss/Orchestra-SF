# Mission53 — inert command-admission proposal for integration47, current intake55

Status: PROPOSED / NOT_APPLIED / NOT_RUN. This directory contains no activated host composition and no remote write. The patch adds a read-only admission hook to the existing Application; it adds no financial command, policy, role, stage, store, grant or executor.

## Exact base and files

- Repository: gustavomhss/Orchestra-SF.
- Integration base examined: C19 `5b11f1460fa44426626ea7674ccb8baf0a083e0a`; terminal47 target `12b459f6997298f79e3360c4aaeb8ffc0a106a50` and refreshed C21 target `3f35d8ee987cdeaafd3341c2fde13c4125a1f69e` have the identical application blob and bytes.
- Current intake: mission55, S0-C epoch `S0-C-e10-browser55`, accepted sole stack writer in `final-intake-55/ACK55.json` (blob `a6caa04d8c525339697d3e40f7d61ae5830d6e6d`). Control `c1df70b2fedd2183d243a523fbfef9c7c6ddff35` delegates this explicit succession after terminal47; Procurement53 remains an active source until its explicit release. Original integration47 provenance is preserved.
- Hosted generation/typecheck/guards remain owned by45; mission55 does not dispatch tests or CI. Source proof does not qualify the composed hook.
- Target: `modules/sucafina/Sucafinav1/runtime/application.ts`.
- Base git blob: `4edac56f32a082a0944a88fe5f231bc5aa739690`.
- Proposed git blob: `d544e79d40f05cb8fa048b21d1a815e512184b6a`.
- Unified patch: `application-command-admission.patch`.
- Full before/after sources: `pre/` and `post/`, with inert `.ts.txt` copies of the exact TypeScript bytes.
- No change to `runtime/contract.ts` or the Command schema.
- `procurement-approval-admission.example.ts.txt` is a complete, unmounted composition helper. Its intended relative imports assume location `product/integration/procurement-approval-admission.ts`. Moving or installing it is current integrator55 work; this proposal does not select or fabricate an actual host context provider.

The root implementation in the allowed `product/procurement/decision-preparation.ts` supplies:

```ts
lifecycle.admission(plan, binding):
  Promise<PortResult<{
    current(snapshot, actor, command, environment): PortResult<true>
    finish(): void
  }>>
```

## Application hook

```ts
Application.prepareCommandAdmission?(
  request: Request,
  surface: Surface,
  command: Command,
): Promise<ApplicationCommandAdmission | Response | undefined>

type ApplicationCommandAdmission = {
  current(
    snapshot: Snapshot,
    actor: Actor,
    command: Command,
    environment: Environment,
  ): { allowed: true } | {
    allowed: false
    status: 403 | 409 | 422 | 503
  }
  finish?(): void
}
```

The factory runs outside the transaction, after the existing canonical JSON decoder. It may resolve and retain existing host-owned UI context. The predicate is synchronous; it must not perform I/O, open a transaction, allocate an identifier, call `domain.execute`, write a receipt or mutate persistence.

Application supplies cloned snapshot, actor and command, copied directory/bank key, and an `environment.id` that throws if used. Predicate changes cannot alter the snapshot or command that the domain executes. Application freshly authenticates the real Request with the current surface roleMap in its destination transaction before calling the predicate.

For the managed Procurement actions `Requests/save`, `submit_pr`, `approve`, and `reject`, no await lies between the predicate and the existing single `contribution.domain.execute`. Failed admission returns `commit:false` and never calls the executor. The predicate cannot return a replacement command; success admits only the decoded original command.

The retained context closes in a finally block surrounding `Promise.resolve().then(() => transaction(...))`, including refused commands, cancellation, failed commit, rejected promises and a persistence adapter that throws synchronously before returning a Promise. The scheduling boundary is outside the transaction; there is still no await between the predicate and the managed canonical execute. `finish` must be idempotent and must not throw. Core admission is single use; a refused or lost command must not replay by reusing a finished closure.

## Explicit transport

The exported constant is:

```ts
APPLICATION_COMMAND_REVIEW_HEADER = "x-sf-command-review"
```

The browser's explicit action sends the ordinary Command JSON body and this header containing `encodeURIComponent(JSON.stringify(plan))`. The example limits the encoded header to 16,384 ASCII characters and requires canonical URI encoding. Header limits in the actual installation must support the chosen limit; an oversized review is an explicit refusal and must not fall back to unreviewed execution.

The header is a selector for reviewed transport. Its JSON is untrusted intent. `requiresExplicitAction:true`, `approvalGranted:false` and `receipt:null` are descriptive fields, not evidence of a human approval. A choice or checkbox does not authorize dispatch. The UI must expose the specific action, amount, currency, holder, version and effect, and dispatch only from that explicit human command.

Rules:

| Input | Outcome |
| --- | --- |
| No header | Existing ordinary Application behavior; the example hook returns undefined |
| Header on GET/HEAD or upload | 422; no product or command execution |
| Header present, hook absent | 503; no fallback to ordinary execution |
| Header present, hook returns undefined | 503; no fallback |
| Empty, malformed, oversized, noncanonical header or unsupported surface/page/action | 422 from the example |
| Existing UI context unavailable | 503 |
| Native/model context or denied authority | 403 |
| Stale review/source/version | 409 |
| Incomplete explicit input | 422 |
| Unavailable admission, thrown predicate, invalid async/other predicate result | 503 |
| Current review and canonical domain accepts | Existing canonical response; no new receipt semantics |

A header-bearing request bypasses `application.product` and enters the existing command decoder and destination transaction. This prevents a product route from executing a different effect before reviewed-command admission. It does not add an endpoint.

The ordinary decoder materializes `confirmed:false`; the plan must include that exact canonical value. The companion core does so. Do not silently normalize `confirmed:true`, change the id/action/amount or refresh version during composition.

## Binding and ownership

Current integrator55 owns mounting `prepareCommandAdmission` in the existing Application composition. The existing host owns:

- Authentication of the real Request and the binding to the existing UI context.
- Installation/project/principal/accessRevision/policyVersion and source scope.
- The Request object identity returned by `host.requestFor(binding)`.
- Expiration, revocation and disposal of that binding.
- Persistence, environment, domain and the canonical executor.

The example requires `requestFor: DomainPortHost["requestFor"]` as well as `existingUiContextFor(request)`. The latter must resolve the host's existing context for that exact Request. The wrapper verifies `requestFor(binding) === request` and the Request signal before and after the awaited lifecycle admission, and again in the synchronous predicate. A valid binding for another Request is refused even when both requests name the same principal. Closed, aborted or rebound contexts cannot proceed. It must not create an actor from header fields, look up a user by name, manufacture a principal, accept profile identity as authorization, or create a new grant. If the host cannot provide the context, return unavailable. Its `finish` releases only retention owned by this request, not another request or the user's entire session.

Mounting example, deliberately dependent on an actual existing context provider:

```ts
const applicationWithReviewedProcurement: Application = {
  ...existingApplication,
  prepareCommandAdmission: createProcurementApprovalAdmissionHook({
    lifecycle: procurementApprovalLifecycle,
    requestFor: (binding) => existingDomainPortHost.requestFor(binding),
    existingUiContextFor: existingHostUiContextForRequest,
  }),
}
```

If the installation already has a command-admission hook, current integrator55 must compose ownership explicitly and preserve the other handler. This snippet must not silently overwrite it. A managed review refusal is terminal and must never try another hook as a bypass.

## What the fence proves and what remains open

The core re-derives and compares the current source incarnation/version/digest, physical request CAS, complete record digest, settings/roleMap digest, actor projection, holder, submitted amount/currency and exact Command inside the destination transaction. Settings changes that leave the request CAS unchanged are refused. Re-import/source replacement cannot be accepted merely because a request id/version was reused.

The core revalidates the binding asynchronously before admission. Its synchronous predicate checks the retained Request identity and signal; Application supplies fresh canonical authentication inside the transaction. External lease revocation is only fenced to the extent the existing host invalidates `requestFor` and its authenticator revalidates authority. This proposal does not invent a new cross-service revocation guarantee or an async/nested transaction inside the predicate.

The hook provides admission, not durable idempotency. Replaying an old command uses the same CAS and cannot produce a second canonical effect; it does not recover a C12 receipt. Lost response without an authoritative receipt remains indeterminate. The frozen-value edit/submit/approve cycle remains distinct from approving a future replacement and applying a post-approval `Requests/save`. That latter financial contract remains OPEN for S0.

## Verification boundary

No product execution, local tests, CI dispatch, workflow mutation or remote application of this patch occurred here. Static inspection and patch byte/hash generation are the only performed checks.

Tests in allowed mission53 test paths can prove the core predicate using the real Application and a test-only Domain wrapper that calls admission.current and then the original domain.execute once. That is a harness adaptation, not activation of this Application patch. Record this status explicitly as SHARED_PATCH_NOT_APPLIED.

After applying the shared patch, current integrator55 must obtain surgical Actions verification against the actual Application hook through the authorized checks owner45. Mission55 has no CI-dispatch authority. Required discriminators:

1. Header absent preserves canonical behavior; header plus missing hook is 503 with snapshot/audit/notices unchanged.
2. Empty/malformed/oversized header and altered command refuse without fallback or domain execution.
3. Settings/currency/roleMap change after preparation but before the destination transaction refuses even if request CAS is unchanged.
4. Replaced source incarnation, old holder, wrong amount, stale CAS and revoked binding refuse without effects.
5. A current explicit command crosses fresh canonical authentication and calls domain.execute once.
6. A predicate that mutates its arguments cannot alter the real snapshot/actor/command; predicate identifier allocation throws and refuses.
7. Cancellation, failed commit, rejected promise and an adapter throwing synchronously before returning a Promise dispose only this request's retained context; no receipt or success is fabricated.
8. Retry of the same committed CAS has no duplicate effect; unknown lost-response state is not called a receipt replay.
9. A context provider returning Request B's binding for Request A is refused before admission even for the same principal; rebinding during the admission await or before current is also refused. Aborted Request A is never admitted.

These tests are not yet PASS, and the core harness results cannot be relabeled as shared-hook integration evidence.

## Packaged installation patch

`application-and-helper.patch` is the complete two-file patch: the Application extension plus the helper at `product/integration/procurement-approval-admission.ts`. The target helper was absent at C21 (MCP404). Apply this combined patch once after checking both manifest preconditions. `application-command-admission.patch` is retained as the reviewed runtime-only subset; do not apply both patches. The `.example.ts.txt` and `post/` copy contain the same helper bytes. Mount the exported helper only with the real existing host context inputs specified above. No mount or provider is activated by these inert receipt files.
