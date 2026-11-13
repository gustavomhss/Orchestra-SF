# Orchestra SF — plano integral de produto e IA

**Estado: RECHECK_PENDING.** Os três revisores fecharam os dez apontamentos originais. A rodada 2 encontrou dois P1 e um P2 adicionais, corrigidos neste candidato e enviados para rechecagem no novo SHA. [Estado e pareceres](formal-review/README.md).

O plano preserva todo o escopo e incorpora a equipe residente: **15 WPs, 74 tasks, 17 contratos, cinco perfis, dezoito skills, um MCP com oito packs e 39 operações, Atlas SF e seis provas integradas**. A implementação permanece PLANNED/NOT_RUN.

## Ordem de leitura

1. [Campanha integral](CAMPAIGN.md): resultado, escopo, gates e axiomas.
2. [Equipe, skills, MCP e Atlas](AGENTS-ATLAS-MCP.md): o que será distribuído e usado.
3. [Produto e critérios de aceite](specs/product-acceptance.md): confirmação material, custos omitidos, documentos e consumo das skills.
4. [Contratos de runtime](specs/resident-runtime.md) e [execução reconciliada](specs/execution-reconciliation.md).
5. [Prompts das cinco sessões](START.md), sempre no mesmo commit aprovado.

## Fonte canônica e artefatos verificáveis

- [campaign.json](campaign.json) é a fonte normativa. Os [WPs](work-packages), [contratos](contracts.json), [ownership](ownership.json), [cronograma](schedule.json) e [DAG](task-dag.json) são derivados.
- [Manifesto residente](agents-atlas-mcp.json), [consumo na UI](resident-ui-consumption.json), [outputs intermediários](output-handoffs.json) e [provas residentes](resident-proof-plan.json).
- [Cobertura](coverage.json), [evidências](evidence-plan.json), [axiomas](axiom-index.json), [mapa de provas](proof-map.json) e [seleção de CI](ci-recipes.json).
- [Resultado estrutural](validation.json), [limites da validação](VALIDATION.md), [gerador](tools/render_plan.py) e [validador](tools/validate_plan.py).

Use `python tools/render_plan.py` depois de alterar a campanha; `python tools/render_plan.py --check` detecta cópias divergentes. `python tools/validate_plan.py` verifica vínculos, axiomas, recursos e outputs declarados.

## Materiais preservados

As [fontes históricas](sources), [protótipos sintéticos](prototypes/README.md), [pareceres anteriores](reviews/README.md) e [primeira rodada formal](formal-review/round-1/SUMMARY.md) continuam preservados. [SCOPE-STATUS.md](SCOPE-STATUS.md) explica a precedência.

A meta de implementação é 120 minutos, condicionada à capacidade e às durações observadas. A campanha continua com o escopo inteiro se o prazo não for atingido. Azure/deploy e novos acessos corporativos ficam fora desta frente.
