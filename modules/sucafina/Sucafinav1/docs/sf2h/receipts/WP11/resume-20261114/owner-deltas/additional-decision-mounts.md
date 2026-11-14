# Montagem adicional: divergência, rejeição e estado de execução

Status: `OWNER_INTEGRATION_REQUIRED`. Estes serviços e rotas são implementados no produto WP11, mas a composição manual do runtime WP10 ainda precisa consumi-los. A existência do serviço, de um handler HTTP e de testes não prova que a interface instalada os montou.

## Divergência entre premissa e fonte oficial

`createDecisionProduct` recebe `observeAssumption`, callback do owner da fonte, e expõe `assumptionDivergence`. O serviço preserva o valor declarado e retorna separadamente o valor observado, as referências e `matches`, `diverges` ou `unavailable`. A leitura repete as observações e relê o caso depois do último callback assíncrono. Alteração do caso ou da fonte durante a leitura recusa o resultado.

`createDecisionHttp` recebe esse serviço e expõe `decision-assumption-divergence`. O payload fechado é `{ purpose: "assumption-divergence", caseRef, alternativeId, alternativeVersion }`. Usa a concessão de leitura existente `decisions.portfolio.read`, com digest do payload integral e versão atual do caso. A rota não aceita um valor oficial fornecido pelo cliente.

O runtime deve ligar `observeAssumption` ao produtor oficial autorizado, com referências C02 atuais. A UI deve mostrar os dois valores e suas referências, mantendo o comando oficial separado. O teste discriminante de WP11 usa Planner e Dashboard reais, C08 e admissão UI real com identidade e intenções sintéticas de teste; seu emissor de referências por digest é uma fronteira de fixture. Não se declara um emissor C02 instalado nem uma sessão nativa.

## Rejeição de proposta preparada

`mutations.rejectChange` e a rota `decision-reject-change` recebem `{ purpose: "reject-change", caseRef, choiceId, changeId, rationale }`. A concessão existente `decisions.prepare-changes` é vinculada ao payload integral da rejeição; uma concessão para preparar operações não autoriza rejeitá-las. `createDecisionHostProduct` faz esse mapeamento. A composição manual de `mutationGrant`/`verifyMutationSourcesLocked` deve admitir a nova operação privada `reject-change` com a mesma cerca de intenção e autoridade vigente.

A rejeição só é permitida para uma mudança `planned`, ainda sem recibo ou tentativa de execução. No lock C08 de `cases`, o serviço procura a reserva global por caso/encarnação/change e recibos ou proofs de qualquer principal. Se uma execução pode ter começado, a rejeição é recusada e o resultado continua exigindo reconciliação.

A transação preserva os `ChoiceRecord`, o comando e os números originais, marca a mudança como `cancelled`, avança a versão do caso e registra a justificativa. O evento utiliza o tipo existente `reconsideration-accepted` com `consideredActions: ["reject-change:<id>"]`; significa aceitação da reconsideração humana que rejeita a mudança, não aceitação da proposta. O evento e o outbox são gravados atomicamente. Nenhum recibo de domínio é fabricado. Retry com a mesma identidade e conteúdo retorna o recibo da transação; conteúdo diferente conflita.

O consumidor deve rotular essa ação como rejeição/cancelamento de proposta, preservar a justificativa e não oferecê-la como reversão de uma execução já iniciada. Recusa formal de Procurement continua pertencendo ao comando e à autoridade desse domínio.

## Resultado indeterminado

`createPreparedExecution` agora registra uma reserva privada durável antes do primeiro dispatch. A chave é global por caso, encarnação e mudança. A reserva inclui digest da mudança, identidade humana e binding da revisão. Ausência de recibo após uma reserva retorna `application-indeterminate-reconciliation-required` sem nova revisão, confirmação ou dispatch. Uma queda entre a reserva e o envio também permanece conservadoramente indeterminada.

Um recibo autoritativo recuperado continua passando primeiro pela verificação de identidade e revisão e pelo caminho de reconciliação. O registro de tentativa não é prova de efeito nem de sucesso. O consumidor deve mostrar a necessidade de reconciliação em vez de apresentar a tentativa como falha segura para repetição. O teste injeta perda real do recibo em store temporário, fecha/reabre e restaura exatamente o recibo original; não representa reparo automático em produção.

`createPreparedApplicationStatus` fornece uma projeção privada de leitura, sem modificar C09: `{ caseRef, changeId, choiceId, recordedState, status }`, com `status` igual a `not-attempted`, `receipt-required` ou `reconciled`. `recordedState` conserva o estado registrado no caso; o marker sozinho não produz estado terminal. Para devolver `reconciled`, o serviço exige o recibo exato ainda autorizado pelo produtor, sua associação ao caso e nova leitura C08 após os callbacks assíncronos. Participação no caso não concede acesso ao resultado de domínio de outro ator.

`createDecisionProduct` expõe `applicationStatus`, usando somente `application.apply.readReceipt`. A rota privada `decision-application-status` recebe o payload fechado `{ caseRef, changeId, choiceId }` com a concessão `decisions.portfolio.read`, versão atual e sem retry histórico. O consumidor manual de WP10 deve montar esse serviço para mostrar a restrição antes de oferecer aplicação. O teste de indeterminação chama a rota HTTP antes e depois da recuperação, incluindo recusa do estado terminal para um participante sem acesso ao recibo; essa fronteira HTTP em teste não equivale à interface instalada.

Estas montagens não autorizam merge, deploy, GNATIVE ou aceitação dos gates globais. Os runs exatos das implementações e dos testes próprios constarão no receipt final; nenhum run é atribuído aos deltas de runtime não aplicados.
