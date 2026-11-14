# WP12 — resposta Dashboard no mesmo caso

Este incremento prepara uma missão própria e isolada de `sf-coordenar-perguntas`. A pessoa seleciona a conversa de uma dotação CAPEX de 2027 já ligada, por uma relação real, ao projeto e ao Planner do mesmo caso. A resposta é lida pela porta C06 e permanece **unconfirmed**. Ela não confirma valor, documento, benefício ou cobertura de treinamento.

A preparação usa os produtores C09/C10 reais e mantém a mesma entrada de treinamento pendente, agora vinculada ao identificador da thread que o C06 realmente criou. O helper Planner existente continua byte a byte preservado, inclusive sua exigência de resposta com fonte Planner. A fronteira de integração Planner previamente publicada continua aberta.

O período da conversa e da fonte CAPEX é exatamente 2027 e está contido no horizonte do caso. O projeto observado no ano corrente é contexto da relação; não é substituído por uma fonte de 2027 nem usado como fonte principal de uma conversa com período incompatível. A proposta seleciona o subconjunto CAPEX autorizado, permitido pelo verifier fechado e pelo consumidor.

## Produtor, execução e consumidor

Sem modelo, a preparação UI, o recebimento humano, a resposta e a reabertura usam portas reais. Esse ramo não cria uma contribuição nativa. Com modelo instalado, o driver exige Session/SkillLoadReceipt, as quatro chamadas nativas, o resultado de answer antes da preparação da pergunta em mensagens distintas, uma QuestionProposal real e seu consumidor C11→C06. Os digests do recibo são comparados aos argumentos e ao resultado persistidos de cada chamada, com o mesmo run, Session, principal e callId. Uma nova thread nativa exige uma terceira instância do host para observar a persistência.

Os negativos recusam uma fonte homônima fora do caso e a leitura HTTP não admitida. Depois dos consumidores positivos, retirar somente o CAPEX selecionado deve recusar as duas linhagens de resposta e qualquer output nativo existente; o outro CAPEX continua legível. A pendência, o caso e os dados originais são verificados antes dessa retirada deliberada.

## Estado da prova

O novo arquivo está congelado com duas revisões estáticas independentes, de semântica e de tipos/interfaces. Não houve testes de produto ou typecheck locais. A revisão independente de interfaces realizou somente remoção de tipos e checagem de sintaxe com Node, sem importar ou executar o produto. O prazo declarado é 360000 ms; não é uma medição. Não há inferência, recibo nativo, confirmação de custo, aceite GNATIVE ou fechamento global WP12 observado. `sf_work_list`, o handoff, a reutilização de resposta confirmada e a rota Planner têm provas e pendências distintas.

`preparation.json` descreve os vínculos e limites; `source-pins.json` identifica 21 fontes publicadas e os cinco arquivos próprios preservados. Os caminhos de cápsulas são metadados de auditoria; as URLs imutáveis identificam o conteúdo publicado.
