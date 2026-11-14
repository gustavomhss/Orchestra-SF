# WP10 — Bloqueios estrangeiros observados em W1

Candidato **`eee00ac3ef2b68c987970535ba5bba5e4c6ad01b`**, árvore `dcfc04896c3a83e6a69d3ecd1d948ff54231ddf7`; PR [#29](https://github.com/gustavomhss/Orchestra-SF/pull/29) contra `sf2-stack`. Relatório de triagem de evidência por `/root/ci_triage`, **sem função de revisor independente**.

**32 diagnósticos / 15 paths / 7 owners. Os 15 blobs são idênticos no W1 e nos heads publicados verificados via GitHub MCP.** A igualdade foi observada em 2026-11-14T02:47:27.949Z. Não há delta corretivo destes arquivos nos heads indicados.

C12 Procurement monta as factories WP11 sem callbacks obrigatórios e a UI WP01 não renderiza AlternativeDraft. Ambos têm consequência funcional rastreável no código e não podem ser fechados como mero ruído de typecheck. Os outros casos são discriminados abaixo: incompatibilidade de resolver com mitigação já presente em W1, inferência/narrowing e sintaxe de teste.

Não houve escrita em produto, branches ou remoto; nenhum teste/typecheck local ou novo CI foi executado. Este documento não concede aceite nativo/global, não aceita critérios e não substitui R1/R2/R3.

## Evidência hospedada vinculada ao candidato

| Seleção | Snapshot | Run / job | Resultado observado |
|---|---|---|---|
| unit | `d6dd636ec1ff6c6162eab8bd67f9398f847cc0d5` | [43544861337 / 132293688965](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43544861337/job/132293688965) | 169 testes em 42 arquivos: 156 pass, 13 fail |
| check | `e216f8c3ce944eb81d4869828959ed189068a73d` | [43544864518 / 132293700346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43544864518/job/132293700346) | Sucafina/CLI typecheck FAIL; Atlas generate/diff/typecheck, spawn imports e product guards PASS |

Os envelopes registrados modificam somente o arquivo de pedido da seleção em relação a W1: `.ci-run.json` e `.astra-wp10-check.json`. O JSON anexo conserva requests, SHAs, parents, IDs e digest do artifact.

O controle positivo omni passou (11 testes declarados, 38 spawns, zero delegated; log unit, linha 1374). As 13 falhas da seleção unit são 9 C17 Atlas consumer WP02, 1 projeção de meses Planner WP10, 2 native host disposal WP10 e 1 routine publication WP10. Elas não equivalem aos 32 diagnósticos de tipos e não se atribuem automaticamente a este conjunto. O controle não é aceite nativo.

## Owners e pins observados

| Owner | Diagnósticos | Paths | Branch | Head observado | Igualdade W1 |
|---|---:|---:|---|---|---|
| WP01 | 2 | 2 | `astra-wp01` | `6f4360bf0bdd444a19a7d4f97e18306ae7618b6f` | 2/2 |
| WP04 | 2 | 1 | `astra-wp04` | `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62` | 1/1 |
| WP06 | 1 | 1 | `astra-wp06` | `4d65d3acb627ed85825da487248a6f6c4c3f1f11` | 1/1 |
| WP11 | 14 | 4 | `astra-wp11` | `ff99e4b4de56bbf6e7ef36daf5d3eb749779017a` | 4/4 |
| WP12 | 2 | 1 | `sf2-ai-ready` | `574841e2409a9523000c4c1976c81804c9a86fde` | 1/1 |
| WP13 | 8 | 4 | `sf2-portfolio-ready` | `27375325788fa571d39137728ec7f0666e89f22c` | 4/4 |
| WP14 | 3 | 2 | `sf2-memory-ready` | `02ac8172c17ad57e830bfb23d3ff1d1b1191852b` | 2/2 |

**WP06 avançou** de `fb13945d9687e0ebd90f81ba5f9356ec8c7613af` para `4d65d3acb627ed85825da487248a6f6c4c3f1f11` às 02:38:08Z, com a mensagem “test(sucafina): bound native lifecycle and match publication fences”. O parent foi informado. `imports/dashboard.ts` continua exatamente igual ao W1; esta triagem não consumiu nem avaliou como integrado o restante do incremento.

## Impacto funcional que exige prova positiva

### WP04 — C12 e callbacks de revisão/replay

O consumidor chama `createSfPreparedApply` sem `reviewDigestFor` e `createPreparedExecution` sem `reviewDigestFor` e `revalidateProducer`. As factories invocam esses membros diretamente. Na rota positiva que chega às chamadas, a ausência causa chamada de função indefinida. O cache local de revisão de Procurement armazena `changeDigest`/`expiresAt`; isso não satisfaz sozinho o digest canônico e o replay exigidos. A consequência foi inferida da leitura, não observada numa execução de produto.

O delta deve vir de WP04 e fornecer revisão efetiva e revalidação atual de produtor, com identidade, versão, escopo e expiração correspondentes à operação. O conserto não pode substituir validação por constante nem diminuir os requisitos de WP11. A prova de fechamento exige review → apply → receipt, recusa de revisão revogada/produtor alterado e retry após resposta perdida sem duplicar efeito.

### WP01 — AlternativeDraft no consumidor UI

O mapa `labels` não inclui `AlternativeDraft`. `contributionBody` também não tem o case de `AlternativeDraft` ready e chega ao fim sem retorno. O template comum interpola o rótulo e o corpo, levando a `undefined` para a contribuição nova. Assim, compilar sem verificar o consumidor deixaria uma lacuna funcional; a proposta não se torna utilizável por essa UI.

WP01 precisa renderizar o payload canônico com refs e cobertura, mantendo `domainApplied:false`, sem recalcular valores oficiais ou aplicar automaticamente. A prova deve demonstrar ready e não ready pelo consumidor real, com tratamento seguro de conteúdo e abertura do resultado.

### WP14 — resolver incompatível, mitigado na montagem W1

`source-access.ts` declara um objeto `ReturnType<typeof createProcurementSourceResolver>`, mas o chama como função. Um caller que passa esse objeto, conforme o tipo público, encontra TypeError convertido em `unavailable`. W1 já fornece em `business-services.ts:299` um objeto chamável via `Object.assign(resolveProcurement,{...individual,resolve:resolveProcurement})`, mitigando a incompatibilidade no caminho montado. Não se afirma falha desse caminho integrado por esta causa. WP14 deve reconciliar assinatura/chamada e provar a forma pública escolhida, mantendo a segunda resolução e a reautorização.

## Inventário por arquivo e delta mínimo

Os paths abaixo são relativos a `modules/sucafina/Sucafinav1/`, salvo referência explicitamente absoluta no repositório. As posições vêm do log hospedado, não de um compilador local. O JSON contém as mensagens originais completas, linhas do log, trace de código, critérios por arquivo e ambos os URLs imutáveis.

### WP01 — 2 diagnóstico(s), 2 path(s)

#### W1-F01: product/ui/components.ts

**AlternativeDraft sem rótulo no renderer comum.** Classificação: `runtime_source_trace`.

Diagnósticos: TS2741 em 64:9 (log 714).

**Causa:** O Record de labels em components.ts:64 não cobre o membro AlternativeDraft do contrato canônico. A string HTML em :65 interpola labels[output.kind].

**Impacto/limite:** Uma contribuição ready AlternativeDraft que chega ao renderer comum tem rótulo undefined. Em conjunto com contribution-body.ts, também não possui corpo utilizável. Consequência inferida do código, sem execução de browser nesta triagem.

**Delta mínimo do owner:** WP01 deve incluir o rótulo AlternativeDraft e compor o renderer tipado do payload canônico junto com contribution-body.ts, preservando proposal-only, domainApplied:false, referências reais e os limites atuais de autorização.

**Prova pendente:** No novo candidato, prova hospedada da contribuição AlternativeDraft ready e dos estados não ready, com conteúdo real do contrato, escaping e abertura do resultado; sem aplicação automática nem promoção de cobertura incompleta.

**Critérios afetados por dependência:** `WP10.T01.CHK.02`, `WP10.T01.DOD.01`, `WP10.T06.SUC.01`, `WP10.T06.SUC.60`, `WP10.SUC.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `cd559d550b6fa799549b23c5c2c9f353781145cb`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/components.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/6f4360bf0bdd444a19a7d4f97e18306ae7618b6f/modules/sucafina/Sucafinav1/product/ui/components.ts).

**Trace:** [product/ui/components.ts:64,65](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/components.ts#L64); [product/ui/contribution-body.ts:8,54](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/contribution-body.ts#L8).
#### W1-F02: product/ui/contribution-body.ts

**AlternativeDraft ready cai fora do switch do corpo.** Classificação: `runtime_source_trace`.

Diagnósticos: TS2366 em 8:65 (log 715).

**Causa:** contributionBody tem retorno string declarado; estados não ready retornam vazio, mas o switch de ready não inclui AlternativeDraft e chega ao fim sem retorno.

**Impacto/limite:** O renderer comum interpola undefined no corpo de AlternativeDraft ready. O compilador evidencia uma lacuna de produto, não somente uma anotação de tipo. Consequência estática; não é aceite ou prova de browser.

**Delta mínimo do owner:** Adicionar um case AlternativeDraft tipado com proposta, cenário e referências/estado de cobertura do contrato. Manter domainApplied:false e não derivar valores financeiros oficiais na UI; a seleção/aplicação permanece nos consumidores autorizados.

**Prova pendente:** Mesmo conjunto de provas de WP01-ALTERNATIVE-DRAFT; demonstrar corpo utilizável no consumidor real e tratamento seguro de conteúdo textual e de estados incompletos.

**Critérios afetados por dependência:** `WP10.T01.CHK.02`, `WP10.T01.DOD.01`, `WP10.T06.SUC.01`, `WP10.T06.SUC.60`, `WP10.SUC.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `95f3c12a559ff40b010b7774bc7a036da4b2afed`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/contribution-body.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/6f4360bf0bdd444a19a7d4f97e18306ae7618b6f/modules/sucafina/Sucafinav1/product/ui/contribution-body.ts).

