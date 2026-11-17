---
name: sf-user-journey-qa-groups-work
description: "Grupo de manutenção SF work: Home, trabalho e memória. Mudanças em busca, Meu trabalho, views, relações, threads, sinais e casos semelhantes."
internal: true
when: "Quando o QA solicitar grupo work ou mudança em Home, trabalho e memória"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Home, trabalho e memória

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em busca, Meu trabalho, views, relações, threads, sinais e casos semelhantes.

**Tamanho:** 29 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-UI29-P01** · `sf-user-journey-qa-ui-ui29-33-ui29-p01` · UI29: Começar o dia com prioridades e contexto reais (P1)
2. **SF-UI29-N01** · `sf-user-journey-qa-ui-ui29-33-ui29-n01` · UI29: contraprova — Viewer abre link privado compartilhado da Home de um executivo (P1)
3. **SF-UI30-P01** · `sf-user-journey-qa-ui-ui29-33-ui30-p01` · UI30: Executar trabalho pendente reunido de múltiplos domínios (P1)
4. **SF-UI30-N01** · `sf-user-journey-qa-ui-ui29-33-ui30-n01` · UI30: contraprova — Trocar conta/tenant enquanto Meu trabalho está aberto (P1)
5. **SF-UI31-P01** · `sf-user-journey-qa-ui-ui29-33-ui31-p01` · UI31: Encontrar evidências autorizadas sem indexar segredos no endereço (P1)
6. **SF-UI31-N01** · `sf-user-journey-qa-ui-ui29-33-ui31-n01` · UI31: contraprova — Tentar GET com search terms na query URL em vez de POST JSON (P1)
7. **SF-UI32-P01** · `sf-user-journey-qa-ui-ui29-33-ui32-p01` · UI32: Salvar visão operacional e retomá-la quando V2 estiver disponível (P1)
8. **SF-UI32-N01** · `sf-user-journey-qa-ui-ui29-33-ui32-n01` · UI32: contraprova — Acessar viewId pertencente a outro usuário mesmo se rota estiver registrada (P1)
9. **SF-UI51-P01** · `sf-user-journey-qa-ui-ui49-53-ui51-p01` · UI51: Ligar registros de áreas sem supor equivalência por título (P1)
10. **SF-UI51-N01** · `sf-user-journey-qa-ui-ui49-53-ui51-n01` · UI51: contraprova — Usar string de título “EDI Santos” em vez de ref canônico (P1)
11. **SF-UI52-P01** · `sf-user-journey-qa-ui-ui49-53-ui52-p01` · UI52: Registrar discussão sobre bloqueio técnico sem aprovar orçamento (P1)
12. **SF-UI52-N01** · `sf-user-journey-qa-ui-ui49-53-ui52-n01` · UI52: contraprova — Comentário contém link para documento revogado (P1)
13. **SF-UI53-P01** · `sf-user-journey-qa-ui-ui49-53-ui53-p01` · UI53: Confirmar que revisão foi feita sem falsificar mudança (P1)
14. **SF-UI53-N01** · `sf-user-journey-qa-ui-ui49-53-ui53-n01` · UI53: contraprova — Terceiro modifica TASK-023 para v4 antes de confirmação v3 (P1)
15. **SF-UI61-P01** · `sf-user-journey-qa-ui-ui59-63-ui61-p01` · UI61: Identificar sinal relevante e descartar falso positivo (P1)
16. **SF-UI61-N01** · `sf-user-journey-qa-ui-ui59-63-ui61-n01` · UI61: contraprova — Limiar ausente e sinal com unidade diferente (P1)
17. **SF-UI62-P01** · `sf-user-journey-qa-ui-ui59-63-ui62-p01` · UI62: Encontrar casos anteriores semelhantes sem vazar dados (P0)
18. **SF-UI62-N01** · `sf-user-journey-qa-ui-ui59-63-ui62-n01` · UI62: contraprova — Caso de outro tenant com título muito semelhante (P0)
19. **SF-UI63-P01** · `sf-user-journey-qa-ui-ui59-63-ui63-p01` · UI63: Comparar resultado observado com previsão e aprender sem reescrever história (P1)
20. **SF-UI63-N01** · `sf-user-journey-qa-ui-ui59-63-ui63-n01` · UI63: contraprova — Observed ainda não publicado ou não confiável (P1)
21. **SF-UI67-P01** · `sf-user-journey-qa-ui-ui64-68-ui67-p01` · UI67: Autenticar em Microsoft e selecionar contexto corporativo válido (P0)
22. **SF-UI67-N01** · `sf-user-journey-qa-ui-ui64-68-ui67-n01` · UI67: contraprova — OIDC assinado de tenant errado, CSRF inválido, nonce ou code replay (P0)
23. **SF-UI69-P01** · `sf-user-journey-qa-ui-ui69-70-ui69-p01` · UI69: Operar ferramentas locais sem assumir identidade Entra (P0)
24. **SF-UI69-N01** · `sf-user-journey-qa-ui-ui69-70-ui69-n01` · UI69: contraprova — Enviar token/local-operator por browser hospedado em Azure (P0)
25. **SF-E2E-001** · `sf-user-journey-qa-e2e-e2e001-009-001` · O briefing das 8h: o CIO precisa decidir sem alterar a fonte (P0)
26. **SF-E2E-028** · `sf-user-journey-qa-e2e-e2e028-036-028` · Busca precisa preservar privacidade e proveniência (P0)
27. **SF-E2E-029** · `sf-user-journey-qa-e2e-e2e028-036-029` · Visão salva só existe quando a capacidade V2 está disponível (P1)
28. **SF-E2E-036** · `sf-user-journey-qa-e2e-e2e028-036-036` · A URL não pode conceder acesso ao registro (P0)
29. **SF-E2E-041** · `sf-user-journey-qa-e2e-e2e037-045-041` · Instalação vazia não inventa dashboard completo (P1)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
