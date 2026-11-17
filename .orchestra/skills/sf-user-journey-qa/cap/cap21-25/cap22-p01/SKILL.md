---
name: sf-user-journey-qa-cap-cap21-25-cap22-p01
description: "QA manutenção SF: executar story SF-CAP22-P01 (CAP22: Registrar taxa FX com fonte temporal explicita) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP22-P01 ou o caso específico CAP22: Registrar taxa FX com fonte temporal explicita"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP22-P01"
---
# SF-CAP22-P01 — CAP22: Registrar taxa FX com fonte temporal explicita

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP22 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/fx` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero registrar taxa FX com fonte temporal explicita para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir FX rates e selecionar competência setembro/2026
3. Consultar par EUR/USD e proveniência
4. Adicionar/editar taxa 1.08 em hipótese, se policy permitir
5. Comparar cotações de EUR 28000 de Procurement
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 28000 EUR × 1.08 = 30240 USD quando fonte compatível
- Cotação e competência visíveis
- Taxa não altera cálculo histórico congelado sem revisão
- Ausência de taxa permanece missing
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u45. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