**Trace:** [product/ui/contribution-body.ts:8,54](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/contribution-body.ts#L8); [product/ui/components.ts:64,65](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ui/components.ts#L64).

### WP04 — 2 diagnóstico(s), 1 path(s)

#### W1-F03: product/procurement/decision-host.ts

**C12 monta factories novas sem callbacks obrigatórios de revisão e replay.** Classificação: `runtime_source_trace`.

Diagnósticos: TS2741 em 168:42 (log 712); TS2739 em 187:43 (log 713).

**Causa:** createSfPreparedApply em :168 não recebe reviewDigestFor; createPreparedExecution em :187 não recebe reviewDigestFor nem revalidateProducer. As factories WP11 chamam esses membros obrigatórios diretamente. O cache de revisão local guarda changeDigest/expiresAt, não substitui o recibo canônico exigido.

**Impacto/limite:** Ao atingir a rota positiva que invoca os callbacks, ocorre chamada de função ausente. Não há evidência de revisão/aplicação funcional nessa composição. Isto é incompatibilidade funcional entre consumidor C12 e produtor WP11, além das duas falhas de tipo; não é um defeito demonstrado no runner.

**Delta mínimo do owner:** WP04 deve ligar o digest real de admissão/revisão a ambas as factories e a revalidação atual do produtor à execução. O digest deve corresponder à revisão exata, mudança, escolha, ator, escopo, versão e expiração. Preservar a transação de domínio e recibo idempotente. Não usar digest inventado, callback constante true nem enfraquecer os requisitos WP11.

**Prova pendente:** Prova hospedada de review→apply→receipt autorizado; revisão revogada e produtor alterado recusados; perda da resposta após commit recupera o mesmo recibo sem reaplicar; ausência de revisão permanece recusa. A prova deve indicar SHAs dos dois lados e candidato composto.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`, `WP10.T01.CHK.05`, `WP10.T01.INV.02`, `WP10.T01.INV.03`, `WP10.SUC.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `0c970d36c5af4f5a58dfca80e1c46cf12d478f5f`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/procurement/decision-host.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/91e1f60bc6f7e85517e2b4f963eec5ac7da13e62/modules/sucafina/Sucafinav1/product/procurement/decision-host.ts).

