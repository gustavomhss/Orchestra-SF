# WP12 — seleção pública de Meu Trabalho em missões relacionadas

Estado: **driver revisado estaticamente; produto e typecheck ainda não executados para este arquivo**. Este adendo trata duas obrigações antes classificadas amplamente como dependentes do host: `sf_work_list` em `sf-coordenar-perguntas` e a rota AM02 de `sf-preparar-revisao-executiva`. Não altera o mapa D21, seus textos ou seus status.

## Caminho de autoridade e assunto comum

O novo teste lê o seletor produzido pelo HTML real de `workbench-work-select` em Procurement. A pessoa escolhe esse seletor público e seu período no objetivo da missão. Uma segunda instância auxiliar de business services seleciona seu próprio período pela porta pública; seu handle não é usado na instância montada que emitiu o HTML.

A solicitação de serviço, a ação Hot Topics e a relação C06 são o mesmo assunto de renovação. A solicitação é um registro bruto explícito; a ação, a atribuição e a relação são criadas pelo comando humano real. Na pergunta, a mesma evidência Planner gera a condição de training pendente por C09/C10 e integra as fontes do caso e da relação. Na revisão, a agenda real captura a ação exata e conserva sua data de observação, separada do horizonte financeiro da solicitação. Um pedido homônimo sem essa atribuição permanece fora dos itens esperados.

## Consumidores e níveis de prova

| Missão | Consumidor com UI real | Ramo nativo condicionado à disponibilidade real |
|---|---|---|
| Pergunta | Meu Trabalho e reuso idempotente da ação C06 existente | Session/SkillLoadReceipt, `sf_work_list` comparado com UI, QuestionProposal C08 → C11 → thread C06 sem resposta e reabertura |
| Revisão executiva | Meu Trabalho, ação C06 e leitura da revisão Hot Topics preservada | Session/SkillLoadReceipt, work/review tool receipts reais, DecisionBrief C08 → consumidor C11 |

Os resultados e recibos auxiliares de trabalho permanecem auditados na Session. O teste não acrescenta campos a QuestionProposal ou DecisionBrief. Com catálogo vazio, registra indisponibilidade; não cria saída substituta nem promove a execução de UI a inferência.

## Reabertura, isolamento e retirada da fonte

O token do registro anterior deve ser recusado depois de reabrir o host. Uma nova seleção é emitida pelo mesmo caminho público, e o consumidor verifica os mesmos identificadores persistidos de solicitação, ação e relação. Um Request fora do autenticador real não pode ler a página. Ao final, a exclusão explícita da solicitação deve retirar acesso ao trabalho e a qualquer saída nativa previamente concluída, mesmo que o catálogo de modelos tenha mudado.

Antes desse negativo, o driver compara o caso e os dados brutos de Procurement/Hot Topics e Planner. A afirmação não inclui a imutabilidade de todas as namespaces: emissões legítimas de identidade de fonte podem persistir metadados.

## Limites preservados

Não há claim de descoberta autônoma do token, `Open work`/destination, resposta confirmada, todos os required_operations da skill ou C07. A thread nova fica sem resposta; o bloqueio conhecido de answer scope Planner/Procurement continua separado. O caminho case-work-selection também continua dependente de `workSignals`; este teste exercita o caminho público Procurement já existente com fontes relacionadas ao mesmo caso.

`preparation.json` contém os dois nomes exatos, os 360000ms de cada teste e os dois pointers canônicos. `source-pins.json` permite reproduzir os contratos inspecionados por URL imutável, blob Git e SHA256. `independent-review.json` preserva a revisão estática independente e seus limites. Somente CI hospedado poderá atribuir resultados a este arquivo.
