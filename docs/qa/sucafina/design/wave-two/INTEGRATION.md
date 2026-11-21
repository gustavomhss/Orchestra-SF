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

The final validation document will identify the exact verified product commit and the successful gate runs. Initial failures remain diagnostic history, not passing evidence.

## First visual run

Run [44918211856](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44918211856) built the real bundle and captured twelve starting views with zero page errors. It stopped at the exact accessible name of the CAP02 filter. The name was corrected in the product. The next journey bounds individual UI actions at 15 seconds so a missing control cannot consume the full 240-second genuine installation journey budget. No timeout was raised or assertion removed.
