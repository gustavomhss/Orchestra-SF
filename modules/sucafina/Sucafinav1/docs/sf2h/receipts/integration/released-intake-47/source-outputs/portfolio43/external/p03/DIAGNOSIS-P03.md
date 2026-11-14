# Diagnóstico P03 — missão43

## Disposição

**P03 permanece PARTIAL: os dois consumidores curtos passaram; o novo cenário semântico falhou no budget original.** Não existe nova execução deste cenário nem mudança de orçamento. Nenhuma correção Finance34 foi aplicada pela missão43, inclusive em validação.

A inspeção não demonstrou uma correção segura, material e suficiente somente na composição do teste. Os wrappers canônicos que poderiam ser confundidos com uma correção já existem no blob executado. Foi recuperado o pacote completo e publicado do owner Finance34: ele altera precisamente uma dependência de persistência ainda ausente tanto em W quanto no target atual. Esse delta tem prova causal e uma jornada Finance concluída na origem; **não tem prova de suficiência para este consumidor WP13**.

## Execução observada

| Identidade | Valor |
| --- | --- |
| W | `524fa67c99dda72807a98f5e23ce3354c8e40197` |
| W tree | `dafb1be8b17b2c8941818af5fc793255ab73c4da` |
| S | `6ff519e41a661dcfb87399fa4aa83ea2c1d2213f` |
| S tree | `d703c3aea4d9574baac8da9e58040a6b85b1586e` |
| Pai de S | W, confirmado por GitHub MCP |
| Request .ci-run.json | blob `d0ce0de717e09954f2ec6770a380ccc63bf60969` |
| Run | [43649882839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649882839) |
| Job de produto | 132615750915, failure |
| Cleanup | 132617040916, success |
| portfolio.test.ts | 16 PASS |
| reconciliation.test.ts | 11 PASS |
| semantic-union-source-scenario.test.ts | 1 FAIL por deadline180000 |
| Blob do cenário semântico | `47b5358c8dda3179045499388ce98871576a2aa9`, idêntico ao postimage21 |

O request selecionou os três arquivos e conservou `--timeout 120000`; o cenário declara explicitamente `180000` e a fixture usa o guard original de180000. Nenhum desses valores foi alterado.

O executor principal relatou os seguintes checkpoints/contadores dos logs: bootstrap68ms; prepare omitted11901ms; deadline180003ms;6818 leituras C08 cases/58,9s inclusivos;81858 host.revalidate;2617 planner.verifyOperation/44,16s inclusivos; seis transações cases no terminal. Estes números são evidência do run fornecida pelo executor principal, não nova medição desta revisão. Categorias são aninhadas e não devem ser somadas.

No terminal, a chamada `before.persistent.evaluateAndStore` da linha49 ainda não retornara o resultado omitido. O erro da linha50 tornou-se `comparison-persisted-but-binding-unavailable` depois do deadline. Portanto as assertions posteriores de confirmação250000, escolha preservada, replay e revogação deste novo teste **não foram alcançadas**. Os27PASS não as substituem.

## Percurso de código e linhas

As linhas abaixo se referem ao W fixado, sem editar os arquivos.

