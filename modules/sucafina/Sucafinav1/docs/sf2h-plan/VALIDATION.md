# Validação do plano e workflow

**PLAN_STRUCTURE_PASS.** Fonte `044c729f37c055bf81c1cf4832ad37ffcd96b77834e0c725b6a0da51c1a4421d`. 15 WPs, 74 tasks, 17 contratos; 1.230 axiomas e 380 checks, 1.610 critérios mapeados. Scope, contratos, capacidades e manifesto residente foram preservados. Nenhum teste de produto foi executado.

O renderer verifica 100 artefatos. Os 23 pacotes de contexto preservam tasks/axiomas completos, contratos pertinentes e atribuições, cobrindo todos os 1.610 IDs, 19 handoffs, 18 skills e 39 operações. Três controles negativos detectam mudança de writer, ator sem atribuição e branch divergente. [Recibo](formal-review/round-3/context-validation.json).

[validation.json](validation.json) registra DAG, slots, leases, ownership e vínculos; [context-measurement.json](execution/context-measurement.json) registra bytes, escopo e limites da comparação. Controles de versões anteriores permanecem nos seus SHAs históricos.

Repita `python tools/render_plan.py --check` e `python tools/validate_plan.py`. Esses comandos validam planejamento; não demonstram produto, execução de IA/Atlas/MCP/Relay ou 120 minutos. Guards de repositório são verificados separadamente por SHA. Implementação e provas: NOT_RUN.
