# Handoff — audit-one

SHA: 1c02f68f036217cf893990e1de94d73abfef802d (último commit de produto integrado; este handoff é o commit seguinte)
Data: 2026-11-19T14:45:36-03:00
Estado: partial

PR existente: [#349](https://github.com/gustavomhss/Orchestra-SF/pull/349), base `close-final-candidate`. Não abrir outro PR.

## Feito

- **Pré-requisito integrado primeiro:** `043798870304ed15a6f7ad852c9e7a9f7aeac9cb` e `dcdaa904af530dfd020b0454329f8e7808e3097f` de `audit-one-tip`.
- **WP1:** core e CLI compilaram de verdade no [run 44553716279](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44553716279), 2/0. O runner Bun de test-ci executa testes; typechecks são disparados por harness Node exclusivo de CI.
- **WP2 / Operations:** os cinco casos originais passaram no [run 44553973512](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44553973512), com ClamD real. A abertura do fornecedor único veio do commit exigido no brief.
- **Core/native integrado:** correção do coordenador de Session e fixture com localização nativa canônica. Unit [44556979548](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44556979548): 31/0; sete componentes originais SF2/SF8 [44557097018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44557097018): 7/0. Controle negativo com coordenador antigo falhou como esperado em 44557988536.
- **C08 integrado:** recibo aceita somente a intenção original/já admitida ou retomada exata. [44558502952](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44558502952): 1/0, 59 asserts; seis negativos de recuperação passaram em 44557577263. Preservar o blob final do teste `handoff-c08-integration.test.ts`: `59756ace4ed97c0d90c29b933da01bb466a20430`.
- **Memory + domínio integrados:** witness privado restrito ao mesmo owner, revalidações atuais e descarte final. [44572249494](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44572249494): 14/0, 1.348 asserts, incluindo WP14, oito casos de projection-access, histórico, revogação e isolamento entre chamadas.
- **SF2 inicial integrado em 15fd6f3:** Planner canônico, período de origem, autorização com cópia da superfície necessária, fixture local explícita e correções WP12. Gate amplo [44569728195](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569728195): 129/1, 2 skips preexistentes, 3.706 asserts; WP12 pending 86,689 s e executive 39,614 s passaram. A falha restante foi rollover WP08.
- **DOCX integrado em 1c02f68f036217cf893990e1de94d73abfef802d:** `product/reviews/render.ts`, `reports-support/ooxml.ts` e `docx-continuation130/table-flow.test.ts`. Contexto de continuação tem estilo explícito e é validado antes de separar os dados; geometria e textos continuam iguais. [44578223416](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44578223416): 4/0; 475 tuplas completas em cada formato DOCX/PPTX e nove corrupções rejeitadas.
- **Composição atual compilada:** produto `969d7eb7c198647643b4f096a0c112cf21013618`, branch `audit-qualification2`. [44579240217](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44579240217): sucafina, CLI, app-shell e `typecheck:sf-e2e` passaram. A composição inclui os candidatos UI/SF2/SF8 abaixo, ainda não todos integrados.
- **UI candidata, ainda não integrada:** `audit-ui@ae9e1eabb7132c0397418f8a14cb7cd11e63d7de`. Entradas reais de Workbench, controles de decisão, refresh explícito preservando seleção/ordem/histórico, discussão C05 e leitura de catálogo. Gates: rotas 44560242503 (6/0); decision-list 44568689037 (1/0); refresh 44573125347 (5/0, 149 asserts); commandIdentity C05 44579010232 (13/0, 225 asserts); seletor DOM de portfólio 44578630862 (1/0, 8 asserts). O seletor captura apenas `section[data-portfolio]`; a recuperação de criação perdida aguarda o GET real antes de reabrir o catálogo.
- **SF8 candidato, ainda não integrado:** `audit-sf8@848fea91caed668355caa7360f9a28fc0fa95f74`, 16 arquivos. Fontes/BI sem atalhos de projeção fabricados, provas preservando ordem e bijeção, resultados reais 55.000/15.000 e verificador Planner que constrói sua projeção privada uma vez. Chrome/local 44557750633: 13/0; BI [44575862758](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575862758): 20/0, 706 asserts, 392,06 s; unit/recertificação 44574897375: 2/0, 69 asserts. O loop longo Finance ainda falha no orçamento, detalhado abaixo.

## Pendente

- **WP3 — UI-DECISIONS** — `packages/app-shell/e2e/sucafina/decisions.spec.ts:20-26`. Run anterior 44571336628: 3/2; comparação real excedia deadline HTTP de 10 s. Também foram corrigidos seletor DOM que capturava um botão e sincronização com recuperação real da criação. **Em andamento:** [44579520386](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44579520386), snapshot `1b6559da4a307d276297777fe650b13aafe3911b`, sobre 969d7eb. Não declarar o WP verde antes do resultado.
- **WP4 — UI-REPORTS** — `packages/app-shell/e2e/sucafina/reports.spec.ts:29,44`. A entrada real funciona; run 44571399074 expôs CPU de catálogo/refresh, identidade C05 ausente e parser DOCX. C05 e parser têm gates verdes separados. **Em andamento:** [44579546482](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44579546482), snapshot `52409395db75162cf35dd4758af54371a0cc65c8`, sobre 969d7eb. Inspeção mostrou que após preserve o estado tem reviewRef, mas a URL ainda é composer; confirmar evidência antes de corrigir canonicalização da URL. Não reduzir frequência/deadline nem omitir autorização.
- **WP5 — rollover WP08** — `modules/sucafina/Sucafinav1/test/product/wp08/thread-period-continuity.test.ts:51`. Candidato `audit-dashboard-issue@ae078ad9d7a95c92e93fdd73aca059e72f66c94b`: emissor mantém duas leituras e checker canônico de metadata; wrappers conservam fallback. Run 44577596761: 39/1, rollovers 25,005/25,841 s; falha adjacente revelou receipt revivível após relógio NaN. Isso foi corrigido, incluindo NaN/±Infinity antes/depois de authorize. Run [44578870858](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44578870858): 50/2, 390 asserts; todos os negativos/relógio passaram, mas rollovers 32,654/33,330 s excederam 30 s no runner mais lento. Ainda precisa margem real. Não repetir só para obter verde. Nova direção sob revisão: mover a projeção com environment.at para a observação já autorizada do checker, conservando as duas leituras e a prova do registry.
- **Finance adjacente a WP6** — `modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts:22`. [44575731374](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575731374): 11/1, 316 asserts. Único vermelho: três estados de treinamento em 350,413 s para orçamento original de 300 s (66,901 + 139,101 + 144,405). Escolha humana, limites, serializações legadas, quatro negativos de read-scope e recertificação persistida passaram. Perfil de hashes do mesmo loop em andamento: 44578926510, snapshot `ce18499dc1eb54c5c0e6fddb44b4e10af9b3b6c1`. Investigar também ligação dos selectors C08 já existentes, sem reduzir observações/guards.
- **Revisão de paths protegidos herdados** — `godfile-waivers.json` e `script/spawn-allowlist.json`. [44571819429](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44571819429): spawn PASS; guards base PR 0 gates/1 warn; base origin/dev 2 gates/194 warns. Os dois blobs são idênticos em 7c7dc2, na base PR 52d2c24 e no candidato: não foram modificados nesta campanha. A skill `guardrail-usage` exige decisão de reviewer para o label `guardrail-approved`; não autoaprovar a própria mudança. PR atualmente sem labels e sem reviews. Concluir o trabalho autorizado antes de solicitar essa revisão concreta.
- **WP7 — fecho** — `.github/workflows/sf-ci.yml`. Nenhum novo sf-ci completo foi disparado. Depois de fechar os WPs e resolver a revisão protegida, integrar somente blobs de produto, atualizar este handoff, rodar o único sf-ci final e ler também SF-1/3/4/5/6, cancelados no run original 44541428344.

## Decisões e justificativas

- Asserções originais removidas: **nenhuma**. Orçamentos originais preservados. Novos negativos foram adicionados para fonte, metadata, Request, headers, binding, lease, seleção, relógio e export.
- Console legado permanece desligado: GET bare `/sucafina/dashboard|planner|procurement` retorna 404 `legacy console decommissioned — use /`. `?page=` continua shell; `?asset=page` continua fragmento; `?sf=` é operação explícita. Não ressuscitar console para passar UI.
- Nenhum dado, grant, decisão humana ou aprovação foi fabricado. Se C12 alcançar um controle/estado sem produtor real, reportar a fronteira concreta; o próximo gate UI ainda precisa confirmar.
- O atalho proposto de confiar só na identidade do método readScopedSource foi rejeitado: um driver pode adulterar o resultado ou descartar commit. Manter checker/prova canônica.
- Fixtures usam autoridade e armazenamento reais. A fixture C05 agora prova lista vazia sem ACL e pessoa visível somente após ACL real explícita.
- Probes, perfis, harnesses, requests e workflow de download de artefatos são **exclusivos dos snapshots ci-run**. Não integrar esses arquivos.
- Não houve mudança em `apps/cli/script/distribution-payload.ts`; não repetir linux-factory já verde no run 44541428351.

## Como retomar

1. Partir de `audit-one@1c02f68f036217cf893990e1de94d73abfef802d` mais este commit de handoff. Base de composição para gates atuais: `audit-qualification2@969d7eb7c198647643b4f096a0c112cf21013618`.
2. Ler os runs em andamento UI 44579520386/44579546482 e Finance 44578926510 antes de criar outro gate. Manter um writer por arquivo e branches separados.
3. Fechar a performance WP08 com SF2 e Finance com SF8, sem alterar limites ou fabricar prova. UI mantém ownership dos controles, navegação e fixtures; root mantém render.ts/ooxml.ts e integração.
4. Integrar sequencialmente somente arquivos finais qualificados. Preservar WP13 blob `59756ace4ed97c0d90c29b933da01bb466a20430`; não copiar árvores inteiras das composições, que contêm mudanças ainda não integradas.
5. Revalidar compilação/guards no produto final, obter revisão legítima dos dois paths herdados, atualizar este handoff e executar o único sf-ci no fim. Não abrir PR novo.

## Comandos e resultados

- Cada WP usa `ci-run-linux-<nome>` + `.ci-run.json`. Bun seleciona arquivos exatos; Playwright usa package `app`, config `e2e/playwright.production.config.ts` e specs inteiros. Não usar grep com o validador production.
- `bun run typecheck` (sucafina/CLI/app-shell) e `bun run typecheck:sf-e2e`: PASS em 44579240217. Core: PASS em 44553716279 e 44569979607.
- `bun run check:spawn-imports`: PASS em 44571819429.
- `bun run check:guards --base origin/dev`: 2 gates herdados; base PR 0 gates. Nenhum label de aprovação aplicado.
- `bun run test:ci ...`: evidências por escopo nas seções acima; executar apenas via GitHub Actions, sem shell/testes locais.
- `sf-ci` final: **não rodado nesta campanha**. Último full permanece 44541428344 no SHA 7c7dc2fac55.
