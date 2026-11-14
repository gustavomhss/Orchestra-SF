# Missão32 — adendo de revogação na retenção final e egress HTTP

## Conclusão

O oráculo do teste HTTP deve observar separadamente a recusa do executor e a recusa final da composição. O executor C12 conserva `{ status: "unavailable", reason: "receipt-authority-changed" }` quando a autoridade é revogada durante sua última leitura de retenção. Na composição real, o `withCase` externo revalida a autoridade depois da ação e substitui o resultado por `{ status: "denied", reason: "case-selection-authority-changed" }`, que o adapter HTTP publica como403.

A correção justificada é manter a assertion exata da recusa interna e passar a exigir o403 externo com motivo exato. Não se justifica aceitar uma lista indiferenciada `[403, 503]`, remover a assertion do motivo ou enfraquecer a garantia de não divulgar o recibo. Também não se justifica alterar o executor, o state-provider ou o host compartilhado para produzir503 na composição.

## Testemunho W2 e limite da observação

Os metadados e o log foram lidos diretamente via GitHub MCP:

| Identidade | Valor |
| --- | --- |
| W2 | `9cf37f42eefb080940c7c71e4c2b1c5539459295` |
| S2 | `26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860` |
| Run | [43643559235](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43643559235), attempt1 |
| Job | [132596171206](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43643559235/job/132596171206) |
| Resultado | 22 pass, 1 fail, 567 assertions; 23 testes em10 arquivos |
| Única falha | `recovery-http.test.ts`, teste de revogação/encarnação, expectativa503 na linha189; resposta403 |

A assertion anterior `finalReadInterleavings === 1` passou. O corpo da resposta não foi impresso, e a assertion que esperava `receipt-authority-changed` não foi alcançada. Portanto, W2 demonstra o403 observado e o disparo do hook, mas não comprova sozinho qual camada produziu esse403 nem o retorno interno exato. A explicação da composição abaixo foi confirmada por leitura dos arquivos do S2. O próximo teste precisa registrar/validar os dois resultados para transformar essa explicação em prova executada.

## Caminho efetivo de execução

| Camada | Comportamento no código fixado |
| --- | --- |
| Hook da fixture | O wrapper de `authority.state.read` aguarda o callback real. Quando encontra retorno booleano true no namespace cases com recibo vinculado, revoga antes da reautorização final C08; não altera o resultado do callback. |
| State provider | Depois do callback, chama `authorize` novamente. Autoridade diferente retorna `denied/product-authority-changed`, sem commit. |
| `apply.ts`, `retainReceipt` | Só aceita status ok, valor true, Request atual e não abortado. A recusa de C08 torna a retenção falsa. |
| `apply.ts`, retorno de replay vinculado | Retenção falsa retorna `unavailable/receipt-authority-changed`. A identidade e o recibo não são divulgados. |
| `decision-http.ts`, action dentro de `withCase` | Converte o resultado interno em Response e devolve essa Response dentro de um PortResult ok para o escopo externo. |
| `business-services.ts`, `withCase` | Após `await action()`, revalida host, Request/binding e escopo. Com a revogação ainda ativa, retorna `denied/case-selection-authority-changed` em vez de liberar a Response interna. |
| `decision-http.ts`, conclusão | Mapeia o PortResult externo denied para403. A Response interna503 não é a resposta HTTP publicada. |

O `withCase` não distingue sucesso interno de recusa interna nessa revalidação de saída. Portanto, seu403 não relaxa a recusa C12 nem transforma indisponibilidade em sucesso: ele é uma segunda recusa de autoridade na fronteira da composição.

### Identidades de código verificadas no S2

