---
name: sf-user-journey-qa-ui-ui39-43-ui43-p01
description: "QA manutenção SF: executar story SF-UI43-P01 (UI43: Consultar resultado preservado e comparar campanhas) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI43-P01 ou o caso específico UI43: Consultar resultado preservado e comparar campanhas"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI43-P01"
---
# SF-UI43-P01 — UI43: Consultar resultado preservado e comparar campanhas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI43 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SCN-PORT-01/R-001 · conjunto P-004/P-009

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero consultar resultado preservado e comparar campanhas para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SCN-PORT-01/R-001 · conjunto P-004/P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir resultado R-001 de SCN-PORT-01
3. Examinar composição, pesos, elegibilidade e data de origem
4. Alterar origem em outro contexto e voltar
5. Comparar com nova execução sem sobrescrever R-001
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Resultado R-001 é preservado e versionado
- Mudança da fonte não altera snapshot antigo
- Resultados incompatíveis são sinalizados
- Origem não é reclassificada como oficial
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u19. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
