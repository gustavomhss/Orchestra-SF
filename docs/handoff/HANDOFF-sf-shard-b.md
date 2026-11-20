# HANDOFF — sf-shard-b

## SHA e estado

- Estado: **PARTIAL — shards 4 e 6 enumerados; shard 5 interrompido; correções/gates por causa em andamento.**
- Base imutável: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
- Branch: sf-shard-b; código neste checkpoint: e55478bd29cd03d604116b855d45e3664270ba4e. Esta revisão acrescenta somente a atualização do handoff.
- Escopo: CI-SF shards 4, 5 e 6 de 8; apenas GitHub; verificação por Actions.
- `sf-ci` não foi executado. Não há declaração de GO ou de shard verde.

## Por shard

| Shard | Run | SHA testado | N pass / M fail | Estado |
| --- | --- | --- | --- | --- |
| 4 | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | `dd45d888617943df40e02815d58b59f88d8a18f7` | **497 pass / 14 fail** | 511 testes, todos os 118 arquivo s; Omni PASS, 428 spawns |
| 5 | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | `f0bccdc48b42a9d000f3bda6565fa3d88286c845` | **≥576 pass / ≥21 fail observados, sem sumário final** | job cancelado no limite de 45 minutos; 105 de 119 arquivos iniciados |
| 6 | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | `204a74491764dcde4da22ebe558efc318e04a777` | **409 pass / 23 fail / 2 skip** | 434 testes,109 arquivos, 7243 asserções, 2226,61 s; Omni declared PASS, 18 declarados / 824 spawns |

No shard 5 há 576 marcadores pass (um concatenado ao final de uma linha Received de HTML), 20 marcadores fail e uma asserção adicional visível em `work-bridge.test.ts:386`, cujo marcador fail não consta depois da linha longa. Há um skip Windows/DACL pré-existente em Linux. Esses números são limites observados, não uma reconstrução do sumário ausente. A checagem Omni final não chegou a executar.

## Falhas do shard 4

Caminhos abaixo relativos a `modules/sucafina/Sucafinav1/test/product/`. A tabela registra a enumeração na base. Commits e gates posteriores estão nas seções abaixo; nenhum recorte qualifica o shard inteiro.

| File:line | Casos | Observação | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| wp13/handoff-persistence.test.ts:95 | 1 | `ok` → `stale` | fixture-request-identity — novo Request em cada lookup (:58), incompatível com case-port.ts:84,107; C08 |
| wp13/coverage-sensitivity-integration.test.ts:115 | 1 | mutação de input aceita (`false` → `true`) | shared-security-input-mutation — `product/portfolio/verification.ts:203-205`; S10, PR #405 |
| wp13/handoff-domain-integration.test.ts:392 | 1 | preparação canônica indisponível | fixture sem `confirmed: false` (:391); correção publicada; ver fatias |
| wp13/handoff-c08-predispatch.test.ts:242 | 1 | replay retorna `conflict`, esperado `ok` | fixture-original-intent — substitui a versão do case em replay; produtor exige request original; C07 |
| wp13/handoff-canonical-integration.test.ts:176 | 1 | replay retorna `conflict`, esperado `ok` | fixture-original-intent — substitui a versão do case em replay; produtor exige request original; C07 |
| proof234/am04-c12-return.test.ts:78 → c12-receipt-recovery/consumer.ts:81 | 1 | leitura de receipts negada após revogação | fixture observa como Alice revogada; C02 — observação por Bob já autorizado publicada |
| wp12/native-execution-reevaluation.test.ts → wp12/native-portfolio-preparation.ts:150 | 1 | esperado total null, recebido 240000 | fixture confunde fonte sem operações com hipótese; C04 — correção publicada nos helpers de preparação |
| wp12/native-execution-purchase.test.ts → wp12/native-procurement-preparation.ts:193 | 2 | pending/complete: esperado total null, recebido 240000 | mesma causa de classificação da fonte; preservar null em hipóteses e cobertura incompleta |
| wp07/browser-ui.test.ts:242 | 1 | inscrição redireciona a `/`, ausente na fixture isolada | C03 — correção do cliente de inscrição publicada; componente existente permanece |
| ui-split/ui-source/draft-replay.test.ts:32 | 1 | replay exato após avanço legítimo: 403, esperado 200 | shared-draft-replay — `product/decisions/hot-topic-draft.ts:94-101,206-207`; S11, PR #406 |
| ui-split/ui-work/guards.test.ts:23 | 1 | exit 1 após 90011 ms | unbound — orçamento do subprocesso :19; somente WARN, nenhum finding de gate observado |
| integrated-proofs/am01/portfolio-recall-proof.test.ts:19 | 1 | timeout 240000 ms; 579798,97 ms observados | unbound — lifecycle do host; catálogo instalado vazio, sem inferência; limite :148 |
| integrated-proofs/am01/recall-five-profiles.test.ts:31 | 1 | SF_PRODUCT_AUTHORITY_CONFIG_INVALID | fixture duplica operações na linha 28; deduplicação publicada; C01 |

