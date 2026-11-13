# Estado da validação

**PLAN_STRUCTURE_PASS.** O validador estrutural não encontrou falhas no plano canônico `a6765b12170334a27e915e7cc0d812cbb5caebc1cc9dcedbd4558610838423d5`.

- 15 WPs, 71 tasks e cinco famílias de axiomas em campanha, cada WP e cada task.
- 758 axiomas e 264 verificações, agrupados em 18 conjuntos de provas.
- 41 requisitos originais, 28 capacidades originais e 18 capacidades de IA com responsáveis.
- 14 contratos, 13 jornadas, referências válidas, dependências sem ciclos e ownership sem colisões.
- Três revisões adversariais reconciliadas, com relatórios de rechecagem preservados.

O validador verifica a estrutura e os vínculos declarados. Não compila o produto, não executa IA ou Relay, não roda CI e não prova que o prazo será cumprido. Os estados de implementação são PLANNED/NOT_RUN.

Para repetir a validação após uma alteração no plano: `python tools/validate_plan.py`.
