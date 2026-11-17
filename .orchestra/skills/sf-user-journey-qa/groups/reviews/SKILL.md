---
name: sf-user-journey-qa-groups-reviews
description: "Grupo de manutenção SF reviews: Reuniões, snapshots e relatórios. Mudanças em pauta, apresentação, preservação, comparação, DOCX/PPTX e acesso a exportações."
internal: true
when: "Quando o QA solicitar grupo reviews ou mudança em Reuniões, snapshots e relatórios"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Reuniões, snapshots e relatórios

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em pauta, apresentação, preservação, comparação, DOCX/PPTX e acesso a exportações.

**Tamanho:** 16 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-UI47-P01** · `sf-user-journey-qa-ui-ui44-48-ui47-p01` · UI47: Organizar com antecedência reunião global de TI (P0)
2. **SF-UI47-N01** · `sf-user-journey-qa-ui-ui44-48-ui47-n01` · UI47: contraprova — Dois itens de projeto têm nomes idênticos e um item está sem origem (P0)
3. **SF-UI48-P01** · `sf-user-journey-qa-ui-ui44-48-ui48-p01` · UI48: Apresentar revisão histórica com fidelidade mesmo após mudança de dados (P0)
4. **SF-UI48-N01** · `sf-user-journey-qa-ui-ui44-48-ui48-n01` · UI48: contraprova — Sessão de viewer é revogada enquanto apresentação está aberta (P0)
5. **SF-UI49-P01** · `sf-user-journey-qa-ui-ui49-53-ui49-p01` · UI49: Comparar duas revisões sem confundir mudança e ausência (P0)
6. **SF-UI49-N01** · `sf-user-journey-qa-ui-ui49-53-ui49-n01` · UI49: contraprova — Comparar R1 USD setembro com R2 EUR outubro sem FX declarada (P0)
7. **SF-UI50-P01** · `sf-user-journey-qa-ui-ui49-53-ui50-p01` · UI50: Entregar slides e documento que reproduzem revisão auditada (P0)
8. **SF-UI50-N01** · `sf-user-journey-qa-ui-ui49-53-ui50-n01` · UI50: contraprova — Revogar direito de export de um usuário após gerar PDF/DOCX (P0)
9. **SF-E2E-001** · `sf-user-journey-qa-e2e-e2e001-009-001` · O briefing das 8h: o CIO precisa decidir sem alterar a fonte (P0)
10. **SF-E2E-004** · `sf-user-journey-qa-e2e-e2e001-009-004` · Reunião preservada enquanto o sistema continua mudando (P0)
11. **SF-E2E-009** · `sf-user-journey-qa-e2e-e2e001-009-009` · Risco operacional vira decisão de portfólio (P0)
12. **SF-E2E-013** · `sf-user-journey-qa-e2e-e2e010-018-013` · Revogação deve valer inclusive para documentos já gerados (P0)
13. **SF-E2E-024** · `sf-user-journey-qa-e2e-e2e019-027-024` · Relatório demorou: a UI não pode mentir (P0)
14. **SF-E2E-025** · `sf-user-journey-qa-e2e-e2e019-027-025` · 25 projetos, notas longas e apresentação acessível (P0)
15. **SF-E2E-044** · `sf-user-journey-qa-e2e-e2e037-045-044` · A reunião do CIO sob carga e múltiplas consultas (P1)
16. **SF-E2E-045** · `sf-user-journey-qa-e2e-e2e037-045-045` · Auditoria consegue reconstruir a história de uma decisão (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