## Falhas observadas do shard 5

Mesmo prefixo de caminhos. Falhas observadas classificadas; nenhum resultado dos arquivos não iniciados é presumido.

| File:line | Casos | Observação | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| installed-bi-closure/sensitivity-history.test.ts:19,66 | 3 | deadlines cooperativos de 165000 ms | unbound — desempenho/lifecycle; sem aumentar limite por palpite |
| similarity217/installed.test.ts:53,99,137 | 3 | `ok` → `unavailable` | shared-canonical-recall-availability — positivos C09+Atlas indisponíveis; reason interno não exposto pelo assert |
| wp12/native-execution-bi.test.ts:85 | 2 | predicado esperado true, recebido false | fixture-native-source-link — URL e label nativos exatos; mesma causa de work-bridge; C06 |
| wp11/source-promotion-coverage.test.ts:182 | 1 | ordem de evaluatedSourceRefs diverge | fixture-source-first-evidence-order — comparar exatamente com avaliação humana já validada; C05 |
| wp01/planner-monthly.test.ts:44 | 1 | inscrição seguida de navegação a console retirado | contrato de UI legado — usa `?page=OPEX`; não restaurar console |
| wp00/contract-freeze.test.ts:19 | 1 | hash de `product/contracts/decisions.ts` diverge | contract-freeze-drift — não atualizar hash somente para verde |
| wp10/integration/portfolio-promotion.test.ts:227 → :43 | 1 | deadline cooperativo de 285000 ms | unbound — desempenho/lifecycle |
| wp10/integration/review-portfolio-http.test.ts:271 | 1 | `denied` → `unavailable` | shared-grouped-revocation-status — C08 externo ok, leitura interna unavailable em vez de denied; sem evidência de divulgação |
| wp10/integration/review-access-browser-fixture.ts:29 | 1 | WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE | unbound — deadline de transporte da fixture |
| wp10/integration/bi-lifecycle.test.ts:202 | 4 | inscrição redireciona a `/` não servida | contrato de shell legado; quatro casos de lifecycle, sem restaurar console |
| wp10/integration/portfolio-exact-threshold.test.ts:43 → :213 | 1 | denied/criterion-result-access-unavailable | shared-durable-sensitivity-access — verifySensitivity false / bind denied; dentro do orçamento, não timeout |
| wp10/integration/planner-calculation.test.ts:615 | 1 | 0 resoluções observadas, esperado 1 | fixture-instrumentation-copy — contador intercepta cópia retornada; Atlas usa objeto original (business-services.ts:540,726); preservar esperado 1 |
| wp10/integration/work-bridge.test.ts:386 | ≥1 erro de asserção adicional | HTML não contém `page=All+Projects`; marcador fail ausente após linha longa | fixture-native-source-link — mesma causa dos dois casos BI; C06 |

O cancelamento ocorreu durante `wp10/integration/planner-calculation.test.ts:684`, na chamada de recall em `:694`. Os dez casos seguintes não foram alcançados: `:718` (fonte persistida alterada), `:738` (oito variantes: source, membership, capture, coverage, selector, clock, principal, lease) e `:810` (isolamento lexical com cálculo paralelo). A cauda desse arquivo e os 14 arquivos abaixo ficam **unbound — não enumerados por limite do job**:

- `Sucafinav1/test/product/integrated-proofs/am06/correlate.test.ts`
- `Sucafinav1/test/product/review-fixes/finance-resume-performance/historical-batch.test.ts`
- `Sucafinav1/test/product/ui-split/ui-recovery/recovery.test.ts`
- `Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/atomic-rejection.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-unchanged.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard.test.ts`
- `Sucafinav1/test/product/wp06/imports/financial-impact.test.ts`
- `Sucafinav1/test/product/wp06/imports/receipt.test.ts`
- `Sucafinav1/test/product/wp06/imports/source-fences.test.ts`
- `Sucafinav1/test/product/wp10/analysis-composition/decision-controls.test.ts`
- `Sucafinav1/test/product/wp10/analysis-composition/decision-domain.test.ts`
- `Sucafinav1/test/product/wp10/atlas-business/case-event-continuity.test.ts`

## Feito e justificativas

