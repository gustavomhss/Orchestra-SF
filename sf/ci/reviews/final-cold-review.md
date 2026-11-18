# A1 — CI-12: revisão fria do PR #242 (W0/W1, 2026-11-16)
**Veredito: CHANGES REQUIRED / NÃO MERGEAR.** Revisão independente de leitura de 16 patches do [PR #242](https://github.com/gustavomhss/Orchestra-SF/pull/242), metadados, manifests, YAML, logs de Actions e revisão prévia `validation/final-bundle/gpt-review-pr242.md`. A1 **não** aprova PR, não altera código e não substitui 3 pareceres humanos/release Azure. Nenhuma review GitHub formal encontrada ao consultar `list_pull_request_reviews`. O status `mergeable=true` é apenas mecânico.

## Matriz de todos os 16 caminhos alterados (observação de escopo)
| Patch #242 | Propriedade / risco para a migração Linux/Web |
|---|---|
| `.github/workflows/sf-ci.yml` | A6; Linux/PR+dispatch, 12 jobs. **B1, B2, M2, M3 pendentes**; `sf/verify` negativo observado |
| `.github/workflows/sf-release.yml` | A10; fail-closed intencional; não há deploy Azure real; **M1 / BLOCKED** |
| `.github/workflows/test-ci.yml` | A2; Linux-X64 exclusivo; verificar consumidores externos antes de concluir equivalência |
| `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts` | A4; substitui `createDraft` por `createSfDraft`; run browser segue RED, não confundir alteração de fixture com correção integral |
| `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts` | A4; 2 Q01 portáteis, comparador congelado de 305 operations + extensões |
| `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts` | A9; preserva três negativas F04 live, retiradas do PR Bun (SEM PASS até Azure real) |
| `packages/core/test/test-ci-request.test.ts` | A2; remove matriz cross-OS; valida `systems={linux:[ubuntu-24.04]}`; não provar universais via recorte |
| `script/sf-ci/gate.mjs` | A2; recibo SHA/run/attempt/runner/digest, precheck + verify; **B2/M4 identidade de caso ausente** |
| `script/sf-ci/gate.test.mjs` | A2; negativos sintéticos úteis, não cobrem omissão de arquivo obrigatório da seleção real |
| `script/test-ci-request.ts` | A2; seleção Linux-only, pode afetar consumidores canônicos fora do produto; escopo intencional SF |
| `script/test-ci.ts` | A2; Linux-only e host request; contrato externo precisa de revisão |
| `sf/ci/CI-CLOSURE.md` | A10 (somente leitura A1); declara harness sem afirmar release; evidências históricas não servem a C |
| `sf/ci/PENDING-WORK.md` | A10; backlog detalhado e flags separadas, não aceite |
| `sf/ci/README.md` | A10; rationale de recortes, equivalência ainda aberta |
| `sf/ci/suites.json` | A2; 8 IDs e releases AM separados, mas YAML pode desviar (**B2/B3**) |
| `sf/release-target.json` | A10; `activation=BLOCKED`, correto até Azure real |

## Bloqueadores que impedem promoção de `sf/verify` como único required check
1. **BLOCKER B1 — typecheck E2E sem prova de inclusão:** `sf-ci.yml` usa `bun run typecheck:sf-e2e` sem `--showConfig`, `--listFiles` e `script/sf2h/final-bundle/verify-e2e-typecheck.mjs` do Epic. Um spec pode sair do grafo e typecheck verdejar. **A6** reinstala negativa real de omissão.
2. **BLOCKER B2 — manifesto não é seleção executada:** `sf/ci/suites.json` descreve arquivos/specs enquanto YAML duplica comandos e decisões. `gate.mjs` valida IDs/contagens, não correspondência *identidade por arquivo/caso*. Remover teste essencial pode verdejar. **A2 + A6** tornam manifest único/gate fail-closed, testam drift/seleção mutada.
3. **BLOCKER B3 — equivalência por requisito não provada:** CLI passou com 12 arquivos, Atlas com 4, porém cenário Linux/permission/Relay/Task/host excluído não recebeu matriz requisito→teste e provenance histórico `ci-recipes.json` ausente. **A6** recupera fonte original ou reconstrói auditavelmente contra `requests.json`+Epic+produtores, com revisão externa; **BLOCKED_BY_SOURCE** até então.

**MAJOR M2:** Epic fazia `bun run generate` + `git diff --exit-code`; novo YAML apenas `check:generated` em Atlas/client. A6 restaura ou demonstra equivalência com controle negativo.
**MAJOR M3:** guard base mudou `origin/dev` → base de PR/fallback. A6 compara mesmo tree contra as duas bases e registra receipts/diff; mudar base não pode omitir bloqueio.
**MAJOR M4:** Bun JUnit aceita `product_executed≥1`, 0 fail/skip, sem baseline/case identity. A2 fixa piso por suite/seleção, não inventa suite cheia por um teste.
**MAJOR M1 (fora do PR gate):** `sf/verify` ≠ Entra real, Azure instalado, dados/rollback, AM/F04. A10 mantém separate release attestation, AZ-01..08 pendentes.
**MAJOR PR #240:** 11 patches em branch distante, X casts union impossíveis, Y decoder sem proof Context-free, Z gate não rodado; A5 corrige antes de A9 LIVE; A1 não edita.
**MAJOR F0/base:** `sfa-coord` diverge do `close-final-candidate` (ahead18/behind2). `sf-ci-lean` e branch do A1 compartilham versão antiga do atributo `focusable`; o `close-final-candidate` tem mudança mas merge-ref do run ainda TS2322. **A6/A3** reconciliam tree/ancestralidade no SHA de checkout, não apenas branch names. A1 **não** move branches.

## Observações favoráveis que NÃO encerram blockers
- Runner novo `ubuntu-24.04` X64 e Omni binário real; preflight `success` e `sf/verify` **failure esperado** em upstream RED observado no [run 43958796792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43958796792). Não há mascaramento automático observado nesse negativo.
- Q01: duas provas de metadata/rotas foram movidas para `transport-contract.test.ts` e **três negativas live** permanecem em `transport-integration.test.ts`. Isso mantém inventário de 5 testes, mas **execução F04 não está comprovada**. A4 valida portáteis, A9 executa F04 só após A7/A8/C.
- Mudanças multi-OS parecem direcionadas ao produto Linux x64, decisão de escopo aceita; cuidado com consumidores de CLI fora do SF. `sf-release` inerte é proteção, não aceitação.

## Parecer e DoD de CI-12
**CHANGES_REQUIRED; bloqueio de merge e de migração de required checks.** Exigir evidência real e negativa B1/B2/M4, matriz B3, M2/M3, run completo **não cancelado** do SHA final com 12 jobs/8 receipts `sf/verify=success`, cold review humano e correção do produto sem retries/skips/forjar autorização. Run histórico 43958796792: `static/SF/APP-BROWSER/OPERATIONS/DECISIONS/REPORTS/verify = failure` — `PRODUCT_CI_GREEN=NO`. A10 só congela C depois das integrações; três revisores independentes e aprovação do dono para settings/release ainda **PENDING_OWNER**. Este texto é review documental por A1, **não** evento `APPROVE` em GitHub.
