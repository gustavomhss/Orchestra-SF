# Validação do plano e workflow

**PLAN_STRUCTURE_PASS.** Fonte `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Foram preservados 15 WPs, 74 tasks, 17 contratos, 1.230 axiomas e 380 checks: 1.610 critérios. Scope, contratos, capacidades, jornadas e manifesto residente permanecem preservados.

O renderer confere 100 artefatos e o compilador produz 23 pacotes. Contratos referenciados, handoffs de fase e dependências de rotas MCP são verificados por ator. A validação mantém todas as atribuições, grants, leases, alocações e critérios; a expansão acrescenta contexto de leitura. Os [12 controles negativos](formal-review/round-3/correction-controls.json) rejeitam os defeitos concretos encontrados na revisão e a deriva da identidade de eventos.

[validation.json](validation.json) registra o resultado estrutural. A [medição de contexto](execution/context-measurement.json) informa os arquivos e bytes efetivamente contados. Bytes de documentação não medem tokens ou tempo de execução.

O [guard inicial](formal-review/round-3/initial/guard/receipt.json) pertence exclusivamente a `10a99bf06c5578ec02dab590a680ab18766c7ff4`: 78 regras, 190 paths, zero bloqueios/erros e um aviso advisory de tamanho no canônico já existente. O candidato corrigido requer seu próprio guard e rechecagem.

Repita `python tools/render_plan.py --check` e `python tools/validate_plan.py`. Esses comandos verificam planejamento. Produto, testes de produto, inferência, Actions e provas de runtime permanecem **NOT_RUN**.
