---
name: sf-user-journey-qa-groups-smoke
description: "Grupo de manutenção SF smoke: Smoke P0 — oito decisões críticas. Validar a espinha dorsal após mudanças pequenas ou antes de uma demo. Não equivale ao release completo."
internal: true
when: "Quando o QA solicitar grupo smoke ou mudança em Smoke P0 — oito decisões críticas"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Smoke P0 — oito decisões críticas

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Validar a espinha dorsal após mudanças pequenas ou antes de uma demo. Não equivale ao release completo.

**Tamanho:** 8 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-E2E-001** · `sf-user-journey-qa-e2e-e2e001-009-001` · O briefing das 8h: o CIO precisa decidir sem alterar a fonte (P0)
2. **SF-E2E-002** · `sf-user-journey-qa-e2e-e2e001-009-002` · Duas versões de forecast diante do comitê financeiro (P0)
3. **SF-E2E-003** · `sf-user-journey-qa-e2e-e2e001-009-003` · A cotação mais barata não pode vencer quando é inelegível (P0)
4. **SF-E2E-005** · `sf-user-journey-qa-e2e-e2e001-009-005` · A importação foi aplicada, mas a confirmação não chegou (P0)
5. **SF-E2E-013** · `sf-user-journey-qa-e2e-e2e010-018-013` · Revogação deve valer inclusive para documentos já gerados (P0)
6. **SF-E2E-015** · `sf-user-journey-qa-e2e-e2e010-018-015` · Login corporativo sem atalhos na identidade (P0)
7. **SF-E2E-026** · `sf-user-journey-qa-e2e-e2e019-027-026` · Agente nativo produz parecer, não aprovação automática (P0)
8. **SF-E2E-034** · `sf-user-journey-qa-e2e-e2e028-036-034` · Todas as telas, papéis e estados: prova transversal de UX (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
