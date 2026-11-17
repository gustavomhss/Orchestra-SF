---
name: sf-user-journey-qa-e2e-e2e010-018-010
description: "QA manutenção SF: executar story SF-E2E-010 (Incidente de segurança com indicador e dono) pela UI; ator SECURITY, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-010 ou o caso específico Incidente de segurança com indicador e dono"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-010"
---
# SF-E2E-010 — Incidente de segurança com indicador e dono

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** SECURITY · **Outros atores:** OPS, CIO · **Superfícies:** CAP11, CAP12, CAP13, CAP16, UI61, UI47 · **Jornadas:** J06, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Uptime 99.7% vs 99.9% SLA, 3 incidentes e 4 de 200 endpoints sem patch.

**Resultado de negócio:** Como SECURITY, com apoio de OPS, CIO, diante da situação descrita, preciso levar um incidente realista de TI até métricas, risco e escalonamento de gestão, para garantir resposta tempestiva sem inflar ou esconder métricas.

## Pré-condições específicas

- Uptime 99.7% vs 99.9% SLA, 3 incidentes e 4 de 200 endpoints sem patch.

## Passos a executar na interface

1. Operações confirma downtime em setembro
2. Segurança valida 4 endpoints críticos sem patch
3. Risco R-07 recebe mitigação e autoridade própria
4. Finance/exec vê resultado agregado, não credenciais
5. Signals identifica materialidade acima do limiar
6. CIO inclui incidente na pauta da reunião
7. Auditor verifica numeradores e denominadores
8. QA marca 0 breaches com base conhecida, não missing

## Oráculos observáveis (não reescrever para passar)

- Taxa de não conformidade = 2% se denominador=200
- Meta 99.9 e real 99.7 permanecem distinguíveis
- Incidentes e riscos associados não são fundidos em um registro
- Missing não é apresentado como 0 breaches
- A pauta não altera estado de incidente

## Contraprovas

- Fazer denominador null: taxa indeterminada
- Viewer sem grant tenta acessar relatório nominativo de incidente: negado

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
