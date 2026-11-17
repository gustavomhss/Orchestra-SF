---
name: sf-user-journey-qa-groups-finance
description: "Grupo de manutenção SF finance: Finance, Planner e BI. Mudanças em orçamento, forecast, OPEX, CAPEX, versões, FX, dashboards e BI."
internal: true
when: "Quando o QA solicitar grupo finance ou mudança em Finance, Planner e BI"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Finance, Planner e BI

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em orçamento, forecast, OPEX, CAPEX, versões, FX, dashboards e BI.

**Tamanho:** 35 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-CAP01-P01** · `sf-user-journey-qa-cap-cap01-05-cap01-p01` · CAP01: Preparar o briefing executivo sem tomar decisões na leitura (P1)
2. **SF-CAP01-N01** · `sf-user-journey-qa-cap-cap01-05-cap01-n01` · CAP01: contraprova — Nega-se acesso a uma revisão histórica da carteira após revogar a permissão do CIO durante a sessão (P1)
3. **SF-CAP02-P01** · `sf-user-journey-qa-cap-cap01-05-cap02-p01` · CAP02: Registrar e conduzir um assunto crítico que atravessa áreas (P1)
4. **SF-CAP02-N01** · `sf-user-journey-qa-cap-cap01-05-cap02-n01` · CAP02: contraprova — Dois tópicos de mesmo título e owners distintos; encaminhar usando apenas o título (P1)
5. **SF-CAP03-P01** · `sf-user-journey-qa-cap-cap01-05-cap03-p01` · CAP03: Entender orçamento aprovado, consumido e projeção de fim de ano (P0)
6. **SF-CAP03-N01** · `sf-user-journey-qa-cap-cap01-05-cap03-n01` · CAP03: contraprova — Remover FX de EUR e abrir indicador consolidado com linha em EUR (P0)
7. **SF-CAP04-P01** · `sf-user-journey-qa-cap-cap01-05-cap04-p01` · CAP04: Corrigir uma linha OPEX com rastreio de versão (P0)
8. **SF-CAP04-N01** · `sf-user-journey-qa-cap-cap01-05-cap04-n01` · CAP04: contraprova — FINANCE-B edita mesma linha no intervalo e FINANCE-A salva revisão velha (P0)
9. **SF-CAP05-P01** · `sf-user-journey-qa-cap-cap01-05-cap05-p01` · CAP05: Avaliar CAPEX de infraestrutura com approval de mudança explícito (P0)
10. **SF-CAP05-N01** · `sf-user-journey-qa-cap-cap01-05-cap05-n01` · CAP05: contraprova — Tentar editar CAPEX na versão official/locked com role de leitura (P0)
11. **SF-CAP17-P01** · `sf-user-journey-qa-cap-cap16-20-cap17-p01` · CAP17: Separar versão oficial de hipóteses antes de discutir forecast (P0)
12. **SF-CAP17-N01** · `sf-user-journey-qa-cap-cap16-20-cap17-n01` · CAP17: contraprova — Tentar editar valor na versão official bloqueada (P0)
13. **SF-CAP18-P01** · `sf-user-journey-qa-cap-cap16-20-cap18-p01` · CAP18: Projetar renovação SaaS em cenários concorrentes (P0)
14. **SF-CAP18-N01** · `sf-user-journey-qa-cap-cap16-20-cap18-n01` · CAP18: contraprova — Dois usuários alteram mesma linha e período em A (P0)
15. **SF-CAP19-P01** · `sf-user-journey-qa-cap-cap16-20-cap19-p01` · CAP19: Planejar CAPEX por projeto e período sem dupla contabilização (P0)
16. **SF-CAP19-N01** · `sf-user-journey-qa-cap-cap16-20-cap19-n01` · CAP19: contraprova — Inserir segunda linha com mesmo ID e combinação de período (P0)
17. **SF-CAP20-P01** · `sf-user-journey-qa-cap-cap16-20-cap20-p01` · CAP20: Projetar posições por competência sem confundir lotação e custo (P0)
18. **SF-CAP20-N01** · `sf-user-journey-qa-cap-cap16-20-cap20-n01` · CAP20: contraprova — Usuário sem HR tenta acessar custo individual por URL de position edit (P0)
19. **SF-CAP21-P01** · `sf-user-journey-qa-cap-cap21-25-cap21-p01` · CAP21: Alocar custo entre entidades sem ultrapassar 100% (P0)
20. **SF-CAP21-N01** · `sf-user-journey-qa-cap-cap21-25-cap21-n01` · CAP21: contraprova — Alterar splits a 60/50 e tentar aplicar (P0)
21. **SF-CAP22-P01** · `sf-user-journey-qa-cap-cap21-25-cap22-p01` · CAP22: Registrar taxa FX com fonte temporal explicita (P0)
22. **SF-CAP22-N01** · `sf-user-journey-qa-cap-cap21-25-cap22-n01` · CAP22: contraprova — Excluir taxa de EUR e comparar proposta (P0)
23. **SF-CAP23-P01** · `sf-user-journey-qa-cap-cap21-25-cap23-p01` · CAP23: Criar versão hipotética sem destravar baseline publicado (P0)
24. **SF-CAP23-N01** · `sf-user-journey-qa-cap-cap21-25-cap23-n01` · CAP23: contraprova — Contribuidor tenta publicar versão official sem autorização (P0)
25. **SF-UI45-P01** · `sf-user-journey-qa-ui-ui44-48-ui45-p01` · UI45: Selecionar BI com fontes autorizadas de múltiplas áreas (P0)
26. **SF-UI45-N01** · `sf-user-journey-qa-ui-ui44-48-ui45-n01` · UI45: contraprova — Viewer procura visão de talentos que não possui grant (P0)
27. **SF-UI46-P01** · `sf-user-journey-qa-ui-ui44-48-ui46-p01` · UI46: Explicar um número do BI até a linha de origem (P0)
28. **SF-UI46-N01** · `sf-user-journey-qa-ui-ui44-48-ui46-n01` · UI46: contraprova — Linha de origem é revogada após renderização do gráfico (P0)
29. **SF-UI54-P01** · `sf-user-journey-qa-ui-ui54-58-ui54-p01` · UI54: Encaminhar decisão sobre assunto crítico de modo governado (P1)
30. **SF-UI54-N01** · `sf-user-journey-qa-ui-ui54-58-ui54-n01` · UI54: contraprova — Duas confirmações idênticas em abas paralelas (P1)
31. **SF-E2E-002** · `sf-user-journey-qa-e2e-e2e001-009-002` · Duas versões de forecast diante do comitê financeiro (P0)
32. **SF-E2E-007** · `sf-user-journey-qa-e2e-e2e001-009-007` · Drill-down executivo precisa fechar com a fonte (P0)
33. **SF-E2E-012** · `sf-user-journey-qa-e2e-e2e010-018-012` · Duas pessoas editam a mesma linha no Planner (P0)
34. **SF-E2E-038** · `sf-user-journey-qa-e2e-e2e037-045-038` · Fechamento financeiro: hipótese não edita versão oficial (P0)
35. **SF-E2E-032** · `sf-user-journey-qa-e2e-e2e028-036-032` · CTRM, SAP e Fabric não viram features por aparecer no menu (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
