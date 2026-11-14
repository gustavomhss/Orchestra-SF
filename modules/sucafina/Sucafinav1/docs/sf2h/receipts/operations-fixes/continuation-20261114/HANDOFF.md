# Continuação operations-fixes — OPS-REV-03

**Status da missão: PARTIAL.** OPS-REV-03 foi corrigido e provado; I-OPS-02 e o erro herdado WP14 permanecem nas fronteiras de seus owners.

## Estado e fonte da retomada

Mesma PR [#52](https://github.com/gustavomhss/Orchestra-SF/pull/52), `operations-fixes` → `astra-operations`, sem merge. A retomada consumiu o HEAD `32a73ae7995eb193eaf9a78527736cb2df176a00`, posterior ao último SHA informado pelo usuário. Os dois commits posteriores eram exclusivamente evidenciais e foram preservados. A publicação terminal dos checks anteriores na PR também foi observada antes da escrita.

O produto desta continuação é `c9b14ba6848d87a756c4144a542f5cee571dac37`, tree `08c06a318a21e8c343742f935c9ad789accc34be`. O delta de produção altera somente `product/documents/capabilities.ts#searchDocumentEvidence`. Novos testes/fixtures permanecem no namespace `test/product/operations-fixes/`; recibos nesta subpasta.

## Findings

| Finding | Estado | Evidência e limite |
|---|---|---|
| D-OPS-01 | Correção anterior preservada | Run 43625203326: 8 PASS / 96 assertions em W `ee2e14ac`. Não repetido pela troca de sessão. Schema, workbench e corpos de extração/confirmação não mudaram nesta continuação. |
| OPS-REV-03 | Corrigido e provado cirurgicamente | Run 43626678715: **4 PASS / 0 FAIL, 37 assertions**, 42,53 s. W `c9b14ba6`, snapshot `56b5b3dc`. |
| I-OPS-02 | BLOCKED_EXTERNAL_DEPENDENCY | Impasse reproduzido no run 43624678702: 2 PASS / 76 assertions. Estes PASS provam o defeito e controles, não recuperação aceita. Propostas anteriores continuam NOT_APPLIED / NOT_RUN. |

## Mudança de comportamento

A busca verifica escopo, leitura autorizada e identidade corrente antes de consumir orçamento. Índice e campos do mesmo documento compartilham uma posição pela identidade instalação/projeto/documento/encarnação/revisão/digest do blob, independentemente de campo ou revisão RAG.

São pesquisadas no máximo cem fontes autorizadas distintas. O 101º documento autorizado pode comprovar `document-scan-limited`, sem ter seu texto pesquisado. Todas as fontes contadas, inclusive as sem match e essa testemunha de limite, são revalidadas na saída. A validação de refs, offsets UTF-16, SHA-256 do blob/trecho, BLAKE3 e autoridade permanece.

A busca continua parando ao obter `request.limit` matches. A flag indica corte de fontes efetivamente alcançado; não representa cardinalidade total de documentos não observados.

## Provas selecionadas

- HTTP real: upload/admissão/schema/extração de A com 100 campos, B posterior com token único, controle de A ainda corrente, busca geral e [A,B] equivalentes a B isolado, consulta vazia, armazenamento somente com candidatos e retirada física de A.
- Prefixo de 104 fontes inacessíveis, alternando revogação, outro principal, instalação e projeto: igualdade completa de resultados/metadata com B isolado e ausência de token privado.
- Cem e 101 fontes autorizadas: B na posição cem é pesquisado; a 101ª fonte afeta apenas a flag; revogação da testemunha ou de fonte sem hits no egress suprime toda a resposta.
- Regressão existente de SQLite: leitura posterior altera a fonte de match anterior e a saída é recusada.

Os dois cenários de cardinalidade usam política de bytes sintética explicitamente declarada. O parser, RAG, adapter, resolver, busca, SQLite e autoridade são reais; isso não qualifica o controle nativo de acesso para 104 anexos reais. A prova HTTP usa byteport e ciclo de fonte de produção. Nenhum navegador adicional, teste local, epic ou full suite foi executado.

## Critérios

`WP06.T05.CMP.19` e `WP06.T05.QLT.18` são cobertos na parcela de busca/metadata deste finding. Preservados `WP06.T05.INV.19/CHK.19/QLT.19`, `CAMP.INV.04`, `CAMP.CMP.02`, C14 e C17. Não se declara aceite integral do WP06, matriz de formatos, paridade UI/native/MCP, AM01–AM06 ou release global.

## I-OPS-02: próxima ação executável

Reconciliado novamente `procurement-apply@897484c9a472bd43d17cabe56552f2f8fa890185`: o novo fix de pós-condição de PR mantém `decision-host.ts` no blob `23d9291b3dcedda36edc4aa4f38856024e3c58f4` e `decision-http.ts` no blob `e169d335f091c446bb380ee73f450083f917946f`. `decision-recover` continua ausente. Finance mantém o executor `f8404c18abc040c49cf111eb4561ce4c2873a4c6`, que já tem correção parcial do gate genérico.

O owner do host/HTTP e o owner do executor precisam reconciliar e publicar as propostas [Operations](../c12-receipt-recovery.NOT_APPLIED.patch) e [variante Finance](../c12-current-executor.NOT_APPLIED.patch), preservando seus preimages e os incrementos novos. A rota de recuperação deve encontrar o recibo original antes de qualquer dispatch; sem recibo, não aplica domínio. Depois, a UI pode consumir a rota e provar H05, retry, reload, navegação na mesma aba e reabertura SQLite, conservando um efeito, o mesmo recibo, edição concorrente e autorização atuais.

Não copiar o hunk antigo do executor sobre Finance. Nova aba/sessão ou correlação apagada continua exigindo resolver durável. Os patches e o [handoff C12 anterior](../c12-owner-handoff.md) foram preservados, sem aplicação fora do ownership.

## Typechecks e guards executados

[Run 43627083716](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627083716), job `132545828766`, sobre W `c9b14ba6848d87a756c4144a542f5cee571dac37`. Snapshot `1601f4eef6e556f660217627771b2f8a6a7b17dd`, tree `77707e529972f759420ced4b399b44b0d132f27c`; pai direto W e único acréscimo `.astra-operations-check.json`, blob `0789c92cf40d554902167e957cf18c50adb9e171`.

| Gate | Resultado |
|---|---|
| Envelope, checkout de W e base origin/dev | PASS |
| `bun typecheck` em `modules/sucafina` | **FAIL: um TS2741 herdado**, em `test/product/wp14/source-access-atlas.test.ts(167,41)`: falta `procurementEvidenceWrites`. |
| `bun typecheck` em `apps/cli` | PASS |
| `bun run check:guards --base origin/dev` | PASS: **78 regras, 856 paths, zero gates, 11 warnings e zero errors**. |
| Upload de evidência | PASS; artifact `14126157499`. |

O erro WP14 tem o mesmo blob `fbe627ffde443ff7e2d3b1204bbcf67523404f41` no baseline `ba8a09e` e no produto W; ambos foram relidos. Nenhum diagnóstico aponta para o incremento. As onze advertências são dez dependências herdadas em manifests e um timeout anterior de WP01; nenhum desses paths foi modificado nesta continuação. Nenhum ignore ou approval label foi aplicado.

O check aguardou o grupo compartilhado ocupado por import-recovery e executou em seguida, sem cancelamento de outro run. A conclusão agregada permanece **FAILURE**, não green global. A evidência e os hashes do log/artefato estão em [proof.json](proof.json).

## Publicação e limites

Resultados terminais, requests e relação W/S ficam em [proof.json](proof.json); reconciliação da retomada em [preparation.json](preparation.json). As provas anteriores seguem nos recibos originais, com seus próprios SHAs. A entrega documental posterior ao produto somente acrescenta evidência e o apontador deste handoff; não reatribui a si execuções de outro commit.

Remoto exclusivamente GitHub MCP; nenhuma nova branch de produto/PR, mudança em engines, workflow, acesso, alçada, deploy ou merge. Os testes e recibos anteriores permanecem intactos.

## Encerramento da escrita desta retomada

Esta rodada encerra sua escrita em `operations-fixes` com este handoff. Os dois runs próprios estão terminados; nenhum CI próprio permanece em voo. A próxima sessão deve reconciliar HEAD/PR e os hosts publicados antes de retomar I-OPS-02. Não há autorização de merge ou fechamento global implícita.
