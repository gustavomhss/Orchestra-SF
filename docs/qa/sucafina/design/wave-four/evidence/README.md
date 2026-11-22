# Wave four — original browser evidence

Status: **IN_PROGRESS**. Twelve areas are qualified; the final Decisions journey remains under source-lifecycle investigation. The existing galleries below contain **105 reviewed captures for this block**, plus six separately identified regression samples.

| Group | Areas | Captures persisted and reviewed | Source / qualification |
| --- | ---: | ---: | --- |
| [Planner](planner/README.md) | 4 | 40 | Planner9; Planner + previous six passed again after dev composition |
| [Procurement](procurement/README.md) | 5 | 43 | Procurement10: 4 tests, 11 original POSTs and fresh readbacks |
| [Work, Search, Saved Views](work/README.md) | 3 | 22 | Work10: all 3 tests passed; selected images retain exact original run identities |
| Decisions | 8 | Pending final successful source states | Decisions9 lost original case availability by UI41 light; diagnostic Decisions11 is running |
| [Previous six regression](regression/README.md) | Earlier 6 | 6 representative JPEGs of 67 previews | Separate from this block's capture total |

[Validation and scope limits](../VALIDATION.md) · [Exact area/route/state mapping](../scope.json) · [Technical verification](../technical-verification.json) · [Composition evidence](composition/manifest.json)

The final technical gate on product `218a5ee39935336c88abeb92b0a4d2cc980f21de` passed **14 checks / 87 regression cases**, including application declarations, E2E semantics, full CLI types with zero diagnostics, exact-dev guards and seven-file palette parity. Technical success is separate from visual review and user acceptance.

## Provenance and inspection

All files are unedited JPEG previews produced by Playwright against isolated original installed sources, real enrollment and real operation admission. Each group manifest identifies the original snapshot/product commit, run, image and limits. The original PNG attachments remain in Actions; the persistent JPEGs make the reviewed states available after artifact expiry.

Every selected image in the three complete groups was manually reviewed. The coordinator also inspected representative desktop, narrow, review and Portuguese images across those areas. Scope does not mean every route/state/theme combination. Actual browser zoom and measured contrast ratios were not tested.

Procurement's eleven HTTP 200 responses had JSON content type and eleven independent fresh source readbacks. Six acknowledgement bodies were readable and positive; five were unavailable to the collector. No cause for the unavailable bodies is inferred, and they are not counted as readable acknowledgements.

Work's images come from three explicitly identified source runs; Work10 subsequently passed all three areas together. Planner/previous-six passed again on the incorporated dev, but the combined decoded log could not be retrieved. That workflow status is preserved without inventing combined counters or relabeling the earlier images.

[Draft PR #588](https://github.com/gustavomhss/Orchestra-SF/pull/588) awaits user review after all twenty areas are qualified. Earlier-wave acceptance does not approve this block.