1. Branch de trabalho criada exatamente na base; nenhuma outra branch de trabalho foi rebaseada.
2. Lidos AGENTS.md, contrato do runner, manifesto e seletor canônico. Nenhum shell ou teste local utilizado.
3. Inventário: 924 arquivos, menos 40 do harness ordenado e 1 release-only = 883 elegíveis. Partição e requests conferidos independentemente; shards 4/5/6 têm 118/119/109 arquivos. Nenhum arquivo foi removido.
4. O pedido literal fornecido não é admitido pelo runner da base:
   - `.github/workflows/test-ci.yml:30-37`: exige branch `ci-run-linux-*`.
   - `script/test-ci-request.ts:96-98`: exige `args`.
   - `script/test-ci-request.ts:12-15,133-140` e workflow `:144-159`: não permitem env `SF_*`.
   - `script/test-ci-package.ts:21-35`: resolve alias `sucafina`, não `modules/sucafina`.
5. Usados `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: [--timeout, 30000, ...todos os caminhos exatos do shard]`, env Omni=1. Branches de enumeração: `ci-run-linux-sfb-4r1`, `ci-run-linux-sfb-5r1`, `ci-run-linux-sfb-6`.
6. `runtime/application.ts:76-81,91-95,382` foi somente lido. HTML legado continua descomissionado. Nenhuma navegação de browser a :4110.
7. Quinze causas de fixture foram corrigidas em dezesseis commits, com um draft de testes (#410) e dois PRs shared (#405/#406). Gates somente após fix concreto; falhas reais de produtor não foram convertidas em expectativas de erro.

## Incidentes de admissão — zero testes de produto

- Runs 44645786965 e 44645800154 foram disparados na criação das branches no SHA base antes de existir `.ci-run.json`; falharam com ENOENT no passo Read request.
- Runs 44645789826 e 44645801987 receberam os arquivos exatos, mas falharam com `TEST_PACKAGE_NOT_FOUND:modules/sucafina` em `script/test-ci-package.ts:35`.
- As quatro execuções terminaram sem executar testes. Elas não são contadas como falhas de produto.
- Houve sobreposição transitória desses runs de admissão acima do limite de dois; não se declara cumprimento retroativo desse limite.
- Correção de publicação: criar árvore e commit completos via Git Data API ANTES de criar a ref `ci-run-linux-*`. Cada novo pedido passa a disparar somente um workflow. Pedidos seguintes usam o alias registrado e no máximo duas execuções ativas.
- As duas execuções involuntárias no SHA base repetiram o mesmo bloqueio de admissão ENOENT e ficam classificadas como `unbound`, sem testes de produto. Após corrigir a publicação e o alias de pacote, não houve repetição de pedido idêntico sem mudança.

## Limite da evidência

Os requests selecionam todos os arquivos canônicos de cada shard para verificação no Actions; o shard 5 foi interrompido e os shards 4 e 6 concluíram. O `test-ci` não produz o recibo completo de `sf-ci`, não executa sua verificação de cobertura e usa Omni no escopo `declared` para seleções explícitas. Não há alegação de baseline, coverage, digest de execução ou GO. Os hashes de seleção são cálculos de inventário, não recibos.


## Falhas do shard 6

Caminhos relativos a modules/sucafina/Sucafinav1/test/product/. Soma: 23 casos, sem contar novamente a lista repetida do sumário.

| File:line | Casos | Evidência | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| dashboard-installed-closure/consumer-read.test.ts:64,179 | 2 | Inscrição antes de Hot Topics/summary | Migração de UI instalada; não restaurar console |
| wp13/semantic-union-source-scenario.test.ts:50 | 1 | stale/portfolio-selection-changed após 180034 ms; deadline 180000 ms | unbound — desempenho, 10404 leituras de cases / 126564 revalidações |
| wp04/capabilities.test.ts:88 | 1 | unavailable/requisition-unavailable | C15 — CAS canônico requests:PR-1 ausente |
| wp04/ui-sourcing-analysis.test.ts:98 | 1 | 503 esperado, undefined recebido | Migração/integração; interface/http.ts:26,30 não admite workbench-sourcing-input |
| wp12/native-question-consumer.test.ts:149 | 1 | answer-reuse-unavailable; Planner com 17 campos | Dependência shared existente #400; ainda sem gate deste teste nesse head |
| wp12/native-verifier-negatives.test.ts:147 | 1 | invalid-forecast-input após false-monthly-total | C14 — seleção HTTP com caseRef passada ao Forecast canônico |
| wp12/native-execution-documents-contract.test.ts:21 → native-procurement-preparation.ts:193 | 1 | null esperado, 240000 recebido | C04 — fonte sem operações vs hipótese |
| wp01/http.test.ts:56 | 1 | workbench legado 404, esperado 200 | Migração de UI; não restaurar contrato retirado |
| wp01/import-receipt-browser.test.ts:26 | 1 | File encontra upload e checkbox | C13 — locator exato |
| wp01/alternative-contribution.test.ts:46 | 2 | Subtotal null/0; corpo de proposta ausente | Migração/apresentação; contribution-body.ts default vazio:53; payload/envelope passaram:37–42 |
| wp01/personal-views.test.ts:82 | 1 | Inscrição antes de ?page=OPEX | Migração de UI; :83–90 usa densidade e global legados |
| wp10/integration/calculation-ancestry-composition.test.ts:26 → composition-test-deadline.ts:5 | 1 | Deadline 105000 ms em produce-outer | unbound — desempenho; 573 leituras, 102548 ms na fase |
| wp10/integration/bi-case-access.test.ts:136 → bi-access-browser-fixture.ts:198 | 1 | Espera botão singular Abrir origem | C16 — opções reais de múltiplas origens; distinto de C06 |
| wp10/native-host/native-host-disposal.test.ts:38 | 7 | SessionSubagentModels ausente nos 7 modos | C12 — composição do host de teste |
| wp06/native/import-analysis.test.ts:156 → :326 | 1 | Contribuição persistida sem preview link renderizado | Migração do consumidor; persistência/importPreviewRef/mensagem passaram:148–155; não fabricarURL |

## Fatias de teste publicadas

Locais abaixo referem-se à causa na base, salvo indicação explícita. Revisão de fonte não substitui Actions.

| Causa | SHA do fix | Arquivo:linha e decisão | Gate |
| --- | --- | --- | --- |
| C01 | 122e311c4950e8846cb221ad554fd53d3d9b41de | integrated-proofs/am01/recall-five-profiles.test.ts:28 — Set da união completa de operações; remove somente duplicatas | [44656693207](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656693207) — sem sumário final; cancelled |
| C02 | 6e5dd957823b937665b91ba0020246d3bca7770d | proof234/am04-c12-return.test.ts:78 — recuperação Alice permanece negada; Bob já autorizado observa e compara o estado completo | [44663503882](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663503882) — 1 pass / 0 fail; success |
| C03 | d61fe54b772e244c194789f43f94429026bc1906 | wp07/browser-ui.test.ts:242 — inscrição real sem seguir redirect; afirma 303/Location /, abre componente isolado existente | [44663570903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663570903) — em andamento (in_progress) |
| C04 | dda42a61a089094f6560363449fdc734ad0566de | wp12/native-portfolio-preparation.ts:139–153; native-procurement-preparation.ts:190–199 — baseline conhecido exato 240000 e cobertura completa; hipóteses/null preservados | [44660393378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660393378) — 1 pass / 3 fail + 1 erro(s); failure |
| C05 | 4bcbffc7160c3f0a47c98155c4e40d139cc8b433 | wp11/source-promotion-coverage.test.ts:182 — igualdade exata com ordem de fontes da avaliação humana já validada | [aguardando run](https://github.com/gustavomhss/Orchestra-SF/tree/ci-run-linux-sfb-c05-4bcbffc) — em andamento (pending) |
| C06 | 6248b54d66f1d35b996c1c3e10c2836bf11b3c37 | wp12/native-execution-bi.test.ts:85; wp10/integration/work-bridge.test.ts:386 — URL e label nativos completos com fonte, versão, período e ano | [44662186554](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662186554) — 3 pass / 0 fail; success |
| C07 | e062c6f06142d223c5b8dfd59bd181d9ec5a3b16 + extensão 8d84b40e83b0d3c5e7466ffc2fd64da8d0396f3e | wp13/handoff-c08-predispatch.test.ts:242; handoff-canonical-integration.test.ts:162,176 — versão alterada conflita; replay da request original devolve recibo completo idêntico; extensão handoff-persistence.test.ts:170 | pendente |
| C08 | b91d281808c5428e0e0643bc49fd9400cad5ddbc | wp13/handoff-persistence.test.ts:58; handoff-domain-integration.test.ts:358 — mesma Request admitida durante a operação; gate persistence, domain coberto por C09 | [44656700681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656700681) — 0 pass / 1 fail; failure |
| C09 | 0e5a457f4d3728a149016b972eee88b2afcdf861 | wp13/handoff-domain-integration.test.ts:391 — intenção de rascunho confirmed:false; não é aprovação | [44662583356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662583356) — 0 pass / 1 fail; failure |
| C12 | afb087bb3028f7f6ab3706e50da6bbed5ddb459d | wp10/native-host/native-host-disposal.test.ts:19,57 — SessionSubagentModels real importado e exportado pelo root | pendente |
| C13 | 94763c9deec5898cdf5b20b2dfadc5858de4919e | wp01/import-receipt-browser.test.ts:26 — File com exact:true, sem modificar o resultado/contagem da importação | pendente |
| C14 | 489f6d09cf96ca7348aa362c81635ee1713f05ed | wp12/native-verifier-negatives.test.ts:106,146,165,202 — projeção dos quatro campos canônicos; preserva caseRef no HTTP e todas as provas adversariais | [44662785880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662785880) — 1 pass / 0 fail; success |
| C15 | 0e4541a5defc2f35385a45d50d9a4c9eb8a070aa | wp04/capabilities.test.ts:39 — CAS requests:PR-1 versão0, independente da revisão4 do wrapper legado | pendente |
| C16 | 4dff91a6503aa4ee6800e98030bde1c38114118b | wp10/integration/bi-access-browser-fixture.ts:195 — controle atual de múltiplas origens + vínculo refDigest64hex; preserva200 retido/403/limpeza/resposta tardia | [44663094821](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663094821) — 1 pass / 0 fail; success |
| C17 | e55478bd29cd03d604116b855d45e3664270ba4e | wp13/handoff-persistence.test.ts:147 (gate C08) — perda explícita após receipt real; indisponibilidade antes da reserva; execução única, recibos completos e CAS5/5 | pendente |

### Justificativas e limites

- C01 mantém a união completa de operações. C02 mantém a revogação de Alice e a negativa da recuperação; Bob já autorizado observa o mesmo estado completo.
- C03/C13 exercitam componentes/HTTP isolados existentes, não uma jornada instalada. Nenhuma rota de produção foi recriada.
- C04: planner/scenario-port.ts:107–129, wp03/source-scenario.test.ts:32–81 e wp13/source-scenario.test.ts:36–38 distinguem observação sem operações de hipótese. Total 240000 exige cobertura completa; hipóteses e cobertura ausente mantêm null/conditioned. Fontes e digests permanecem.
- C05: decisions/cost-coverage.ts:99–121 preserva a ordem da evidência humana, integrante do digest. Comparação exata, sem sort/contains.
- C06: apps/cli/src/sucafina-product/extended-source-links.ts:61–62,76–78,94 define rota e label. BI passa de predicado parcial para igualdade completa; work-bridge exige anchor completo.
- C07: c12-recovery-closure/original-intent.test.ts:60–68 exige conflito para versão alterada e recibo idêntico para request original.
- C08: case-port.ts:84,107 exige identidade estável. Gate ultrapassou :95 e expôs :147, esperado case-reconciliation-pending, recebido recibo ok. Novo ponto corrigido por C17; conservar este resultado histórico, gate conjunto com C07 pendente.
- C09: procurement-decision-producer/preparation.test.ts:55–74 exige intenção de rascunho explícita. confirmed:false não significa aprovação.
- C12: packages/core/src/session/subagent-models.ts:250 fornece o serviço real; package.json:397 exporta o módulo; AppNodeBuilder:24–33 fornece ao mapa de Locations os serviços exportados pelo root. Mesmas provas de grants, leases, tickets e interrupções nos 7 modos.
- C14: contracts/operations.ts:29–34,1167–1175 aceita somente baseRef/candidateRef/period/currency. caseRef HTTP, ataques, digests e provas de preservação continuam.
- C15: procurement/decision-preparation.ts:89–90 e prepared.ts:103–107 exigem CAS independente. Os probes collateral/settings de capabilities.test.ts:71,77 já omitiam confirmed:false e podem negar antes da razão nominal; este fix não amplia sua evidência.
- C16: analytics/source-navigation.ts:10–14,22–30 conserva todas as fontes e oferece rótulos A/B com digest verdadeiro. Permanecem200 autorizado retido,403 após revogação, ausência de dados privados e descarte do 200 tardio.

- C17: decisions/apply.ts:72–104 persiste a tentativa antes do dispatch e nega redispatch sem recibo; :125–158 já reconcilia o avanço normal do namespace. A fixture injeta perda da resposta somente após executePrepared real retornar ok, seguindo wp11/execution-reconciliation.test.ts:67–75. Indisponibilidade temporária do segundo producer ocorre antes da reserva. Exige os dois recibos reais completos, uma execução por domínio, valores 40/60 e CAS 5/5. Igualdades de receipts brutos usam state.read; cases.read continua nas provas da view. Revisão cruzada PASS, comportamento ainda depende de Actions.

## Gates de correção

| Causa | Run | SHA do request | Resultado |
| --- | --- | --- | --- |
| C01 | [44656693207](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656693207) | a0010a3b9f37d0e762cf4bd3a043ea6d9a4eb773 | sem sumário final; cancelled |
| C08 | [44656700681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656700681) | 9a699a80ee693cb257abe147d707ad073426143a | 0 pass / 1 fail; failure |
| S10 | [44657814166](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657814166) | 1642f3229d99624550da44cedfc8df52848e537b | 9 pass / 2 fail; failure |
| C04 | [44660393378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660393378) | be8321dfa6fb969650264c7282bc759940a0320c | 1 pass / 3 fail + 1 erro(s); failure |
| C06 | [44662186554](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662186554) | 2c3b227d23205cfd82ea42181e4cc2942acdaf33 | 3 pass / 0 fail; success |
| C09 | [44662583356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662583356) | 54b955411b4bea65cfc246500b5f001f521e5c27 | 0 pass / 1 fail; failure |
| C14 | [44662785880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662785880) | d9b371c6601f4d9c5cb3ea8649fa5da13be300f2 | 1 pass / 0 fail; success |
| C16 | [44663094821](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663094821) | aadfc91f667fdb42477499cc044d8e6c9fb5889c | 1 pass / 0 fail; success |
| C02 | [44663503882](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663503882) | 4ceb855f78c465e7e56fdc351f77d0d115133c45 | 1 pass / 0 fail; success |
| C03 | [44663570903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663570903) | 53a48cafae8f16b16e99d01d753ef6ac733a698c | em andamento (in_progress) |
| C05 | [aguardando run](https://github.com/gustavomhss/Orchestra-SF/tree/ci-run-linux-sfb-c05-4bcbffc) | a4980fbbe4e2bf7eae1f6636073ff32d791ab219 | em andamento (pending) |

Os requests estão nos commits indicados, em .ci-run.json. Cada run testa o fix SHA associado, acrescido somente do request. Os dois slots contam workflows até o encerramento completo.

C07+C17 compartilham um único gate de três arquivos porque a fixture persistence precisa das duas correções e C07 ainda não tinha gate. C04 agrupa os consumidores dos shards 4 e 6. C06 agrupa os dois arquivos do shard 5. Não converter a passagem de um recorte em passagem do shard inteiro.

### Falhas dos gates e evolução

- **C01 — [44656693207](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656693207):** Job cancelado no limite de 45 minutos, sem sumário Bun, sem marcadores pass/fail e sem checagem Omni final. Portanto N pass / M fail indisponível (0/0 marcadores não significa aprovação). Local: integrated-proofs/am01/recall-five-profiles.test.ts:24, entrada do teste; nenhum throw/asserção falha foi emitido. A configuração avançou além do antigo CONFIG_INVALID: catálogo inicial vazio, preparação canônica e negativos foram observados para finance, procurement, portfolio e maestro. Os marcadores de disponibilidade registram inferenceExecuted:false, outputRef:null, consumerRef:null e gnativeAccepted:false. Último checkpoint: sf_maestro em :98, às 02:33:30 UTC. sf_reviewer e a reabertura :132 não foram comprovados. O fonte define 900000 ms em :166, mas nenhum timeout Bun foi emitido; não atribuir o cancelamento a esse limite. Classificação: unbound — execução/desempenho ou lifecycle sem raiz interna demonstrada. Nenhum rerun.
- **C08 — [44656700681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656700681):** 0 pass / 1 fail em wp13/handoff-persistence.test.ts:147. A identidade estável ultrapassou a falha inicial :95; o novo ponto esperava reconciliação pendente onde o produtor atual reconcilia normalmente. C17 substitui esse pressuposto por perda explícita da resposta após receipt real. O resultado histórico não é apagado; a nova fixture será verificada no gate C07+C17. Omni não aplicável, zero spawns.
- **S10 — [44657814166](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657814166):** 9 pass / 2 fail, 260 asserções, 11 testes/2 arquivos, 1143,59 s. Falhas em wp13/coverage-sensitivity-integration.test.ts:22 (timeout 300000 ms, duração reportada 395894,04 ms) e :141–142 → wp11/fixture-trace.ts:15 (bootstrap-start, deadline 180000 ms, trace 290514 ms). Classificação: unbound — desempenho/deadlines. O corpo confirmed continuou após o timeout e se sobrepôs ao bootstrap seguinte; a raiz interna não está demonstrada. omitted/bundled chegaram aos markers posteriores a :115, incluindo injeção de mutação, revogação e caso preservado; isso não aprova o teste fora do prazo. Cinco casos de integração e os quatro de sensitivity-read-scope passaram. Omni não aplicável, zero spawns. PR #405 permanece draft, sem qualificação de merge; nenhum limite ampliado.
- **C04 — [44660393378](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660393378):** 1 pass / 3 fail + 1 erro entre testes, 368 asserções, 1491,91 s. documents-contract.test.ts:15 passou (233854,25 ms). Os três fails são timeouts explícitos: native-execution-reevaluation.test.ts:24, limite 300000 ms em :152 (414910,63 ms reportados); native-execution-purchase.test.ts:14, variantes pending/complete, limite 360000 ms em :136 (417443,02 / 424437,39 ms). Houve um bloco adicional de erro em native-choice-preparation.ts:36 após pending: decision-choose/decision-authority-changed. Ambos purchase registram essa razão após cerca de 300 s desde a seleção e probes procurement-context-unavailable, mas somente um erro entre testes consta no sumário. Os checkpoints de preparação ultrapassaram as asserções corrigidas; a raiz interna da demora permanece unbound. Não renovar seleção, ampliar prazos ou remover guards para obter verde. Omni PASS focused/declared, 187 spawns e zero delegações.
- **C06 — [44662186554](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662186554):** PASS: 3 pass / 0 fail, 107,34 s, nos dois perfis native contextual BI (finance/maestro) e no caso C08 do anchor. Dez casos inalterados de work-bridge foram filtrados explicitamente; não é aprovação desse arquivo inteiro. URLs e labels completos passaram. Omni PASS no escopo focused/declared, 98 spawns e zero delegações; isso não afirma inferência nativa.
- **C09 — [44662583356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662583356):** 0 pass / 1 fail, 45 asserções, 1191 ms. Novo ponto em wp13/handoff-domain-integration.test.ts:262: somente aggregateRevision muda de 10 para 11; receipts, proofs, incarnation e storageVersion=1 permanecem idênticos. A reserva em decisions/apply.ts:86–96 avança legitimamente o agregado antes da transação do domínio, cujo rollback ocorre no driver da fixture :327–337. A retomada esperada em :272–273 contradiz o guard conservador de apply.ts:72–75: tentativa sem recibo exige reconciliação, não redispatch. Classificação: pendência de contrato de recuperação pré-commit / envelope de estado da fixture. Não ignorar metadados nem liberar redispatch para verde; precisa desenhar evidência autoritativa de rollback/aborto em PR shared, se esse comportamento for requerido. Nenhum patch parcial ou gate exploratório. Omni não aplicável, zero spawns.
- **C14 — [44662785880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662785880):** PASS: 1 pass / 0 fail, 9,46 s. O verifier executou os ataques preservados, o replay canônico e a reabertura do host sem alterar os digests/estado esperados. Omni PASS no recorte focused/declared, 57 spawns, zero delegações. A projeção remove caseRef somente da operação Forecast; a seleção HTTP e a autoridade do case permanecem.
- **C16 — [44663094821](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663094821):** PASS: 1 pass / 0 fail, 76,36 s. O componente usou controle real de origem com refDigest de 64 hex; o teste comprovou resposta 200 retida, segunda consulta 403 após revogação, ausência de projection/links, limpeza do DOM/opções e descarte do 200 tardio. Omni não aplicável, zero spawns. É prova do componente/HTTP pelo transporte Playwright declarado, sem qualificação de jornada nativa instalada.

### Seleções dos gates publicados

Caminhos relativos a modules/sucafina/; a árvore exata está no SHA do request.

| Causa | Arquivos |
| --- | --- |
| C01 | Sucafinav1/test/product/integrated-proofs/am01/recall-five-profiles.test.ts |
| C08 | Sucafinav1/test/product/wp13/handoff-persistence.test.ts |
| S10 | Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts; Sucafinav1/test/product/wp13/sensitivity-read-scope.test.ts |
| C04 | Sucafinav1/test/product/wp12/native-execution-reevaluation.test.ts; Sucafinav1/test/product/wp12/native-execution-purchase.test.ts; Sucafinav1/test/product/wp12/native-execution-documents-contract.test.ts |
| C06 | Sucafinav1/test/product/wp12/native-execution-bi.test.ts; Sucafinav1/test/product/wp10/integration/work-bridge.test.ts ; filtro -t: ^(native contextual BI \[\|actual C08 work composition opens a current thread and survives rebuilding the host with the same durable key$) |
| C09 | Sucafinav1/test/product/wp13/handoff-domain-integration.test.ts |
| C14 | Sucafinav1/test/product/wp12/native-verifier-negatives.test.ts |
| C16 | Sucafinav1/test/product/wp10/integration/bi-case-access.test.ts |
| C02 | Sucafinav1/test/product/proof234/am04-c12-return.test.ts |
| C03 | Sucafinav1/test/product/wp07/browser-ui.test.ts |
| C05 | Sucafinav1/test/product/wp11/source-promotion-coverage.test.ts |

## Produção compartilhada — PRs separados

| Causa | PR / branch | SHA do fix | Mudança e gate |
| --- | --- | --- | --- |
| S10 | [#405](https://github.com/gustavomhss/Orchestra-SF/pull/405), sf-shard-b-shared-sensitivity | 8da7b9c5c8600bad368b43432f6d71ed13317b4c | portfolio/verification.ts:203–205: sem sensitivityReadScope usa snapshots, token, captura provisória e fingerprints finais; gate coverage-sensitivity-integration + sensitivity-read-scope |
| S11 | [#406](https://github.com/gustavomhss/Orchestra-SF/pull/406), sf-shard-b-shared-draft-replay | 3190d29fa62e902f8ceefdffcf703eb367c9b2c9 | decisions/hot-topic-draft.ts:94–101,206–207: leitura na versão atual só para transação durável existente e versão não regredida; gate draft-replay + hot-topic-draft-domain + hot-topic-snapshot |

Ambos drafts, título shared:, base sf-join-four, revisão independente PASS. Produção não foi incorporada em sf-shard-b. S10 preserva contexto original e caminho scoped. S11 mantém request original no digest, autorização e CAS; identidade/incarnação, escopo, fontes e integridade continuam verificados; novos comandos stale continuam negados.

Risco S10: primeiro estado training levou134680 ms na base; os três estados compartilham 300000 ms. Não aumentar limite caso surja timeout posterior. hot-topic-draft-domain pertence ao shard 3 e é regressão adicional, não sua enumeração/qualificação.

PRs alheios apenas inspecionados: [#398 Atlas](https://github.com/gustavomhss/Orchestra-SF/pull/398), [#400 resposta Planner](https://github.com/gustavomhss/Orchestra-SF/pull/400), [#401 custo BI](https://github.com/gustavomhss/Orchestra-SF/pull/401). Nenhum foi integrado, alterado ou rebaseado por esta sessão. #398 é hipótese para similarity217 sem equivalência causal demonstrada no log. #400 acrescenta resolveAnswerScope e um manifesto que preserva a fonte Planner completa; neste baseline ela contém 17 campos, correspondendo à lacuna em native-question-consumer:149; ainda requer verificação desse teste após integração. Não transferir green de outra sessão.

## Pendente e como retomar

1. Aguardar os gates ativos C03 (44663570903), C05 (ci-run-linux-sfb-c05-4bcbffc) e registrar os resultados. Nunca repetir gate idêntico sem mudança.
2. Gatear os commits pendentes por causa, até dois workflows ativos. C04/C06 agrupam arquivos com mesma raiz. Não declarar shard verde por recorte.
3. Verificar a correção C17 do ponto C08:147 no gate conjunto C07+C17, preservando reconciliação durável e execução única.
4. Timeouts/processos unbound não têm raiz interna provada; não elevar prazos por palpite.
5. Migrar consumidores legados em trabalho próprio sem restaurar #content, data-surface, details/summary ou form[data-command] como contrato.
6. Contract-freeze exige decisão de contrato; não trocar hash para verde. planner-calculation:112–123 intercepta cópia retornada em business-services:726, enquanto Atlas usa original:540; corrigir seam observável sem reduzir esperado 1.
7. Shard5 mantém14 arquivos não iniciados e cauda Planner não enumerada, unbound pelo limite do job. Nenhum pass/fail atribuído a código não executado.
8. Atualizar este handoff com run, SHA, contagens e file:line. Erro idêntico 2x sem mudança: parar e registrar unbound.

## Integração e draft de testes

- Draft de testes: [#410](https://github.com/gustavomhss/Orchestra-SF/pull/410), head de código e55478bd29cd03d604116b855d45e3664270ba4e.
- Durante a sessão, sf-join-four avançou de f7dd58e32bc834f1485df20b91adbf759b4c4ad0 para 08854f14d83ab12d8665b0e3787881edbfaabd53 (PRs #399, #398, #404, #401, #402; 10 commits, 14 caminhos).
- Auditoria read-only não encontrou sobreposição textual com os 17 arquivos de teste, o handoff ou os dois arquivos dos shared. #410 foi confirmado clean depois do cálculo inicial de mergeability. Isso não substitui verificação da composição.
- Nenhuma mudança dessas outras sessões foi incorporada aos snapshots de gate desta sessão. Os resultados continuam vinculados à base imutável e ao SHA de cada fix/request.

## Ordem de merge

Nada foi mesclado. Primeiro qualificar/integrar shared #405 e #406, independentes entre si, e dependências aplicáveis de outras sessões (#400 para resposta Planner; #398 permanece hipótese). Depois integrar sf-shard-b sobre a base acordada. Nenhum rebase de branches alheias. UI legada e falhas unbound continuam bloqueios explícitos; não há GO.