- [Host integrado `business-services.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860/apps/cli/src/sucafina-product/business-services.ts), blob `385dd1998ec3fb73b32f77ab3dec9c93beb440d1`, função `withCase`.
- [State provider](https://github.com/gustavomhss/Orchestra-SF/blob/26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts), blob `2fd55c7304add0829d7434917c80664fe86356b9`, método `read`.
- [Executor](https://github.com/gustavomhss/Orchestra-SF/blob/26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860/modules/sucafina/Sucafinav1/product/decisions/apply.ts), blob `65d2a0518427b1454aa665ef744bce7564ed8049`, `retainReceipt` e replay com recibo vinculado.
- [Adapter HTTP](https://github.com/gustavomhss/Orchestra-SF/blob/26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860/modules/sucafina/Sucafinav1/product/procurement/decision-http.ts), action e resolução final de `withCase`, além da função `response`.
- [Fixture](https://github.com/gustavomhss/Orchestra-SF/blob/26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860/modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts), `beforeRetentionReadReturn`.

## Como preservar a intenção do teste

Somente no trecho do teste que agenda a revogação final, envolver temporariamente `fixture.business.procurementDecisions.recover` em um observador que chama a função original exatamente uma vez com os argumentos recebidos, conserva seu resultado e retorna esse mesmo resultado sem alteração. Restaurar o método original em `finally` imediatamente depois da chamada HTTP, antes da recuperação positiva seguinte.

O oráculo deve exigir em conjunto:

1. `finalReadInterleavings === 1`.
2. A função original `recover` foi invocada exatamente uma vez.
3. O resultado interno é exatamente `{ status: "unavailable", reason: "receipt-authority-changed" }`.
4. A resposta HTTP final tem status403 e corpo exatamente `{ status: "denied", reason: "case-selection-authority-changed" }`.
5. O corpo externo não contém valor nem o ID do recibo; o snapshot durável permanece idêntico ao anterior.
6. Depois da restauração da autoridade, uma nova recuperação retorna200 e o mesmo recibo, conservando domínio, histórico e case.
7. A remoção/recriação física continua recusada, sem divulgação e sem mudança durável ou efeito adicional.

O observador não substitui o serviço, não chama o executor diretamente, não altera o fluxo de HTTP e não produz um resultado sintético. Ele torna visível a recusa interna que a revalidação externa deliberadamente substitui. Com isso, a antiga assertion de `receipt-authority-changed` permanece e ganha uma assertion da fronteira externa.

O predicado do hook é estrutural; `finalReadInterleavings === 1` isoladamente não identifica o caller. Os checks2–3 acima também eliminam um falso positivo de disparo antecipado em `cases.read`: uma recusa durante o preflight externo impediria a chamada a `recover`; uma recusa antes da retenção interna produziria outro motivo. Se o resultado interno exato não for observado, o teste deve continuar falhando e o agendamento precisa ser investigado, sem ampliar os status aceitos.

## Justificativa contratual

No [pack S4-A fixado em `dbf9547211d9b0fade619790de7c19c0869b7c7d`](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/execution/actors/S4-A.json):

- `/contracts/11/content/4` exige revalidar acesso ao recuperar o recibo original; possuir recibo durável não concede acesso depois de revogação.
- `/contracts/7/content/22` exige autenticação real no destino; IDs e estado histórico não substituem a ligação atual.
- `/contracts/15/content/8` preserva autorização final no domínio.
- `/contracts/15/content/9` invalida a lease na revogação e exige revalidação de egress.
- `/contracts/15/content/10` exige revalidar escopo/fontes antes de divulgar à UI e proíbe vazamento em stale/denied.
- `/resident/integrated_proofs/3/negative_checks/1` recusa autoridade antiga; `/resident/integrated_proofs/3/positive_checks/1` preserva recuperação legítima sem novo efeito.

O [anexo `resident-runtime.md`](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md), seção1.1, passos6–7, determina revalidação do retorno e invalidação por revogação. O [anexo `product-acceptance.md`](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/product-acceptance.md), seção1, conserva o registro protegido diante de acesso revogado e exige revalidar ao restabelecer acesso; a aplicação concreta C12 continua fundada em suas próprias cláusulas.

O contrato exige recusa atual e ausência de divulgação; não exige que o HTTP externo exponha503 quando a camada externa detecta revogação e responde403. Exigir os dois resultados exatos respeita cada fronteira e mantém todas as contraprovas. Este adendo não afirma que a instrumentação proposta já passou em Actions.

## Observação posterior executada

A instrumentação descrita foi executada no W3 `796f7d75310eba98a847a5ad9a5d4a5cec7e3de7`, S3 `0a316164ce059b113e966810dc0c09cf47e0f76b`, run [43644467464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644467464), job `132599028141`: **1 pass, 0 fail, 4 filtered out, 28 assertions**. O retorno interno observado foi `unavailable/receipt-authority-changed`; o corpo externo foi `denied/case-selection-authority-changed`, HTTP403. Hook1x, recuperação após reautorizar200 e recriação física403 passaram com snapshot durável preservado e zero efeitos duplicados. O resultado transforma a explicação estática acima em prova executada deste candidato, sem reclassificar o FAIL de W2.