**Trace:** [product/procurement/decision-host.ts:125,139,168,187](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/procurement/decision-host.ts#L125); [product/decisions/prepared-apply.ts:59](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts#L59); [product/decisions/apply.ts:40,55](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/apply.ts#L40).

### WP06 — 1 diagnóstico(s), 1 path(s)

#### W1-F04: product/imports/dashboard.ts

**Tipo de preview de backup reutiliza união incompatível do workbook.** Classificação: `type_contract_only_observed`.

Diagnósticos: TS2322 em 54:3 (log 696).

**Causa:** DashboardBackupAdapter.preview usa ReturnType de previewDashboardImport, enquanto simulateBackup retorna variantes de rejeição com shape diferente, incluindo status produzido por ternário. O contrato inferido do workbook exige dados adicionais em algumas variantes.

**Impacto/limite:** Bloqueia o typecheck. Não foi demonstrada falha funcional de backup por este diagnóstico; o próprio W1 teve provas de preservação de estado privado aprovadas, sem que isso elimine a incompatibilidade de tipos.

**Delta mínimo do owner:** WP06 deve definir e preservar a união discriminada real do preview de backup, ou retornar variantes realmente compatíveis com o contrato escolhido. Não inventar by/stored ou remover dados necessários só para satisfazer a assinatura; manter rejeição de metadados e namespace protegido.

**Prova pendente:** Typecheck hospedado do novo candidato e prova cirúrgica de preview/rejeição/replace de backup com preservação de estado confiável. Novo head WP06 observado não altera este blob.

**Critérios afetados por dependência:** `WP10.T01.CHK.03`, `WP10.T01.CHK.11`, `WP10.T01.CMP.01`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `3a2dbbf47fb9e5d430ccd0edde2efccdf8412437`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/imports/dashboard.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/4d65d3acb627ed85825da487248a6f6c4c3f1f11/modules/sucafina/Sucafinav1/product/imports/dashboard.ts).

