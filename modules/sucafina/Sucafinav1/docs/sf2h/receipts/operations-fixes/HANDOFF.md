# Operations fixes — entrega para S0

## Estado da entrega

| Finding | Resultado desta branch | Condição restante |
|---|---|---|
| **D-OPS-01** | Correção de produção publicada; seleção cirúrgica **8 PASS / 0 FAIL, 96 assertions**. | Revisão e consumo por S0 no candidato composto. Não equivale a aceite integral WP06. |
| **I-OPS-02** | Inferência **reproduzida no consumidor real**; seleção **2 PASS / 0 FAIL, 76 assertions** confirma o impasse e controles. | Integração pelos owners do host/executor e prova positiva de recuperação. Propostas **NOT_APPLIED / NOT_RUN**. |

Publicação: [PR #52, operations-fixes → astra-operations](https://github.com/gustavomhss/Orchestra-SF/pull/52).
Nenhuma PR anterior foi mergeada ou fechada. O destino de composição permanece com S0.

## Delta e pins

O ponto de partida é `ba8a09e371ce8d93eb917eabb102caaee5affaf4`, tree `eb427121bcfd8c2511aac31d908f3c0d52c1915e`, head da PR34 e da branch-base.
O [parecer independente](https://github.com/gustavomhss/Orchestra-SF/blob/6830fa159d30b60d001f91a47326ae88c6255282/modules/sucafina/Sucafinav1/docs/sf2h/receipts/reviews/operations/REVIEW.md), o [plano imutável](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan) e o [protocolo CI](https://github.com/gustavomhss/Orchestra-SF/blob/a3d29d011ba3607a57914701300f09117a3e2de9/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md) fixam as fontes desta entrega. AGENTS, COMMON e critérios afetados de WP06/WP04/WP01/C12 foram lidos. Pins e decisões de reconciliação constam em [reconciliation.json](reconciliation.json).

| Incremento | Commit | Conteúdo |
|---|---|---|
| D-OPS produção | `86f9c993678668634ab409dc31b6b92865836180` | Reuso autorizado de schemas; identidade da intenção pendente no workbench. |
| I-OPS prova | `8caafd2455cc149064ad0d5fdb63f48009269de7` | Fixture H05, consumidor real e controles C12. |
| D-OPS prova | `ee2e14ac940ba62177052f44c0f0e781132e7564` | Integração documental real e jornada Chromium. |
| I-OPS handoff | `eb3a97c0c2063fd28bbca74cdf50b3417c15ba25` | Reprodução, preimages e propostas para owners. |

Só `product/documents/schemas.ts` e `product/documents/workbench.ts` mudam em produção. Os seis arquivos novos de fixture/teste ficam em `test/product/operations-fixes/`; os recibos ficam neste diretório. `capabilities.ts` conserva a proteção estrita de schema. Nenhum host, contrato, executor WP11, workflow ou arquivo das quatro fatias UI foi aplicado ou alterado.

## D-OPS-01: resultado útil

O produtor reusa a definição equivalente, vigente e autorizada, preferindo a que já pertence ao candidato existente; a confirmação permanece intacta. Cada operação nova registra seu digest e a identidade original do schema no ledger existente. O workbench conserva body e as duas chaves da intenção incerta, de schema e extração, até concluir a sequência.

A prova executa duas submissões completas, outra após confirmação e perdas de resposta após os commits reais das duas etapas. As novas submissões geram UUIDs diferentes, mas devolvem o mesmo schema/candidato. O retry repete body/chaves originais. Tipos, unidades e versões diferentes continuam conflitos; revogação e fonte fisicamente substituída continuam recusadas. O teste não devolve schema constante ao browser.

- [Recibo narrativo e fronteiras](d-ops-01.md)
- [Request, blobs, tráfego e SHA-256 do log](d-ops-01-proof.json)
- [Actions 43625203326](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625203326): **8 PASS / 0 FAIL**, 96 assertions, 20,93 s.

## I-OPS-02: resultado observado e transferência

A extensão real de H05 chegou a review, confirmação humana, Apply, edição concorrente, 409, retry, reload e reabertura de SQLite/autoridade/serviços. O retry e a chamada original após reabertura retornaram 409, conservando body/chave. O caso avançou de 3 para 4, preservou a edição concorrente, manteve um efeito financeiro e um recibo durável, mas nenhum recibo vinculado ao caso. Não se alega reinício do processo Bun.

O controle API com versão corrente mais digest original alcançou o recibo existente. Essa chamada não é o fluxo oferecido pela UI e não substitui uma rota que só recupera recibos. Digest alterado retornou 409; revogação e substituição física retornaram 403 em controles independentes.

A correção necessita de caminhos compartilhados. Conforme a autorização desta tarefa, foi publicado um patch proposto com preimages, sem aplicá-lo. A proposta separa `decision-recover` de `decision-apply`: exige recibo original antes de qualquer dispatch, preserva bindings e autorização atual e reconcilia o caso por CAS. A variante mínima sobre Finance conserva os incrementos já publicados pelo owner; o hunk antigo de executor não deve substituí-los.

A UI proposta mantém a correlação em `sessionStorage`, sob escopo autorizado completo, para reload e nova navegação na mesma aba. **Nova aba, nova sessão ou correlação apagada ainda exigem resolver durável pelos owners.** Este limite permanece aberto. A proposta não foi executada nem recebe crédito de recuperação aceita.

Precisão sobre o recibo C12 anterior: o estado `planned` é da **mudança preparada**, não um estado verificado do caso. As referências normativas ali listadas identificam critérios afetados e gates de preservação; não constituem aceite da proposta.

- [Handoff dos owners e gate de fechamento](c12-owner-handoff.md)
- [Reprodução e controles executados](c12-reproduction.json)
- [Preimages e hashes dos patches](c12-source-pins.json)
- [Proposta integral para o pin Operations](c12-receipt-recovery.NOT_APPLIED.patch)
- [Variante mínima do executor Finance](c12-current-executor.NOT_APPLIED.patch)
- [Actions 43624678702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624678702): **2 PASS / 0 FAIL**, 76 assertions, 37,36 s.

## Proveniência das provas e gates finais

| Prova | Produto W | Snapshot S |
|---|---|---|
| D-OPS | `ee2e14ac940ba62177052f44c0f0e781132e7564` | `96da0ee1011e4a47086830c0a4bde00b878f54e5` |
| C12 | `8caafd2455cc149064ad0d5fdb63f48009269de7` | `9c173f573e88bf033e9180494114d33da9a4894f` |

Em cada run, S tem W como pai e acrescenta somente `.ci-run.json`; a comparação remota confirmou essa relação. Os dois controles Omni registraram um único veredito nonce-bound **pass**, um spawn declarado e zero delegações. Os drivers confirmaram encerramento físico sem contextos ou sockets remanescentes. Os recibos estruturados preservam hashes do log decodificado e métricas; não incluem arquivos brutos de log no produto.

W2→W3 acrescenta apenas os testes documentais. Os incrementos seguintes a W3 acrescentam recibos; os blobs de produção e de cada prova permanecem iguais aos executados. Não houve teste local, suite epic, remoção de assertions, aumento de deadlines ou repetição equivalente de run. Todas as operações remotas usaram GitHub MCP.

**Gates finais separados:** executar o workflow existente `astra-operations-check` em modo completo no commit que publica estes recibos, com snapshot que acrescenta somente `.astra-operations-check.json`. Ele roda `bun typecheck` em `modules/sucafina` e `apps/cli`, e `bun run check:guards --base origin/dev`. O resultado terminal e o par produto/snapshot dessa checagem serão registrados na [PR #52](https://github.com/gustavomhss/Orchestra-SF/pull/52), sem novo commit autorreferente de recibo. A falha Atlas já observada no pin inicial não é suprimida nem corrigida fora do ownership.

S0 deve consumir o delta documental e reconciliar a proposta C12 com os owners atuais. Estes recibos não declaram READY global, aceite humano, GNATIVE ou permissão de merge.
