# Orchestra SF — plano integral de produto e IA

**Estado: APPROVED_FOR_EXECUTION.** Três agentes independentes aprovaram o planejamento corrigido em `1feb949244357b8ee7ea7a0c27310281accc7592`. Os 13 achados das duas rodadas formais estão encerrados; nenhum P0, P1 ou P2 ficou aberto nos escopos examinados. Este commit de entrega registra os pareceres e o fechamento, preservando a fonte canônica e seus 50 espelhos. [Consolidação e limites](formal-review/round-2/SUMMARY.md).

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

## Leitura pelo GitHub MCP

O leitor de arquivo raw do conector pode recusar `campaign.json` por tamanho. A leitura integral foi conferida pelo endpoint de Git blob, no mesmo MCP e com as mesmas permissões:

```text
https://api.github.com/repos/gustavomhss/Orchestra-SF/git/blobs/376ec1b545812f44652d2ae834bdbc86ba888106
```

Neste conector, `structuredContent.content` retorna o JSON canônico já decodificado. Faça o parse e selecione as seções necessárias, sem despejar o documento inteiro no contexto. Se a fonte mudar, obtenha o novo SHA do blob na árvore Git do commit fixado; não reutilize o SHA antigo como se fosse a versão nova. Os WPs, contratos e demais espelhos menores continuam disponíveis para leitura direta. [Recibo de acesso e igualdade do conteúdo](formal-review/round-2/access-check.json).