**Trace:** [product/imports/dashboard.ts:54](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/imports/dashboard.ts#L54).

### WP11 — 14 diagnóstico(s), 4 path(s)

#### W1-F05: product/decisions/alternative-replay.ts

**Replay perde correlação dos discriminantes de ScenarioResult e cobertura.** Classificação: `type_inference_only_observed`.

Diagnósticos: TS2345 em 42:36 (log 625); TS2345 em 44:58 (log 636); TS2345 em 50:213 (log 649); TS2322 em 51:39 (log 662).

**Causa:** O spread/rebuild de result e costCoverage perde, para o compilador, a relação entre comparisonStatus e coverageState. O objeto inferido deixa de ser atribuível a ScenarioResult, à proposta e à saída AlternativeDraft.

**Impacto/limite:** Quatro diagnósticos são propagação da mesma inferência. Nenhum valor financeiro incorreto foi demonstrado pela triagem; o conserto deve conservar a distinção entre cobertura completa e incompleta.

**Delta mínimo do owner:** WP11 deve reconstruir por ramos já estreitados ou manter um clone tipado cuja correlação dos discriminantes seja preservada, alterando somente a identidade/versionamento necessário. Não usar cast sem prova, enfraquecer ScenarioResult ou promover cobertura incompleta a completa.

**Prova pendente:** Typecheck hospedado e replay positivo/recusa para as variantes de cobertura, com identidade e refs preservadas e domainApplied:false.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`, `WP10.T06.SUC.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `7f4fa4df2075fea83cf89981b00a5f1cba0f630a`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/alternative-replay.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/alternative-replay.ts).

**Trace:** [product/decisions/alternative-replay.ts:42,44,50,51](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/alternative-replay.ts#L42).
#### W1-F06: product/decisions/mutations.ts

**Comparação redundante após find de falha de draft.** Classificação: `type_narrowing_only_observed`.

Diagnósticos: TS2367 em 119:26 (log 675).

**Causa:** find(item => item.status !== "ok") já estreita failedDraft aos estados não ok; comparar novamente com ok produz TS2367.

**Impacto/limite:** Falha estática; a comparação redundante não demonstra defeito de comportamento por si só.

**Delta mínimo do owner:** WP11 deve verificar a existência do failedDraft e retornar a falha já estreitada, preservando o short-circuit e o resultado original.

**Prova pendente:** Typecheck hospedado e preservação do retorno original de falha na seleção afetada; não ampliar escopo de testes sem risco concreto.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `c9b380d4f9e3f0b35eae027374d57bf4c9b65c3e`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/mutations.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/mutations.ts).

**Trace:** [product/decisions/mutations.ts:119](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/mutations.ts#L119).
#### W1-F07: product/decisions/prepared-apply.ts

**Resultado genérico da transação de Apply inferido de forma estreita.** Classificação: `type_inference_only_observed`.

Diagnósticos: TS2322 em 48:5 (log 676); TS2345 em 85:426 (log 683); TS2638 em 109:75 (log 689); TS2740 em 111:185 (log 690); TS2638 em 114:74 (log 691); TS2638 em 115:81 (log 692); TS2638 em 115:112 (log 693); TS2740 em 116:183 (log 694).

**Causa:** O callback transacional é inferido a partir de um ramo de falha, mas também retorna recibo, existing, conflito e null. A inferência resultante propaga {} aos testes de in e aos retornos CommandReceipt.

**Impacto/limite:** Oito diagnósticos de tipagem; {} no erro do compilador não prova que o runtime tenha produzido um recibo vazio. A ausência real de callbacks no consumidor C12 é registrada separadamente em WP04-C12-CALLBACKS.

**Delta mínimo do owner:** WP11 deve declarar explicitamente o resultado transacional discriminado, cobrindo CommandReceipt, {existing:CommandReceipt}, {failure:"conflict"|"unavailable"} e null, e manter o retorno PortResult<CommandReceipt> estreitado. Preservar reautorização, atomicidade e recuperação idempotente; não contornar com any.

**Prova pendente:** Typecheck hospedado e seleção cirúrgica de Apply: rollback antes do commit, mesma chave/digest recupera recibo, chave com conteúdo diferente conflita, revogação nega leitura/retry e resposta perdida não repete efeito.

**Critérios afetados por dependência:** `WP10.T01.CHK.05`, `WP10.T01.INV.02`, `WP10.T01.INV.03`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `60c1b9d21f82f0871a8d15886f1949e1396de57a`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts).

