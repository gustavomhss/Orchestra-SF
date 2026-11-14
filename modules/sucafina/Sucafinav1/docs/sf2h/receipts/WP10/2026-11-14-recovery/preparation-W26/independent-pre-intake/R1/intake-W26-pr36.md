# R1 — Pré-intake W26 / PR36

**Recomendação: admitir somente os sete blobs publicados especificados, com nova verificação hospedada obrigatória.** Não identifiquei defeito novo confirmado de finanças, autoridade ou persistência nos sete arquivos. O aceite funcional permanece **HOLD**: encontrei uma lacuna própria de composição no host W25 e ainda não existe um candidato W26 com terminais avaliado por esta revisão.

Este é um parecer focal de fonte anterior ao intake. `finalForCandidate: false`; **não conta como um dos três pareceres finais independentes**.

## Identidade e independência

- Revisor: **R1**, agente `/root/independent_r1_w16`; `authoredProductChanges: false`, `authoredTests: false`.
- Base efetivamente examinada: W25 `3d59829e5d9e438cbb443428a9479d7f63b5bf31`, árvore `ee95a2e3d0f02efabe6a4442fcf59479265a9f61`.
- Publicador: PR36, commit `48486a2186c0cc07a3a5558e34e2aa94c89ad5e9`.
- Manifesto: `agents/ci/W22-D-observation/publisher-audit/selection-manifest.json`, SHA256 `6824ff01f9c582fc8d86e7ab73514156ce5ecdf9761e20fe20f3d94da67990cc`.
- Corte de observação: **2026-11-14T16:41:25Z**. Nenhum SHA final W26 é certificado.
- Não executei produto, import, teste, build, typecheck ou browser local; não modifiquei produto, testes, refs remotas ou CI. Escrevi apenas os novos artefatos desta revisão. Pareceres anteriores permanecem históricos.
- Li os diffs e as fontes congeladas, rastreei os consumidores reais e conferi os blobs remotamente. Os audits dos builders serviram como índices, sem substituir esta inspeção.

## Sete blobs propostos

As sete combinações de tamanho, Git blob e SHA256 conferem com os bytes arquivados. Os três produtores e o teste integrado também foram recuperados no commit exato pelo GitHub MCP e comparados byte a byte.

| Caminho relativo a `modules/sucafina/Sucafinav1/` | Git blob proposto | Situação em W25 |
|---|---|---|
| `product/portfolio/sensitivity-store.ts` | `d2528cc98eabfea36025f25cdb0cb2bf9c54c42c` | Mesma base do manifesto W22 |
| `product/portfolio/threshold-proof.ts` | `89ba60857babe8a5c80f409de39b7e0598695b96` | Mesma base do manifesto W22 |
| `product/portfolio/verification.ts` | `b2ac17f210886353d3596fc6a891242c7ea40f0a` | Mesma base do manifesto W22 |
| `test/product/wp13/coverage-sensitivity-integration.test.ts` | `1a0dc5a9bc71923aafd3ec5eaf476f7a3f780bdc` | Mesma base do manifesto W22 |
| `test/product/wp13/persistence-recovery.test.ts` | `63f262129fb37adf74013f58ea5fc56bb4ecd79e` | Novo no tree completo |
| `test/product/wp13/sensitivity-retry-boundary.test.ts` | `674fae533af967f87e49a5a79d25ac1a6a925e3a` | Novo no tree completo |
| `test/product/wp13/threshold-recertification.test.ts` | `42ddb74c93873d0dec1e9d255ba90a2ae71cab7d` | Novo no tree completo |

O manifesto foi preparado sobre W22. Revalidei contra W25: os quatro arquivos existentes ainda possuem os blobs de base registrados, e os três testes novos estão ausentes do **tree completo**, sem tratar ausência de hidratação como deleção. Os **89 imports relativos**, com **40 destinos distintos**, resolvem no cohort ou na árvore W25; todos os bytes hidratados dos destinos conferem com seus blobs. Nenhum destino não selecionado mudou desde a base W22 do manifesto. O único specifier externo encontrado é `bun:test`. Essa é uma prova de caminho/hash; não substitui compilação, bundling ou runtime.

## Finding próprio aberto — ligação de `exactThreshold`

**R1-W26-HOST-EXACT-THRESHOLD-01 — severidade alta; aberto na base W25; bloqueia aceite do consumidor integrado, mas não a admissão estática dos sete blobs.**

