# WP00 — revisão final de checks W3–W5

**W5 comprova o typecheck oficial do harness UI e a correção da configuração; o check geral continua FAIL pelos mesmos 144 diagnósticos de Sucafina já observados em W2.** O resultado não comprova comportamento UI: o teste real W3 foi bloqueado no bootstrap C15 e registrou zero observações.

Produto W5: `70476b99e0a34c4432d48f5d2f3710c26562aa1b`; tree `56f717d5713bb48710f82ed66f9ef3d01292d90c`. Check: [43522928224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224), snapshot-envelope `8a52144930724b61de2a8d2b8fe91adbce9b5f27`. Revisão independente de fontes, logs e artefatos; nenhum teste, servidor, typecheck ou mutação remota foi executado pelo revisor.

## Resultado comprovado

| Item | W3 | W4 | W5 |
| --- | --- | --- | --- |
| Typecheck Sucafina | FAIL: 144 diagnósticos | FAIL: mesmos 144 IDs | FAIL: mesmos 144 IDs |
| Configuração/inclusão dos dois arquivos UI | FAIL: formato showConfig interpretado incorretamente | FAIL: TS5069; ambos os paths constam da listagem | PASS |
| Typecheck oficial UI | Não executado | Não executado | PASS |
| Guards contra origin/dev | 78 regras, 586 paths, 0 gate, 11 warn, 0 errors | 78 regras, 587 paths, 0 gate, 11 warn, 0 errors | 78 regras, 587 paths, 0 gate, 11 warn, 0 errors |
| Check geral | FAIL | FAIL | FAIL |

O log W5 registra a validação dos dois arquivos, seguida de `bun run typecheck:e2e --project e2e/sucafina/wp00/tsconfig.json` sem diagnóstico ou falha. Os guards permanecem PASS com 11 avisos; nenhum aviso foi suprimido. O [artefato 14084311276](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224/artifacts/14084311276) tem SHA-256 `24383cd1a0a26e180d9ef1737da30047e52cd12b1a965543edc20e1a4dfb8b3d`, conforme o log de upload.

## Classificação dos diagnósticos

Foram comparadas **144 identidades únicas em cada W2, W3, W4 e W5**, definidas por arquivo normalizado, linha, coluna e código TypeScript. W5 tem **zero IDs novos e zero removidos** em relação a W2; as 144 mensagens iniciais também coincidem com W2. Não há diagnóstico em `test/product/wp00/`. O JSON anexo preserva todos os IDs, linhas dos logs de origem e contagens por arquivo/código.

Em W3 somente a mensagem inicial do TS2345 de `product/imports/dashboard-preview.ts(38,75)` apresenta outra abreviação de propriedades do tipo impresso; sua identidade é a mesma. W4 e W5 voltam à mensagem inicial observada em W2. Portanto, a conclusão de estabilidade usa identidades explícitas, sem presumir igualdade byte a byte de logs completos.

Um erro herdado está no prefixo `product/contracts`: `host-context.ts(14,45) TS2307`, import de `../routines/factory.ts` ausente. Ele já existe em W2. A conclusão é **ausência de novos diagnósticos**, não ausência de erros em toda a pasta de contratos. Nenhum arquivo de outro WP foi alterado para remover esses erros.

## Correções próprias verificadas

- **Recibo de observação:** o catch de `observe()` agora atribui `outcome = "failed"` antes de registrar e relançar a exceção. A inconsistência de sucesso após erro de screenshot/anexo foi removida na fonte e essa fonte passou no typecheck W5. A falha de anexo não foi provocada artificialmente.
- **Cache/autenticação:** antes de alcançar `measure-ui`/`completed`, o recibo passa a declarar `authenticated: false`, `cacheState: null` e razão da ausência. Isso corrige a afirmação incondicional presente no recibo histórico W3; esse artefato foi preservado. Não se atribui execução UI W5 a uma mudança apenas de fonte/typecheck.
- **Forma do showConfig:** o tsgo pinado produz opções flat e não inclui `files`. O workflow lê essa forma real e usa `--listFilesOnly` para demonstrar a inclusão de spec e helper. W5 confirmou essa verificação.
- **TS5069:** o tsconfig próprio agora define `emitDeclarationOnly: false`, preservando `composite: false` e `noEmit: true`. O workflow exige essas opções e o `configFilePath` exato; o script oficial do app então compila os dois arquivos com sucesso.

Os três blobs locais de W5 conferem com `inputs/w5-files.json`; hashes completos constam no JSON desta revisão. Não houve edição de produto pelo revisor.

## Limite da prova de UI

O [run UI W3 43522178175](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522178175) executou o snapshot `f50d9f2d8ae4173210bc6b8ef5a6a7ec24249324` do produto W3. O log real do servidor registra `Profile policy mismatch: sf_portfolio`; `inputs/ui3-raw-measurements.json` contém `stage: start-existing-cli`, `exitCode: 1` e `observations: []`.

Assim, **UI behavior permanece BLOCKED em C15**. O preparo do corpus sintético foi observado; autenticação, jornadas visuais, 30 repetições, viewports aprovados e comparação temporal com o baseline não foram demonstrados. Typecheck UI PASS não muda esse resultado nem constitui prova AM02/AM06, C17 ou GNATIVE.

Fontes locais: `inputs/ciChecks-attempt{2,3,4,5}.log`, `inputs/checks{3,4}-artifact/`, `inputs/ui3-raw-measurements.json`, log real do servidor no artefato UI3, `inputs/resume-publication-w5.json` e os três arquivos W5. Detalhamento reproduzível: [typecheck-review.json](typecheck-review.json).

## Atualização de evidência após a revisão

O writer confirmou também o run UI5 [43522985791](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522985791) no produto W5: mesma falha C15, autenticação não atingida, cache não observado e zero medições. O recibo integral está em [ui-bootstrap-observations.json](ui-bootstrap-observations.json). Esta adição não modifica a autoria nem o resultado da revisão de typecheck acima.