**Trace:** [product/decisions/prepared-apply.ts:48,85,109,111,114,115,116](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts#L48).
#### W1-F08: product/decisions/proposals.ts

**Comparação redundante após find de falha de preview.** Classificação: `type_narrowing_only_observed`.

Diagnósticos: TS2367 em 98:26 (log 695).

**Causa:** failedPreview já exclui status ok após find; a nova comparação com ok produz TS2367.

**Impacto/limite:** Falha de tipo sem defeito funcional adicional demonstrado.

**Delta mínimo do owner:** WP11 deve usar o teste de presença e retornar a falha já discriminada, sem alterar o resultado ou ordem de validações.

**Prova pendente:** Typecheck hospedado do novo candidato e manutenção dos retornos de falha.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `304eb80e72a002078e3f6ea8c5cfac507ffdd494`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/proposals.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/proposals.ts).

**Trace:** [product/decisions/proposals.ts:98](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decisions/proposals.ts#L98).

### WP12 — 2 diagnóstico(s), 1 path(s)

#### W1-F09: product/ai/analysis-port.ts

**Narrowing assíncrono do estado e união de retorno do histórico.** Classificação: `type_inference_only_observed`.

Diagnósticos: TS2345 em 245:120 (log 610); TS2345 em 303:50 (log 612).

**Causa:** Em :245, outcome.state estreitado para needs-input/unavailable não permanece estreitado dentro do callback. Em :303, withRunContext infere um retorno sem output pelo primeiro ramo e rejeita o ramo ready com ContributionEnvelope.

**Impacto/limite:** Dois bloqueios estáticos. Não há prova nesta triagem de settlement errado, exposição ou perda de output em execução.

**Delta mínimo do owner:** WP12 deve capturar o estado estreitado em valor imutável antes do callback e explicitar o tipo de retorno canônico de leitura de run com output ready opcional/discriminado. Não suprimir output, alargar estado nem enfraquecer proveniência/autorização para passar no compilador.

**Prova pendente:** Typecheck hospedado e leitura/retomada de runs ready e não ready com output e reautorização preservados no novo candidato.

**Critérios afetados por dependência:** `WP10.T01.SUC.10`, `WP10.T06.CHK.10`, `WP10.T06.SUC.01`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `06b12a8714adb16b87f7f6e8f8a329e164ed5288`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ai/analysis-port.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/574841e2409a9523000c4c1976c81804c9a86fde/modules/sucafina/Sucafinav1/product/ai/analysis-port.ts).

**Trace:** [product/ai/analysis-port.ts:245,303](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/ai/analysis-port.ts#L245).

### WP13 — 8 diagnóstico(s), 4 path(s)

#### W1-F10: product/portfolio/catalog.ts

**Comparação redundante de falha no catálogo.** Classificação: `type_narrowing_only_observed`.

Diagnósticos: TS2367 em 15:20 (log 704).

**Causa:** find de status diferente de ok já estreita failure; a comparação adicional com ok é incompatível com o tipo estreitado.

**Impacto/limite:** Bloqueio estático sem falha de comportamento demonstrada.

**Delta mínimo do owner:** WP13 deve testar somente a presença de failure e preservar a falha original e o short-circuit.

**Prova pendente:** Typecheck hospedado do novo candidato.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `484ee7dc8ac3a78a381f73c020a3afc06c5394c7`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/portfolio/catalog.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/product/portfolio/catalog.ts).

