# G08 private installed Teams executor

## Status and proof boundary

This is executable preparation, not a G08 approval. No QA host, slot, final pin or real Microsoft session is supplied by this PR. The hosted job executes refusal controls, typechecks this package and asks Playwright to **list** the exact nine central cases. Its receipt says `LISTED_NOT_RUN`, `installed:false` and `g08Closed:false`.

The installed job is dormant until the authorized owner supplies the private inputs below on a dedicated `orchestra-sf-g08-qa` Linux x64 Actions runner. Merely naming the runner label or the `g08-isolated-qa` environment does not reserve a host or create an approval. Configure that environment's owner protection before dispatch; release it only after the reservation, actors and disposable Team have been confirmed.

A successful installed run emits `CORE_TEAMS_INSTALLED_VERIFIED` for these nine cases, with `g08Closed:false`. The wider U15, U39, U40, F04 and AZ02 groups retain their own original producers, inventories and installed receipts. They are not implicitly covered by browser visibility, nine listed cases, or a green tooling job.

## Sources and retained obligations

The seven original cases are adapted narrowly from [teams-profile-linux.spec.ts at 08fa1796](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/app-shell/e2e/sucafina/native/teams-profile-linux.spec.ts), with attachment and original F02 authority checks from its [installed browser fixture](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts) and [readiness reader](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/app-shell/e2e/sucafina/native/fixture/readiness.ts).

