# Planner evidence — CAP20–CAP23

**Observed result: 2 tests passed, 5 confirmed writes and 5 exact source readbacks, 40 complete captures.**

[GitHub Actions run 44961772161](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44961772161) · [Immutable test snapshot](https://github.com/gustavomhss/Orchestra-SF/tree/9f52fd75da5f789f91b61d595a86651277ec2ec0) · [Tested product commit](https://github.com/gustavomhss/Orchestra-SF/tree/70b756800304adb9c0e9ff494f3cd3fc189fe828) · [Machine-readable manifest](manifest.json)

The original enrolled installation and source producers supplied all records, authority, revisions and acknowledgements. Every fixture title identifies test data. Neither browser responses nor native context were intercepted. Both English and Portuguese runs ended with empty page-error and console-error collections.

## Confirmed source behavior

| Area | Observed behavior |
| --- | --- |
| CAP20 — Headcount | Position draft survives revise/cancel, confirmed FTE changes from 1 to 0.9 and is read back from the original source. An unavailable roster-impact action stays unavailable. |
| CAP21 — Allocations | Entity distribution is reviewed and confirmed from 65/35 to 60/40, with 100% total and source version 2. An absent contract reference stays absent. |
| CAP22 — FX | EUR changes from 1.08 to 1.09 with its actual source reference, provider and observation time; the reread preserves the provenance. An absent BRL rate stays absent. |
| CAP23 — Versions and comparison | Version rename and copied version are independently reread; comparisons show source values and all twelve months, with keyboard access to the horizontal table. |

## Coverage limits

The views were observed in Chromium, English and Brazilian Portuguese, light/dark themes and desktop/320px viewports. Actual browser zoom and other engines were not tested. Registered route scope is broader than these journeys: this gallery does not assert a successful command for every route or producer. The comparison intentionally reports an unspecified source currency when no currency is supplied. User acceptance and merge remain pending.

## CAP20

### CAP20-list-dark-desktop-test-data

![CAP20-list-dark-desktop-test-data](CAP20-list-dark-desktop-test-data.jpg)

### CAP20-list-light-desktop-test-data

![CAP20-list-light-desktop-test-data](CAP20-list-light-desktop-test-data.jpg)

### CAP20-list-light-320-test-data

![CAP20-list-light-320-test-data](CAP20-list-light-320-test-data.jpg)

### CAP20-dark-320-position-editor-test-data

![CAP20-dark-320-position-editor-test-data](CAP20-dark-320-position-editor-test-data.jpg)

### CAP20-dark-320-position-review-test-data

![CAP20-dark-320-position-review-test-data](CAP20-dark-320-position-review-test-data.jpg)

### CAP20-dark-desktop-confirmed-source-test-data

![CAP20-dark-desktop-confirmed-source-test-data](CAP20-dark-desktop-confirmed-source-test-data.jpg)

### CAP20-dark-desktop-unavailable-roster-impact-test-data

![CAP20-dark-desktop-unavailable-roster-impact-test-data](CAP20-dark-desktop-unavailable-roster-impact-test-data.jpg)

### CAP20-pt-BR-dark-desktop-test-data

![CAP20-pt-BR-dark-desktop-test-data](CAP20-pt-BR-dark-desktop-test-data.jpg)

### CAP20-pt-BR-dark-320-test-data

![CAP20-pt-BR-dark-320-test-data](CAP20-pt-BR-dark-320-test-data.jpg)

## CAP21

### CAP21-shared-catalogs-dark-desktop-test-data

![CAP21-shared-catalogs-dark-desktop-test-data](CAP21-shared-catalogs-dark-desktop-test-data.jpg)

### CAP21-shared-catalogs-light-desktop-test-data

![CAP21-shared-catalogs-light-desktop-test-data](CAP21-shared-catalogs-light-desktop-test-data.jpg)

### CAP21-shared-catalogs-light-320-test-data

![CAP21-shared-catalogs-light-320-test-data](CAP21-shared-catalogs-light-320-test-data.jpg)

### CAP21-dark-320-distribution-editor-test-data

![CAP21-dark-320-distribution-editor-test-data](CAP21-dark-320-distribution-editor-test-data.jpg)

### CAP21-dark-320-distribution-review-test-data

![CAP21-dark-320-distribution-review-test-data](CAP21-dark-320-distribution-review-test-data.jpg)

### CAP21-dark-desktop-confirmed-distribution-test-data

![CAP21-dark-desktop-confirmed-distribution-test-data](CAP21-dark-desktop-confirmed-distribution-test-data.jpg)

### CAP21-pt-BR-dark-desktop-test-data

![CAP21-pt-BR-dark-desktop-test-data](CAP21-pt-BR-dark-desktop-test-data.jpg)

### CAP21-pt-BR-dark-320-test-data

![CAP21-pt-BR-dark-320-test-data](CAP21-pt-BR-dark-320-test-data.jpg)

## CAP22

### CAP22-rates-and-provenance-dark-desktop-test-data

![CAP22-rates-and-provenance-dark-desktop-test-data](CAP22-rates-and-provenance-dark-desktop-test-data.jpg)

### CAP22-rates-and-provenance-light-desktop-test-data

![CAP22-rates-and-provenance-light-desktop-test-data](CAP22-rates-and-provenance-light-desktop-test-data.jpg)

### CAP22-rates-and-provenance-light-320-test-data

![CAP22-rates-and-provenance-light-320-test-data](CAP22-rates-and-provenance-light-320-test-data.jpg)

### CAP22-dark-320-rate-editor-test-data

![CAP22-dark-320-rate-editor-test-data](CAP22-dark-320-rate-editor-test-data.jpg)

### CAP22-dark-320-provenance-review-test-data

![CAP22-dark-320-provenance-review-test-data](CAP22-dark-320-provenance-review-test-data.jpg)

### CAP22-dark-desktop-confirmed-provenance-test-data

![CAP22-dark-desktop-confirmed-provenance-test-data](CAP22-dark-desktop-confirmed-provenance-test-data.jpg)

### CAP22-pt-BR-dark-desktop-test-data

![CAP22-pt-BR-dark-desktop-test-data](CAP22-pt-BR-dark-desktop-test-data.jpg)

### CAP22-pt-BR-dark-320-test-data

![CAP22-pt-BR-dark-320-test-data](CAP22-pt-BR-dark-320-test-data.jpg)

## CAP23

### CAP23-version-ledger-dark-desktop-test-data

![CAP23-version-ledger-dark-desktop-test-data](CAP23-version-ledger-dark-desktop-test-data.jpg)

### CAP23-version-ledger-light-desktop-test-data

![CAP23-version-ledger-light-desktop-test-data](CAP23-version-ledger-light-desktop-test-data.jpg)

### CAP23-version-ledger-light-320-test-data

![CAP23-version-ledger-light-320-test-data](CAP23-version-ledger-light-320-test-data.jpg)

### CAP23-dark-320-version-editor-test-data

![CAP23-dark-320-version-editor-test-data](CAP23-dark-320-version-editor-test-data.jpg)

### CAP23-dark-320-version-review-test-data

![CAP23-dark-320-version-review-test-data](CAP23-dark-320-version-review-test-data.jpg)

### CAP23-dark-desktop-copy-review-test-data

![CAP23-dark-desktop-copy-review-test-data](CAP23-dark-desktop-copy-review-test-data.jpg)

### CAP23-dark-desktop-confirmed-copy-test-data

![CAP23-dark-desktop-confirmed-copy-test-data](CAP23-dark-desktop-confirmed-copy-test-data.jpg)

### CAP23-source-comparison-dark-desktop-test-data

![CAP23-source-comparison-dark-desktop-test-data](CAP23-source-comparison-dark-desktop-test-data.jpg)

### CAP23-source-comparison-light-desktop-test-data

![CAP23-source-comparison-light-desktop-test-data](CAP23-source-comparison-light-desktop-test-data.jpg)

### CAP23-source-comparison-light-320-test-data

![CAP23-source-comparison-light-320-test-data](CAP23-source-comparison-light-320-test-data.jpg)

### CAP23-dark-320-keyboard-monthly-scroll-test-data

![CAP23-dark-320-keyboard-monthly-scroll-test-data](CAP23-dark-320-keyboard-monthly-scroll-test-data.jpg)

### CAP23-pt-BR-dark-desktop-test-data

![CAP23-pt-BR-dark-desktop-test-data](CAP23-pt-BR-dark-desktop-test-data.jpg)

### CAP23-pt-BR-dark-320-test-data

![CAP23-pt-BR-dark-320-test-data](CAP23-pt-BR-dark-320-test-data.jpg)

### CAP23-compare-pt-BR-dark-desktop-test-data

![CAP23-compare-pt-BR-dark-desktop-test-data](CAP23-compare-pt-BR-dark-desktop-test-data.jpg)

### CAP23-compare-pt-BR-dark-320-test-data

![CAP23-compare-pt-BR-dark-320-test-data](CAP23-compare-pt-BR-dark-320-test-data.jpg)