| Arquivo / linhas | Papel observado |
| --- | --- |
| [semantic-union-source-scenario.test.ts,49–50](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/test/product/wp13/semantic-union-source-scenario.test.ts#L49-L50) | Primeira avaliação/persistência omitida e erro terminal. |
| [Mesmo teste,266–274](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/test/product/wp13/semantic-union-source-scenario.test.ts#L266-L274) | `canonicalPlanner.compareScenarios` e `simulateScenario` **já** são envolvidos por `readPortfolioSnapshot`. |
| [Mesmo teste,297–343](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/test/product/wp13/semantic-union-source-scenario.test.ts#L297-L343) | `compareSelected` conserva duas observações, fontes/autoridade e snapshot final simultâneo; `compare` **já** abre o scope canônico. |
| [Mesmo teste,359–365](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/test/product/wp13/semantic-union-source-scenario.test.ts#L359-L365) | Composição de análise, persistência, comparison/portfolio bindings e produção; usa o produtor real. |
| [product/portfolio/analysis.ts,41–80](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/product/portfolio/analysis.ts#L41-L80) | Seleção, provas, comparação, persistência C08, binding, nova seleção e revalidação são efetivamente necessários nesta cadeia. |
| [product/planner/persistence.ts,93–107](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/product/planner/persistence.ts#L93-L107) | C08 comparison é gravado, `bindings.bind` é chamado e falha de binding vira o erro observado; preserva nova validação posterior. |
| [product/decisions/criterion-comparison.ts,35–57](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts#L35-L57) | Cada validação lê resultado/regras, chama verifyBinding e reavalia critérios; read repete a validação. |
| [Mesmo arquivo,61–87](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts#L61-L87) | bind contém validação privada, transação própria e read posterior. Envolver só o método read exportado não envolve a validação privada anterior ao commit. |
| [test/product/wp11/renewal-operation-verifier.ts,19–34 e86–102](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/test/product/wp11/renewal-operation-verifier.ts#L19-L34) | Verificador de operações e grupo de alternativas **já** possuem transação real por invocação, sem memo de autoridade e com callback final dentro do scope. |
| [product/planner/sensitivity-units.ts,56–100](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts#L56-L100) | Duas fases reais de C08, caso, cenário, evidência e autoridade; batch/escalares e cronologia atuais precisam permanecer. |
| [runtime/local-store.ts,154–173 e199–204](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/runtime/local-store.ts#L154-L173) | W conserva `currentSnapshots`/nested clones e decodificação das três superfícies por root; corresponde exatamente à preimage Finance34. |
| [product/portfolio/read-snapshot.ts,16–60](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/product/portfolio/read-snapshot.ts#L16-L60) | Scope retém identidades, payload/Request/autoridade, aceita apenas joins próprios, aguarda checks e recusa write aninhado. |
| [test/product/wp11/fixture-trace.ts,7–29](https://github.com/gustavomhss/Orchestra-SF/blob/524fa67c99dda72807a98f5e23ce3354c8e40197/modules/sucafina/Sucafinav1/test/product/wp11/fixture-trace.ts#L7-L29) | Guard lança antes/depois de cada callback instrumentado quando o tempo excede180000. |

A resposta tardia de binding não demonstra isoladamente corrupção de dados, fonte ou C08: o guard pode lançar durante os callbacks e os produtores transformam recusas/exceções em estados explícitos. O que o run demonstra é **deadline antes da conclusão do caminho de binding**. Não se muda o expectedok para unavailable/stale.

## O que está demonstrado e o que permanece hipótese

**Demonstrado por leitura/identidade:** o teste executado já possui as roots de leitura descritas; W e sf2-stack atual usam a preimage exata do delta Finance34; o namespace dos cinco testes do owner está ausente; o patch completo recuperado bate byte a byte nos hashes do manifesto.

**Demonstrado na origem Finance34:** o owner mediu materialização de payloads em roots Planner desnecessárias, implementou memo apenas da transformação pura mais demanda por superfície e conservou callbacks, locks, CAS, validação e formato. O probe S3→S4 reduziu trabalho UTF-16 de materialização em roots, sem deslocamento medido para nested. Sua jornada original passou em W3. Estes dados estão no handoff original, preservado integralmente.

**Inferência causal plausível, ainda sem prova WP13:** essa mesma persistência antiga participa das milhares de leituras/replays observadas neste run WP13. A integração do delta publicado remove uma fonte material conhecida de trabalho, mas o número de comparações/revalidações do consumidor WP13 é diferente. Não é possível inferir que180000 será suficiente nem converter o PASS Finance em PASS P03.

**Sem delta seguro demonstrado no teste:** acrescentar novamente wrapper ao Planner/compare não muda a implementação já executada. Envolver `evaluateAndStore`, `analysis.evaluate`, `bind`, `selection.register` ou mutações numa root somente leitura envolveria escritas C08/CAS; o poison é obrigatório. Wrappers adicionais em reads individuais podem alterar distribuição de roots/clones, mas não há medição que demonstre redução material aqui; `currentSnapshots` também clona. Não foram propostos caches de resultado, confiança, digest, fonte ou callbacks, nem retirada de revalidações/fences.

## Dependência Finance34 e pacote completo

- PR42 / finance-resume, terminal publicado e reobservado: `3117cae7e113b7aa0a8286963dcd7bc918994f3f`; tree `e59f6e24f49a9856d970789b984c33ef83711c0a`.
- Produto W3: `ebbc90dd3a325e2e8367f4e915ddd193a78b9220`; tree `e1ec7c748bd094585dfdbdf0cfbd019782ade908`.
- S5 Finance: `858caef12e133425d036867b6333496691856e9a`; [run43648344709](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43648344709),44PASS/0FAIL/396assertions; jornada137976,36ms com nove checkpoints. Prova de origem, não prova do bundle nem do novo teste WP13.
- [Handoff original](https://github.com/gustavomhss/Orchestra-SF/blob/3117cae7e113b7aa0a8286963dcd7bc918994f3f/modules/sucafina/Sucafinav1/docs/sf2h/receipts/finance-persistence-performance/HANDOFF-FINAL.md) e [patch composto completo](https://github.com/gustavomhss/Orchestra-SF/blob/3117cae7e113b7aa0a8286963dcd7bc918994f3f/modules/sucafina/Sucafinav1/docs/sf2h/receipts/finance-persistence-performance/bundle/composed-with-tests.NOT_APPLIED.patch.txt).
- Cópias locais inertes: [HANDOFF-FINAL.md](./finance34-owner/HANDOFF-FINAL.md), [manifest.json](./finance34-owner/manifest.json), [patch completo](./finance34-owner/composed-with-tests.NOT_APPLIED.patch.txt), [patch de produto](./finance34-owner/product.NOT_APPLIED.patch.txt), [residual-boundary.json](./finance34-owner/residual-boundary.json).
- O documento original endereça sessão33. A missão43 direciona este encaminhamento à **sessão42**, integradora atual; o original não foi reescrito.

| Artefato | Identidade |
| --- | --- |
| Patch completo | 76415bytes; gitblob `4a90b0e422bc628e654111bbc8612cfd796e1a34`; SHA256 `f483c07f69b56beb93a600c1ed84fd3100d0f40bb7897de5c05f7b3f4885c1e1` |
| Patch de produto | 8961bytes; gitblob `12f4774b0dec057bfb0a56a95c51360abfbba478`; SHA256 `e06bc8d5cb98e950597813b3c020acbd9df5de2befec4920dceedd5c2953ec19` |
| local-store preimage composto | `b753e3ffbfcdc06de373388845c686afac26dec8`; SHA256 `e82f739cb1845c0c7fdd90d50a5de0a62d6c3f79d4c981289b63880e7a8e5460` |
| local-store postimage proposto | `e9da289bdce680f2429904c1e83dec60c39aa2a8`; SHA256 `4f16fe7291f763ffba129ba024e6ee0b001d05b6769d0445f049c8869fc54311` |
| contract KEEP_CURRENT | `9e9bac976b503409de65868a366f352ca1e65071`; SHA256 `809bdbfe8b1efd05e4c0a3d8b78eea726c729d1767e8c4569fa6a31e78bb1c7a` |

Target reobservado por MCP durante esta revisão: `sf2-stack@36521bb47f1d10de8d8bb5d376fdb5d5fa7bc8e1`, tree `d6cc2b9f562ddc390e13a0645aae510bb5bd4e13`. Os dois blobs correspondem exatamente às preconditions acima; `test/product/finance-persistence-performance/` continua ausente na listagem completa de32 entradas. **Compatibilidade textual atual conferida; NOT_APPLIED / NOT_TESTED no bundle.**

O patch altera somente runtime/local-store.ts e adiciona os cinco testes exatos de W3. Preserva o contract composto, cloneSnapshot/copyValue/validateSnapshot e currentVersionCAS. O postimage inteiro da origem Finance não deve substituir o arquivo composto.

## Condição para novo run

1. A sessão42 reconcilia sua autoridade, novo head, blobs/modes e ausência dos cinco arquivos imediatamente antes do intake. Faz o intake incremental pelo fluxo GitHub MCP/CAS sem force sob sua própria autoridade.
2. A sessão42 qualifica o delta de persistência com a seleção curta autorizada e preserva a falha legada/SKIPs/checks do owner como fatos separados. A missão43 não aplica Finance34 e não repete a jornada Finance.
3. Só depois de existir **novo W material contendo o delta publicado e qualificado**, cabe reexecutar o cenário semântico WP13 pelo dispatcher autorizado, com request deduplicado e os mesmos72expect-lines,guard180000,test180000 e oráculos. Reconciliar se os27PASS anteriores precisam nova seleção devido à mudança da dependência; permanecem ligados ao W original até então.
4. Se o consumidor ainda falhar, conservar o terminal e diagnosticar a nova árvore sem repetir run inalterado. Não eliminar regras, histórico/C08 duplicado, asserts, negativas, CAS, reabertura, custos ausentes ou fences para obter verde.

Esta revisão não executou produto ou testes, não escreveu remoto, não alterou Finance ou contratos e não lançou workflow. Processamento local limitou-se a cópia textual, JSON e hashes. CurrentChoice permanece HELD; nenhum resultado acima fecha aceite global/native ou wholeWP13.
