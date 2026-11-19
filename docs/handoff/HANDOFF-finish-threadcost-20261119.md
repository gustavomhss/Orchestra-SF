# Handoff — finish-threadcost-20261119

SHA: `b486045f63b9df1537ec7b964602628535887524` (código; este documento é um commit posterior).
Data: 2026-11-19
Estado: partial

## Feito

- Base de integração observada: `sf-join-four@fc92e46d83c1f309e991b058da384886b1d67ba1`.
- Transporte das três mudanças da branch anterior `finish-continuity-20261119@879a7132c17844e120f8ca78c94bfbac357eba06`, sem trazer outros arquivos.
- `product/collaboration/authority.ts:127`: autoriza uma vez cada corpo completo de evidência compartilhado entre a thread e suas mensagens no mesmo passe. A identidade usa a serialização canônica completa; diferenças de instalação, projeto, versão, campos ou período continuam distintas. Não há retenção de grants entre chamadas.
- `product/collaboration/host.ts:202`: a associação interna da resposta à pergunta lê a identidade real no estado C08, com principal, accessRevision, policyVersion, participação, última mensagem do destinatário, referência exata e contexto material. A API pública de evidências não mudou. Os leitores originais da resposta, do escopo, de observação, de leitura e de commit continuam responsáveis pela autorização antes e depois.
- `test/product/wp08/threads-context.test.ts`: conserva as asserções anteriores e acrescenta negativas para referências com o mesmo seletor e corpo alterado, além de revogação e restauração entre chamadas.
- `test/product/wp08/thread-history-fixture.ts:56` e `thread-actors-fixture.ts:98`: removem apenas o grant histórico intermediário repetido. O candidato não é exposto pela BCS antes de `host-binding/business-context.ts:107–111` exigir `proveContinuity` e revalidar o contexto. A callback final relê a referência atual exata por `records.resolve`, exige o mesmo seletor completo (superfície, tipo, ID, campos e período), compara o corpo e chama o verificador histórico real e seu fence dentro de uma transação SQLite real. A emissão inicial continua no produtor original; a prova final não reemite uma segunda referência só para exigir que seja idêntica.
- A distinção entre ausência de arquivo e revogação explícita já integrada por PR #374 foi preservada na fixture de atores.

- O experimento readonly `f569dda299f41e4efac7bed75e0f6a07e7758fa3` foi retirado por commit normal `b486045f63b9df1537ec7b964602628535887524`. Os três arquivos foram restaurados pelos blobs exatos do predecessor `1f957c07b2621e0884dd28b6510989881df52a22`; não houve reset/force push.

## Pendente

