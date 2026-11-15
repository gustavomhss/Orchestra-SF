# Mission104 — C51 exact minimal repair

## Identity & scope

- Source branch `minimal-first-save` / [PR92](https://github.com/gustavomhss/Orchestra-SF/pull/92); source correction [commit 2356b2a453087784d3e2dbb191252e4c04e1c151](https://github.com/gustavomhss/Orchestra-SF/commit/2356b2a453087784d3e2dbb191252e4c04e1c151), tree `2ecec1a1135f6e43cc8ee800ed08af58f99c54d5`.
- C51 source-of-truth material: `529142f63683de8e4b1f7d4232f88faf8ffcef6c`, tree `d679b541596dab3b280a87e15e4a0b29ee518262`. Current `sf2-stack` later receipt-only HEAD at handoff: `d083b422b6a587f47873abde4d866e35017ff8b8`; **105 must revalidate CURRENT head and preimage before CAS**.
- ONLY existing C51 file to change: `apps/cli/src/sucafina-product/dashboard-http.ts` blob preimage `9369722db40a922887c63481753776e3b01e97d8` → exact expected C51 postimage `72dc59d7b2b0a23148a24e6457fd82e37daa6f08` (Git blob already created, not committed into C by this mission).
- New test: `modules/sucafina/Sucafinav1/test/product/first-save-http-repair/outcome-key-admission.test.ts`, blob `e5e3783efa011f80ca4e9ac9467776bc9bca2b19`. Integrate test blob separately. Original `minimal-first-save/first-save-recovery.test.ts` blob `566e765f201d1a45677c0c52c75eb92ecb16d482` **MUST remain identical**.
- Other C51 preimages, NOT TO MODIFY: `dashboard-decisions.ts@c432524a112c873117309377d941845bf9923096`; `product/decisions/hot-topic-draft.ts@d880fe5a5f7fd3c9c4fa249dbc374620a39a43a7`. Source87 different `dashboard-decisions.ts@b4d70dfb9467d59e3ac8861e0b4fc1c628d09bc6` must NOT overwrite C51 reconciliations. No UI52, creation96, application86, auth, transport or other host files.
- This diff is **against C51**, not against source87's simpler HTTP error mapping. The original source87 addition also preserves 503 on outcome admission when real `unavailable`; C51 already does so.

## Complete minimal patch against C51 (apply only if preimage still matches)

```diff
diff --git a/apps/cli/src/sucafina-product/dashboard-http.ts b/apps/cli/src/sucafina-product/dashboard-http.ts
--- a/apps/cli/src/sucafina-product/dashboard-http.ts
+++ b/apps/cli/src/sucafina-product/dashboard-http.ts
@@ -28,8 +28,13 @@ export function createSfDashboardHttp(input: { origin: string; mount: string; runtime: () => Runtime | undefined }) {
     if (!read && (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))) return reply({ status: "denied" }, 403)
     const payload: unknown = read ? mode === "dashboard-hot-topic-drafts" ? { caseRef: { id: url.searchParams.get("id"), incarnation: url.searchParams.get("incarnation"), version: Number(url.searchParams.get("version")) } } : { id: url.searchParams.get("id") } : await boundedJson(request)
     if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply({ status: "invalid" }, 400)
+    // A missing/malformed original command key is a caller refusal, not host outage.
+    // Check only first-save recovery, before runtime/admission or any lookup work.
+    if (mode === "dashboard-hot-topic-draft-outcome" &&
+      !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? ""))
+      return reply({ status: "denied" }, 403)
     const runtime = input.runtime()
     if (!runtime) return reply({ status: "unavailable" }, 503)
     const action: SfHumanAction | undefined = ["dashboard-review-preserve", "dashboard-capture"].includes(mode!) ? "reviews.preserve" :
       ["dashboard-hot-topic-draft", "dashboard-hot-topic-draft-outcome"].includes(mode!) ? "decisions.edit" : mode === "dashboard-hot-topic-prepare" ? "decisions.prepare-changes" : mode === "dashboard-hot-topic-apply" ? "decisions.apply" : undefined
     const digest = digestSfValue(payload)
```

## Causality and negatives

UI command identity resolves from original request `Idempotency-Key`. A missing or syntactically malformed key yields `ui-identity-unavailable` from the admission authority. Source87 mapped any admission rejection to 403; C51 correctly distinguishes genuinely unavailable infrastructure as 503, but misclassifies a caller omission as outage. This single outcome-only pre-admission guard rejects missing/malformed key 403 before acquiring runtime, state, re-registering, dispatch or Apply. Legitimate `commandIdentity` unavailable with a **valid** key remains 503 at C51; revoked caller returns 403; malformed payload still 400. Other endpoints continue unchanged.

New negative test contains two focused cases: (a) seven absent/malformed keys rejected without invoking runtime/authorize/command identity, (b) valid key with missing infrastructure command identity =>503 versus revocation =>403. Existing original real SQLite/HTTP/C08 tests preserve wrong actor/case/incarnation, first-save loss/reopen, independent same-text intents, revocation, source fence and lookup write isolation. There is NO new source or C PASS yet from this repair.

## Validation route / ownership

- CI101 owns product Actions; exact previously FAILED C51 selection is `package=sucafina`, `directory=modules/sucafina`, `runner=bun`, `env={}`, Ubuntu 24.04, `--timeout 120000`, 3 named files/13 tests; add the new test as a fourth named file after integration, execute in ONE deduplicated request on a new explicit W/tree, not on C51.
- Mission45 owns compiler/typecheck/guards; no product tests to45.
- 105 is ONLY `sf2-stack` writer. Request ACK105 with integrated file/blob/tree/W and new CI request source; 101 returns W/S/tree/run/job/attempt/results. Independent 91/92 recheck **after** new C proof. Do not mark GLOBAL_RELEASE.

## Full outcome and reproduction

C51 observed run [43682448571/job132715780313](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682448571/job/132715780313), W `529142f63683de8e4b1f7d4232f88faf8ffcef6c`, S `32c186de11afc265a47aa06355ba560b5e89650b`, original request blob `9e17fe415e16abcfc46c2aad23f224760f3a5b38`, 12 PASS/1 FAIL/213 expects. Original oráculo at `first-save-recovery.test.ts:269` expected [503,403,403,403,403,403,400]; received [503,403,403,403,403,503,400]. Missing-key index six is the only deviation. Source87 green 43677408316 and 43677629469 are NOT integrated acceptance.
