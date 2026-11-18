# N24 U16/U17 — concrete GitHub handoff

**Branch:** `sf-ux-n24` • **Base:** `sf2-stack` • **Epoch:** `ux-native-n24-e1`  
**Integrator:** 125 (PR #65) • **Hosted tests:** 120 (PR #106) • **Compiler:** 119 (PR #107)  
**Admitted author:** `gustavomhss` GitHub 228147811; ACK at `ACK.json`.

## Landed in owned product destinations

| Surface | Owner | Concrete implementation |
|---|---|---|
| UI33 | U16 | `decisions/cases/{model,route,create,index}.ts(x)`: authorized projection list, reversible filtering, new-case review, case ref, opaque creation correlation and fail-closed unknown result |
| UI34 | U16 | `decisions/intent/index.tsx`: source objective/horizon/criteria/participants/source evidence and gaps; no invented update command |
| UI35 | U17 | `decisions/alternatives/index.tsx`: current source scenarios, versions, costs, coverage, missing categories, controlled compare and current-choice preparation (not promotion) |
| UI36 | U17 | `decisions/assumptions/index.tsx`: recorded assumption status/evidence, filter, missing categories and factual divergences (no fake confirmation) |
| UI37 | U17 | `decisions/questions/{index,answer,cycles,consume}.tsx`: source questions, recipients, preparation, original output validation, explicit source choice, storage CAS, answer confirmation and cycle work |
| Layout | U16/U17 | `decisions/cases/n24.css`: responsive single/split, focus-visible, wrap, reduced-motion |
| Localization | U16/U17 | `src/i18n/orchestra-chapters/sf-u16.ts` and `sf-u17.ts`, typed EN/PT-BR records |
| Journey | U16/U17 | `e2e/sucafina/native/journeys/u16.spec.ts` and `u17.spec.ts`: source-backed 320–1440 and 200% cases, **written only** |

All 16 product/locale/test files were **absent** at the original verified branch HEAD `526e7204b310756e552196bbf3d64037dbbf047c`, then created as own leaves. GitHub blob **postimages per path** are in `EVIDENCE.json`. No files of other authors were edited.

## Dependence and prove gates — do not infer green

- **Hard gate, F02/A04 path binding:** existing A04 `{surface}` templates lack an allowed way to bind the source surface in several strict inputs; F02's `operationUrl` rejects unbound routes. This blocks claims of working native source IO until 125/119 land a source-proven fix.
- **Hard gate, creation recovery:** native typed A04 omits original `workbench-create-recover` operation and its scope header; ambiguous outcomes stay unknown without replay, not certified end-to-end.
- **Hard gate, A13 dependency:** collaboration client/schema are still on `sf-ux-a13`; U17 types against that author-owned contract. Do not substitute a parallel storage provider.
- **Shared 125 composition:** insert UI33–UI37 into the existing F01 native registry; import U16/U17 dictionaries in typed locale registry; expose A13 package subpaths after its own admissible integration. Inert exact patch at `SHARED-PATCHES.md`. Do **not** cherry-pick shared files from another owner.

## Observed versus unproven

**Observed:** source pins, GitHub ACK commit, all owned product file blob postimages, immutable evidence receipt and code commits are remote in `sf-ux-n24`.  
**Not observed:** locally executed tests (forbidden), hosted test pass, typecheck/compiler pass, network source calls, browser screenshots, accessibility audit, 200/400% visual proof, end-to-end mutation receipts and PR integration. `EVIDENCE.json` explicitly says `NOT_RUN`. Written Playwright files are test authoring only, not passing reports.

## Next owner actions

1. **125** admit branch changes only on `sf2-stack` under its current epoch; apply `SHARED-PATCHES.md` after independently checking preimages and A13/F02/A04 contract revisions.
2. **119** run hosted compiler and report exact file/line errors, including A04 surface template mismatch. N24 has not run a local parser, typecheck or lint.
3. **120** execute two surgical Playwright journeys after F01, A04 and A13 are integrated; capture actual output, visual/screenshots and state gates.
4. **125/S0** collect producer authorization/recovery evidence, re-run gates and only then classify UI33–UI37 as integrated/qualified.

No dev merge, deploy, alternate dispatcher, parallel backend, override of `protected_paths` or Goal restart was attempted by N24.
