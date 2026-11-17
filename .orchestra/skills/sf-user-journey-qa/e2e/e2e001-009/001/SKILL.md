---
name: sf-user-journey-qa-e2e-e2e001-009-001
description: "QA manutenção SF: executar story SF-E2E-001 (O briefing das 8h: o CIO precisa decidir sem alterar a fonte) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-001 ou o caso específico O briefing das 8h: o CIO precisa decidir sem alterar a fonte"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-001"
---
# SF-E2E-001 — O briefing das 8h: o CIO precisa decidir sem alterar a fonte

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, FINANCE · **Superfícies:** CAP01, CAP02, CAP03, CAP09, CAP13, UI29, UI30, UI47 · **Jornadas:** J01, J02, J05, J06, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Às 08:00, CIO revisa backlog EDI HOT-EDI-07, R-07, forecast USD590000 e pedido PR-32000.

**Resultado de negócio:** Como CIO, com apoio de LEADER, FINANCE, diante da situação descrita, preciso reunir prioridades, orçamento, riscos e encaminhamentos de TI em um briefing confiável, para orientar a reunião das 8h e responsabilizar a pessoa correta por cada pendência.

## Pré-condições específicas

- Às 08:00, CIO revisa backlog EDI HOT-EDI-07, R-07, forecast USD590000 e pedido PR-32000.

## Passos a executar na interface

1. CIO autentica e escolhe instalação correta
2. Abre Hoje e confere autoria e data de cada alerta
3. Abre dashboard e identifica P-004/risco R-07
4. Caio relata atraso de seis dias em Hot Topics
5. Sofie confirma base do forecast sem aprovar mudança
6. CIO cria pauta com data da fonte explícita
7. Salva snapshot e delega ação a Caio
8. CIO volta a Hoje e confirma que item foi encaminhado uma vez

## Oráculos observáveis (não reescrever para passar)

- Contas da pauta mostram forecast 590000, budget 600000, não 0
- Alerta do risco P-004 possui origem auditável
- Caio recebe exatamente uma tarefa com seu principal
- Ação não muda status de PR ou orçamento
- Revisão preserva versão e autor do briefing
- Tópico com mesmo título mas outro ID não aparece por associação de string

## Contraprovas

- Interromper sessão do CIO antes de salvar: sem pauta aplicada
- Simular perda de resposta na delegação: recuperar recibo sem duplicar

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