`apps/cli/src/sucafina-product/portfolio-services.ts`, linhas 64–101, possui `units` e `sensitivityPreview`, mas não passa `exactThreshold` nem a `createPortfolioProofVerifier` nem a `createPortfolioProduct`. O fallback de `decision-domain-services.ts`, linhas 129–138, omite o mesmo produtor. Trata-se de composição própria WP10 preexistente.

Isso tem efeito concreto. `planner-sensitivity.ts:95–97` devolve `exact-threshold-not-proven` sem o callback, e seu finalizador conserva limiar não exato/nulo. A nova recertificação de `verification.ts:141–150` também exige que o callback esteja conectado. Logo, números e replays obtidos por fixtures que fornecem `world.exact` não demonstram o caminho do host real. Um resultado exato persistido por outro consumidor tampouco ganha prova pelo verifier que continua sem o produtor.

### API canônica disponível para a correção

`createPlannerExactThreshold` já é exportada por `product/planner/exact-threshold.ts`, blob `59fcb482078a1c33a8ab4c6e0d5e691228b6ae43`. O construtor recebe `{ units, preview }`; a função criada recebe `(SensitivityRequest, baselineRef, TrustedDomainContext)`. Os dois consumidores aceitam `exactThreshold(request, binding, context)`, e `binding.baselineRef` fornece o vínculo necessário. Os inputs de produção já existem em ambos os pontos de composição. A correção deve ligar o produtor canônico sob a mesma autoridade e as mesmas fontes, sem callback numérico de fixture. Não escrevi patch para preservar a independência.

**Prova exigida:** novo commit publicado e teste hospedado pelo consumidor de host real, cobrindo cálculo inicial exato, leitura fria e retry idempotente, além de recusa por fonte/autoridade revogada e preço/FX indisponível. Preservar os três estados de treinamento, C08 único, escolha humana e ausência de aplicação automática. Uma eventual correção posterior não está aceita por este documento.

## Análise do delta financeiro e de persistência

### Leitura e retry

O novo `sensitivity-store.ts:29–52` faz a leitura canônica de vínculo depois das releituras do resultado e das amostras. Confirmei diretamente `criterion-rules.ts:166–184`: esse leitor preservado observa vínculo, regra e resultado duas vezes, executa o verifier do produtor nas duas observações, compara o conteúdo e encerra com revalidação do host. Portanto a redução de chamadas externas não elimina as duas observações canônicas.

No retry, o lookup precisa casar com request e caso capturados, digest integral e prova atual da regra. Somente um resultado já vinculado que passou por nova leitura canônica evita outro cálculo. A ausência de vínculo segue pelo cálculo e bind validados; respostas denied/stale/conflict não são convertidas em sucesso. Identidade da operação, kind, identidade/conteúdo do binding e lease são conferidos ao redor das esperas. O adaptador real de idempotência de `portfolio-services.ts:64–66` também chama `host.revalidate`.

### Recertificação do número armazenado

O número persistido é tratado como candidato. O verifier exige prova estrutural atual emitida pelo intervalo canônico ou pelo produtor de cobertura atual; correlaciona cenário, baseline, metadados, operação do parâmetro, engine, limites, unidade, período e fontes. O domínio canônico restringe a variação a uma substituição direta USD fora de HR, sem escrita indireta no parâmetro por defer. A monotonicidade não é inferida das três amostras.

`threshold-proof.ts` exige duas novas observações no candidato e no valor IEEE adjacente do lado rejeitado. Ambas preservam os componentes fixos e sua ordem; uma satisfaz o critério, a adjacente não. Para a recertificação, ambos os testemunhos devem coincidir também com o digest estrutural atual. Referências próprias ou somente auto-hashadas não bastam: a evidência persistida deve coincidir com as referências produzidas agora, inclusive sua ordem determinística no verifier.

### Digests, fontes e autoridade final

O resultado reconstruído inteiro precisa reproduzir `stored.resultDigest`. Fonte, baseline, units e qualificações de cobertura são relidos; o capture mantém o fence físico e a revalidação da autoridade. Depois de seu último await, o novo código compara novamente o conteúdo dos inputs recebidos e a identidade/conteúdo da autoridade. A prova de fence não é tratada como licença: os testes novos incluem revogação sem alteração do fence físico. A demonstração executada dessa recusa ainda depende do CI.

O certificado de subtotal conhecido continua separado da completude de custos. Categorias ausentes não viram custo zero nem aprovação de cenário. O produtor de cobertura retém classificação C10, fontes, período e autoridade atuais; as hipóteses e totais nulos das amostras permanecem divulgados.

## Testes: preservação e limites

