# Handoff — finish-reviewfixtures-20261119

SHA: d49e0c0f258373cdc2ed8ca4b39e888486cbdd7e (código qualificado; handoff no commit documental seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- `test/product/wp08/thread-actors-fixture.ts:82`: a fronteira explícita do arquivo histórico agora distingue disponibilidade e revogação. Uma referência capturada com grant revogado retorna `revoked`; ausência de histórico continua retornando `unavailable`. Não houve alteração no produtor ou nos papéis da instalação.
- `test/product/wp07/comment-continuity.test.ts:99`: conserva as negações de leitura, conversa atual e HTTP 403 após revogação explícita; acrescenta o controle de indisponibilidade sem conteúdo preservado. Exportações DOCX/PPTX e identidades imutáveis continuam sendo verificadas.
- `test/product/wp07/review-thread-context.test.ts:65`: compõe a permissão atual exigida para o próprio participante responder à revisão C05. O lease exige a revisão real, seus sources históricos revalidados, snapshot protegido, identidade e revisão de acesso do ator; a verificação de commit confere todos esses vínculos.
- A criação anterior admitia o próprio autor sem lease de destinatário; `recipient-actions.ts:67` exige explicitamente o lease para replies, inclusive self. A fixture agora fornece essa prova em vez de contornar o guard. Outro destinatário (`reader-b`) continua sem esse grant e continua negado.
- O padrão de lease segue `test/product/wp08/review-answers-fixture.ts:31`, reutilizando o próprio preparador de fence existente no teste. Nenhuma Request de outro participante foi fabricada.
- Run [44584531031](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44584531031): success, **4 pass / 0 fail / 104 expect**, dois arquivos em 75,49 s. Teste `135773772035` e cleanup `135775499629`: success.

## Pendente

- Nenhum pendente nestes dois specs.
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-period-continuity.test.ts:14`: os dois casos temporais de outra fatia continuam pendentes por amplificação de leituras. Não foram incluídos nem declarados qualificados aqui.
- `modules/sucafina/Sucafinav1/test/product/wp07/review-port.test.ts:79`, `projection-access.test.ts:46` e `test/product/wp14/domain-outcome.test.ts:65`: correções disjuntas sob responsabilidade do root; o resultado desta fatia não substitui seus gates.

## Decisões e justificativas

- Asserções removidas: nenhuma. O teste de comentários conserva seus 23 pontos de asserção originais e adiciona dois; o teste de contexto conserva os 72 pontos originais. O total em runtime é maior por loops existentes.
- Causa do primeiro erro histórico: a fixture usava `historical.allowed=false` para simular uma revogação, mas emitia `state: unavailable`. O produtor `reviews/services.ts:34` corretamente mantém essa distinção. Agora o teste prova separadamente a indisponibilidade e a recusa explícita, sem enfraquecer `denied` para “qualquer falha”.
- Causa do segundo erro: faltava `reviewRecipientAuthority`. A prova introduzida só cobre o próprio participante autenticado e revalida os produtores originais; não concede acesso por nome, role, catálogo ou referência recebida.
- Mantidos os races de revogação em criação/reply, ausência de gravação após recusa, releituras imutáveis, rejeição de provider replacement, troca de lease e adulteração da observação.
- Nenhum timeout foi aumentado. Os limites de 120 s já existiam nos testes.
- Nenhuma alteração produtora, de workflow, application.ts, baseline, coverage, receipt ou suíte. `.ci-run.json` só existe no snapshot CI descartável. Esse inventário não declara guards aprovados.

## Como retomar

1. Integrar `finish-reviewfixtures-20261119` em `sf-join-four`; a base é `ab9c515abee460c294bd061c99f41dbd0064fdf6`.
2. Reproduzir o pedido abaixo somente se uma nova mudança afetar estes contratos.
3. Root combina esta fatia com seus três specs de Reviews e coordena o gate change-scoped agregado dos consumidores históricos.
4. A análise de desempenho da continuidade permanece em branch própria; não reutilizar grants entre chamadas ou mutações.

## Comandos e resultados

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp07/comment-continuity.test.ts","Sucafinav1/test/product/wp07/review-thread-context.test.ts"]}
```

- Código: `d49e0c0f258373cdc2ed8ca4b39e888486cbdd7e`.
- Snapshot: `36f0ded5963fcab2f6a49d5375e5c01be1ca67e3`.
- Branch CI: `ci-run-linux-reviewfixtures-20261119`; cleanup success.
- Run `44584531031`: completed/success; 4 pass / 0 fail / 104 expect.
- `bun typecheck` (app-shell): não rodado por esta fatia.
- `bun run check:guards --base origin/dev`: não rodado por esta fatia.
- Nenhuma execução local ou acesso à máquina do dono. Sem declaração de GO.
