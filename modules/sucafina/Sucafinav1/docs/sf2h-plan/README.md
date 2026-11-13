# Orchestra SF — plano integral e workflow de execução

**Versão 3.2: candidato corrigido em rechecagem independente.** O plano preserva o produto integral e organiza a execução por uma supervisora S0, quatro sessões coordenadoras e seus auxiliares. O estado verificável está na [rodada 3](formal-review/round-3/SUMMARY.md).

## Começar

1. [START](START.md): entrada pela supervisora, sempre com o commit de planejamento fixado.
2. [WORKFLOW](WORKFLOW.md): capacidade, lançamento, delegação, integração, provas, retomada e término.
3. [Prompt S0](prompts/S0.md): missão da supervisora e distribuição das quatro sessões do preset.
4. [COMMON](execution/COMMON.md) e [pacotes por ator](execution/manifest.json): tarefas, axiomas, contratos, dependências e limites de escrita atribuídos.

O preset de duas horas usa S0 + N=4 sessões independentes, com até vinte slots incluindo coordenadoras. Sua admissão exige capacidade real. A árvore collaboration de quatro slots globais não ganha vinte por aninhamento. Git registra checkpoints e entregas; o lançamento e a retomada dependem das capacidades efetivamente expostas pelo backend.

## Escopo completo

**15 WPs, 74 tasks, 17 contratos e 1.610 critérios**, além das regras operacionais do workflow. Cinco perfis residentes, dezoito skills, um MCP Sucafina com oito packs e 39 operações, Atlas SF Business Profile v1 e seis provas integradas permanecem na campanha. Dashboard, Planner, Procurement, BI, documentos, importação, reuniões, colaboração, exportações, Relay, decisões, portfólio e memória estão cobertos.

[Campanha](CAMPAIGN.md), [agentes/Atlas/MCP](AGENTS-ATLAS-MCP.md), [contratos](contracts.json), [WPs](work-packages), [ownership](ownership.json), [cronograma](schedule.json), [handoffs](output-handoffs.json), [provas](proof-map.json) e [CI](ci-recipes.json).

## Execução e verificação

Os jobs persistem por writer. Outputs são integrados quando prontos e consumidos por SHA. Um dispatcher controla as requests de CI, adota execuções idênticas em andamento e preserva todas as seleções finais. O candidato de produto C inclui guias, prompts e skills; a entrega D acrescenta apenas evidências admitidas e recebe guard próprio.

`campaign.json` é a fonte normativa. O renderer e o compilador conferem 100 artefatos derivados e 23 pacotes de contexto. Os contratos e handoffs são fechados por ator; definições adicionais de skills e provas são contexto de leitura e não transferem escrita ou responsabilidade de execução.

Execute `python tools/render_plan.py --check` e `python tools/validate_plan.py`. Consulte [validação](VALIDATION.md), [medição de contexto](execution/context-measurement.json) e [limites/histórico](SCOPE-STATUS.md).

SHA-256 canônico: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Se o leitor raw do conector recusar uma fonte grande, obtenha o blob SHA na árvore do commit fixado e use o endpoint Git blob do mesmo conector. Não misture artefatos de versões diferentes.

Implementação e provas de produto: **PLANNED/NOT_RUN**. A meta de 120 minutos inclui preparação e todos os gates, depende de observação real e mantém o escopo integral em caso de atraso. Azure, deploy e novos acessos corporativos permanecem fora desta frente.
