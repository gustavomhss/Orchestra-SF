---
name: sf-user-journey-qa-ui-ui29-33-ui32-p01
description: "QA manutenção SF: executar story SF-UI32-P01 (UI32: Salvar visão operacional e retomá-la quando V2 estiver dispo) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI32-P01 ou o caso específico UI32: Salvar visão operacional e retomá-la quando V2 estiver disp"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI32-P01"
---
# SF-UI32-P01 — UI32: Salvar visão operacional e retomá-la quando V2 estiver disponível

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI32 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work/views/:viewId` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** VIEW-EDI-Caio · filtros IT-BR e pendente

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero salvar visão operacional e retomá-la quando V2 estiver disponível para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: VIEW-EDI-Caio · filtros IT-BR e pendente. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[READ_ONLY_WITNESS]** Inspecionar se o produtor Saved Views V2 está instalado
3. **[UI_ACTION]** Se disponível, salvar VIEW-EDI-Caio e retornar em nova sessão
4. **[CONTROLLED_FAULT]** Se indisponível, registrar estado de capability/unavailable sem forçar ação — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
5. **[UI_ACTION]** Confirmar que a visão legada não foi vendida como V2
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Teste tem duas saídas condicionais documentadas pelo release contract
- V2 instalada restaura owner/filtros e não revela dados revogados
- V2 não instalada é registrada como GAP funcional, não PASS
- Nenhum fallback silencioso inventa operação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u43. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
