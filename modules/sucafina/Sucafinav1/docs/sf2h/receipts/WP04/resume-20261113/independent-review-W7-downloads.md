> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 W7 — revisão estática de downloads e testes

**Resultado: nenhum achado aberto após a correção estreita de W7-CR-01. CI W7 ainda pendente.**

Comparação feita contra `publication-w6.json`. Nenhum teste/typecheck ou produto foi executado localmente; esta revisão não alterou arquivos de produto/testes.

## Achado e fechamento

`purchaseOrderMoney` inicialmente suprimia todo o retorno canônico quando faltavam linhas, inclusive aprovação submetida, moeda, câmbio e estado já registrados. O caso `po_pending`, EUR, FX 1.08, base submetida USD, aprovação 108 e linhas vazias distinguia a divergência.

A versão final delega os cinco estados PO ao produtor canônico, que mantém totais ausentes e preserva os fatos submetidos conhecidos. O guard contra empréstimo de valores de PR/proposta permanece para PO incidental fora desses estados. O teste `real financial downloads preserve frozen submitted currency after base changes and retain explicit zero` agora inspeciona bytes reais CSV/HTML para PO pendente/aprovada sem linhas e verifica snapshot inalterado.

## Demais conclusões

- Seleção de proposta exige ID único e moeda registrada; ausência não vira moeda base nem zero.
- Total/FX da PO usam `procurementMonetaryFacts`; não foi copiada fórmula. Zero explícito é preservado.
- Alterar a moeda base não reinterpreta FX submetido: original e aprovação histórica mantêm suas moedas e valor comparável atual fica indisponível quando incompatível.
- Campos bancários continuam fora do registro de requests e do HTML PO; privilégio do CSV de fornecedores permanece separado.
- O harness de sourcing decodifica uma vez as cinco entidades emitidas por `esc`, incluindo um literal `&quot;` no dado esperado. A igualdade integral do JSON permanece.
- Os dois ajustes de matcher exigem presença/valor numérico apropriados antes das comparações; sem casts ou supressões.

## Bytes revisados

| Arquivo | SHA-256 |
| --- | --- |
| `modules/sucafina/Sucafinav1/runtime/downloads.ts` | `68fd4fd424dc89754ea4298bfe227978e443471a492b192e79f0acbd0a85f828` |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts` | `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59` |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts` | `4d07767f4e5897ff2b307eb8c69568f521a1775c53fa756160e1d3c786564ca6` |
| `modules/sucafina/Sucafinav1/test/product/wp04/queue-lifecycle.test.ts` | `fed84abdd811f8d376fc8017b578d6ad13ee6f2bfb492e3f28b5e0e2e0b79af7` |
| `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts` | `d9984a1e2efb1c8f835e4d1d5135c79953eedf334c6b2afd106ceb6c7fb38f76` |

Os três casos novos de download pertencem a arquivo já selecionado no CI cirúrgico. Sucesso de execução será atribuído apenas ao recibo do snapshot final.
