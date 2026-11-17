---
name: sf-user-journey-qa-groups-routines
description: "Grupo de manutenção SF routines: Agentes, residentes e agendas. Mudanças em análise assíncrona, admissão de agentes, rotinas, agendamento e recorrência."
internal: true
when: "Quando o QA solicitar grupo routines ou mudança em Agentes, residentes e agendas"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Agentes, residentes e agendas

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em análise assíncrona, admissão de agentes, rotinas, agendamento e recorrência.

**Tamanho:** 11 stories; nenhum roteiro foi executado por esta lista.

**Escopo:** Não inclui homologação total nem promoção de release.

## Ordem sugerida (skill individual por story)

1. **SF-UI64-P01** · `sf-user-journey-qa-ui-ui64-68-ui64-p01` · UI64: Selecionar rotina verificável antes de delegar análise (P0)
2. **SF-UI64-N01** · `sf-user-journey-qa-ui-ui64-68-ui64-n01` · UI64: contraprova — Trocar digest da recipe entre preview e run (P0)
3. **SF-UI65-P01** · `sf-user-journey-qa-ui-ui64-68-ui65-p01` · UI65: Acompanhar um run até conclusão verificável e auditável (P0)
4. **SF-UI65-N01** · `sf-user-journey-qa-ui-ui64-68-ui65-n01` · UI65: contraprova — Provider responde output incompleto e run acaba failed (P0)
5. **SF-UI66-P01** · `sf-user-journey-qa-ui-ui64-68-ui66-p01` · UI66: Entender e controlar recorrência de uma rotina (P0)
6. **SF-UI66-N01** · `sf-user-journey-qa-ui-ui64-68-ui66-n01` · UI66: contraprova — Port do scheduler não suporta leitura de detalhes atuais (P0)
7. **SF-UI70-P01** · `sf-user-journey-qa-ui-ui69-70-ui70-p01` · UI70: Observar contribuição de residentes sem imaginar autonomia irrestrita (P1)
8. **SF-UI70-N01** · `sf-user-journey-qa-ui-ui69-70-ui70-n01` · UI70: contraprova — Residente falhou mas UI preserva badge completed anterior (P1)
9. **SF-E2E-026** · `sf-user-journey-qa-e2e-e2e019-027-026` · Agente nativo produz parecer, não aprovação automática (P0)
10. **SF-E2E-027** · `sf-user-journey-qa-e2e-e2e019-027-027` · Rotina recorrente cruza fusos e muda de horário (P0)
11. **SF-E2E-035** · `sf-user-journey-qa-e2e-e2e028-036-035` · Sessões, contexto e agentes da plataforma Orchestra (P1) · **CONDICIONAL:** PLATFORM_CAPABILITY_DEPENDENT

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, capture checkpoint privado `storyId`, `attempt`, `deployedSHA`, `installation`, `fixtureRevision`, `actorAliases`, `beforeDigest` e `evidenceRef`. Não reutilize dados de outro grupo sem reconciliação; para mutações, restaure apenas via seed existente autorizado em instalação QA isolada.
3. Ao terminar cada story, grave o resultado no próprio `EVIDENCE-RECORD.json` privado, com `afterDigest`, `receiptRef` ou motivo de bloqueio, e checkpoint `resumableFrom` da próxima story. Ao retomar, valide novamente SHA, instalação, fixture, atores e estado; se mudaram, refaça somente a story afetada, nunca marque PASS reutilizado.
4. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
5. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
