# WP00 — revisão independente de typecheck W3–W10

**W10 reconfirma a correção dos cinco diagnósticos próprios de W7, removidos em W8. O check geral continua FAIL pelos mesmos 144 diagnósticos herdados, em 50 arquivos. A seleção e o typecheck oficial das seis fontes UI passaram; os guards passaram com 11 avisos.** Estes resultados não comprovam execução de jornadas, zoom, 30 repetições ou comparação de desempenho.

Produto W10: `181953e9cee36166558c5f429cbe11e0dd5105d1`; tree `43527d9e4444d57dc77696a15f2cd425ceb7ca2b`. Check: [43539548039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539548039), job `132276616575`, snapshot-envelope `899be75b46bd6ba4c292bf836e630bdf1a6a0aee`. Os logs confirmam o checkout do envelope e, em seguida, do produto; `revisions.txt` registra SHA, tree e base `origin/dev` usados no check.

A revisão leu os logs e artefatos publicados e conferiu hashes. Não executou testes de produto, navegador, servidor ou typecheck local, nem realizou mutações remotas. Nesta atualização, somente os dois recibos `typecheck-review` foram editados.

## Reconfirmação W9 e W10

W9 apresenta **144 diagnósticos em 50 arquivos**, sem novo ID, sem ID removido e sem diagnóstico em `test/product/wp00/`, comparado com W6 e W8. A lista de identidades mantém o digest `d00315bfe0f32da892b8ad5775e24bd343a9da3185b55afe8d84d418dae28a9b`. O `typecheck.log` W9 é igual em bytes ao W8: SHA-256 `61c155da1d97475f31c8aecc965815c53d84d68acbf93b967bcdd4377ea70338`. Frente a W6, permanece apenas a variação textual já descrita do TS2345 de `dashboard-preview.ts(38,75)`, sem novo diagnóstico.

O check confirma novamente a seleção das seis fontes, o typecheck oficial UI e os guards **78 / 606 / 0 gate / 11 warn / 0 errors**. O resultado geral continua FAIL. O [artefato W9 14090094509](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43538629884/artifacts/14090094509) foi revalidado pelo SHA-256 `f1295176ed566f68e453904e576f8cafcb0a64e404567d8df2a3dd8c1e4c72dd`, igual ao digest do upload. Os arquivos revisados são `inputs/reopen-checks-w9/` e `inputs/ci-reopen-checks-w9.log`.

W10 foi verificado pelos seus próprios logs e artefatos: **144 diagnósticos em 50 arquivos, zero IDs acrescentados ou removidos frente a W6 e W9, e zero diagnósticos em `test/product/wp00/`**. O log completo e o artefato produzem as mesmas 144 identidades. O `typecheck.log` é idêntico em bytes aos de W8 e W9, com SHA-256 `61c155da1d97475f31c8aecc965815c53d84d68acbf93b967bcdd4377ea70338`; o log completo W10 tem SHA-256 `e678d1c99afaa55420fbb484e5210f3fa5a95f002835d172abd1fa18ce4024ab`.

A validação da configuração e inclusão das seis fontes UI, o typecheck oficial UI e os guards passaram novamente no W10. O único passo com falha é o typecheck Sucafina herdado; o check geral permanece FAIL. O [artefato W10 14091490266](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539548039/artifacts/14091490266) contém oito arquivos, tem 15.752 bytes e SHA-256 `be429640206ef87b614f946a37502690a706d65ff61c15db41e93b504074c6aa`, conferido no ZIP baixado e no digest de upload. Fontes: `inputs/reopen-checks-w10/` e `inputs/ci-reopen-checks-w10.log`.

| Evidência | W9 | W10 |
| --- | --- | --- |
| Diagnósticos Sucafina / arquivos | 144 / 50 | 144 / 50 |
| IDs acrescentados / removidos versus W6 | 0 / 0 | 0 / 0 |
| Diagnósticos em `test/product/wp00/` | 0 | 0 |
| Configuração/inclusão UI | PASS, 6 fontes | PASS, 6 fontes |
| Typecheck oficial UI | PASS | PASS |
| Guards: regras / paths / gate / warn / errors | 78 / 606 / 0 / 11 / 0 | 78 / 606 / 0 / 11 / 0 |
| Check geral | FAIL | FAIL |

Produto W9: `1e09268b53e08fa4190c3969424973def7e1327e`; tree `22364becae1fc92de6dddf89b8d4912790ea15b2`; [run 43538629884](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43538629884), job `132273650366`, snapshot-envelope `2673e9e64f1440c93d470bdfd67cc97257234ee3`.

## Resultado por ciclo até W8

