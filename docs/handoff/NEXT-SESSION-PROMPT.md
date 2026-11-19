# Próxima sessão — continuar o PR #349 (`audit-one`)

> Você não tem terminal. Só GitHub: contents API, branches, commits, workflows, logs, artefatos.
> Este arquivo é o contexto completo. Leia até o fim antes de agir.

## 1. Missão

Fechar os quatro gates vermelhos que sobraram do PR **#349** (`gustavomhss/Orchestra-SF`, base `close-final-candidate`),
integrar os candidatos já qualificados, rodar **um** `sf-ci` no fim e commitar o handoff.

Nada de refactor adjacente. Menor mudança que faz o gate passar.

## 2. Estado exato (verificado em 2026-11-19 23:40 UTC)

- Branch de integração: **`audit-one`** → tip `1b60a62ec9c` (só doc). Base integrada `d140de16be6`; último produto integrado `5270973e31b`.
- PR: **#349**, base `close-final-candidate@52d2c24f4f8`. **Não abra outro PR.**
- Último `sf-ci` completo: **44541428344** em `7c7dc2fac55` → `failure`. Nada rodou depois.
- Última atividade de gate: **22:55 UTC**. A sessão anterior parou aí.
- Os dois commits do `audit-one-tip` (`04379887030`, `dcdaa904af5`) **já foram integrados** em `audit-one`.

## 3. O que já está verde (com run — não reabra)

| Peça | Run | Resultado |
|---|---|---|
| Compiladores sucafina/core/CLI/app-shell | 44579240217 | 4 PASS |
| Typecheck core+CLI | 44553716279 | PASS |
| OP-DOC-01 (5 casos operations) | 44553973512 | 5/0 |
| Core/native (coordenador + fixtures) | 44556979548 / 44557097018 | 31/0 e 7/0 |
| C08 handoff | 44558502952 | 1/0, 59 asserts |
| Memory + domínio | 44572249494 | 14/0, 1348 asserts |
| SF2 (WP5) integral | 44580788979 | 55/0, 401 asserts |
| SF8 BI | 44575862758 | 20/0, 706 asserts |
| SF8 unit/recertificação | 44574897375 | 2/0 |
| DOCX | 44578223416 | 4/0 |
| PAGE (14 specs) | 44611557163 | 154/0, 1028 asserts |
| Finance privado (b396) | 44612026777 | 69/0, 563 asserts |
| Critérios (8d9cd/2777fa2) | 44602150955 | 36/0, 276 asserts |
| C12 ordem (decisão do dono) | 44632508338 + c12-native9 | GREEN |
| File codecs | 44632446497 | GREEN |
| Proposals | 44630358847 | GREEN |
| Choice retry / local origin | choice-retry2 / localorigin1 | GREEN |

Regra: **não** repita um gate inalterado para "buscar verde". Verde já tem run.

## 4. O que está vermelho agora (com assinatura)

### WP-R1 — `reports15` (run 44631696084)
Specs `packages/app-shell/e2e/sucafina/reports.spec.ts` (RPT-01..04).
Assinatura: `SF_REPORTS_FAILED_SURFACE {"path":"/orchestra/sf-dashboard/opex/r_...","surfaces":[],"headings":[]}`
e `http proxy error: /sucafina/dashboard?download=json`, depois `Expected: 200`.
O download JSON não responde 200 dentro do budget. Ver se é a rota (`?download=json`) ou a superfície OPEX vazia.

### WP-R2 — `operations9` (run 44630165380)
`operations.spec.ts`; falha com `script "test:e2e:local" exited with code 1`. Puxe `--log-failed` para o assert exato.

### WP-R3 — `dashboard11` (run 44630303725)
`dashboard-installed` / BI instalado.
Assinatura: `SF_DASHBOARD_INSTALLED_TRANSPORT {"tab":"primary","id":21,"method":"POST","path":"/sucafina/dashboard","mode":"domain","action":"save-entry","event":"failed","code":"net::ERR_FAILED"}`
e muitos `http proxy error: /sucafina/status`.

### WP-R4 — `wp10-native6` (run 44630493615)
WP10 composição nativa. Assinatura: `http proxy error: /sucafina/status` e `test:e2e:local` exit 1.

> **Fato importante sobre `/sucafina/status`:** a rota **existe** (`modules/sucafina/Sucafinav1/local/entry.ts:111-121`, servida em `:281`).
> O `proxy error` significa que o alvo do proxy vite não estava no ar (subida/restart), **não** que a rota foi removida.
> Não "conserte" isso ressuscitando nada nem mexendo no 404 do console. Investigue readiness/porta/harness.

## 5. Candidatos já revisados, ainda não integrados

Integre **blobs**, nunca a árvore inteira. Cada branch abaixo foi lida por root + um segundo revisor.

