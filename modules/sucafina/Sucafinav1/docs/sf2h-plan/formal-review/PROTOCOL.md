# Protocolo da revisão formal

## Missão

Tentar refutar a coerência e a executabilidade do plano completo, inclusive o adendo, usando um único snapshot fixado. Não implementar, não alterar critérios e não simular provas de produto. Sem quota de achados: registrar somente problemas demonstráveis.

## Independência

Três revisores novos recebem a intenção do usuário, o snapshot e seu foco. Cada um lê o material primário e entrega o parecer antes de receber o resultado dos demais. Pareceres históricos não substituem evidência; não usá-los como conclusão pronta. Só escrever no arquivo de relatório atribuído.

## Severidade

- P0: contradição crítica ou caminho que permite violar um invariante essencial/aceitar uma entrega inválida.
- P1: lacuna obrigatória de escopo, contrato, ownership, integração, dependência, recurso ou prova que impede considerar o plano pronto para execução integral.
- P2: melhoria relevante de precisão ou qualidade que não impede iniciar o plano.

A implementação ainda não existir é esperado. Um achado precisa demonstrar por que o PLANO não orienta ou verifica essa implementação corretamente. A meta de 120 minutos já é condicionada; apontar gargalos concretos, não apenas dizer que parece difícil.

## Registro de achado

ID; severidade; requisito/axioma atingido; path e seção/símbolo; evidência exata; cenário que refuta o plano; consequência; correção verificável; dono sugerido; bloqueia execução?; confiança e incerteza material.

## Cinco famílias de axiomas da revisão

**DoD:** parecer no SHA fixado, áreas examinadas, achados reproduzíveis e veredicto explícito.

**Invariants:** não retirar escopo, conceder autoridade, inventar execução ou reinterpretar falha como sucesso; não editar o plano para fazê-lo passar durante o julgamento.

**Quality standards:** evidência primária, raciocínio verificável, severidade proporcional, correção concreta e ausência de achados duplicados apresentados como vários problemas.

**Completeness criteria:** cobrir a especialidade atribuída e suas bordas com as outras frentes; examinar estados de falha e o caminho real do produtor ao consumidor; considerar todo o adendo de agentes/skills/MCP/Atlas.

**Success criteria:** o integrador consegue reproduzir cada problema e saber qual mudança permite fechá-lo. Se não houver bloqueios demonstráveis, o revisor pode aprovar com limites explícitos.

## Resultado

JSON e Markdown por revisor. Campos mínimos: review_id, reviewer, reviewed_commit, focus, examined_paths, verdict, findings, residual_uncertainties e implementation_test_status=NOT_RUN. As correções e rechecagens pertencem a uma rodada identificada; uma decisão do integrador não apaga o parecer original.
