---
name: sf-user-journey-qa-ui-ui64-68-ui64-p01
description: "QA manutenção SF: executar story SF-UI64-P01 (UI64: Selecionar rotina verificável antes de delegar análise) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI64-P01 ou o caso específico UI64: Selecionar rotina verificável antes de delegar análise"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI64-P01"
---
# SF-UI64-P01 — UI64: Selecionar rotina verificável antes de delegar análise

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI64 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-routines` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** ROUTINE-EDI-RISK-v1 · escopo P-004 e R-07

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero selecionar rotina verificável antes de delegar análise para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: ROUTINE-EDI-RISK-v1 · escopo P-004 e R-07. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir catálogo de rotinas e escolher recipe publicada
3. **[READ_ONLY_WITNESS]** Conferir digest, owner, escopo, custo/modelo e permissões
4. **[READ_ONLY_WITNESS]** Preparar input com fontes autorizadas e conferir preview
5. **[UI_ACTION]** Admitir execução uma vez
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- A receita usa versão/digest fixados
- Admissão devolve runRef e state real
- Ausência de modelo/skill fica unavailable, não inventa resultado
- Rotina não tem poderes sobre mutações financeiras sem confirmação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u27. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