| Evidência | W3 | W4 | W5 | W6 | W7 | W8 |
| --- | --- | --- | --- | --- | --- | --- |
| Diagnósticos Sucafina | 144 | 144 | 144 | 144 | 149 | 144 |
| IDs herdados preservados | 144 | 144 | 144 | 144 | 144 | 144 |
| IDs próprios novos versus W6 | 0 | 0 | 0 | 0 | 5 | 0 |
| Arquivos com diagnósticos | 50 | 50 | 50 | 50 | 53 | 50 |
| Configuração/inclusão UI | FAIL: leitor de showConfig | FAIL: TS5069 | PASS, 2 fontes | PASS, 2 fontes | PASS, 6 fontes | PASS, 6 fontes |
| Typecheck oficial UI | Não executado | Não executado | PASS | PASS | PASS | PASS |
| Guards: regras / paths / gate / warn / errors | 78 / 586 / 0 / 11 / 0 | 78 / 587 / 0 / 11 / 0 | 78 / 587 / 0 / 11 / 0 | 78 / 593 / 0 / 11 / 0 | 78 / 606 / 0 / 11 / 0 | 78 / 606 / 0 / 11 / 0 |
| Check geral | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL |

Produto W8: `d456bdd9cb4c8d921648b8c885d49cf71e592402`; tree `a4b265973dd87d6bcff71b1be710f65bea6d341b`. Check: [43537543232](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537543232), snapshot-envelope `fafd7a5e1be32bdf5158fa9c66b3fbde94d9dda7`.

W6: [run 43524854853](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524854853), produto `29f40e0f0fafa8d526df9b280151962187f1440d`, snapshot-envelope `b6b7af9c4c31f8c21eb6cd64da1cf01916caa27d`. W7: [run 43536792411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536792411), produto `7c9bcdd891e5b56a09b438dc055fe05b4af5646c`, snapshot-envelope `20c38eaabbbc8bbb20ba7ca1560d084762c267a3`.

## Comparação discriminante dos diagnósticos

Cada identidade é a tupla **path normalizado no repositório, linha, coluna e código TS**. A extração foi feita independentemente dos logs completos e dos `typecheck.log` dos artefatos W6, W7, W8, W9 e W10; os dois meios produziram os mesmos conjuntos em cada ciclo. O inventário histórico W2/W5, preservado no JSON, coincide integralmente com W6, W8, W9 e W10.

- W7 acrescenta exatamente cinco IDs próprios e não remove nenhum dos 144 herdados.
- W8 apresenta zero IDs acrescentados e zero removidos em relação a W6; elimina os cinco IDs próprios de W7. W9 e W10 reconfirmam esse conjunto sem novos diagnósticos.
- O SHA-256 da lista de IDs ordenada, serializada como JSON compacto UTF-8, é `d00315bfe0f32da892b8ad5775e24bd343a9da3185b55afe8d84d418dae28a9b` em W6/W8/W9/W10; em W7 é `18b97f8720534f4300fdc4d099bfdc278e328615d3b2ac4d83b85d09304eba2b`.

O TS2345 de `product/imports/dashboard-preview.ts(38,75)` mantém a identidade. Na comparação das primeiras linhas, a união de tipos aparece com outra ordem/abreviação de campos (`warnings?`/`commandDigest?` versus `baseDigest?`/`reason`). Essa variação já ocorreu em W3 e reaparece em W7/W8/W9/W10. O JSON registra as duas mensagens separadamente; ela não é contada como novo diagnóstico nem como correção. O texto de continuação não compõe a identidade, e não se afirma igualdade byte a byte entre todos os ciclos ou entre os logs completos. A igualdade específica dos artefatos `typecheck.log` de W8/W9/W10 foi verificada separadamente.

O erro herdado `product/contracts/host-context.ts(14,45) TS2307`, relativo ao import de `../routines/factory.ts`, continua presente. **Zero diagnósticos em `test/product/wp00/` não significa ausência de erros em toda a pasta `product/contracts`.**

## Cinco erros próprios corrigidos em W8

Os paths abaixo são relativos a `modules/sucafina/Sucafinav1/`; as posições identificam os diagnósticos observados em W7.

| Fonte e posição W7 | Código | Correção confirmada pelo check W8 |
| --- | --- | --- |
| `test/product/wp00/contract-consumers.test.ts(18,30)` | TS2339 | Nome do caso usa `operation.operation`, campo real do freeze, em vez de `operation.id`. O aceite de cada handler/export permanece exigente. |
| `test/product/wp00/corpus-reconciliation.test.ts(69,80)` | TS2769 | `expect<Record<string, unknown>>` explicita o tipo da igualdade do snapshot completo. |
| `test/product/wp00/corpus-reconciliation.test.ts(88,79)` | TS2769 | A mesma correção de tipagem na segunda igualdade, preservando valores esperados. |
| `test/product/wp00/measurement-receipts.test.ts(126,30)` | TS2345 | Fixture inválida é produzida a partir de cópia válida e corrupção deliberada via `Reflect.set`; o contrato de produção não foi alargado. |
| `test/product/wp00/measurement-receipts.test.ts(133,40)` | TS2345 | O teste mantém a expectativa de rejeição na direção inversa da comparação; o segundo diagnóstico desaparece. |

