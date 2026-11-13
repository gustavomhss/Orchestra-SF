# Orchestra SF — plano integral e workflow de execução

**Versão 3.2: delta de execução em revisão.** O produto integral aprovado na versão anterior foi preservado. Esta revisão torna operacional a supervisão S0+N, prepara contexto por ator, integra por output pronto, deduplica CI e separa o produto testado da entrega evidencial. [Estado e pareceres](formal-review/README.md).

## Começar

1. [START](START.md): iniciar pela supervisora S0, com o SHA de planejamento fixado.
2. [WORKFLOW](WORKFLOW.md): topologia, lançamento/ACK, fila, integração, provas, retomada e término.
3. [Prompt S0](prompts/S0.md): missão da supervisora e distribuição das quatro sessões do preset.
4. [COMMON](execution/COMMON.md) + [pacotes atribuídos](execution/manifest.json): leitura completa por papel, com hashes e todas as tarefas/axiomas pertinentes.

O preset de duas horas usa S0+N=4 sessões independentes, até vinte slots incluindo coordenadoras. Admissão exige capacidade real; o backend collaboration de quatro slots globais não ganha vinte por aninhamento. Git mantém o ledger, mas não cria nem desperta conversas. O modo automático usa um backend de sessões realmente disponível; o modo assistido conserva suas limitações explícitas.

## Escopo completo

**15 WPs, 74 tasks, 17 contratos e 1.610 critérios**. Cinco perfis, dezoito skills, um MCP SF com oito packs/39 operações, Atlas SF Business Profile v1 e seis provas integradas. Dashboard, Planner, Procurement, BI, documentos, imports, reuniões, colaboração, exportações, Relay, decisões, portfólio e memória permanecem na campanha.

[Campanha](CAMPAIGN.md), [equipe/Atlas/MCP](AGENTS-ATLAS-MCP.md), [contratos](contracts.json), [WPs](work-packages), [ownership](ownership.json), [cronograma](schedule.json), [handoffs](output-handoffs.json), [provas](proof-map.json) e [CI](ci-recipes.json). DoD, invariants, quality standards, completeness criteria e success criteria permanecem em todos os níveis; o workflow adiciona essas famílias às suas oito etapas.

## Verificação e proveniência

`campaign.json` é a fonte normativa; 100 artefatos são gerados pelo renderer e pelo compilador de contexto. Execute `python tools/render_plan.py --check` e `python tools/validate_plan.py`. [Validação](VALIDATION.md), [medição de contexto](execution/context-measurement.json) e [limites/histórico](SCOPE-STATUS.md).

Hash canônico atual: `044c729f37c055bf81c1cf4832ad37ffcd96b77834e0c725b6a0da51c1a4421d`. Se o leitor raw do MCP recusar a fonte grande, obtenha o blob SHA na árvore do commit fixado e use o endpoint Git blob do mesmo conector. Os packs por ator permitem a leitura inicial sem abrir o JSON inteiro; seus hashes e source hash estão no manifesto. Não misture versões.

Implementação e provas de produto: **PLANNED/NOT_RUN**. A meta 120 minutos inclui arranque e todos os gates, depende de observação real e não autoriza redução de escopo. Azure/deploy e novos acessos corporativos permanecem fora desta frente.
