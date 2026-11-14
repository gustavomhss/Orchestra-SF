# WP12 — auditoria de dívida própria após D21

Este adendo mantém imutável o mapa publicado em `551ff6c1684ae09704cfce85c12690e8369b2d0c`. Seus 108 critérios, 50 critérios herdados, cinco perfis, 18 skills e 39 rotas AM02 continuam com os mesmos textos e estados de aceite. A auditoria distingue uma implementação própria possível, uma preparação de driver ainda pendente e os pré-requisitos de composição que pertencem a outros owners. Nenhum critério recebe upgrade por código escrito ou revisão estática.

## Resultado acionável

A rota `sf_maestro / sf-coordenar-perguntas / sf_handoff_prepare` pode ser composta com portas públicas existentes. O novo `native-execution-question-handoff.test.ts` cria uma ação e sua relação pelo C06, lê a referência escalar emitida pelo Hot Topic, inclui os endpoints no caso e prepara o `QuestionPlanningInput` real. A referência da ação chega ao modelo pela relação confirmada. O teste não injeta identidade privada no objetivo.

O arquivo passou por revisão estática independente, que conferiu as fronteiras de autoridade e onze fontes. Seu ramo sem modelo observa a preparação real de UI, recusas e os consumidores de domínio após reabrir o host. Seu ramo com modelo exige Session, SkillLoadReceipt, chamadas efetivamente concluídas e contribuição canônica. Ambos continuam **sem execução hosted neste adendo**.

O consumidor `handoff-link` recebe os valores da preparação e reautoriza fonte, ação e destinatário. Ele preserva uma ação e uma relação em retries e reloads, mas não armazena o recibo nativo. O recibo e o resultado da chamada são auditados na Session. Quando uma `QuestionProposal` nativa existe, o consumidor C11/C06 cria uma única thread e preserva a proveniência da contribuição. As duas fronteiras não são confundidas.

## As 27 obrigações pendentes

O arquivo `obligations-27.json` conserva cada obrigação, seu literal, ponteiro canônico, critérios e ação própria posterior. As 27 linhas incluem 12 obrigações de operações necessárias às skills e 15 rotas AM02; há operações repetidas entre esses dois conjuntos.

| Grupo | Linhas | Trabalho concreto e ownership |
|---|---:|---|
| C07: catálogo, preparar, executar, estado, resultado e watch | 12 | WP09/WP10/WP14 precisam publicar e montar as portas nativas e a admissão atual; WP12 deve então escrever e executar os witnesses e consumidores exatos. |
| Meu Trabalho | 2 | A composição consumida não fornece os sinais de trabalho nem o vínculo público da seleção ao input nativo. Intake posterior precisa de revisão por pins; o probe UI existente não vale como chamada nativa. |
| KPI de Forecast | 2 | WP00/WP10 e owners das fontes precisam fornecer uma relação legítima entre o Forecast Planner e uma métrica autorizada. A rota de BI não substitui a rota Finance/Forecast. |
| Compra: mudanças e recibos | 4 | Falta o alvo real autorizado no caminho ordinário consumido; `PreparedChangeSet` e recibo exigem store/choice/autoridade reais. WP12 mantém a obrigação de driver e consumidor após o owner publicar esse caminho. |
| Contratos: extração e busca | 2 | O produtor consumido diverge da superfície real do contrato e da referência canônica de schema documental. Corrigir esses gates pertence à composição WP10/WP06. |
| Revisão executiva: relatório e artefato | 2 | Falta a relação pública entre a seleção da pauta e a revisão preservada acessível à missão executiva. A missão Meeting não substitui essa AM02. |
| Meeting: preparar revisão | 1 | A revisão preservada não fornece o seletor público da pauta corrente exigido por `sf_review_prepare`. |
| Handoff | 1 | Novo driver próprio implementado e revisado estaticamente. Publicação e CI hosted continuam pendentes. |
| KPI de BI | 1 | Novo caminho próprio autorizado após auditoria de duas seleções públicas de orçamento; driver ainda não implementado no cutoff deste pacote. |

Também estão discriminadas as cinco saídas sem driver positivo: `AnalysisPlan`, `EvidenceCandidate`, `PreparedChangeSet`, `UnresolvedCondition` e `MatchExplanation`. A auditoria aponta o gate consumido de cada uma e a implementação própria que continua necessária após sua resolução. Um tipo no catálogo não é uma saída efetivamente produzida.

## Próximo incremento próprio: BI01 e KPI

A auditoria independente encontrou uma composição plausível sem editar contratos ou o produtor. BI01 exige uma seleção `Budget Overview / budgetSeries`; `total-budget` exige outra seleção `Budget Overview / budgetMetrics`. A identidade de uma seleção não pode ser reutilizada como a outra. Ambas podem ser emitidas realmente, no mesmo período, e vinculadas ao mesmo caso. A skill deve descobrir a fonte adicional por `sf_case_read`.

O produtor calcula o total anual a partir dos mesmos doze valores efetivos mensais. O próximo driver deverá exigir essa igualdade e preservar a ausência de medições de actual/forecast. O verificador da proposta é fechado: `ContextualBIProposal.sourceRefs` e `ContributionEnvelope.evidenceRefs` continuam contendo exatamente a fonte da série BI. A fonte adicional do KPI pertence ao resultado auxiliar e ao recibo reais da chamada na Session. Não haverá campo extra ou alegação de que o WP05 consumiu um KPI quando ele consumiu apenas o gráfico/tabela BI01.

Essa investigação não resolve a dependência já publicada sobre descoberta de identificadores de artefatos pelo modelo. Nenhum `tableRef` ou identificador privado será inserido no objetivo para contornar esse gate. Tampouco fecha o KPI de Forecast, cujo input é diferente.

## Evidência e limites

`question-handoff-route.json` descreve o incremento, as recusas, a seleção cirúrgica de CI e os limites do consumidor. `handoff-independent-review.json` contém a revisão estática do arquivo congelado. `bi01-kpi-viability.json` registra apenas a viabilidade e os limites do próximo driver. `source-pins.json` reúne trinta fontes reproduzíveis por caminho, commit, blob e URL imutável.

Os caminhos de scratch preservados em recibos independentes são metadados da auditoria original; não são links para arquivos deste pacote. Os arquivos entregues são os seis nomes desta pasta, e as fontes podem ser recuperadas pelos pins públicos. Não houve teste de produto ou typecheck local, alteração de fonte estrangeira, nova credencial, mudança de política financeira, aprovação ou aplicação de domínio pela skill. A revisão limitada dos arquivos próprios de IA não identificou outro defeito de implementação inequívoco; isso não declara ausência de todos os defeitos nem quitação das provas restantes.
