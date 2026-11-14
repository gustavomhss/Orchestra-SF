# Revisão independente final — W17

**Veredito: CHANGES_REQUIRED.** Há prova positiva do próprio W17 para os cinco casos completos de BI no caminho Node exercitado. O package SF continua falhando em Check15, e as demais obrigações de integração, UX, runtime nativo e entrega permanecem abertas.

| Identidade | Pin |
|---|---|
| PR / branch / base | PR32 / `astra-compose` / `sf2-stack` |
| **reviewed_head** | `9048e0e65351a5bd80768458a79fed94a4993db7` |
| **reviewed_tree** | `f073278e9fb11ca93b129c16331460e1fb6e25c4` |
| Pai único | `34e6dd4f3588a64a3963a854ee29729f82fdd594` |
| Base observada | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` |
| Revisor | `/root/review_semantics_final` |
| Independência | `no_author_overlap: true` |

Root, autores de implementação e autores de propostas/recibos não são contados como esta revisão independente. O revisor não alterou produto, testes ou branches, não publicou, não disparou CI, não baixou artifacts e não executou produto/typecheck/guard/build localmente. A execução local foi somente leitura, hashing e interpretação de metadados/textos/ZIP. Os drafts W17, adendo Check15 e todos os finais anteriores permanecem intactos.

## O que W17 altera e preserva

O MCP confirma **9 caminhos: uma fixture própria e oito recibos, zero deleções**. O único código alterado é `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-lifecycle.test.ts`, blob **`a6e4dbe4bddc18866a8fe8082fa889540ac75972`**. Nenhum código de produto, contrato, política financeira ou helper estrangeiro mudou nessa rodada.

A fixture reutiliza o driver WP02 já composto, blob **`76188b9f567861b30dba3b22afce66d60a2424c8`**. Node possui os pipes Chromium; Bun permanece como host real de HTTP/produto e cliente Playwright. A categoria `host-contextual-controls` é um rótulo do helper; seus relatórios nesta seleção provam somente os quatro lifecycles de navegador WP10 observados.

Os cinco nomes e todas as expectativas anteriores são preservados: **81 linhas que começam por `expect(`, 83 linhas contendo `expect(` e 83 ocorrências**. As duas contagens de linhas usam denominadores diferentes, ambos iguais antes/depois. O quinto caso sem navegador é byte a byte idêntico. Permanecem os budgets de120s por caso, prazo cooperativo105s, startup/navegação15s e página10s. Nenhuma asserção foi retirada para obter o sucesso.

## CI10: prova positiva exata, com alcance delimitado

[Run43605201442](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43605201442), job132478265438: **SUCCESS, 5 PASS /0 FAIL, 114 expectativas, um arquivo completo,16,02s, nenhum erro não tratado reportado**. Cleanup de workflow132478786112 também passou; esse job apenas remove o snapshot, enquanto os quatro relatórios do driver provam o cleanup de navegador.

| Envelope CI10 | Valor |
|---|---|
| W | `9048e0e65351a5bd80768458a79fed94a4993db7` |
| S | `dcd14c5fad0c84143d3071557c493e2c5de3e9e4` |
| Árvore S | `823a2081fbc1fab1f39e441cf0f9bd3fa34687e1` |
| Pai | W17, único |
| Único delta | A `.ci-run.json` |
| Request blob | `6decd1736e1fda8ac653ff5ec7a03d3f48d47ede` |
| Request SHA256 | `b7e57c0f9591b817e4d387c73e29d1875c1fbb684dd100687dd6b1a688475d2a` |
| Log SHA256 | `e1523b406dbed298dea8853371390c09366e094510a3e57642f97d5083b6b2d2` |

Commit, árvore, parent, único delta, request, run e jobs foram autenticados pelo MCP. O log independente é byte a byte igual ao arquivo do root. Os cinco nomes observados correspondem exatamente à fonte W17 e ao request completo, sem filtro ou omissão. Artifacts retornados por CI10: lista vazia.

| Caso executado | Duração ms | Resultado |
|---|---:|---|
| BI keeps the canonical shell, refreshes on manual focus and timer, and signs out once while discarding a held genuine success | 4333.16 | PASS |
| the canonical shell still polls authority while BI awaits a held result and revocation prevents every late render | 2357.29 | PASS |
| clearing the BI selection while genuine authorized options are delayed prevents restoration of the previous selection | 2468.05 | PASS |
| BI returns from a real source with the same human filters, version pair, currency and mark focus after current reauthorization | 5783.85 | PASS |
| BI origin digests select only an explicit source of the real current Planner difference and never choose A or B implicitly | 652.69 | PASS |

O quarto caso agora atravessa a sequência que falhava em W16: comparação HTTP/DOM, origem Planner HTTP, navegação à fonte, Back com reautorização, nova resposta BI e DOM, período, par de versões, USD e foco da marca. O log registra `comparison.http`357ms, `source.http`133ms, navegação99ms, `return.http`382ms e `return.dom`18ms; o caso completo passa em5783,85ms. Isso prova **o caminho Planner-source/Back exercitado**, sem estender o resultado às seis rotas positivas, detail refresh ou critérios visuais/performance.

### Omni e cleanup real do novo caminho

Nonce **`7b19b299b892fc9d0777b0a87e16f2b7`**: **PASS, quatro testes declarantes, quatro spawns Omni, zero delegações**. Os quatro `reportBrowser` aparecem depois do corpo e cleanup obrigatório e imediatamente antes do PASS de cada caso, conforme a ordem lexical da fixture. O quinto caso não declara spawn artificial.

| Caso de navegador | PID Node / Chromium | Frames para / do browser | Cleanup normal confirmado |
|---|---|---|---|
| 1 | 4099 / 4114 | 71 / 189 | Sim |
| 2 | 4236 / 4251 | 48 / 131 | Sim |
| 3 | 4374 / 4389 | 33 / 102 | Sim |
| 4 | 4514 / 4529 | 84 / 213 | Sim |

Cada relatório confirma PIDs distintos do cliente Bun, boundary AppProcess, pipe pertencente a Node, um cliente de bridge, tráfego limitado, zero contexts, conexão encerrada, saída Node/Chromium0, WebSocket1000 limpo, EOF/queues drenados e socket/diretório removidos. O driver só produz a prova depois dessas condições. Essa é prova de lifecycle normal do novo caminho, **não prova nativa de negócio, provider/recipient ou AM**.

O erro antigo `WP07_CHROME_GROUP_OR_TRANSPORT_REMAINS_LIVE` permanece histórico e aberto com seu owner: W17 não altera nem reexecuta aquele helper direto-Bun, blob `26a07dfe8d5a5c1986535aea0c857bfd9faffda5`. A hipótese de descritores explica a escolha do driver; a causa exata do caminho antigo e sua reparação não foram provadas. Finding encaminhado na [PR33](https://github.com/gustavomhss/Orchestra-SF/pull/33#issuecomment-6878612897).

## Check15: bloqueante atual do mesmo candidato

[Run43604348151](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43604348151), job132475647040: **FAIL**. S **`771cf5896aa504620ab35a2e44cca2606b7e18c3`**, árvore **`12707f474e546fe850ab798de957d2fc535007ff`**. Pais W17 + Check14; único delta A `.astra-compose-check.json`, blob **`fab08401863895c347b6b64a9e6322786575129b`**. Request SHA256 `e2815b407757a8adab31ff646b3a83bbcc8939276f223f7376755db5e48e50bb`. A referência dev `a1d37698a7bb097c1578f827eba6a19b9917ef07` serve ao guard; não foi importada no produto.

| Owner / subcheck | Resultado exato |
|---|---|
| WP04 |3 diagnósticos SF |
| WP06 |4 diagnósticos SF |
| WP08 |4 diagnósticos SF |
| WP09 |1 diagnóstico SF |
| WP13 |1 diagnóstico SF |
| WP14 |1 diagnóstico SF |
| WP00/WP10 e CLI |0 diagnósticos próprios; CLI passa |
| Atlas | Geração, check, diff vazio e typecheck passam |
| Subprocessos |4671 arquivos,66 sites permitidos; passa |
| Guards |78 regras,1423 caminhos,0 gate,46 warnings,0 erros; passa |

Os14 diagnósticos do package SF são byte a byte iguais aos de Check14. Subchecks positivos não transformam a falha do package em aprovação.

Foi reutilizado o artifact **14117816293**,3947bytes, SHA256 **`c9520733218b5b12b9540594b4330b76f1d313bd6af2f3b97cbb7d5569700c33`**. Conferidos novamente os dez membros, W/tree/dev nas revisões, merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` e o SF log. Sem outro download. Log Check15 SHA256 **`21b84dcddec8d54e8a9e5140ec0f1df799c6e83f6a96818a6adc138055216e26`**.

## Árvore, freeze e critérios

Os **16 catálogos completos nos escopos explícitos registram8.821 caminhos**. Root/modules/Sucafina foram relidos;13 catálogos foram reutilizados somente por hash e reancorados, incluindo apps/CLI idênticos. A função `prepare_delivery.anchored_catalog` foi reaplicada no fechamento: `pending=[]`, zero remoções e os9 blobs publicados corretos.

| Metadado | SHA256 |
|---|---|
| `evidence/candidate-w17-catalogs/state.json` |`c0745d364abba969533b685d0255cf9590ec3769f40d939b64cfc373375e8758` |
| `evidence/candidate-w17-catalogs/known.json` |`4e287eb59e35e7f083907593cc666306704857520df1c7f8d729677d4afc8fe4` |

Freeze **revisão10 /38 artefatos**, blob `b20cf5cecf22885dd8858f3659056a50ab88f485`, e teste estrito `47b4a49cd85ae20e5f0006ded9736eb8be1993bb` permanecem íntegros. As38 identidades estão ancoradas; conservam-se17 contratos lógicos,39 operações/rotas,5 perfis,18 skills,8 packs e6 provas.

`canonical_inputs` revalidou **85 critérios WP00 +171 WP10**, os50 globais herdados, textos/famílias/escopos, oito seleções literais, AM01–AM06, três revisões independentes e o contrato C/G7/D/G8. Campaign imutável SHA256 **`703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`**. Mapas completos continuam propostos fora do produto, com WP00=78 NOT_REVALIDATED/7 BLOCKED e WP10=135 NOT_REVALIDATED/36 BLOCKED; sucessos de casos não convertem critérios compostos inteiros em PASS.

Os catálogos não provam todos os subdiretórios do repositório nem os inputs efetivos de formatter/generator/Turbo. O audit de inputs e guard real de D continua bloqueante. **D permanece PROPOSED_EVIDENCE_BRANCH_NOT_D.**

## PR29 atual: disponibilidade reconciliada, intake em HOLD

O corte de heads `evidence/heads-reconciled-w17-closeout.json` registra16 PRs de fonte e o candidato. Seu SHA256 é `95f0f7c26b0de5d0a9824835ea02ff9cca445b9cfcbb24ce9a04dfa8b7f6e06a`. Título, draft ou green de outro SHA não concede aprovação. Este revisor autenticou novamente PR32 e PR29 e leu os sete novos blobs da fonte.

PR29 atual **`532da498e08fa36fadbd3c01e3e7da00d869dd47`**, árvore **`5dcac0d207da530a4ff9b8f3ccd39e2e1cd2ef1f`**, pai `c3b02c7693c1ff3b702596c7c8458f913972a404`:47 caminhos de delta, dos quais sete são produto/teste. Nenhum desses sete forma um incremento completo consumível em W17.

| Caminho proposto | Dependências diretas ausentes em W17 | Decisão |
|---|---|---|
| `apps/cli/src/sucafina-product/business-services.ts` | `prepared-application-egress.ts`, `memory-case-read-scope.ts`, `source-fence-read.ts`, `scenario-procurement-proof-scope.ts` | HOLD |
| `apps/cli/src/sucafina-product/portfolio-reconciliation-services.ts` | `proof.ts`, `reconciliation.ts` | HOLD |
| `apps/cli/src/sucafina-product/work-destinations.ts` | `work-signals.ts` | HOLD |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/analysis-lifecycle-context.test.ts` | `analysis-lifecycle-fixture.ts` | HOLD |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-reconciliation.test.ts` | `reconciliation.ts` | HOLD |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/work-bridge.test.ts` | `work-signals.ts`, `work-destinations.ts`, `work-http.ts` | HOLD |
| `modules/sucafina/Sucafinav1/test/product/wp10/native-host/routine-installed-publication.test.ts` | `routine-installed-publication.ts` | HOLD |

O caso mais crítico é `business-services.ts`: a fonte **`520a71460ba69a9c8a07fd1b7db838ca13108c32`** remove `CaseScope.lifecycleOnly`, guards e `withAnalysisCase` implementado/exportado pelo composto **`b3595989d0c08159c96484d96bd40a149a9721e6`**. O consumidor W17 `analysis-run-context.ts`, blob **`70ff3cd88d5f8ae2137c17a3750f72d94f3d969e`**, ainda exige `withAnalysisCase`; quatro helpers importados pela fonte também estão ausentes. O reader composto **`db9faeec0e1d35c0724a25a0d9cf53fee93961ee`** permanece protegido. Substituir o arquivo inteiro perderia a composição já validada e não fecharia os imports.

As ausências foram verificadas nos catálogos completos atuais, sem executar código. O adendo de source terminal do root, SHA256 `28e2cb1b14ae605e40cc2311ca4d071790501240a52a053108a291507573edc8`, registra os resultados da própria fonte e suas falhas de grupos. Esses resultados não são execução W17 e não são uma revisão independente final. Os antigos erros próprios do sourcec3b não são alegados como atuais após a atualização532; os holds aqui têm base nas dependências e incompatibilidades concretas.

## Findings e obrigações que permanecem

O JSON conserva cada finding anterior com seu W/S histórico. Os cinco casos BI e os quatro cleanups normais agora têm prova no próprio W17; W15/CI8 lifecycle/Finance/readers, W16/CI9 vantagem e W14/CI7 demais corpos continuam ligados aos seus próprios pins, sem transferência.

- **Runtime/integridade:** quatro timeouts antigos C17 de history/ancestry/reopen; produtores policy/project/mixed-source; composição Atlas/recall e grupos Finance/Portfolio/lifecycle/publication ainda em hold. Nenhuma dessas obrigações é coberta pelos cinco casos BI.
- **Tipos:** os14 diagnósticos atuais Check15 precisam de fechamento pelos owners e nova composição verificável.
- **UX:** continuam abertos seis destinos positivos, detail refresh durante timer/focus, reflow de vantagem, viewport320/768/1440px,200%zoom, teclado/dados densos e p95. A revisão independente UX do mesmo C confirma `UX-WP05-BI-ADVANTAGE-REFLOW-07` como MUST_FIX, com renderer blob `47b271f492292956a8d8696cc32cd999e9878661`; a correção de detail não cobre esse renderer estrangeiro. Fonte: `independent-review-staging/product-ux/final-9048e0e65351.json`, SHA256 `55c10d414f4fa83c2a9689b42ad2967b8f0d38701211cbcb15807b73d259b3df`. Este revisor não fabricou observação visual.
- **Nativo/global:** provider/recipient C07 governados, instalação real de skills/perfis/sessões/scanner/consumidores, AM01–AM06, as oito seleções finais e suite global do bundle por S0.
- **Revisões/entrega:** três pareceres não autores no mesmo C com zero findings mandatórios antes de C/G7. Os findings atuais impedem essa qualificação. D exige prova de inputs, ancestralidade/diff/modes/hashes e seu guard efetivo; permanece NOT_D.

As oito seleções preservadas são CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS, CI-UI-OPERATIONS, CI-UI-DECISIONS e CI-UI-REPORTS. Nenhum epic foi disparado pelo revisor.

**Próxima ação:** conservar a prova BI W17, encaminhar os bloqueantes aos respectivos owners e compor somente incrementos delimitados com dependências fechadas, preservando os fences de lifecycle. S0 conserva a autoridade de integração final e da suite global. **Sem READY para WP00/WP10 completos, sem C/G7, sem D/G8 e sem GLOBAL_RELEASE.**
