# W14 — contraprova de revisão tardia

## Mudança e identidade

Foi alterado somente o teste `a delayed review preparation cannot start or restore data after analysis access is revoked`, em `modules/sucafina/Sucafinav1/test/product/wp01/edit-recovery.test.ts`. O blob anterior no W13 era `98b235b93451f5449625b65fbd4fbb369dc47f1a`; o candidato é `be4e6c1f990ab190291022f2133e239fb9239eb8` (SHA256 `b41dd5576e5ee97900301861e1159ffebdc3cab59b430534de023ed3199ad66f`). O consumidor `modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts` permanece no blob `973a2f09b394426364c514b923ecdc8e10ffb184`. Nenhum outro caso desse arquivo foi reescrito.

## Evidência anterior preservada

O mesmo caso passou no [W9, run 43586466170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586466170), em 420,07 ms. Ele não foi selecionado no W10. No [W13, run 43590725536, job 132434657511](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590725536/job/132434657511), falhou em 5.371,24 ms esperando o evento de resposta com o cabeçalho `x-fixture-review-released`. Os logs não demonstram uma causa única, um aborto explícito, uma restauração indevida de dados ou o início de uma revisão. O recibo e a análise causal W13 permanecem congelados.

## Contraprova ajustada

O handler continua usando o mesmo `Response.json` da fixture de transporte. Ele materializa esse corpo antes da entrega, envia os cabeçalhos e um prefixo exato do JSON enquanto o acesso continua válido e mantém o restante suspenso. O teste observa os cabeçalhos e permite que a continuação autorizada entre na leitura do corpo incompleto. Só então provoca a resposta 403 da atualização de histórico e verifica a mensagem de revogação.

Após essa revogação, a fixture libera os bytes restantes do mesmo JSON. O teste exige igualdade exata do texto recebido, `finished() === null`, entrega completa sem cancelamento e apenas uma preparação. As assertions anteriores de zero requisições de início, ausência do formulário, ausência do texto privado e remoção de `data-case` continuam intactas. A liberação é idempotente para o cleanup.

Essa versão exercita o guard de acesso após a leitura do corpo e a continuidade do consumidor após a revogação. Ela não depende de a resposta ser abandonada antes de ler o corpo. Não é uma declaração de cobertura exclusiva de uma instrução interna: o guard de atividade também permanece no consumidor.

## Limites e próximo gate

Os limites continuam em 5 s por fase, 30 s no caso, 30 s de idle no servidor e 15 s no fetch do consumidor. Não houve aumento de prazo, retry interno, remoção de assertion, mock novo de produtor ou alteração de código do produto. Continua sendo uma contraprova de transporte do consumidor real, sem execução nativa, sem modelo residente e sem aceite do host completo.

O estado é **IMPLEMENTED_NOT_EXECUTED**. Nenhum teste, typecheck ou guard foi executado localmente, e o revisor não disparou CI. O gate seguinte é o arquivo `test/product/wp01/edit-recovery.test.ts` no snapshot W14 publicado, com o ciclo obrigatório de browser no GitHub Actions.
