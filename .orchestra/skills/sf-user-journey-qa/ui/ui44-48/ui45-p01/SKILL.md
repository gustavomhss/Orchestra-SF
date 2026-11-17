---
name: sf-user-journey-qa-ui-ui44-48-ui45-p01
description: "QA manutenção SF: executar story SF-UI45-P01 (UI45: Selecionar BI com fontes autorizadas de múltiplas áreas) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI45-P01 ou o caso específico UI45: Selecionar BI com fontes autorizadas de múltiplas áreas"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI45-P01"
---
# SF-UI45-P01 — UI45: Selecionar BI com fontes autorizadas de múltiplas áreas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI45 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-bi` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BI-EXEC-01 · orçamento, riscos, PR, backlog

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero selecionar BI com fontes autorizadas de múltiplas áreas para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: BI-EXEC-01 · orçamento, riscos, PR, backlog. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir catálogo BI e conferir visões habilitadas por papel
3. Selecionar BI-EXEC-01 para período setembro/2026
4. Conferir cobertura de origem e atualização
5. Abrir drilldown de OPEX
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Catálogo não lista fontes proibidas
- Fonte parcial não é disfarçada de total completo
- Moedas/períodos compatíveis estão rotulados
- Drilldown respeita grants do usuário
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u20, u21, u22. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