Estas cinco falhas ficam registradas como regressões próprias de W7, corrigidas em W8. O recibo não as reclassifica como herdadas nem oculta o ciclo vermelho.

## Alcance do PASS da UI e dos guards

A listagem real `--listFilesOnly` inclui `baseline-ui.spec.ts`, `zoom-capability.spec.ts`, `prepare-installation.ts`, `browser.ts`, `flows.ts` e `measurements.ts`, todos em `packages/app-shell/e2e/sucafina/wp00/`. O workflow valida o path do tsconfig e `noEmit: true`, `composite: false`, `emitDeclarationOnly: false`, e então executa o script oficial `bun run typecheck:e2e --project e2e/sucafina/wp00/tsconfig.json`, que conclui sem diagnósticos. Os seis paths e as posições da listagem constam no JSON.

Os guards W7/W8/W9/W10 registram **78 regras, 606 paths, 0 gate, 11 warn e 0 errors**, contra `origin/dev` em `a1d37698a7bb097c1578f827eba6a19b9917ef07`. São dez avisos de dependências e um aviso de double cast já explícitos no log; nenhum foi suprimido para obter o resultado.

O PASS de compilação não aprova comportamento UI, startup da extensão, zoom real, download autenticado, UI30, p95 observado ou aceite nativo. A falha histórica de bootstrap C15 e qualquer execução UI posterior pertencem aos respectivos recibos de execução, sem promoção pelo resultado deste check.

## Integridade dos novos artefatos

| Ciclo | Artefato | SHA-256 do ZIP baixado, igual ao upload |
| --- | --- | --- |
| W7 | [14090775445](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536792411/artifacts/14090775445) | `cbd9e986480dc99911eb848ebeac621826843da15c68a3b46d5a42a87255bacd` |
| W8 | [14091015302](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537543232/artifacts/14091015302) | `a1c7eb420870fedd751a339f72109643b159153e51a35e63ddfb94683a1e9f07` |
| W9 | [14090094509](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43538629884/artifacts/14090094509) | `f1295176ed566f68e453904e576f8cafcb0a64e404567d8df2a3dd8c1e4c72dd` |
| W10 | [14091490266](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539548039/artifacts/14091490266) | `be429640206ef87b614f946a37502690a706d65ff61c15db41e93b504074c6aa` |

Fontes desta atualização: `inputs/checks6-artifact/`, `inputs/reopen-checks-w7/`, `inputs/reopen-checks-w8/`, `inputs/reopen-checks-w9/`, `inputs/reopen-checks-w10/`, `inputs/ciChecks-attempt6.log` e `inputs/ci-reopen-checks-w{7,8,9,10}.log`. Contagens por arquivo/código, IDs, offsets dos logs, revisões e hashes permanecem reproduzíveis em [typecheck-review.json](typecheck-review.json).

## Histórico W3–W5 preservado

O texto abaixo registra as conclusões da revisão anterior e a atualização UI5 recebida depois dela. Seus hashes, limitações e falhas pertencem àquelas revisões; o resultado concluído mais recente é W10, acima.

### WP00 — revisão final de checks W3–W5

**W5 comprova o typecheck oficial do harness UI e a correção da configuração; o check geral continua FAIL pelos mesmos 144 diagnósticos de Sucafina já observados em W2.** O resultado não comprova comportamento UI: o teste real W3 foi bloqueado no bootstrap C15 e registrou zero observações.

Produto W5: `70476b99e0a34c4432d48f5d2f3710c26562aa1b`; tree `56f717d5713bb48710f82ed66f9ef3d01292d90c`. Check: [43522928224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224), snapshot-envelope `8a52144930724b61de2a8d2b8fe91adbce9b5f27`. Revisão independente de fontes, logs e artefatos; nenhum teste, servidor, typecheck ou mutação remota foi executado pelo revisor.

#### Resultado comprovado

| Item | W3 | W4 | W5 |
| --- | --- | --- | --- |
| Typecheck Sucafina | FAIL: 144 diagnósticos | FAIL: mesmos 144 IDs | FAIL: mesmos 144 IDs |
| Configuração/inclusão dos dois arquivos UI | FAIL: formato showConfig interpretado incorretamente | FAIL: TS5069; ambos os paths constam da listagem | PASS |
| Typecheck oficial UI | Não executado | Não executado | PASS |
| Guards contra origin/dev | 78 regras, 586 paths, 0 gate, 11 warn, 0 errors | 78 regras, 587 paths, 0 gate, 11 warn, 0 errors | 78 regras, 587 paths, 0 gate, 11 warn, 0 errors |
| Check geral | FAIL | FAIL | FAIL |

