---
name: sf-user-journey-qa-groups-access
description: "Grupo de manutenção SF access: Identidade, autorizações e release. Mudanças em Entra/Graph, grants, tenants, privacidade, rotas, acessibilidade, white-label e promoção."
internal: true
when: "Quando o QA solicitar grupo access ou mudança em Identidade, autorizações e release"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Identidade, autorizações e release

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em Entra/Graph, grants, tenants, privacidade, rotas, acessibilidade, white-label e promoção.

**Tamanho:** 21 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-UI67-P01** · `sf-user-journey-qa-ui-ui64-68-ui67-p01` · UI67: Autenticar em Microsoft e selecionar contexto corporativo válido (P0)
2. **SF-UI67-N01** · `sf-user-journey-qa-ui-ui64-68-ui67-n01` · UI67: contraprova — OIDC assinado de tenant errado, CSRF inválido, nonce ou code replay (P0)
3. **SF-UI69-P01** · `sf-user-journey-qa-ui-ui69-70-ui69-p01` · UI69: Operar ferramentas locais sem assumir identidade Entra (P0)
4. **SF-UI69-N01** · `sf-user-journey-qa-ui-ui69-70-ui69-n01` · UI69: contraprova — Enviar token/local-operator por browser hospedado em Azure (P0)
5. **SF-E2E-013** · `sf-user-journey-qa-e2e-e2e010-018-013` · Revogação deve valer inclusive para documentos já gerados (P0)
6. **SF-E2E-014** · `sf-user-journey-qa-e2e-e2e010-018-014` · Mesmo nome, dois tenants e nenhum vazamento (P0)
7. **SF-E2E-015** · `sf-user-journey-qa-e2e-e2e010-018-015` · Login corporativo sem atalhos na identidade (P0)
8. **SF-E2E-016** · `sf-user-journey-qa-e2e-e2e010-018-016` · O organograma oficial precisa vir do Graph (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
9. **SF-E2E-017** · `sf-user-journey-qa-e2e-e2e010-018-017` · Grupo concede papel; perfil recebe grant independente (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
10. **SF-E2E-018** · `sf-user-journey-qa-e2e-e2e010-018-018` · Nem o administrador pode se autoconceder privilégios (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
11. **SF-E2E-019** · `sf-user-journey-qa-e2e-e2e019-027-019` · Colaborador saiu: as permissões órfãs continuam visíveis (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
12. **SF-E2E-020** · `sf-user-journey-qa-e2e-e2e019-027-020` · Graph indisponível não autoriza uma árvore parcial (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
13. **SF-E2E-021** · `sf-user-journey-qa-e2e-e2e019-027-021` · Dois administradores alteram a mesma política (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
14. **SF-E2E-022** · `sf-user-journey-qa-e2e-e2e019-027-022` · Mudança de grant deve produzir efeito na sessão ativa (P0) · **CONDICIONAL:** PR270_NOT_PROMOTED
15. **SF-E2E-030** · `sf-user-journey-qa-e2e-e2e028-036-030` · O tema Sucafina preserva a arquitetura visual do Orchestra (P1) · **CONDICIONAL:** WHITE_LABEL_RELEASE_FEATURE_UNVERIFIED
16. **SF-E2E-031** · `sf-user-journey-qa-e2e-e2e028-036-031` · Flamengo demonstra fluxo sem inventar autoridade (P0) · **CONDICIONAL:** PR268_DRAFT_NOT_PROMOTED
17. **SF-E2E-034** · `sf-user-journey-qa-e2e-e2e028-036-034` · Todas as telas, papéis e estados: prova transversal de UX (P0)
18. **SF-E2E-036** · `sf-user-journey-qa-e2e-e2e028-036-036` · A URL não pode conceder acesso ao registro (P0)
19. **SF-E2E-039** · `sf-user-journey-qa-e2e-e2e037-045-039` · 403, 422 e 503 têm significados diferentes (P0)
20. **SF-E2E-040** · `sf-user-journey-qa-e2e-e2e037-045-040` · A promoção exige produto, identidade e governança (P0) · **CONDICIONAL:** RELEASE_POLICY_OWNER_APPROVAL
21. **SF-E2E-042** · `sf-user-journey-qa-e2e-e2e037-045-042` · O produto continua operável para teclado, zoom e idiomas (P1)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
