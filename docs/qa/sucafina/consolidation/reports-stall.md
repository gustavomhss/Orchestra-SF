# CI-UI-REPORTS stall note

Job `134890490475` (`sf/test-CI-UI-REPORTS`) from run `44329483839`.

`SF_REPORTS_TRACE` is absent. The suite never started, so there is no `REPORT_READ2_DONE` / `REPORT_STORED_DONE` stop and no hanging await to name.

The first real error is the same Effect 4 export failure as UI-OPERATIONS. Vite failed the production webServer build before Playwright:

```
packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/producer.ts (56:27): "decodeUnknownEither" is not exported by effect/dist/Schema.js
packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/producer.ts (1:9): "Either" is not exported by effect/dist/index.js
import { Either, Schema } from "effect"
Error: Process from config.webServer was not able to start. Exit code: 1
```

No product change on this branch. The import fix is owned by `sf-effect4-imports`.
