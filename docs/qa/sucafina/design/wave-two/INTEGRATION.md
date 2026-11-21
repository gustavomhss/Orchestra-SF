# Wave-two integration notes

## Base preservation

The branch was created directly from dev `bcdc109326de02e20c01c32ffb6b00bee3ff978d` and composed with approved first-wave `8f18ca831df7b144d843e6b0b3477825abe88e46`. The first composed candidate `8acf02ec07c6e2d88af27a81190b2496f60c14d3` changed no path among the 41 upstream changes since the common ancestor. Shared dev is not modified.

## Type-only repair required by the current dev

The initial scoped gate [44918216827](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44918216827) reported TS7056 at `packages/app-shell/src/context/team-profile-web.ts:20`: the inferred exported return type exceeded compiler serialization length. The unchanged upstream file had blob `c03d10cb40b9242c262a91b919aa60415f38b4e1`.

The reader now declares its existing result explicitly using the original `SfTeamContextResult` DTO and the exact three possible returned statuses. This is a type annotation only. Endpoint, parsing, trust checks, timeouts, authentication and runtime behavior are unchanged. No compiler exclusion, ignore, cast or schema change was added.

## Scoped usability repairs

- CAP02 retains a real confirmed-save notice across the immediate authorized reread. It stores only the owner generation and submitted route scope, not record data. The notice clears on owner/read-authority/route change. A success-only registry cleanup accepts the exact confirmed operation reference and refuses unresolved or active/pending/unknown drafts; reopening the saved topic can acquire a fresh version. Ordinary discard semantics remain unchanged. Six focused registry cases and the real create/update/reopen journey verify this boundary.
- CAP03 can select the source period again through the existing owner-bound period port, using its already supported empty period. Admission, draft fences and route validation remain in that port.
- Closing a CAP03 editor disclosure during review restores the two annual readouts. The review and draft remain mounted and resume when reopened. Only the page-scoped visibility selectors changed.
- CAP02 status/priority selects use explicit existing localized accessible names; the first real journey exposed ambiguous implicit labels containing option text.
- The approved compact navigation rules moved unchanged from the Executive stylesheet to the Sucafina source-navigation stylesheet and now also match active CAP02–04. A local scroll reveals the active destination when the strip becomes narrow. Link admission and navigation handlers are untouched.
- CAP04 review translates known flag/field display values through the existing catalog. Raw draft and command values are untouched; CAP05 retains its original presentation.

The final product is `5012d7adf0e5d02576fe6a0add6f79331a812137`. [VALIDATION.md](VALIDATION.md) identifies successful runs, exact coverage and limits. Initial failures remain diagnostic history, not passing evidence.

## First visual run

Run [44918211856](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44918211856) built the real bundle and captured twelve starting views with zero page errors. It stopped at the exact accessible name of the CAP02 filter. The name was corrected in the product. The next journey bounds individual UI actions at 15 seconds so a missing control cannot consume the full 240-second genuine installation journey budget. No timeout was raised or assertion removed.

## Final visual correction and rerun

The complete green browser run 44919606458 on `263e694` supplied 36 images. Its worker critique identified one remaining CAP02 detail defect: the shared canonical-reference select was omitted from the page's native field styling. Only `hot-topics/topics.css` now extends the existing fill, line, radius, 44px minimum height and padding to that selector, with 12px section spacing and an 8px label gap. No shared markup, target, permission, string or command changed.

Final run [44920647017](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017) passes in 2.9 minutes and emits 39 images without skips. New captures include the Portuguese detail, the focused reference field at 320px and OPEX's detail at 320px. Root and the relevant workers inspected these regions; the reference-field defect is resolved. The final [Topics](topics/REVIEW.md) and [OPEX](opex/REVIEW.md) reports state exactly what was visible and what fell below the viewport.

Final gates [44920652075](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920652075) pass both type checks, 78 guards with zero errors and seven-file palette parity. The six real registry tests passed in [44919739363](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363); their product and test blobs did not change afterward. One earlier unit request selected no tests due to a missing `./` in the test path; only the corrected execution is counted.

## Final base and inventory proof

The final app tree `cd11f75aeee6738f3eea1bc87f09dfef880e4b08` is non-truncated. It contains all 75 component entrypoints for the 70-surface, 165-route, 15-chapter inventory. The registry blob `6e1e711e2ff3a95e460026053cb91772693da572` remains unchanged.

Comparing final product to the pinned dev base preserves 40 of the 41 upstream-changed paths byte for byte. The sole overlap is the type-only team reader annotation described above. No workflow, guard or allowlist path changed. Final evidence and report commits contain documentation/JPEG files only and do not change the verified product.
