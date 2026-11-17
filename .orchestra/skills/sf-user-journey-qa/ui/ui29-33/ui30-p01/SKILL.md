---
name: sf-user-journey-qa-ui-ui29-33-ui30-p01
description: "QA manutenção SF: executar story SF-UI30-P01 (UI30: Executar trabalho pendente reunido de múltiplos domínios) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI30-P01 ou o caso específico UI30: Executar trabalho pendente reunido de múltiplos domínios"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI30-P01"
---
# SF-UI30-P01 — UI30: Executar trabalho pendente reunido de múltiplos domínios

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI30 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero executar trabalho pendente reunido de múltiplos domínios para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Meu trabalho com filtros “meu/pendente”
3. **[UI_ACTION]** Entrar em tarefa HOT-EDI-07 atribuída a Caio
4. **[UI_ACTION]** Revisar escopo e confirmar somente ação autorizada
5. **[READ_ONLY_WITNESS]** Voltar à lista e conferir alteração de estado e posição
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- A lista não duplica tarefa por múltiplas relações
- Confirmação não muda valor de Planner
- Owner e período permanecem no retorno
- Tarefa de Gabriel não é apresentada como tarefa de Caio
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u41. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