- `modules/sucafina/Sucafinav1/test/product/wp08/thread-period-continuity.test.ts:17`: os dois cenários de virada de período excederam o limite original de 5 segundos no snapshot anterior; o gate do código atual está em execução.
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-actors.test.ts:10`: o cenário de homônimos, escopos e revogação excedeu o mesmo limite no snapshot anterior.
- `modules/sucafina/Sucafinav1/test/product/wp08/host-answer-reuse.test.ts:38`: o consumidor real de respostas confirmadas demorou 5,24 segundos no snapshot anterior, excedendo o limite original.
- A fatia não está qualificada enquanto esses cenários não passarem por GitHub Actions. Nenhum timeout foi aumentado e nenhum cenário foi dividido para ocultar esse limite.

## Decisões e justificativas

- Asserções removidas: nenhuma.
- A remoção de uma chamada duplicada na fixture não remove o controle histórico: todas as saídas históricas de `resolve` e `context` passam pela prova final original. Retornos antecipados rejeitados não expõem a projeção candidata.
- Não há cache de autorização entre leituras, mudança de baseline/coverage/receipt, mudança de workflow, nem restauração do HTML descomissionado.
- Motivo do rollback: `product/integration/source-lifecycle.ts:52–65` pode atualizar versão e metadados do escopo quando a projeção diverge; `:130–143` encaminha essa manutenção a partir de `resolveScopedSource`. Portanto os leitores não são incondicionalmente puros na camada inferior. O root readonly original recusaria a manutenção, podendo alterar a semântica de drift. Os resultados selecionados não bastam para justificar essa alteração. `DashboardPort.read` já havia sido excluído por gravar audit (`product/dashboard/port.ts:164–176`).
- Cada gate comprova apenas o código indicado. O rollback restaura o comportamento de `1f957c07`; não foi repetido seu gate, por orientação do coordenador. O experimento retirado teve três timeouts; o predecessor restaurado teve quatro no gate estrito de 5s. Nenhum desses resultados é um passe do SHA atual.
- O coordenador identificou que a suíte canônica usa seu limite existente de 30s. Nenhum timeout foi alterado aqui. Não se continuou a modificar produção para satisfazer o gate estreito mais rigoroso.

## Como retomar

1. Revisar o código comportamental em `b486045f63b9df1537ec7b964602628535887524`, equivalente a `1f957c07` nos arquivos restaurados.
2. Manter retirado o experimento readonly. Não envolver emissores, leitores com manutenção de escopo ou comandos em uma raiz que proíba sua escrita legítima.
3. Incluir a fatia no gate agregado canônico coordenado pelo root, usando os limites já existentes, e registrar o resultado por SHA. A investigação de novas otimizações foi encerrada nesta branch.
4. A migração dos três specs de `dashboard-installed-closure` continua em branch separada; não misturar essa evidência com o catálogo histórico de timeouts.

## Comandos e resultados

Toda execução ocorreu em GitHub Actions. Não houve shell local.

| Código | Snapshot CI | Run / jobs | Resultado |
| --- | --- | --- | --- |
| `064e75a88b9214a317df9e538d87c2fb3f2bd576` | `6babc13af5d07b0858c8e22f25a3425d322ab34c` | [44585501284](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585501284); test `135777201508`, cleanup `135780466281` | FAILURE: 8 pass, 3 fail por timeout, 148 expects; cleanup SUCCESS. Os 6 cenários de recibos/revogação passaram. |
| `879a7132c17844e120f8ca78c94bfbac357eba06` | `62737c1eb23b6c54561c750589ff091473ea2bee` | [44589308152](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44589308152); test `135790656050`, cleanup `135793148757` | FAILURE: 8 pass, 4 fail por timeout, 185 expects. Rollover Hot Topic 22,94s; projeto 23,35s; atores 13,53s; host answer 5,24s. Cleanup SUCCESS. |
| `a74a66df14c7d1f5eca3f45304ffd96c5197e295` | `33b681859edb670a0c532ad9ea3dd9137d85c14d` | [44591313379](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44591313379); test `135797751237`, cleanup `135800624374` | FAILURE: 12 pass, 4 fail por timeout, 289 expects. Rollover Hot Topic 17,39s; projeto 17,63s; atores 12,03s; host answer 5,19s. Os quatro testes C05 e as seis races/revogações passaram. Cleanup SUCCESS. |
| `1f957c07b2621e0884dd28b6510989881df52a22` | `398d60769d91a34432c932234477802584f38402` | [44592740765](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44592740765); test `135802792842`, cleanup `135805678807` | FAILURE: 12 pass, 4 fail por timeout, 289 expects. Hot Topic 19,44s; projeto 20,00s; atores 14,08s; host answer 6,35s. Negativas C05/races passaram. Cleanup SUCCESS. |
| `f569dda299f41e4efac7bed75e0f6a07e7758fa3` | `4ad53c2e3fd66c31decedf75a12ca4628ef5f5e5` | [44593905872](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44593905872); test `135806944475`, cleanup `135809380223` | FAILURE: 13 pass, 3 fail por timeout, 289 expects; host-answer PASS4,55s, Hot Topic13,89s, projeto14,44s, atores10,22s. Cleanup SUCCESS. **Experimento retirado; não qualifica o rollback.** |
| `b486045f63b9df1537ec7b964602628535887524` | — | Nenhum novo run | Rollback normal dos três arquivos para os blobs de `1f957c07`, sem gate redundante conforme orientação do coordenador. |

Pedido change-scoped no snapshot CI:

```json
{
  "package": "sucafina",
  "runner": "bun",
  "args": [
    "Sucafinav1/test/product/wp08/threads-context.test.ts",
    "Sucafinav1/test/product/wp08/thread-actors.test.ts",
    "Sucafinav1/test/product/wp08/recipient-receipt-fences.test.ts",
    "Sucafinav1/test/product/wp08/thread-period-continuity.test.ts",
    "Sucafinav1/test/product/wp08/host-answer-reuse.test.ts",
    "Sucafinav1/test/product/wp07/comment-continuity.test.ts",
    "Sucafinav1/test/product/wp07/review-thread-context.test.ts"
  ]
}
```

A branch CI foi criada diretamente no commit que já continha `.ci-run.json`. A branch de trabalho não contém esse arquivo.
