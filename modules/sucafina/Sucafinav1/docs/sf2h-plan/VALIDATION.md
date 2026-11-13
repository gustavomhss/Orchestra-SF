# Validação do planejamento reconciliado

**PLAN_STRUCTURE_PASS.** O resultado aplica-se ao hash canônico `ff3ed928b2abd42eac3e9c1e7901cdf42d43c436623a7bb5d6101ff09c1293cb`. A nova validação inclui equipe residente, MCP, Atlas e alocações; não se limita à campanha anterior ao adendo.

- 15 WPs, 74 tasks, 17 contratos e cinco famílias de axiomas em campanha, cada WP e cada task.
- 1190 axiomas e 371 checks; 1561 critérios ligados a conjuntos de evidência.
- 41 requisitos, 28 capacidades, 18 capacidades de IA, seis requisitos residentes e 13 jornadas preservados.
- Cinco perfis, dezoito skills, oito packs, 39 operações e seis provas integradas, com grants, outputs e consumidores coerentes.
- Vinte slots físicos, 23 identidades ao longo do tempo, três revisores novos e dezoito leases de fonte.
- Dezenove handoffs, dependências temporais, DAG sem ciclos, referências válidas e ownership sem colisões.
- Cinquenta artefatos derivados conferidos contra a fonte canônica, sem drift.
- Cinco controles negativos verificaram que o validador rejeita sobreposição de slot, input atrasado, lease incorreto, critério inexistente e remoção de task original.

[validation.json](validation.json) contém o resultado e seus limites; [validator-controls.json](formal-review/round-2/validator-controls.json) identifica as contraprovas estruturais. A revisão adversarial semântica é independente e permanece pendente neste candidato.

## Repetir

Execute `python tools/render_plan.py --check` e `python tools/validate_plan.py` a partir deste diretório. Depois de alterar a fonte, execute primeiro `python tools/render_plan.py`.

## Limite do resultado

Esses comandos verificam o plano. Não compilam o produto, não executam seus testes, não demonstram IA, Relay, MCP, Atlas, CI ou UX real e não medem produtividade. As janelas de 120 minutos são reservas condicionadas. Todos os resultados de implementação e provas de produto continuam PLANNED/NOT_RUN. O guard do repositório será registrado com seu SHA real, separadamente, sem propagar aprovação para critérios de produto.
