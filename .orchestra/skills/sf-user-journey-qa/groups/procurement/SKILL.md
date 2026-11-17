---
name: sf-user-journey-qa-groups-procurement
description: "Grupo de manutenção SF procurement: Procurement e aprovações. Mudanças em requisições, fornecedores, cotações, sourcing, PO, holders e recibos."
internal: true
when: "Quando o QA solicitar grupo procurement ou mudança em Procurement e aprovações"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Procurement e aprovações

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em requisições, fornecedores, cotações, sourcing, PO, holders e recibos.

**Tamanho:** 19 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-CAP14-P01** · `sf-user-journey-qa-cap-cap11-15-cap14-p01` · CAP14: Ver contrato de fornecedor e a responsabilidade por renovação (P0)
2. **SF-CAP14-N01** · `sf-user-journey-qa-cap-cap11-15-cap14-n01` · CAP14: contraprova — Fornecedor é desativado após contrato entrar em revisão (P0)
3. **SF-CAP24-P01** · `sf-user-journey-qa-cap-cap21-25-cap24-p01` · CAP24: Diagnosticar fila de Procurement e seus atrasos por etapa (P0)
4. **SF-CAP24-N01** · `sf-user-journey-qa-cap-cap21-25-cap24-n01` · CAP24: contraprova — Pedido PR-32000 muda de estágio durante leitura do dashboard (P0)
5. **SF-CAP25-P01** · `sf-user-journey-qa-cap-cap21-25-cap25-p01` · CAP25: Abrir requisição para integração de cargas e acompanhar PR→PO (P0)
6. **SF-CAP25-N01** · `sf-user-journey-qa-cap-cap21-25-cap25-n01` · CAP25: contraprova — Enviar PR com owner divergente ou estágio já alterado (P0)
7. **SF-CAP26-P01** · `sf-user-journey-qa-cap-cap26-28-cap26-p01` · CAP26: Deliberar em fila onde é o holder real (P0)
8. **SF-CAP26-N01** · `sf-user-journey-qa-cap-cap26-28-cap26-n01` · CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta (P0)
9. **SF-CAP27-P01** · `sf-user-journey-qa-cap-cap26-28-cap27-p01` · CAP27: Manter fornecedor apto e protegido para sourcing (P0)
10. **SF-CAP27-N01** · `sf-user-journey-qa-cap-cap26-28-cap27-n01` · CAP27: contraprova — Buyer tenta ler conta bancária via busca/export sem grant específico (P0)
11. **SF-CAP28-P01** · `sf-user-journey-qa-cap-cap26-28-cap28-p01` · CAP28: Ver regras de Procurement sem alterar governança por acidente (P0)
12. **SF-CAP28-N01** · `sf-user-journey-qa-cap-cap26-28-cap28-n01` · CAP28: contraprova — Regular Buyer tenta editar configuração de aprovação (P0)
13. **SF-E2E-003** · `sf-user-journey-qa-e2e-e2e001-009-003` · A cotação mais barata não pode vencer quando é inelegível (P0)
14. **SF-E2E-011** · `sf-user-journey-qa-e2e-e2e010-018-011` · Dados bancários de fornecedor não são dados de comprador (P0)
15. **SF-E2E-031** · `sf-user-journey-qa-e2e-e2e028-036-031` · Flamengo demonstra fluxo sem inventar autoridade (P0) · **CONDICIONAL:** PR268_DRAFT_NOT_PROMOTED
16. **SF-E2E-032** · `sf-user-journey-qa-e2e-e2e028-036-032` · CTRM, SAP e Fabric não viram features por aparecer no menu (P0)
17. **SF-E2E-037** · `sf-user-journey-qa-e2e-e2e037-045-037` · O pedido foi rejeitado e precisa voltar à fila certa (P0)
18. **SF-E2E-039** · `sf-user-journey-qa-e2e-e2e037-045-039` · 403, 422 e 503 têm significados diferentes (P0)
19. **SF-E2E-043** · `sf-user-journey-qa-e2e-e2e037-045-043` · A rede caiu no momento do Apply (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
