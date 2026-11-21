# Planner wave four — BR catalog review

The source-English entries are unchanged. A textual comparison of the original and authored dictionaries found 178 identical English key/value pairs and 178 corresponding BR keys: u08 has 57, u09 has 43, u45 has 39 and u46 has 39. This is a source-content audit, not a runtime type or rendering result.

The only values equal in both locales are Headcount (the established people-planning title already used in this project), FTE and USD (acronym/currency code), and Total (the same word in both languages). No unexplained English field/action leftovers remain in these four BR catalogs. Existing u41/u42/u43 translations were retained.

## Terminology sources inspected

- Existing Orchestra sf-u06 Planner and sf-u03 People BR catalogs at the previous wave source: preserves the project's terms for planning, source values, headcount, forecast and original-data limits.
- [Firefox Brazilian Portuguese preferences](https://github.com/mozilla-l10n/firefox-l10n/blob/main/pt-BR/browser/browser/preferences/preferences.ftl), blob b3ddf52ca28ef421da7ca12549b67084b5b84735: established complete action/control phrasing, including copy, selection, cancellation, configuration and search.
- [Firefox Brazilian Portuguese common dialog](https://github.com/mozilla-l10n/firefox-l10n/blob/main/pt-BR/toolkit/toolkit/global/commonDialog.ftl), blob 5ab6b22b9e6fc0c335008daa637f6fb2012d1bd0: concise native control terminology.
- [VS Code Brazilian Portuguese Git catalog](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-pt-BR/translations/extensions/vscode.git.i18n.json), blob fd1594a7c7c52b3726d0d5266f50d402029181d2: save, discard, confirm and changes terminology in a maintained developer product.

These corpora support control phrasing, not business policy. The financial/domain meaning continues to come from the unchanged English source and original producer contracts. Numerals, currency presentation and dates keep their existing native Intl formatting; this wave adds no plural grammar or locale-dependent business logic.

## Review focus

Check the complete phrases in their rendered context, especially allocation classification versus distribution, source reference versus provider, roster synchronization versus a new position, and copying a fiscal plan. Headcount remains the existing product title; FTE is not expanded into an inferred employee count. USD remains an exact currency identifier.

Remote BR captures are authored for all four Planner domains and comparison at desktop and 320px. The consolidated Actions evidence determines runtime completion and final visual acceptance.