Revocation uses the actual `disable`/`enable` compare-and-swap HTTP contract recorded in [the historical TeamProfile schema](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/schema/src/sucafina/team-profile.ts) and [original revocation helper](https://github.com/gustavomhss/Orchestra-SF/blob/08fa1796973742153b2fa33a0d0d9b20a30e628e/packages/app-shell/e2e/sucafina/native/fixture/response-faults.ts). The local decoder does not add that route to the installed product.

The [current inspected shell at babc660b](https://github.com/gustavomhss/Orchestra-SF/blob/babc660b2cda3e20ed6b68ecab86b973110652cb/packages/app-shell/src/pages/team-profile.tsx) does not contain the historical chat, discard-dialog, administration and picker test contracts used here. No live request to a reserved QA host was available to establish the complete route contract. A missing original selector, route or admin producer is a concrete blocker: the executor fails visibly; it does not replace that producer or skip the obligation.

The [fixed handoff](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md) attests the 222 (2) Compras acceptance, 4/4 in its tested QA installation, including write/re-read and revoked temporary access. Preserve that result in that scope. Its original SHA/tar/slot receipt backlink was not recovered in this preparation. It is neither discarded nor promoted to final-candidate G08 evidence.

| Case | Original observation required |
| --- | --- |
| same-team-distinct-grants | Two original Microsoft contexts, distinct principals, same installed Team owner, actually different grants; opposite-order reload preserves each authority. |
| aba-two-windows | A → B → A in one window; each action's original F02 request/response and a separate original re-read must identify its owner. The sibling remains A and retains its owner after reload. |
| account-without-team | Authenticated denied account, no Team stamp/destinations/availability, visible denial, chat entry disabled. |
| foreign-deep-link-reload | Foreign-installation link and reload retain the denied owner state; returning to the valid link restores A. |
| admin-without-team | Real configuration admin, no Team/business authority, original administration UI available, business chapter denied. |
| narrow-keyboard-draft | Narrow Web keyboard navigation opens an unsent draft, with original F02 revalidation and unchanged owner. |
| draft-cancel-discard | Cancel preserves the draft and A; explicit discard changes to B with the action's original F02 response; returning to A repeats that observation and starts an empty draft. |
| real-revoke-restore | Real admin disables only disposable A, both original accounts lose A, B stays available; original catalog read and one CAS restore A. |
| logout-original-context | Real logout returns 204; original requester context and stale sibling return 401 on F02; distinct holder stays authorized. |

Logout does not copy/replay raw cookies or tokens and does not claim Entra-wide sign-out. Revocation proves the original context/UI authority transition; protected mutation replay and broader background/stream cases remain in the separate groups.

## Inputs owned by the reserved QA operator

Before installed dispatch, final C/T must be confirmed by Migração and Release and the original Linux x64 tar verified through G07. The candidate checkout must contain this executor. Dispatch exactly C; the driver rejects a different checkout or tree.

On the approved host, create a fresh runner-owned absolute directory, mode 0700, outside the checkout. Every direct input must be a regular single-link, non-symlink file, mode 0600 and owned by the runner:

| File | Required provenance |
| --- | --- |
| `plan.json` | Owner-prepared reservation/actor/mutation metadata below, bound to the actual Actions run and attempt. |
| `package-receipt.json` | Exact independently verified G07 `sf-g07-package-v1` bytes; SHA-256 pinned in the plan. |
| `orchestra-sf-entra-linux-x64-baseline.tar.gz` | Exact inner producer tar from that G07 receipt, not the Actions ZIP. |
| `browser-endpoint.txt` | Private loopback CDP descriptor for the already authenticated browser; never paste into GitHub, chat or public artifacts. |

The G07 wrapper's `installation:null` is package evidence, not host evidence. The read-only observer imports `check_rollback_release(C)` and `current_source()` from C's actual installer. It checks every installed file/mode/hash, matches `.a7-source.json`, tar and manifest against G07, reads Azure IMDS without proxies, and observes the running `orchestra-sf.service` PID, cgroup, service UID, executable path and process start. It also observes the exact service argv and resolves `--installation` to C's factory, with the factory and installer source hashes matching G07. The descriptor referenced by the process environment must be private and match the target tenant/origin/mount/listener. The sole loopback listener must belong to that PID in the observer's network namespace. It repeats after the tests and rejects a changed process, boot identity, binding or release. It never calls install, rollback, current selection, restart or maintenance operations.

The observer reads only the existing private `ingress-secret.txt` needed for an original loopback discovery request; it never reads Entra client secrets, keys, cookies or tokens, and never sends that proof to HTTPS. The loopback and TLS-verified HTTPS discovery descriptors must agree with the plan, including the factory's per-process `hostId`. The HTTPS peer must be one of the VM addresses actually reported by Azure IMDS. Every browser F02 response must independently match that same installation, tenant, host and project.

For public content delivery, the observer reads the **active** Caddy configuration through its existing private Unix administration socket, verifies the socket's kernel peer credentials against the actual Caddy unit/PID, and observes its HTTPS TCP/UDP listeners. The supported minimum is the repository's exclusive hostname and original reverse proxy: content-producing handlers must route to the installed loopback listener; static success bodies, file servers, alternate upstreams and response-body interception are refused. This checks the running configuration, not the unrendered template. If the authorized topology uses a separate gateway, it requires an original adapter and independent proof; metadata cannot waive this check.

Runner-owned pages disable their own network cache and bypass service workers. Document, script and stylesheet responses must report port 443 at an assigned VM address. Independent discovery/context/admin reads and CAS writes invoke a real same-origin browser fetch in the original context, using a fresh header nonce only to correlate the network observation. They read the actual Playwright network Response after verifying the same peer and refusing service-worker responses; the page's returned JavaScript body is never an authority source. The browser supplies its original cookie jar and POST origin. Logout and the F02 requests emitted by Team switch, discard, focus refresh and new-chat actions use the same peer check; request waits are registered before the action and exclude the observer nonce. Every opened page needs an observed original document. This prevents accepting an unrelated public frontend or silently reusing a previous candidate's cached shell. The private host operator must have read access to the required process metadata, private descriptor/ingress proof and Caddy socket; missing access blocks execution.

Host metadata, principal labels and the private plan do not grant authority.

The browser must expose exactly four **existing**, distinct Chromium contexts authenticated directly with real Microsoft accounts: requester and holder with different real grants in the same Team A; a denied account without Team authority; and a real configuration administrator without Team authority. Requester must also have Team B. A and B must be the two enabled disposable QA Teams in this catalog. The fixture never launches a browser, creates a context, imports storage state, copies cookies, logs in, adds membership or changes Graph. It creates and closes only its own pages inside original contexts.

The owner must explicitly authorize disabling/re-enabling disposable A and logging out requester. Revocation does not reset the monotonic configuration revision. An unknown disable outcome is resolved by one original catalog read, not by retrying the mutation. Restoration requires exactly the expected catalog state/revision; concurrent changes block acceptance.

## Private plan contract

The plan is JSON serialized as `JSON.stringify(value) + "\n"`, one canonical UTF-8 line. Extra fields, duplicate representations, empty references, repeated principals and different boundary endpoints are rejected. Do not store a filled plan in this repository.

This is a **non-executable shape**; uppercase placeholders must be replaced with verified private values.

~~~json
{
  "schema": "sf-g08-private-plan-v1",
  "candidate": { "sha": "FINAL_40_HEX_C", "tree": "FINAL_40_HEX_T" },
  "packageReceiptSha256": "EXACT_G07_RECEIPT_64_HEX_SHA256",
  "reservation": {
    "reference": "ORIGINAL_REPOSITORY_COMMENT_URL",
    "owner": "CONFIRMED_SLOT_OWNER",
    "startsAt": "UTC_YYYY-MM-DDTHH:MM:SSZ",
    "endsAt": "UTC_YYYY-MM-DDTHH:MM:SSZ",
    "vmId": "ACTUAL_AZURE_VM_UUID",
    "environment": "qa-isolated",
    "exclusive": true
  },
  "approvals": {
    "actorsReference": "ORIGINAL_REPOSITORY_COMMENT_URL",
    "mutationReference": "ORIGINAL_REPOSITORY_COMMENT_URL",
    "scope": "qualification-only"
  },
  "invocation": {
    "id": "FRESH_32_HEX_NONCE",
    "runId": "ACTUAL_ACTIONS_RUN_ID",
    "runAttempt": "ACTUAL_ATTEMPT",
    "workflowSha": "ACTUAL_GITHUB_WORKFLOW_SHA"
  },
  "target": {
    "serverKey": "HTTPS_INSTALLED_ORIGIN",
    "discoveryOrigin": "HTTPS_INSTALLED_ORIGIN",
    "shellOrigin": "HTTPS_INSTALLED_ORIGIN",
    "publicOrigin": "HTTPS_INSTALLED_ORIGIN",
    "installationId": "ACTUAL_INSTALLATION",
    "tenantId": "ACTUAL_TENANT_UUID",
    "teamObjectId": "ACTUAL_TEAM_A_UUID",
    "projectId": "ACTUAL_PROJECT_PROVENANCE",
    "hostId": "ACTUAL_HOST_PROVENANCE",
    "mount": "/ACTUAL_MOUNT",
    "chapterHref": "/orchestra/sf-home?contractRevision=sf-team-profile%2F1&server=ENCODED_ORIGIN&installationId=ENCODED_INSTALLATION&tenantId=TENANT&teamObjectId=TEAM_A"
  },
  "teamB": "SAME_TARGET_SHAPE_WITH_DISTINCT_TEAM_B_AND_MATCHING_CHAPTER",
  "foreignInstallation": "SAME_ENDPOINT_AND_TEAM_A_WITH_DISTINCT_INSTALLATION_AND_MATCHING_CHAPTER",
  "actors": {
    "requester": "ACTUAL_PRINCIPAL_UUID",
    "holder": "DISTINCT_ACTUAL_PRINCIPAL_UUID",
    "denied": "DISTINCT_ACTUAL_PRINCIPAL_UUID",
    "dashboardAdmin": "DISTINCT_ACTUAL_PRINCIPAL_UUID"
  },
  "scratchRoot": "ABSOLUTE_PRIVATE_ROOT"
}
~~~

Reservation and actor references are owner-supplied authorization metadata pointing to confirmed original records. The parser does not appoint an owner or infer approval from a URL. G07's independently verified source confirmations remain required for the final pin.

For installed dispatch select `mode=installed`, the exact candidate ref, `private_root` and prepared nonce. The protected environment provides the point at which the owner can bind the plan to the newly assigned run ID/attempt before the job starts. A rerun requires a new private root/invocation and plan bound to that attempt; old cleanup/report files cannot be reused.

## Execution, evidence and cleanup

The workflow uses a fixed config without grep, sharding, repeat or retries. Serial order keeps revocation/logout after the earlier cases; any failure or skip prevents acceptance. File/package/host preconditions are checked before browser activity. The original admin route/catalog is read before disable.

Private output includes raw Playwright JSON, command log, before/after host witnesses, source hashes and one cleanup record per case. Raw errors, identity/grant data, cookies, CDP details, screenshots, traces and videos never enter the uploaded artifact. Screenshots/traces/video are disabled. Failed installed runs retain details only on the private host for the authorized operator.

Cleanup records verify original context count, zero created contexts, bound document/resource observations, cache bypass, closed runner-owned pages and disconnected attachment. Revocation additionally requires observed restoration. Logout deliberately leaves the authorized requester signed out. The operator retains/removes private evidence under the approved QA retention policy after recording its digest; the executor does not delete the owner's sessions or evidence.

Private configuration, proxy responses, assigned IPs, ingress proof and process environment are never copied into the public receipt. The only public installed output is `g08-public/receipt.json`, built from an explicit allowlist: C/T, tar identity, G07 receipt digest, invocation, case IDs/statuses, source digests and evidence hashes. No actor, hostname, endpoint, reservation-owner identity or private payload is copied. `g08Closed:false` and `productionCutover:false` are fixed.

Remaining preparation blockers: confirmed QA reservation/owner; final C/T and matching G07 tar; installed host/process witness; four original Microsoft contexts with required real authority; complete original UI/admin routes; and separate U15/U39/U40/F04/AZ02 execution. A green executor-controls run resolves tooling validation only.
