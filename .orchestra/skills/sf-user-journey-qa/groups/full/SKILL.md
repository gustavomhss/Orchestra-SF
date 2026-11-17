---
name: sf-user-journey-qa-groups-full
description: "Grupo de manutenção SF full: Full UX e promoção formal (owner-only). Somente quando o owner pedir homologação integral 70/165 ou promoção formal após CI/identidade/VM; nunca em sm"
internal: true
when: "Quando o QA solicitar grupo full ou mudança em Full UX e promoção formal (owner-only)"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Full UX e promoção formal (owner-only)

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Somente quando o owner pedir homologação integral 70/165 ou promoção formal após CI/identidade/VM; nunca em smoke ou regressão diária.

**Tamanho:** 2 stories; nenhum roteiro foi executado por esta lista.

**Escopo:** FULL/RELEASE somente por ordem explícita do owner; não é smoke nem regressão cotidiana.

## Ordem sugerida (skill individual por story)

1. **SF-E2E-034** · `sf-user-journey-qa-e2e-e2e028-036-034` · Todas as telas, papéis e estados: prova transversal de UX (P0)
2. **SF-E2E-040** · `sf-user-journey-qa-e2e-e2e037-045-040` · A promoção exige produto, identidade e governança (P0) · **CONDICIONAL:** RELEASE_POLICY_OWNER_APPROVAL

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, capture checkpoint privado `storyId`, `attempt`, `deployedSHA`, `installation`, `fixtureRevision`, `actorAliases`, `beforeDigest` e `evidenceRef`. Não reutilize dados de outro grupo sem reconciliação; para mutações, restaure apenas via seed existente autorizado em instalação QA isolada.
3. Ao terminar cada story, grave o resultado no próprio `EVIDENCE-RECORD.json` privado, com `afterDigest`, `receiptRef` ou motivo de bloqueio, e checkpoint `resumableFrom` da próxima story. Ao retomar, valide novamente SHA, instalação, fixture, atores e estado; se mudaram, refaça somente a story afetada, nunca marque PASS reutilizado.
4. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
5. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
