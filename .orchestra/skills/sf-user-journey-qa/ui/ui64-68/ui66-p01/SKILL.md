---
name: sf-user-journey-qa-ui-ui64-68-ui66-p01
description: "QA manutenção SF: executar story SF-UI66-P01 (UI66: Entender e controlar recorrência de uma rotina) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI66-P01 ou o caso específico UI66: Entender e controlar recorrência de uma rotina"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI66-P01"
---
# SF-UI66-P01 — UI66: Entender e controlar recorrência de uma rotina

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI66 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-routines/schedules/:scheduleRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero entender e controlar recorrência de uma rotina para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir schedules e selecionar SCHED-EDI-DAILY
3. Verificar se scheduleDetails.read está realmente disponível
4. Consultar timezone, cron, recipe e última ocorrência
5. Pausar ou editar apenas se port corrente admitir e devolver recibo
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Leitura detalhada mantém timezone explícito
- started do schedule é só admissão, não completion do run
- Produtor indisponível mostra capability/unavailable e bloqueia edição
- Histórico de execução relaciona scheduleRef→runRef
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u34. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
