# 237 — PR #208 composition and conflict check

Verified current PR #208 product snapshot `22209d92fa1fd64c487dded102f3acb233dc689e` against every preimage in `PATCH-SET.json` (8 changed target paths and 4 pinned 227/228/231 dependencies). All **12/12 matched**. PR #208 advanced twice during preparation; source was re-fetched rather than overwritten.

All `patches/*.inert.txt` are **full files**, not partial snippets. The `preimage` is the exact Git blob required in current C and `postimage` is the exact expected Git blob. The 211 exclusive compositor must apply only the 8 changed target postimages onto matching preimages; dependencies in unchanged entries are already in #208 and should not be re-written. If #208 moves again or any preimage differs, stop and create a new explicit 3-way composition, preserving every concurrent edit; never force update or merge into dev.

The 237 postimages retain 227 original owner and return-fence, 228 Today adapter and 231 live owner-runtime. The UI33 fixed local newIntent key is **not** a provider identity, permission or business ref; original producer-only idempotency correlation and unknown results remain authoritative. For pending unknown results, discard fails closed rather than inventing a success. Root exit uses one callback registered by the live F01 owner and original browser/shell navigation, with cancellation and focus restoration.

All tests, typechecks, installed proofs and CI are **NOT_RUN**. 232 alone dispatches surgical checks on the product candidate C after 211 composition. No global release.
