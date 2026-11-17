---
name: sf-user-journey-qa-ui-ui44-48-ui46-p01
description: "QA manutenção SF: executar story SF-UI46-P01 (UI46: Explicar um número do BI até a linha de origem) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI46-P01 ou o caso específico UI46: Explicar um número do BI até a linha de origem"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI46-P01"
---
# SF-UI46-P01 — UI46: Explicar um número do BI até a linha de origem

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI46 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-bi/:viewId` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BI-OPEX-01 · USD590000; linha OPEX-LIC-01

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero explicar um número do BI até a linha de origem para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: BI-OPEX-01 · USD590000; linha OPEX-LIC-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir visual BI-OPEX-01
3. Clicar no delta da licença e rastrear até linha OPEX
4. Comparar com versão what-if e conferir query/updatedAt
5. Voltar ao BI sem perder competência e versão
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 590000 e deltas reconciliam com Planner
- Drilldown traz sourceRef/version/period
- Revisão por ator conserva filtros
- Nenhuma transformação oculta missing como zero
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u20, u21, u22. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
