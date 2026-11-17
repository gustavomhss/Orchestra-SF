---
name: sf-user-journey-qa-groups-decisions
description: "Grupo de manutenção SF decisions: Decisões e portfólio. Mudanças em decisões, comparação, sensibilidade, projetos e aplicações governadas."
internal: true
when: "Quando o QA solicitar grupo decisions ou mudança em Decisões e portfólio"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Decisões e portfólio

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em decisões, comparação, sensibilidade, projetos e aplicações governadas.

**Tamanho:** 33 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-CAP09-P01** · `sf-user-journey-qa-cap-cap06-10-cap09-p01` · CAP09: Monitorar portfólio com projetos em diferentes estágios (P1)
2. **SF-CAP09-N01** · `sf-user-journey-qa-cap-cap06-10-cap09-n01` · CAP09: contraprova — Dois projetos têm nomes iguais, IDs P-004/P-023 (P1)
3. **SF-CAP10-P01** · `sf-user-journey-qa-cap-cap06-10-cap10-p01` · CAP10: Gerenciar execução de projeto e milestones verificáveis (P1)
4. **SF-CAP10-N01** · `sf-user-journey-qa-cap-cap06-10-cap10-n01` · CAP10: contraprova — Enviar duas vezes a criação do mesmo milestone após perder resposta de rede (P1)
5. **SF-UI33-P01** · `sf-user-journey-qa-ui-ui29-33-ui33-p01` · UI33: Abrir caso de decisão que cite fatos e alternativas (P0)
6. **SF-UI33-N01** · `sf-user-journey-qa-ui-ui29-33-ui33-n01` · UI33: contraprova — Criar caso com referência de outra instalação (P0)
7. **SF-UI34-P01** · `sf-user-journey-qa-ui-ui34-38-ui34-p01` · UI34: Ver escopo, intenção e fontes antes de escolher (P0)
8. **SF-UI34-N01** · `sf-user-journey-qa-ui-ui34-38-ui34-n01` · UI34: contraprova — Fonte PR-32000 é revogada entre abrir e atualizar o case (P0)
9. **SF-UI35-P01** · `sf-user-journey-qa-ui-ui34-38-ui35-p01` · UI35: Comparar alternativas com custo elegibilidade e FX conhecido (P0)
10. **SF-UI35-N01** · `sf-user-journey-qa-ui-ui34-38-ui35-n01` · UI35: contraprova — FX do período deixa de existir antes da comparação (P0)
11. **SF-UI36-P01** · `sf-user-journey-qa-ui-ui34-38-ui36-p01` · UI36: Registrar premissas e divergências sem inventar consenso (P0)
12. **SF-UI36-N01** · `sf-user-journey-qa-ui-ui34-38-ui36-n01` · UI36: contraprova — Buyer edita premissa reservada à área Finance (P0)
13. **SF-UI37-P01** · `sf-user-journey-qa-ui-ui34-38-ui37-p01` · UI37: Encaminhar pergunta a responsável sem virar aprovador (P1)
14. **SF-UI37-N01** · `sf-user-journey-qa-ui-ui34-38-ui37-n01` · UI37: contraprova — Enviar pergunta a homônimo Sofie de outro owner (P1)
15. **SF-UI38-P01** · `sf-user-journey-qa-ui-ui34-38-ui38-p01` · UI38: Registrar escolha humana consciente sem executar aplicação (P0)
16. **SF-UI38-N01** · `sf-user-journey-qa-ui-ui34-38-ui38-n01` · UI38: contraprova — Alternativa muda de elegibilidade após escolha (P0)
17. **SF-UI39-P01** · `sf-user-journey-qa-ui-ui39-43-ui39-p01` · UI39: Aplicar somente mudança preparada com dupla checagem (P0)
18. **SF-UI39-N01** · `sf-user-journey-qa-ui-ui39-43-ui39-n01` · UI39: contraprova — Enviar mesma confirmação em paralelo após timeout de resposta (P0)
19. **SF-UI40-P01** · `sf-user-journey-qa-ui-ui39-43-ui40-p01` · UI40: Verificar qual mudança foi de fato persistida (P0)
20. **SF-UI40-N01** · `sf-user-journey-qa-ui-ui39-43-ui40-n01` · UI40: contraprova — Attempt existe mas resposta foi perdida após commit (P0)
21. **SF-UI41-P01** · `sf-user-journey-qa-ui-ui39-43-ui41-p01` · UI41: Acompanhar análise assíncrona sem tomá-la por decisão aprovada (P1)
22. **SF-UI41-N01** · `sf-user-journey-qa-ui-ui39-43-ui41-n01` · UI41: contraprova — Modelo devolve JSON fora do schema ou usa fonte fora do scope (P1)
23. **SF-UI42-P01** · `sf-user-journey-qa-ui-ui39-43-ui42-p01` · UI42: Avaliar combinações de projetos com restrições financeiras (P1)
24. **SF-UI42-N01** · `sf-user-journey-qa-ui-ui39-43-ui42-n01` · UI42: contraprova — Candidato sem CAPEX conhecido é tratado como custo zero (P1)
25. **SF-UI43-P01** · `sf-user-journey-qa-ui-ui39-43-ui43-p01` · UI43: Consultar resultado preservado e comparar campanhas (P1)
26. **SF-UI43-N01** · `sf-user-journey-qa-ui-ui39-43-ui43-n01` · UI43: contraprova — Remover acesso a P-009 após criação do resultado (P1)
27. **SF-UI44-P01** · `sf-user-journey-qa-ui-ui44-48-ui44-p01` · UI44: Medir sensibilidade sem apresentar certeza artificial (P1)
28. **SF-UI44-N01** · `sf-user-journey-qa-ui-ui44-48-ui44-n01` · UI44: contraprova — Entrada usa taxa -1, NaN ou unidade percentual misturada (P1)
29. **SF-E2E-006** · `sf-user-journey-qa-e2e-e2e001-009-006` · O documento diz 6 dias; a extração sugere 60 (P0)
30. **SF-E2E-009** · `sf-user-journey-qa-e2e-e2e001-009-009` · Risco operacional vira decisão de portfólio (P0)
31. **SF-E2E-026** · `sf-user-journey-qa-e2e-e2e019-027-026` · Agente nativo produz parecer, não aprovação automática (P0)
32. **SF-E2E-032** · `sf-user-journey-qa-e2e-e2e028-036-032` · CTRM, SAP e Fabric não viram features por aparecer no menu (P0)
33. **SF-E2E-045** · `sf-user-journey-qa-e2e-e2e037-045-045` · Auditoria consegue reconstruir a história de uma decisão (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