| Branch | SHA | Conteúdo |
|---|---|---|
| `audit-qualification13` | `52d283ad23d` | composição qual11 + PAGE + título/comentário Decisions + Finance b396 |
| `audit-qualification12` | `5f9730d360f` | qualificação anterior (mesma linhagem) |
| `audit-ui` | `7b1e23161f7` | UI Decisions, C12 ordem (`procurement-closure.ts` blob `ea3933c5d7bd`), texto de justificativa |
| `audit-reports-page-observation` | `577d407c0a8` | PAGE/BusinessObservation (4 runtimes + 2 testes novos) |
| `audit-criteria-observation` | `2777fa26e3d` | critérios/WP3 (inclui `portfolio-criterion-observation.ts`) |
| `audit-finance-private-integrity` | `b39628b774a` | 3 runtimes comparando `canonicalSfValue` |
| `audit-finance-historical-pairs` | `35a8ecd2d03` | pares históricos em `verification.ts`/`planner-sensitivity.ts` |
| `audit-reports-observation` | `e955106436c` | observação RECORD do WP08 (não resolve a rota PAGE) |

Prova de integração já feita: os 61 blobs de `d140` + qual13 geram tree `8ffd78a3bbb4b0ab4573bce7f4623ff939d40f18`.

## 6. Fatos de produto (não inventar)

- `GET /sucafina/dashboard|planner|procurement` **sem query** = `404`, body `legacy console decommissioned — use /`.
  `apps/cli/test/factory-distribution-linux.test.ts` e o `queue-view` assertam isso. **Não ressuscite o console.**
- `?page=<Page>` = shell completo · `?asset=page` = fragmento · `?download` e `?projection=c02` = dados · `?sf=<mode>` = operação de produto.
- `?sf=` modes vivem no mesmo path (`document-*`, `import-*`, `bi-*`, `workbench-*`).
- Console legado é 404 por decisão; o app Orchestra (vite preview) é quem renderiza as telas nos e2e.
- `/sucafina/status` existe e devolve JSON de readiness.
- **C12 (decisão do dono, opção B):** aplica o rascunho revisado **primeiro**, submete/aprova **depois**, pelos comandos reais.
  Preservar `Estimated amount === operation.amount`, versão +1 e os asserts de recuperação/recibo. Já implementado e verde.

## 7. Mecânica de verificação (sem shell)

- Gate por WP: crie `ci-run-linux-<nome>-<data>` no SHA do WP com `.ci-run.json` na raiz:
  `{"package":"app-shell","runner":"playwright","args":["e2e/sucafina/reports.spec.ts"],"config":"e2e/playwright.production.config.ts"}`
  O workflow `test-ci` roda no push de `ci-run-*` e apaga a branch.
- Typecheck: harness Node no CI com os scripts reais (`bun run typecheck` por pacote; `bun run typecheck:sf-e2e`).
  Um `.ci-run.json` com `runner:"bun"` e `args:["typecheck"]` no pacote certo.
- Bun: `runner:"bun"`, `args` com arquivos exatos (`Sucafinav1/test/...`).
- Playwright: `package:"app"`, spec inteira (o validador não aceita grep).
- Guards: só rodam com checkout; use `ci-run-*`.
- **`sf-ci` final: `workflow_dispatch` uma única vez, no SHA final.** Dois no mesmo ref se cancelam.
- Pacote: push em `sfa-factory-package` (só se tocar `distribution-payload.ts`; já está verde em 44541428351).

## 8. Regras e armadilhas

1. **Não rode `sf-ci` antes de fechar os WPs.** Use `[skip ci]` nos commits de integração para não disparar PR-CI.
2. Integre blobs por WP, sequencialmente, com typecheck a cada merge. Nunca copie árvore de candidato.
3. Não apague asserção, não mude `Expected` para casar, não fabrique aprovação, não altere CAS.
4. Não aplique label `guardrail-approved` você mesmo. `godfile-waivers.json` e `script/spawn-allowlist.json` são herdados
   (idênticos a `7c7dc2` e à base); a revisão legítima é do dono/Maestro.
5. Não integre `.ci-run.json`, probes, harnesses, traces ou workflows novos.
6. Um writer por arquivo.

## 9. Contrato de retorno

Ao terminar — completo ou não — commite `docs/handoff/HANDOFF-audit-one.md` pelo template
(`docs/handoff/HANDOFF-TEMPLATE.md`) com: SHA, feito (com run id), pendente (com `file:line`), decisões,
como retomar, e gates com ids. Nunca diga "verde" sem citar o run.

## 10. Ordem sugerida

1. Ler `docs/handoff/HANDOFF-audit-one.md` no `audit-one` (é o diário detalhado desta campanha).
2. `reports15` → entender `?download=json` / superfície OPEX.
3. `operations9` → `--log-failed`.
4. `dashboard11` → `save-entry net::ERR_FAILED` + readiness.
5. `wp10-native6` → readiness do harness nativo.
6. Integrar `audit-ui`, `audit-result-selectors`-equivalente e qual13 (blobs) quando os WPs fecharem.
7. Compiladores no SHA exato final → um `sf-ci` → ler SF-1/3/4/5/6/7/8.
