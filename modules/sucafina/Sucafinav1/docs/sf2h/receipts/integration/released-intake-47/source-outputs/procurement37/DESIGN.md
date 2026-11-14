# Missão37 — produtor independente de cenário Procurement

Estado de entrega: implementação de produção e provas cirúrgicas da fonte; montagem compartilhada entregue como patch ao sucessor explícito42 da sessão33. O estado final de CI e os SHAs executados pertencem a CI.json e HANDOFF.md, não a uma aprovação implícita deste documento.

## Entrada humana, sem inferência de operação

O controle tipado oferece somente fontes individuais Procurement já anexadas ao caso, com principal, encarnação e versão atuais. O usuário escolhe explicitamente uma requisição, baseline ou replace de PR.estAmount, valor finito não negativo, moeda, período e o inventário renewal-transition-v1. Moeda e período são o escopo visível do caso; nenhum campo permite colar ref interna ou JSON. O inventário é hipótese humana explícita: a existência de uma PR não prova que se trata de renovação.

O produtor aceita baseline vazio ou exatamente uma substituição do mesmo targetRef. Rejeita outro target, replacementRef, operação adicional, moeda/período divergentes, fonte antiga, outro principal e custo de origem ausente para uma substituição. Ausência é null; zero é valor numérico explícito.

## Prévia sem efeitos

O produtor usa leitura transacional commit:false, fonte emitida com identidade e projeção atuais, autoridade de domínio revalidada e o calculador canônico procurementMonetaryFacts. Cria apenas uma cópia em memória da PR para calcular a proposta. Não chama execute, prepared, Apply, source issuance, import, restore ou um ciclo write/revert.

O resolvedor genérico de fonte podia renovar metadados durante a leitura. A missão acrescenta um leitor específico estritamente readonly dentro do arquivo autorizado do produtor. A prova registra todas as tentativas commit:true, além de comparar os snapshots inteiros. Autorização e fonte são novamente verificadas na saída.

## Valor e cobertura C10

O valor provém do campo canônico de estimativa da PR no estágio editável. A moeda é a da PR; a unidade publicada é currency. O período é o escopo explicitamente emitido, sem alegação de que seja uma nova data do domínio. A identidade reúne versão do produtor e calculador, request exato, digest da fonte, principal, instalação/projeto, acesso/política e revisão física do domínio. Timestamps de observação não transformam a mesma intenção em identidade nova.

A cobertura usa CostCoverageBasis e assessCostCoverage existentes. Há nove categorias canônicas; o valor da requisição, sozinho, não autoriza sua classificação em nenhuma delas. A saída conserva knownSubtotal quando conhecido, total:null, comparisonStatus:conditioned, a hipótese de inventário e as pendências reais. Não se inventa um valor para external-operation-cost-unresolved, nem se soma um custo Procurement a uma versão Planner sem relação de alocação comprovada.

## Persistência, escolha e recuperação

A promoção continua no comando C08 decision-promote existente. O formulário retém corpo e chave originais antes de enviar; repetição após resposta perdida usa a mesma intenção. O resultado, operação, fontes e proveniência seguem pelo DecisionMutations/DecisionResultStore existente. O patch da composição acrescenta roteamento explícito do produtor e reconciliação do resultado Procurement; não cria um segundo store.

O controle de escolha e a fotografia imutável continuam nos ports existentes. O patch inclui montagem do formulário e script no chooser, host/rotas/descriptor, calculation, cobertura e leitura dos cenários persistidos. As provas isoladas do snapshot/C08 não são apresentadas como execução de browser montado nem como prova nativa/AM.

## Aprovação financeira e C12

A preparação desta substituição responde financial-approval-command-unavailable. Ela não converte uma escolha, checkbox ou aprovação de outro valor em autorização financeira. O diagnóstico de comandos e a decisão mínima pertencem a FINANCIAL-COMPATIBILITY.md.

prepared.ts e prepared-review.ts incorporam e conservam as proteções OPS-REV-02 já publicadas em C9: estágio editável, recusa de no-op, intenção exata e pós-condição física. Há também uma recusa de estAmount no caminho baixo de preparação e na revisão, antes de executar ou emitir fonte, para impedir que um comando financeiro anteriormente persistido contorne o bloqueio do produtor. Edições de título/justificativa continuam disponíveis. O executor e a recuperação C12 da sessão32 permanecem readonly; a leitura do recibo original precede a reconstrução da mutação. A seleção cirúrgica inclui as regressões existentes de um único efeito/recibo, retry e CAS. Esses positivos genéricos não fecham o critério impossível de Apply financeiro desta substituição.

## Fronteira de integração

A sessão33 encerrou sua autoridade no terminal bf81f9776b6ba5fb6267828a9a029d7e8d6f5587. A missão42 assumiu explicitamente a integração de sf2-stack, preservando a autoridade de fonte37 e os preimages de produto do checkpoint e7e97591edfc15f230856a035e32951f2f700c2f. AUTHORITY-SUCCESSION.json fixa a evidência da sucessão; o handoff original à33 permanece como predecessor. A PR23 contém somente os paths autorizados e patches inertes sob os recibos próprios. Os patches especificam preimage, postimage e dependências; se o consumidor observar outro blob, deve reconciliar o delta antes de escrever.

O ACK solicitado à42 é por path/blob, identificando o candidato montado. A prova cirúrgica, typecheck e guards do novo candidato são de S0 pelo dispatcher existente: a missão42 não tem autorização para executá-los. Sem ACK e prova no novo candidato, M31-PRECHOICE-PROCUREMENT permanece aberto para aceite composto. M31-FINANCIAL-APPROVAL permanece bloqueado pela incompatibilidade de contrato/política, sem waiver. S0 conserva o aceite final; 15 WPs, 74 tasks, 17 contratos, 1610 critérios e T0 não são redefinidos.

O descriptor existente sf_scenario_simulate tem um ramo transitório no patch de montagem: usa o produtor e a admissão reais, retorna resultado e recibo vinculados, sem outputRef e sem chamar persist. O wrapper de cálculo recusa publicação Procurement fora da promoção humana C08. Essa forma é compatível com outputRef opcional em C16, mas não prova execução IA/nativa nem satisfaz, por si, a testemunha persistida C15/AM02. O novo teste consumidor e os critérios da fronteira numérica permanecem explicitamente NOT_RUN até montagem e execução autorizada.

