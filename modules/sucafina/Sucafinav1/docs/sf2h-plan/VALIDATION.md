# Validação do planejamento reconciliado

**PLAN_STRUCTURE_PASS.** Hash canônico: `aaba00217ac1978860853fb0c72748b1b275fe4ee4d3b998c42a9f730dfe98a2`. A validação inclui o produto integral, equipe residente, MCP, Atlas, recursos e handoffs.

- 15 WPs, 74 tasks, 17 contratos e as cinco famílias de axiomas em todos os níveis.
- 1230 axiomas e 380 checks; 1610 critérios ligados a conjuntos de evidência.
- 41 requisitos, 28 capacidades, 18 capacidades de IA, seis requisitos residentes e 13 jornadas.
- Cinco perfis, dezoito skills, oito packs, 39 operações e seis provas integradas.
- Trinta e nove rotas positivas perfil/skill/operação, com consumidor e obrigação de autorização atual.
- Vinte slots físicos, 23 identidades ao longo do tempo, três revisores novos e dezoito leases de fonte.
- Dezenove outputs, dependências temporais, DAG sem ciclos, ownership e interfaces sem divergência.
- Nove paths Atlas com escritor explícito, scanner pelo subpath existente e gate de spawn preservado.
- Cinquenta espelhos conferidos contra a fonte canônica, sem drift.
- Oito controles negativos detectam as regressões de recursos, grants, referências, handoffs e packaging descritas no recibo.

[validation.json](validation.json) contém resultado e limites; [controles estruturais](formal-review/round-2/validator-controls.json) identifica as contraprovas. Os três pareceres e suas rechecagens são publicados em [formal-review/README.md](formal-review/README.md).

## Repetir

Execute `python tools/render_plan.py --check` e `python tools/validate_plan.py` a partir deste diretório. Após alterar a fonte, execute primeiro `python tools/render_plan.py`.

## Limite do resultado

Estes comandos verificam o plano. Não compilam o produto, não executam seus testes, não demonstram IA, Relay, MCP, Atlas, CI ou UX real e não medem produtividade. As janelas de 120 minutos são reservas condicionadas. Implementação e provas de produto continuam PLANNED/NOT_RUN. O guard do repositório é registrado por SHA separadamente; nenhum PASS estrutural aprova critérios de produto.
