---
name: sf-user-journey-qa-groups-people
description: "Grupo de manutenção SF people: People, IT Operations e riscos. Mudanças em headcount, estrutura, segurança, operações, riscos e performance."
internal: true
when: "Quando o QA solicitar grupo people ou mudança em People, IT Operations e riscos"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# People, IT Operations e riscos

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em headcount, estrutura, segurança, operações, riscos e performance.

**Tamanho:** 19 stories; nenhum roteiro foi executado por esta lista.

**Escopo:** Não inclui homologação total nem promoção de release.

## Ordem sugerida (skill individual por story)

1. **SF-CAP06-P01** · `sf-user-journey-qa-cap-cap06-10-cap06-p01` · CAP06: Entender gap de headcount e a proveniência do dado (P1)
2. **SF-CAP06-N01** · `sf-user-journey-qa-cap-cap06-10-cap06-n01` · CAP06: contraprova — Viewer sem escopo salarial tenta drilldown de custo nominativo (P1)
3. **SF-CAP07-P01** · `sf-user-journey-qa-cap-cap06-10-cap07-p01` · CAP07: Manter o quadro de pessoas sem confundir organograma com autorização Entra (P0)
4. **SF-CAP07-N01** · `sf-user-journey-qa-cap-cap06-10-cap07-n01` · CAP07: contraprova — Ciclo de chefia A→B→A e pessoa com nome homônimo são introduzidos em fixture (P0)
5. **SF-CAP08-P01** · `sf-user-journey-qa-cap-cap06-10-cap08-p01` · CAP08: Conduzir review de talentos mantendo confidencialidade (P0)
6. **SF-CAP08-N01** · `sf-user-journey-qa-cap-cap06-10-cap08-n01` · CAP08: contraprova — Revogar grant de RH após criar export e tentar baixar link anterior (P0)
7. **SF-CAP11-P01** · `sf-user-journey-qa-cap-cap11-15-cap11-p01` · CAP11: Atualizar operação de TI com métricas e tempo coerentes (P1)
8. **SF-CAP11-N01** · `sf-user-journey-qa-cap-cap11-15-cap11-n01` · CAP11: contraprova — Alterar input para 997 ou -0.1% e tentar salvar (P1)
9. **SF-CAP12-P01** · `sf-user-journey-qa-cap-cap11-15-cap12-p01` · CAP12: Interpretar KPIs de segurança sem mascara de dados ausentes (P1)
10. **SF-CAP12-N01** · `sf-user-journey-qa-cap-cap11-15-cap12-n01` · CAP12: contraprova — Fonte do denominador indisponível retorna null em vez de 200 (P1)
11. **SF-CAP13-P01** · `sf-user-journey-qa-cap-cap11-15-cap13-p01` · CAP13: Abrir risco corporativo com plano de mitigação e dependências (P1)
12. **SF-CAP13-N01** · `sf-user-journey-qa-cap-cap11-15-cap13-n01` · CAP13: contraprova — Contribuidor de outro domínio tenta fechar R-07 por deep link (P1)
13. **SF-CAP15-P01** · `sf-user-journey-qa-cap-cap11-15-cap15-p01` · CAP15: Acompanhar stakeholders internos e externos em tópico sensível (P1)
14. **SF-CAP15-N01** · `sf-user-journey-qa-cap-cap11-15-cap15-n01` · CAP15: contraprova — Usuário com acesso ao tema, mas não à nota privada, acessa link direto da nota (P1)
15. **SF-CAP16-P01** · `sf-user-journey-qa-cap-cap16-20-cap16-p01` · CAP16: Medir contrato de desempenho de TI e subitens (P1)
16. **SF-CAP16-N01** · `sf-user-journey-qa-cap-cap16-20-cap16-n01` · CAP16: contraprova — Subitem eliminado enquanto outro usuário revisa uma versão antiga (P1)
17. **SF-E2E-008** · `sf-user-journey-qa-e2e-e2e001-009-008` · Headcount e remuneração sob segregação real (P0)
18. **SF-E2E-009** · `sf-user-journey-qa-e2e-e2e001-009-009` · Risco operacional vira decisão de portfólio (P0)
19. **SF-E2E-010** · `sf-user-journey-qa-e2e-e2e010-018-010` · Incidente de segurança com indicador e dono (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, capture checkpoint privado `storyId`, `attempt`, `deployedSHA`, `installation`, `fixtureRevision`, `actorAliases`, `beforeDigest` e `evidenceRef`. Não reutilize dados de outro grupo sem reconciliação; para mutações, restaure apenas via seed existente autorizado em instalação QA isolada.
3. Ao terminar cada story, grave o resultado no próprio `EVIDENCE-RECORD.json` privado, com `afterDigest`, `receiptRef` ou motivo de bloqueio, e checkpoint `resumableFrom` da próxima story. Ao retomar, valide novamente SHA, instalação, fixture, atores e estado; se mudaram, refaça somente a story afetada, nunca marque PASS reutilizado.
4. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
5. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
