---
name: sf-user-journey-qa-ui-ui64-68-ui65-p01
description: "QA manutenção SF: executar story SF-UI65-P01 (UI65: Acompanhar um run até conclusão verificável e auditável) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI65-P01 ou o caso específico UI65: Acompanhar um run até conclusão verificável e auditável"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI65-P01"
---
# SF-UI65-P01 — UI65: Acompanhar um run até conclusão verificável e auditável

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI65 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-routines/runs/:runRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero acompanhar um run até conclusão verificável e auditável para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir execução RUN-EDI-RISK-01
3. Ler estados queued/running/needs-input/completed ou failed
4. Inspecionar saída, provenance e verifier independente
5. Cancelar quando habilitado e conferir efeito terminal
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- started não equivale a success
- Run final tem schema/output verificados quando complete
- Cancelamento tardio não falseia status
- Nenhuma mutação de domínio resulta de texto de agente
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u27. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
