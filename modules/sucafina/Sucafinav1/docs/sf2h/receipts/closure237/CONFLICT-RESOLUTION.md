# 237 — PR #208 resolved concurrent owner-runtime collision

## Exact concurrent state
The first 237 patchset was composed against PR #208 `22209d92fa1fd64c487dded102f3acb233dc689e`. The PR then advanced to `65f388600e550f3044eae7dfceb948ca44155fe9` after draft PR #215 opened. The updated `owner-runtime231.tsx` has preimage blob **`0d46d20222198ea2f1d50271cc1bb4a75dbc1f43`**, not the earlier `fd5e173de15a42431d5053d1fd132b593564752b`. All **other 11 targeted dependency/product blobs remained byte-exact**.

## Full conflict resolution
The upstream owner delta consists of **12 inserted lines** in the discovery effect implementing cross-owner native admission-before-provider-selection and **3 inserted lines** in the route effect preventing duplicate admission. Both are preserved verbatim in the new full-file 237 owner postimage **`1811680cec4776eca162c080c8ade816abf19c3e`**. In that postimage, the 237 guard:
- bypasses unauthorized global profile selection before user consent;
- keeps upstream discovery as the **single** cross-owner admission path and retains its AbortController fencing;
- uses the original F01 navigation instance (not a parallel controller) to decide current-owner edits;
- restores previous URL, editor content and focus on rejected cross-owner exit;
- protects a root-shell sidebar/history/unload exit without altering other Orchestra chapters.

All source patches remain **inert full postimages** under `closure237/patches`; 237 does not change product paths or undo PR #208. The complete `PATCH-SET.json` now maps exact pre/post SHA for each target and shows the latest reconciled base `65f388600e550f3044eae7dfceb948ca44155fe9`.

## Application and verification
Authorized 211 composer must read its exact candidate C SHA and verify the 12 preimages. For each of eight changed targets only, apply the entire corresponding postimage, checking its Git blob equals expected `postimage`. The four unchanged dependency pins are never re-applied. If PR #208 moves again, **do not overwrite**; independently recompute the full-file 3-way postimage preserving all new changes, record exact SHA, and recheck.

Successor 232 alone may dispatch surgical browser and installed tests *after* integration on the same C. All tests/typechecks/build/CI are **NOT_RUN**; no native-positive owner-switch or GLOBAL_RELEASE evidence.
