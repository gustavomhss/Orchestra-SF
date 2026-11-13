# Orchestra SF — plano integral de produto e IA

**Estado deste checkpoint: SAVED_FOR_FORMAL_REVIEW.** Este diretório conserva todo o planejamento produzido e sua origem. Não contém implementação nova do produto.

## Ordem de leitura

1. [Campanha integral](CAMPAIGN.md): objetivo, 15 WPs, 71 tasks, prazo alvo e cinco famílias de axiomas.
2. [Agentes, skills, MCP e Atlas SF](AGENTS-ATLAS-MCP.md): cinco perfis, dezoito skills, um servidor específico, oito packs e a adaptação de conhecimento/memória.
3. [Fontes e status](SCOPE-STATUS.md): o que está decomposto, o que foi acrescentado e quais validações realmente ocorreram.
4. [Revisão formal](formal-review/README.md) e [protocolo](formal-review/PROTOCOL.md).
5. [Prompts das cinco sessões](START.md), sempre no mesmo commit do plano.

## Especificações canônicas

- [Campanha estruturada](campaign.json) e [WPs](work-packages).
- [Contratos](contracts.json), [ownership](ownership.json) e [dependências](task-dag.json).
- [Cronograma e recursos](schedule.json), [cobertura](coverage.json) e [CI](ci-recipes.json).
- [Plano de evidências](evidence-plan.json), [axiomas](axiom-index.json) e [correspondência de provas](proof-map.json).
- [Validação estrutural](validation.json) e [ferramenta de validação](tools/validate_plan.py).

## Materiais preservados

- [Visão de produto com IA](sources/AI-PRODUCT-VISION.md).
- [Campanha original](sources/original-campaign.json).
- [Protótipo sintético](prototypes/decision-workbench.html), somente referência de conceito.
- [Revisões anteriores](reviews/README.md), inclusive a investigação do Atlas.
- [Páginas de origem](pages.json), opcionais para consulta histórica.

O escopo de produto permanece integral. Azure/deploy e novos acessos corporativos não fazem parte desta campanha. Todos os resultados de implementação e de provas de produto permanecem PLANNED/NOT_RUN. O prazo de 120 minutos é uma meta condicionada, não um resultado medido.