**Trace:** [product/portfolio/catalog.ts:15](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/portfolio/catalog.ts#L15).
#### W1-F11: product/portfolio/handoff.ts

**Três comparações redundantes de falha no handoff.** Classificação: `type_narrowing_only_observed`.

Diagnósticos: TS2367 em 41:18 (log 705); TS2367 em 79:18 (log 706); TS2367 em 96:20 (log 707).

**Causa:** Os três resultados failure obtidos por find já excluem ok; a comparação extra repete o teste de uma variante impossível.

**Impacto/limite:** Três diagnósticos estáticos com a mesma causa. Não são três falhas de runtime demonstradas.

**Delta mínimo do owner:** WP13 deve substituir as comparações redundantes por testes de presença e retornar a variante não ok original, sem alterar seleção ou autorização.

**Prova pendente:** Typecheck hospedado do novo candidato.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `b1d98fe90c01a6de34f1dcafdff92fcddf83da2d`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/portfolio/handoff.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/product/portfolio/handoff.ts).

**Trace:** [product/portfolio/handoff.ts:41,79,96](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/portfolio/handoff.ts#L41).
#### W1-F12: product/portfolio/planner-sensitivity.ts

**Narrowing de cenário perdido dentro de exactThreshold.** Classificação: `type_narrowing_only_observed`.

Diagnósticos: TS2339 em 80:106 (log 708); TS2339 em 80:171 (log 710).

**Causa:** source/baseline são validados como scenario antes da criação do callback, mas o acesso a result.costCoverage dentro de exactThreshold volta a enxergar a união geral de resultados de portfolio.

**Impacto/limite:** Dois bloqueios estáticos; esta triagem não demonstrou cálculo numérico errado ou acesso runtime a um resultado incompatível.

**Delta mínimo do owner:** WP13 deve capturar records/results de cenário imutáveis após o narrowing ou revalidar o discriminante dentro do callback. Não acessar a união geral por as/any nem enfraquecer a semântica de costCoverage.

**Prova pendente:** Typecheck hospedado e seleção cirúrgica de sensibilidade/exactThreshold preservando cobertura e refs.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `e6313ad315f5235a87442c7094ff47f2c74ca6c3`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts).

**Trace:** [product/portfolio/planner-sensitivity.ts:80](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts#L80).
#### W1-F13: test/product/wp13/history-provenance.test.ts

**Dois objetos de mock sem fechamento sintático.** Classificação: `test_parse_blocker`.

Diagnósticos: TS1005 em 60:202 (log 537); TS1005 em 66:157 (log 538).

**Causa:** Os mocks das linhas 60 e 66 não fecham o objeto externo antes de as never. O parser emite TS1005 nas duas posições.

**Impacto/limite:** Impede a conclusão do typecheck Sucafina e o carregamento deste teste. Não é falha demonstrada de runtime do produto. A fase semântica bloqueada pode revelar diagnósticos adicionais após a correção.

**Delta mínimo do owner:** WP13 deve fechar o objeto externo em cada mock, mantendo os cenários e asserts. Não remover ou excluir o teste para tornar o pacote verde.

**Prova pendente:** Typecheck Sucafina hospedado depois do delta; então avaliar diagnósticos semânticos eventualmente revelados e executar a seleção relevante pelo executor hospedado quando autorizada.

**Critérios afetados por dependência:** `WP10.T01.DOD.01`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `c9dc2eab887eb7624fabcb335b31972532f9b4b9`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/test/product/wp13/history-provenance.test.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/test/product/wp13/history-provenance.test.ts).

