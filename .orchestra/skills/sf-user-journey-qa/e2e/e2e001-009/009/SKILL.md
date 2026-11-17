---
name: sf-user-journey-qa-e2e-e2e001-009-009
description: "QA manutenção SF: executar story SF-E2E-009 (Risco operacional vira decisão de portfólio) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-009 ou o caso específico Risco operacional vira decisão de portfólio"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-009"
---
# SF-E2E-009 — Risco operacional vira decisão de portfólio

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** LEADER · **Outros atores:** RISK_OWNER, CIO · **Superfícies:** CAP09, CAP10, CAP13, CAP15, UI47, UI54 · **Jornadas:** J05, J06, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · P-004 tem milestone 15/dez e risco R-07; stakeholder externo exige novo prazo.

**Resultado de negócio:** Como LEADER, com apoio de RISK_OWNER, CIO, diante da situação descrita, preciso ligar atraso do projeto, risco e impacto material a uma decisão humana, para priorizar corretamente e preservar justificativa.

## Pré-condições específicas

- P-004 tem milestone 15/dez e risco R-07; stakeholder externo exige novo prazo.

## Passos a executar na interface

1. Caio atualiza milestone MS-04 com justificativa
2. Risk Owner ajusta mitigação de R-07 sem mudar PR
3. Stakeholder STK-011 recebe registro de comunicação
4. CIO abre portfolio 25 projetos, não os duplica por vínculo
5. CIO prepara pauta incorporando risco e milestone
6. Revisão preserva a versão de ambos
7. CIO encaminha action a Caio
8. Caio confirma ação sem mexer em orçamento

## Oráculos observáveis (não reescrever para passar)

- Milestone, risco e stakeholder mantêm IDs distintos
- Portfólio apresenta 25 projetos uma vez
- Encaminhamento produz uma tarefa, não commit Finance
- Pauta registra data de origem dos registros
- Histórico de alterações é auditável por autor

## Contraprovas

- Alterar risco depois da revisão não muda snapshot antigo
- Reenviar ação após timeout não duplica tarefa

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
