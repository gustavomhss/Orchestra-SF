---
name: sf-user-journey-qa-ui-ui49-53-ui53-p01
description: "QA manutenção SF: executar story SF-UI53-P01 (UI53: Confirmar que revisão foi feita sem falsificar mudança) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI53-P01 ou o caso específico UI53: Confirmar que revisão foi feita sem falsificar mudança"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI53-P01"
---
# SF-UI53-P01 — UI53: Confirmar que revisão foi feita sem falsificar mudança

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI53 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work/confirmations/:selectionRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CONFIRM-EDI-01 · TASK-023 · versão observada v3

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero confirmar que revisão foi feita sem falsificar mudança para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CONFIRM-EDI-01 · TASK-023 · versão observada v3. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir confirmação de seleção TASK-023
3. Ler versão v3 da fonte antes de confirmar
4. Escolher “sem alteração” com justificativa
5. Reabrir fila e verificar registro de confirmação
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Confirmação grava versão realmente vista
- Não altera valores financeiros
- Tarefa não reaparece sem mudança material
- Outra competência permanece independente
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u44. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