O log W5 registra a validação dos dois arquivos, seguida de `bun run typecheck:e2e --project e2e/sucafina/wp00/tsconfig.json` sem diagnóstico ou falha. Os guards permanecem PASS com 11 avisos; nenhum aviso foi suprimido. O [artefato 14084311276](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224/artifacts/14084311276) tem SHA-256 `24383cd1a0a26e180d9ef1737da30047e52cd12b1a965543edc20e1a4dfb8b3d`, conforme o log de upload.

#### Classificação dos diagnósticos

Foram comparadas **144 identidades únicas em cada W2, W3, W4 e W5**, definidas por arquivo normalizado, linha, coluna e código TypeScript. W5 tem **zero IDs novos e zero removidos** em relação a W2; as 144 mensagens iniciais também coincidem com W2. Não há diagnóstico em `test/product/wp00/`. O JSON anexo preserva todos os IDs, linhas dos logs de origem e contagens por arquivo/código.

Em W3 somente a mensagem inicial do TS2345 de `product/imports/dashboard-preview.ts(38,75)` apresenta outra abreviação de propriedades do tipo impresso; sua identidade é a mesma. W4 e W5 voltam à mensagem inicial observada em W2. Portanto, a conclusão de estabilidade usa identidades explícitas, sem presumir igualdade byte a byte de logs completos.

Um erro herdado está no prefixo `product/contracts`: `host-context.ts(14,45) TS2307`, import de `../routines/factory.ts` ausente. Ele já existe em W2. A conclusão é **ausência de novos diagnósticos**, não ausência de erros em toda a pasta de contratos. Nenhum arquivo de outro WP foi alterado para remover esses erros.

#### Correções próprias verificadas

- **Recibo de observação:** o catch de `observe()` agora atribui `outcome = "failed"` antes de registrar e relançar a exceção. A inconsistência de sucesso após erro de screenshot/anexo foi removida na fonte e essa fonte passou no typecheck W5. A falha de anexo não foi provocada artificialmente.
- **Cache/autenticação:** antes de alcançar `measure-ui`/`completed`, o recibo passa a declarar `authenticated: false`, `cacheState: null` e razão da ausência. Isso corrige a afirmação incondicional presente no recibo histórico W3; esse artefato foi preservado. Não se atribui execução UI W5 a uma mudança apenas de fonte/typecheck.
- **Forma do showConfig:** o tsgo pinado produz opções flat e não inclui `files`. O workflow lê essa forma real e usa `--listFilesOnly` para demonstrar a inclusão de spec e helper. W5 confirmou essa verificação.
- **TS5069:** o tsconfig próprio agora define `emitDeclarationOnly: false`, preservando `composite: false` e `noEmit: true`. O workflow exige essas opções e o `configFilePath` exato; o script oficial do app então compila os dois arquivos com sucesso.

Os três blobs locais de W5 conferem com `inputs/w5-files.json`; hashes completos constam no JSON desta revisão. Não houve edição de produto pelo revisor.

#### Limite da prova de UI

O [run UI W3 43522178175](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522178175) executou o snapshot `f50d9f2d8ae4173210bc6b8ef5a6a7ec24249324` do produto W3. O log real do servidor registra `Profile policy mismatch: sf_portfolio`; `inputs/ui3-raw-measurements.json` contém `stage: start-existing-cli`, `exitCode: 1` e `observations: []`.

Assim, **UI behavior permanece BLOCKED em C15**. O preparo do corpus sintético foi observado; autenticação, jornadas visuais, 30 repetições, viewports aprovados e comparação temporal com o baseline não foram demonstrados. Typecheck UI PASS não muda esse resultado nem constitui prova AM02/AM06, C17 ou GNATIVE.

Fontes locais: `inputs/ciChecks-attempt{2,3,4,5}.log`, `inputs/checks{3,4}-artifact/`, `inputs/ui3-raw-measurements.json`, log real do servidor no artefato UI3, `inputs/resume-publication-w5.json` e os três arquivos W5. Detalhamento reproduzível: [typecheck-review.json](typecheck-review.json).

#### Atualização de evidência após a revisão

O writer confirmou também o run UI5 [43522985791](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522985791) no produto W5: mesma falha C15, autenticação não atingida, cache não observado e zero medições. O recibo integral está em [ui-bootstrap-observations.json](ui-bootstrap-observations.json). Esta adição não modifica a autoria nem o resultado da revisão de typecheck acima.
