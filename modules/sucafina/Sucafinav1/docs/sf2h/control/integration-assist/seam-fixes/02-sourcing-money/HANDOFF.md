# SF2-SEAM-002 — valor de sourcing até o consumidor Requests

**PROPOSED/NOT_APPLIED.** Aplicação exclusiva da sessão14 em `sf2-stack`. Nenhum teste, typecheck, guard ou workflow foi executado/disparado aqui.

## Correção consumível

[manifest.json](manifest.json) contém duas entradas completas de árvore, com modo, preimage e postimage. Os postimages já existem no repositório, publicados por Operations em `15df31a67efab0aae6e2bff2b7eb8e5e59511324`; não dependem de reconstrução a partir de trechos.

| Caminho relativo ao módulo | Preimage | Postimage |
| --- | --- | --- |
| `product/procurement/monetary.ts` | `5ed7b1c7e8f140c2820d9e3095a7427374d10f69` | `c9a224b12c13b7cec506be90527300caa7e984fd` |
| `runtime/procurement.ts` | `6cd5783d5b4f6f9c9ed3e15547d59f79ccb5ef72` | `20a3ec5a30ac0fce6b35f05750d1b3dced11c45b` |

Aplicar as duas entradas atomicamente. A conferência estática vale somente sobre `f511f30b73289c2f21c843254569d31c02eb9608`, árvore `ee2964cd6cc96ee2697e9d05835777870a843f65`. Não copiar a árvore inteira de WP10 ou Operations para `sf2-stack`. O integrador deve fixar seu candidato real, conferir os preimages e as onze dependências diretas, e registrar novo recibo de alvo antes da aplicação. Head posterior não está pré-aprovado.

## Problema e comportamento

A seleção de cotação já cria uma PO futura quando o pedido ainda está em sourcing. A presença dessas linhas fazia o produtor tratar a PO como valor corrente; consumidores de Requests também calculavam valor por outro caminho. O intake mantém o valor de sourcing nas etapas de sourcing e passa os consumidores ao mesmo produtor.

A PO é projetada separadamente para seus textos. A projeção não grava status, aprovação ou câmbio. O exemplo de recheck é EUR 100 submetidos a 1,08 = USD 108, câmbio atual alterado para 2 e PO futura de USD 200: o pedido continua USD 108 e a PO aparece separadamente. Ausência não vira zero. Autorização, CAS, C16, owner de Memory, observações e identidade permanecem nos mesmos caminhos.

O shell mais recente de WP10 e seus contratos ficam preservados. Não há intake de uma versão antiga de Forecast, nav ou outputs.

## Recheck necessário

As duas entradas são produto; os testes existentes são inputs separados de verificação. `test/product/operations-consumers/monetary-consumers.test.ts` e `fixture.ts`, com blobs exatos no manifesto, estão ausentes no alvo fixado. A fixture importa downloads e um caso monetário também verifica export; a sessão14 precisa reconciliar essa closure com a sessão11 antes do recheck já atribuído.

No alvo fixado, `runtime/downloads.ts` é o blob `3a18d541dd402fde0eb2be25de281b289189c537` e não emite os campos e o parágrafo monetário exigidos pelo segundo caso do teste. Portanto, mesmo com os dois inputs de verificação, esta proposta não fecha a suíte: permanece **BLOCKED_ON_SESSION11_EXPORTS_RECONCILIATION**.

Não remover assertions, pular o caso de export ou substituir seu adapter para produzir um verde. Os oito testes monetários citados no handoff de Operations pertencem à execução da origem e não validam esta composição.

Após a aplicação real: conferir os dois postimages e o SHA candidato, executar o typecheck canônico pelo responsável existente e conferir valores submetidos, FX ausente, zero real, sourcing com PO incidental, comparação de PO e cancelamento. Todos esses resultados estão **NOT_RUN** neste recibo.

## Proveniência e limites

- Origem: [Operations 15df31a](https://github.com/gustavomhss/Orchestra-SF/tree/15df31a67efab0aae6e2bff2b7eb8e5e59511324).
- [Handoff de Operations](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/docs/sf2h/receipts/operations-consumers/attempt-01/HANDOFF.md).
- Producer também publicado em `sourcing-money@e1fe9561f199dc594a5fd559d06d450253e571bc`.
- Exports permanece sessão11; Finance performance, ACK UI, forecast e integridade Memory permanecem com seus responsáveis.
