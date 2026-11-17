---
name: sf-user-journey-qa-e2e-e2e019-027-027
description: "QA manutenção SF: executar story SF-E2E-027 (Rotina recorrente cruza fusos e muda de horário) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-027 ou o caso específico Rotina recorrente cruza fusos e muda de horário"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-027"
---
# SF-E2E-027 — Rotina recorrente cruza fusos e muda de horário

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** OPS · **Superfícies:** UI64, UI65, UI66, UI70 · **Jornadas:** J07.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Recorrência 08:00 America/Sao_Paulo e revisão de ocorrência; producer native scheduleDetails.read pode estar indisponível.

**Resultado de negócio:** Como CIO, com apoio de OPS, diante da situação descrita, preciso programar execução, verificar ocorrência real e lidar com DST e indisponibilidade de detalhes, para não confundir agendamento com resultado concluído.

## Pré-condições específicas

- Recorrência 08:00 America/Sao_Paulo e revisão de ocorrência; producer native scheduleDetails.read pode estar indisponível.

## Passos a executar na interface

1. Abrir schedule e confirmar leitura de detalhes
2. Se porta indisponível, registrar BLOCKED em vez de editar às cegas
3. Se disponível, criar schedule para 08:00 America/Sao_Paulo
4. Observar primeira execução realmente disparada
5. Comparar state da ocorrência e state do run
6. Pausar schedule com autorização atual
7. Alterar timezone para UTC e revisar o próximo horário
8. QA confere que duas instâncias não executam mesma ocorrência duas vezes

## Oráculos observáveis (não reescrever para passar)

- Hora da recorrência tem timezone e DST explícitos
- Schedule started não significa run completed
- Pause tem recibo/estado comprovado
- Native scheduler, não HTTP inventado, é usado
- Sem leitura detalhes, edição/destructive change é bloqueada

## Contraprovas

- Perda de resposta no pause não causa duas alterações
- Revisão stale do scheduler exige reload

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
