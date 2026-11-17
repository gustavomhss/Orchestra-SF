---
name: sf-user-journey-qa-ui-ui54-58-ui54-p01
description: "QA manutenção SF: executar story SF-UI54-P01 (UI54: Encaminhar decisão sobre assunto crítico de modo governado) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI54-P01 ou o caso específico UI54: Encaminhar decisão sobre assunto crítico de modo governado"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI54-P01"
---
# SF-UI54-P01 — UI54: Encaminhar decisão sobre assunto crítico de modo governado

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI54 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PROPOSAL-EDI-07 · HOT-EDI-07 · LEADER Caio

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero encaminhar decisão sobre assunto crítico de modo governado para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PROPOSAL-EDI-07 · HOT-EDI-07 · LEADER Caio. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir proposta vinculada a HOT-EDI-07
3. **[READ_ONLY_WITNESS]** Inspecionar mudança preparada, responsável e origem
4. **[UI_ACTION]** Confirmar encaminhamento para Caio
5. **[UI_ACTION]** Consultar receipt e Meu trabalho do destinatário
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- A proposta tem ID e versão de origem
- Exatamente uma ação é aberta para Caio
- Efeito não aprova compra nem edita Planner
- Retry retorna recibo da aplicação original
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u38. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