| Arquivo | Declarações estáticas | Observação |
|---|---:|---|
| `coverage-sensitivity-integration.test.ts` | 3 existentes | Mesmos nomes e budgets 300000, 300000 e 120000 ms; loop omitted/bundled/confirmed preservado |
| `persistence-recovery.test.ts` | 4 novas | Órfão e resposta perdida; algumas callbacks de verificação são controladas |
| `sensitivity-retry-boundary.test.ts` | 4 novas | Orquestração e mutação de boundary; contexto mutável explicitamente não equivale a grant UI/nativo |
| `threshold-recertification.test.ts` | 1 nova | Budget 60000 ms; nove negativos estruturais, substituição de um ULP e revogação |

Não há nome de teste existente omitido, diretiva skip/only/todo introduzida nem ampliação dos budgets existentes. Os novos testes acrescentam nove declarações, sem serem resultados executados. Alguns negativos estruturais reaproveitam observações numéricas capturadas para isolar correlação; isso não é prova de autorização atual. O teste de integração usa produtores Planner/C08, porém injeta explicitamente o produtor exato; sua aprovação futura não elimina a lacuna do host.

## Exclusões obrigatórias

As duas versões WP11 da PR36 continuam fora da seleção. Na árvore W25 permanecem os pins PR35 `ec052c2c3bef96f492512f3d5f663919580f25c8`:

- `renewal-choice-fixture.ts`: `2da82bf379910826f4558b5b330c97cdaf6806df`.
- `renewal-operation-verifier.ts`: `df3c335c95bf9d8d06d00474ff0bc391dd852b4e`, também conferido remotamente em W25.

Li os guards preservados: transação real de leitura no caso, espera por todos os siblings, fonte/projeção corrente, identidade de Request, abort, binding e revalidação após autenticação. O actor real vem de `plannerSourceActor`; o port continua em `8389709232225424b5905638d0951d8cdbb71dd7`. O intake não deve sintetizar hunks nem trazer outros arquivos da PR36. A árvore final publicada precisará confirmar esses mesmos limites.

## Evidência histórica não transferível

D22 está **cancelled e parcial**, run `43610668152`, job `132494810814`, produto W22 `4bc9c7220f04f113609393aaba38934a7e69878b`, snapshot `c00c167bdf368d89273d60ca29e5eb24c01dc577`. Há 29 resultados nomeados observados (27 pass, 2 fail), um evento de erro adicional, nove headers de 18 arquivos selecionados e nenhum resumo Bun completo. Não atribuo totais completos ou causa do cancelamento.

As durações e a expectativa de redução cold 4→2 / first 7→5 / retry 6→2 são motivação causal para a proposta. Não são aceite de PR36, W25 ou W26, nem promessa de desempenho. Nenhum teste dos sete blobs no sucessor foi observado por esta revisão.

## Critérios, preservação e próximos gates

Conferi novamente o pack: **171 textos canônicos, sete tasks**. Este pré-intake não altera nem promove o status de nenhum deles. Permanecem aplicáveis o consumidor real (`WP10.SUC.10`, `WP10.T01.CHK.02`), três revisores sem autoria (`WP10.T03.CMP.02`), invalidação da evidência após correção (`WP10.T03.CHK.03`, `WP10.T04.CHK.01`) e seleções hospedadas completas (`WP10.T04.CHK.41`).

O recibo original de arquivo mantém SHA256 `bc761d68afd64bcb7e49d2abbe98f849ee113b197b579b16f561b12622f65166`, com **128 cópias estrangeiras e 131 inputs somente leitura**. Não modifiquei esses inputs. Esta revisão focal não substitui a auditoria individual de todo o arquivo.

Para encerrar: compor os sete bytes exatos, corrigir a ligação própria, publicar/congelar o novo candidato, verificar pins e exclusões, executar check e seleções hospedadas afetadas com arquivos completos e colher os três pareceres finais independentes. Manter native/resident/Task/knowledge/global bloqueados até suas provas próprias. S0 continua responsável pela revisão e integração.

## Artefatos verificáveis

| Arquivo | SHA256 |
|---|---|
| `intake-W26-pr36.json` | `89e0601479837c4ffd1b031a611d2f57e2fed714dac01cf1fa3f82cce5d2c06a` |
| `audit-W26-pr36.json` | `990f95bab964f010faa90d4cbef027676b9d14694de5ec3fc256489d67e51428` |
| `remote-blobs-W26-pr36.json` | `c7a485588092f1aab50ee3512e3b218c92a2a9bd147ceb61511b6cee21fc5dd7` |

O JSON contém inventário de blobs lidos, seis comparações remotas, caminhos/linhas do finding, correlação com os textos canônicos e as limitações do parecer.
