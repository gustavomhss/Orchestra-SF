---
name: sf-user-journey-qa-groups-smoke
description: "Grupo de manutenção SF smoke: Smoke P0 — quatro verificações de superfícies, sem full regression. Canário curto de UI/identidade/Planner/Procurement/BI em instalação QA previamente preparada; não inclui impor"
internal: true
when: "Quando o QA solicitar grupo smoke ou mudança em Smoke P0 — quatro verificações de superfícies, sem full regression"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Smoke P0 — quatro verificações de superfícies, sem full regression

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Canário curto de UI/identidade/Planner/Procurement/BI em instalação QA previamente preparada; não inclui import, fault injection, mudança de grants, release ou 70/165.

**Tamanho:** 4 stories; nenhum roteiro foi executado por esta lista.

**Escopo:** Não inclui homologação total nem promoção de release.

## Ordem sugerida (skill individual por story)

1. **SF-UI67-P01** · `sf-user-journey-qa-ui-ui64-68-ui67-p01` · UI67: Autenticar em Microsoft e selecionar contexto corporativo válido (P0)
2. **SF-CAP17-P01** · `sf-user-journey-qa-cap-cap16-20-cap17-p01` · CAP17: Separar versão oficial de hipóteses antes de discutir forecast (P0)
3. **SF-CAP24-P01** · `sf-user-journey-qa-cap-cap21-25-cap24-p01` · CAP24: Diagnosticar fila de Procurement e seus atrasos por etapa (P0)
4. **SF-UI45-P01** · `sf-user-journey-qa-ui-ui44-48-ui45-p01` · UI45: Selecionar BI com fontes autorizadas de múltiplas áreas (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, capture checkpoint privado `storyId`, `attempt`, `deployedSHA`, `installation`, `fixtureRevision`, `actorAliases`, `beforeDigest` e `evidenceRef`. Não reutilize dados de outro grupo sem reconciliação; para mutações, restaure apenas via seed existente autorizado em instalação QA isolada.
3. Ao terminar cada story, grave o resultado no próprio `EVIDENCE-RECORD.json` privado, com `afterDigest`, `receiptRef` ou motivo de bloqueio, e checkpoint `resumableFrom` da próxima story. Ao retomar, valide novamente SHA, instalação, fixture, atores e estado; se mudaram, refaça somente a story afetada, nunca marque PASS reutilizado.
4. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
5. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