**Trace:** [test/product/wp13/history-provenance.test.ts:60,66](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/test/product/wp13/history-provenance.test.ts#L60).

### WP14 — 3 diagnóstico(s), 2 path(s)

#### W1-F14: product/decision-memory/signal-list.ts

**field perde tipo depois da validação de array de bindings.** Classificação: `type_narrowing_only_observed`.

Diagnósticos: TS7006 em 91:1060 (log 620).

**Causa:** O encadeamento de validação Array.isArray e callbacks deixa field implicitamente any em selection.fields.some.

**Impacto/limite:** TS7006 bloqueia typecheck; não há erro funcional ou vazamento demonstrado por esse diagnóstico isolado.

**Delta mínimo do owner:** WP14 deve preservar a tipagem readonly dos bindings e fields, usando um guard/tipo explícito compatível com a validação de entrada. Manter checks de fields, provenance e scope; não usar any ou remover validação.

**Prova pendente:** Typecheck hospedado e manutenção das recusas para fields/bindings inválidos na seleção afetada.

**Critérios afetados por dependência:** `WP10.T07.DOD.01`, `WP10.T07.CMP.01`, `WP10.T07.SUC.01`, `WP10.T01.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `91b6154c5e932b60ed70d50087961af290b626c6`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decision-memory/signal-list.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/02ac8172c17ad57e830bfb23d3ff1d1b1191852b/modules/sucafina/Sucafinav1/product/decision-memory/signal-list.ts).

**Trace:** [product/decision-memory/signal-list.ts:91](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decision-memory/signal-list.ts#L91).
#### W1-F15: product/decision-memory/source-access.ts

**Porta de Procurement declara objeto resolver, mas o chama como função.** Classificação: `runtime_contract_mismatch_mitigated_in_W1`.

Diagnósticos: TS2349 em 221:35 (log 621); TS2349 em 227:33 (log 623).

**Causa:** resolve é declarado como ReturnType<typeof createProcurementSourceResolver>, objeto com método resolve. As linhas 221/227 chamam input.resolve(...). Para um consumidor que passa o objeto descrito no contrato, isso lança TypeError; catch o converte em unavailable.

**Impacto/limite:** Há incompatibilidade real no contrato do produtor além dos dois TS2349. Porém a composição W1 já passa Object.assign(resolveProcurement,{...individual,resolve:resolveProcurement}) em business-services.ts:299; esse valor é chamável e mitiga esta incompatibilidade no caminho montado. Não se afirma que o caminho Procurement integrado W1 falhou por esta causa.

**Delta mínimo do owner:** WP14 deve escolher e declarar a forma canônica: chamar input.resolve.resolve(...) se aceita o objeto, ou declarar explicitamente a assinatura de função e ajustar os consumidores. Preservar a segunda resolução, reautorização e o resultado unavailable em falhas reais; não depender de um callable-object implícito para provar o contrato.

**Prova pendente:** Typecheck hospedado e consumidor positivo usando a forma pública documentada do resolver, seguido de alteração/revogação entre resoluções. A prova do adapter W1 não substitui a prova do contrato padrão.

**Critérios afetados por dependência:** `WP10.T07.DOD.01`, `WP10.T07.CMP.01`, `WP10.T07.SUC.01`, `WP10.T01.SUC.10`, `WP10.SUC.10`; além dos gates compartilhados T04 abaixo. Sem atribuição de cobertura ou aceite.

**Identidade:** blob `9a29a61dca38f723aca5c0bcd416c26a1cc636b1`, igual em [W1](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts) e no [head do produtor](https://github.com/gustavomhss/Orchestra-SF/blob/02ac8172c17ad57e830bfb23d3ff1d1b1191852b/modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts).

**Trace:** [product/decision-memory/source-access.ts:221,227,230](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts#L221); [product/procurement/sources.ts:17,77,86](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/procurement/sources.ts#L17); [apps/cli/src/sucafina-product/business-services.ts:299](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/apps/cli/src/sucafina-product/business-services.ts#L299); [product/host-binding/business-context.ts:220,224](https://github.com/gustavomhss/Orchestra-SF/blob/eee00ac3ef2b68c987970535ba5bba5e4c6ad01b/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts#L220).

## Relação com os 171 critérios e as revisões independentes

Os 171 IDs canônicos continuam preservados. A associação deste relatório significa impedimento de dependência ou de verificação; não transforma cada diagnóstico em reprovação executada de todos os critérios relacionados. O arquivo canônico não foi alterado.

Os gates comuns são `WP10.T04.DOD.01` (verificações válidas no candidato final, sem falha obrigatória/prova desatualizada), `WP10.T04.DOD.40` (recibos de seleções/gates no candidato aceito) e `WP10.T04.CMP.01` (seletores e consumidores afetados). O JSON reproduz o texto canônico dos critérios citados e a ligação aos arquivos.

R1, R2 e R3 foram lidos como inputs independentes da rodada W. Os achados próprios continuam de WP10: R1-UX-01..05 (período, successor/update de review, forecast, fontes BI e filtros), R2-F01..03 (portfolio, evidência de cálculo e fonte histórica), R3-C11-01 (veto final de publicação) e R3-LIFE-01 (liberação de recursos). Não são transferidos a produtores por este relatório. A dependência R3-C07 já tem report próprio e fica fora da contagem 32/15.

Os builders e root devem devolver os deltas e o novo SHA aos três revisores para rechecagem. A presente triagem não é um quarto review, nem substitui um dos três.

## Pendências exatas

- Cada owner publica delta mínimo para seus paths e entrega SHA, contrato/resultados relevantes; os heads observados não contêm correção destes blobs.
- WP10 compõe somente outputs autorizados, registra pins e conserva os inputs estrangeiros arquivados; não corrige diretamente os 15 paths excluídos.
- Depois do freeze de builders, root executa W2 hospedado com snapshots vinculados ao novo SHA e verifica envelopes. Nada de W1 se torna prova verde de W2 por herança.
- A correção do parse WP13 libera diagnóstico semântico adicional: verificar o log completo subsequente, sem presumir que 32 é o total exaustivo de falhas restantes.
- Exigir prova funcional específica de C12 e AlternativeDraft, não apenas typecheck; preservar recusas, atomicidade, recibos e domínio oficial.
- Manter abertos os achados próprios R1/R2/R3 até deltas e rechecagem pelos três revisores independentes; este relatório não substitui nenhum deles.
- Manter C07 com seu relatório próprio e pendências nativas explícitas. Epic global e aceite nativo/global continuam pendentes; nenhuma fabricação de aceite.

## Limites da evidência

- 32 é a contagem de registros de diagnóstico estrangeiros observados no W1, não 32 bugs independentes; causas únicas podem gerar múltiplos registros.
- A igualdade byte-a-byte vale para os 15 paths nos SHAs indicados, não implica que todos os demais arquivos dos heads estejam integrados ou corretos.
- Conclusões de runtime são rastreamento estático de chamadas e renderização; nenhum produto, browser, teste ou typecheck foi executado localmente.
- O relatório não altera contratos canônicos, status dos 171 critérios, branches de produtores, sf2-stack ou registros de revisão independente.
- A hipótese de ambiente não explica estes diagnósticos de código/contrato; não se atribui a ela o resultado sem evidência. As demais falhas W1 têm triagem própria.

## Hashes dos inputs lidos

| Input | Bytes | SHA-256 |
|---|---:|---|
| `analysis/hosted/W1-results.json` | 7614 | `4e365ff027a416507da61755ef1da8d07159fbd6c54a690cee4430a14bc2c441` |
| `analysis/hosted/W1-typecheck-triage.json` | 24090 | `dc1c88b55fc3eaf239a3077322bcd8624c766e2fc79ea7f4e745df8f746949ef` |
| `analysis/hosted/job-132293700346.log` | 120260 | `6841ecc21620c4e04a22ffd5a06e3129ed74c77a76adc79204095ff86173783b` |
| `analysis/hosted/job-132293688965.log` | 133337 | `d6548bb8df3a0ff6c41ac723433a14f878e9f064e94cfc4a6a1063373f6371ab` |
| `analysis/hosted/foreign-source-verification-W1.json` | 7705 | `3623e7c19e4c79a9cb215aa4e4857f3126ff605c1bccfbaee536c22ff7331967` |
| `analysis/reviews/R1-product-W.json` | 237248 | `ace5d4d5b82c6b604bdf65e74ef79204490984adeb18f80dfd7d358be0ff4807` |
| `analysis/reviews/R2-finance-W.json` | 22032 | `ff0093a812d10221e4ca7e5bf11b44bac83718a9a4a299cc21a65d44fcd7b051` |
| `analysis/reviews/R3-runtime-W.json` | 22921 | `5a2e532d46babf5cee6e908e886318bc3e725a5d5762f1e5454d03746878b245` |
| `analysis/criteria-canonical-extract.json` | 72573 | `210842aff836da432a39b98fbe128c64fab45c926f6eed0c9a038820fe4b7673` |

O arquivo `foreign-source-verification-W1.json` conserva os 15 pares de blob SHA retornados pelo GitHub MCP e a igualdade de conteúdo UTF-8. O JSON principal conserva os 32 diagnósticos originais e todos os pins/IDs para auditoria. Os hashes dos entregáveis são calculados após a escrita e enviados ao parent, evitando autorreferência circular.

## Corroboração posterior e fechamento da triagem

**CLOSED — triagem concluída.** O check concorrente [43548298822 / job 132304639692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43548298822/job/132304639692), cujo log registra checkout de `a43883c930cf996472b27c524aadb4694c13b5a3`, repete exatamente os 32 diagnósticos estrangeiros por path/linha/coluna/código e não registra diagnósticos em paths WP10. Esse candidato posterior não é apresentado como o W2 ainda a ser congelado pelo root.

A leitura do log já existente é apenas corroboração do conjunto; não houve dispatch adicional. Hash do log `analysis/hosted/job-132304639692.log`: SHA-256 `69595c97d8a7d6a3cd5b6658ec94393c348ca63a507fce1861979e56ca98028b`, 107313 bytes. A aprovação funcional de C12/AlternativeDraft, os deltas dos owners, a revisão do candidato final e o aceite nativo/global continuam pendentes nos termos acima.
