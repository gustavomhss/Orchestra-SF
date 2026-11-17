---
name: sf-user-journey-qa-ui-ui69-70-ui70-p01
description: "QA manutenção SF: executar story SF-UI70-P01 (UI70: Observar contribuição de residentes sem imaginar autonomia i) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI70-P01 ou o caso específico UI70: Observar contribuição de residentes sem imaginar autonomia "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI70-P01"
---
# SF-UI70-P01 — UI70: Observar contribuição de residentes sem imaginar autonomia irrestrita

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI70 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-routines/residents` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** RES-EDI-01 · agente residente de riscos · último run R-014

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero observar contribuição de residentes sem imaginar autonomia irrestrita para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: RES-EDI-01 · agente residente de riscos · último run R-014. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Residents e conferir versão da receita e owner
3. Inspecionar último run R-014 com fonte e hora
4. Comparar contribution e decisão humana do CASE-EDI-01
5. Suspender ou rever apenas capability admitida
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Estado do residente se baseia em execução real
- Contribuição não altera PR, Planner ou approval
- Output tem provenance e verificador quando aplicável
- Cancelamento/disable não inventa run completion
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u35. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
