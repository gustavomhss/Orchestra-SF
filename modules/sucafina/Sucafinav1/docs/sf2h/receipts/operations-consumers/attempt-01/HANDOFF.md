# Operations consumers — execução e handoff da PR34

## Resultado da continuação

**PARTIAL_EXTERNAL_EXPORT_CONSUMER_OPEN.** As duas correções autorizadas foram implementadas e publicadas na mesma branch `astra-operations`, PR34 contra `sf2-stack`. A seleção funcional executada no GitHub Actions terminou **10 PASS / 2 FAIL**, com os oito testes monetários próprios e os dois cenários Atlas aprovados. As duas falhas preservadas isolam o consumidor externo `runtime/downloads.ts`; não há aceite integral de exportação nem GLOBAL_RELEASE.

Produto **W = `fd363ca6f66dea56422c235f835103467c7ee8ba`**, tree `f0fc51a399640983b20d29944a56c4dc0610313f`, pai único `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. A entrega documental D é o commit que contém este handoff. D acrescenta somente recibos desta missão; os blobs de produto, testes, fixtures e workflows permanecem os de W. O comentário terminal desta continuação na [PR34](https://github.com/gustavomhss/Orchestra-SF/pull/34) registra D/tree, o snapshot dos checks, o dev pin e os resultados finais. Este arquivo declara honestamente os checks estáticos como pendentes no momento de seu commit; não usa uma referência circular nem atribui resultado a um commit posterior.

## Autoridade recebida e liberação

O head real foi consultado antes da escrita e coincidia com o head entregue `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. A passagem de autoridade se baseou no relatório final original, no `delivery-status.json`, no comentário terminal D2 [6876138417](https://github.com/gustavomhss/Orchestra-SF/pull/34#issuecomment-6876138417), na missão publicada em `61eea4adb1fcf0fa50eecf5f6fa5f17e426059e3` e na instrução explícita do usuário para esta sessão nova. Os comentários posteriores foram reconciliados; não havia novo claim de escrita nos dois arquivos. Silêncio não foi usado como evidência de encerramento.

A atualização do ref usa lease do head lido, sem force. A liberação desta sessão será explícita no comentário terminal da PR após a verificação dos checks. A sessão não assume os arquivos de `operations-fixes`, o consumidor de downloads, WP10 ou produtores Finance. O próximo integrador deve reler o head e esse comentário, preservar commits posteriores e confirmar a autoridade do owner de qualquer arquivo externo.

## Delta 1 — semântica monetária por etapa

O helper `product/procurement/monetary.ts` foi consumido **verbatim** de sourcing-money `a3b7fb9b45d7852a3000e01098336a1aca9526c3`, blob `c9a224b12c13b7cec506be90527300caa7e984fd`. As dependências e diferenças foram conferidas, e o conteúdo publicado foi relido para comprovar igualdade. A PR57 e suas provas foram preservadas; nenhuma branch inteira foi integrada.

Em `runtime/procurement.ts`, domínio, projeção de registro, tabela Requests sem C02 e detalhe/resumo usam o helper compartilhado. No fluxo real `select_quote → submit_sourcing`, EUR100 × 1,08 permanece **USD108** após mudar o FX corrente para 2. O texto separado da PO usa uma projeção de leitura para mostrar sua estimativa **USD200**, sem modificar o status ou snapshot do sourcing. A diferença entre PO e aprovação é explícita e não produz um número quando as moedas base são incompatíveis.

Oito casos executados qualificam: fluxo real e C02/C06; PO efetivamente submetida e congelada em USD200 após FX3; cancelamento; FX corrente ausente com recusa de submissão; snapshot de FX ausente em sourcing pendente/rejeitado; moeda base alterada; PO incidental vazia/malformada; e ausência/NaN versus zero observado. Os testes com históricos incompletos e duas linhas usam cópias de leitura descartadas, claramente distintas de comandos legais. Nenhuma correção regrava os registros persistidos ou muda alçadas, política, scoring ou transições.

**Cancelamento:** o helper exato do produtor seleciona as linhas retidas da PO quando o status é cancelado, inclusive após cancelamento direto do sourcing. Esse contrato foi preservado, com label Cancelled e exclusão de totais aprovado/emitido. A missão não redesenhou o produtor para impor outra semântica.

## Delta 2 — caller Atlas efetivamente composto

Foi corrigida a cópia de dois cenários em `test/product/wp14/source-access-atlas.test.ts` desta branch, com blob final `d7d2a69837560f42438d470b83724c1a61939a73`. A reconciliação usa `OPS-CONSUMER-02.patch` e os contratos reais: a **mesma WeakSet vazia** é entregue a `createSfProductAuthority` e `createSfBusinessServices`. Não se fabricou marca autorizadora; o serviço compartilhado continua exigindo a capability. Cenários, assertions e timeouts existentes foram preservados.

Passaram os dois cenários: continuidade cross-principal após reabrir o store; e publicação/recall do documento C17 por Atlas, seguido de bloqueio do acesso após revogação do blob. O scanner de ingresso documental conserva sua limitação de fixture declarada. Esses resultados não promovem AM, modelo externo, GNATIVE ou aceitação humana.

## Execução funcional exata

- [Run 43628901747](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628901747), tentativa 1, conclusão **failure**.
- [Job 132550880255](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628901747/job/132550880255): **10 pass / 2 fail / 0 skip**, 12 casos em 3 arquivos, 212 assertions, 144,13 s; cleanup `132552039173` passou.
- Snapshot **S = `80e78d97f15b468b8393c6a1676472f1979d2d33`**, tree `a37c2473f242712cafbfd7b4cd6e8cb05d21fa40`, pai único W. O único delta é `.ci-run.json`, blob `417694b0fb189826b91e552f7b501bfbeecd58ff`.
- Seleção explícita: `monetary-consumers.test.ts`, `export-owner-regression.test.ts` e `wp14/source-access-atlas.test.ts`. Runner Bun, package Sucafina, `--timeout 120000`, env vazio. O validador canônico passou. Os timeouts existentes de 180000 ms por cenário Atlas foram preservados; não houve retry nem aumento de timeout após falha.
- Omni: **uma** linha positiva com nonce `669e4e5da490881aaf29411e7ca2b727`, igual ao nonce do job; 2 testes declarados, 4 spawns, 0 delegações.
- SHA256 do log decodificado MCP em UTF-8, preservando BOM e LF: `95c77b84f39b225c7eecf7deec4637f907ac59bb82b32e1a9825c1026ab86b12` (77.744 bytes). Esse workflow Bun não publica artifact genérico de teste; os uploads Playwright/Lean foram skipped. Nenhum artifact foi inventado e o log bruto não foi adicionado ao repositório.
- `RESULTS.json` discrimina cada caso, duração, vínculo W/S, falha e limite. O resultado foi relido independentemente por `ci_review` e pelo escritor principal. A revisão de código separada está em `SOURCE-REVIEW.json`.

## Pendência externa discriminada: downloads

| Item | Evidência |
|---|---|
| Path fora da escrita autorizada | `modules/sucafina/Sucafinav1/runtime/downloads.ts` |
| Preimage preservado | `fa365f9d350be341348ab69d789e40779c8b9756` |
| Patch proposto | [downloads-owner.patch](./downloads-owner.patch), blob `d47538f593c2b563e34c75434044def6e070de58` |
| Estado do patch | **Não aplicado; não executado; não qualificado como correção comprovada** |
| Consumidor responsável | Owner atual de downloads, coordenado por S0/Compose após verificar autoridade |

**EXPORT-01, assertion na linha 28:** CSV e HTML de uma PO futura deveriam mostrar 200 USD, FX2/current, estado estimate e aprovação da PO indisponível. Receberam 108 USD, FX1,08/submitted, pending-approval e uma aprovação de PO indevidamente emprestada do sourcing.

**EXPORT-02, assertion na linha 65:** linhas de 40 e 60 exibiram 100 e 100, pois a chamada por linha ainda resolve o total da proposta selecionada. A igualdade do registro persistido foi verificada antes de ambas as falhas. Os testes são regressões ordinárias com o resultado correto esperado; não usam skip, `test.failing` ou inversão do oracle.

A projeção `domain.data.register.value` passou; isso **não** é green do arquivo `register.csv`. Exportações de PO realmente submetida passaram, mas não eliminam a falha específica da PO futura.

A necessidade externa é adaptar o wrapper de leitura `purchaseOrderMoney` para resolver a PO incidental por sua própria etapa, reutilizá-lo nas linhas e manter sourcing/estado persistido intactos. O patch proposto faz esse ajuste no consumidor e preserva o helper verbatim. Antes do intake, o owner deve comparar o preimage ao head real e preservar alterações posteriores. Depois deve executar seleção afetada em Actions, incluindo estas duas regressões e a reconciliação de PO submetida/cancelada, além de typecheck/guards pertinentes. A rodada atual não foi repetida sem mudança.

## Critérios, reuso e limites

| Critérios preservados | Evidência desta missão | Limite |
|---|---|---|
| WP04.INV.02; T03.CHK.03; T03.DOD.02; T03.SUC.02; T04.DOD.01/QLT.02 | USD108/submitted reconciliado entre domínio, Requests, detalhe/resumo, registro em memória, C02/C06; PO separada | Evidência de componente para o recorte exercitado, sem promover todos os critérios |
| WP04.CMP.02; T03.INV.02; T03.CMP.01/02 | FX ausente, base alterada, histórico incompleto, zero distinto de ausência, cancelamento e PO submetida | Não repete toda a matriz de moedas, papéis ou estados |
| WP04.INV.01; T03.INV.01; T02.INV.02 | Mudanças só de consumo/leitura; snapshot não regravado, critérios/política/command contracts preservados | Revisão de diff não substitui prova completa de autorização |
| WP04.INV.03; CMP.03; T05.CHK.04 | Export de PO submetida passou; duas falhas específicas de PO futura registradas | **Export scope OPEN**; não declarar reconciliação completa |
| T03.CHK.04/05; T05.CHK.03 | Reuso identificado de provas anteriores; casos novos somente para o delta | Não declarar execução nova de toda a cláusula nem reset/import/ID |
| Caller C17/BCS/Atlas | Dois cenários originais passaram com capability real compartilhada | Typecheck é um gate separado; não prova AM05/global |

O pack completo WP04 e a fonte fixa foram lidos. `normative-read.json` conserva 111 IDs e hash canônico `de5df06984f523dea5807ba687a86a81e395655d1fbfac33410106f99570118f`. Escopo, contratos, textos e estados históricos não foram reescritos.

Reuso: provas Sourcing [43625920456](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625920456) (58) e [43626658534](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626658534) (5) permanecem atribuídas aos seus W originais; não foram repetidas ou convertidas em greens do W atual. Import14 e Apply10 não foram repetidos sem impacto. As pendências originais H09/browser, nativas, humanas, AM01–AM06, C/G7, D/G8 e a qualificação global S0 permanecem.

## Fechamento estático e autoridade seguinte

O check final usa o workflow existente `astra-operations-check.yml` em modo padrão, sobre o commit documental D exato: `bun typecheck` em `modules/sucafina` e `apps/cli`, e `bun run check:guards --base origin/dev` na raiz. O snapshot contém somente `.astra-operations-check.json`, com `productSha=D` e dev pin relido. Os resultados, jobs e artifact constarão do comentário terminal e da seção atualizada da PR34. Guards são evidência estrutural, não jornada funcional.

Sem merge, nova branch de produto/PR, reset, force push, testes locais, epic/full suite, deploy, novos acessos, alteração de engines ou reinício do Orchestra. Branches temporárias de snapshot são somente as previstas no protocolo CI. A PR continua draft; o próximo passo material depende do owner do consumidor externo, sem reabrir a PR57 ou substituir a sessão operations-fixes.
