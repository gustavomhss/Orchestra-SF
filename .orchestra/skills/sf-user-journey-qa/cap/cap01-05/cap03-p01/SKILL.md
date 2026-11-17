---
name: sf-user-journey-qa-cap-cap01-05-cap03-p01
description: "QA manutenção SF: executar story SF-CAP03-P01 (CAP03: Entender orçamento aprovado, consumido e projeção de fim de) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP03-P01 ou o caso específico CAP03: Entender orçamento aprovado, consumido e projeção de fim d"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP03-P01"
---
# SF-CAP03-P01 — CAP03: Entender orçamento aprovado, consumido e projeção de fim de ano

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP03 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/budget` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero entender orçamento aprovado, consumido e projeção de fim de ano para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Selecionar versão oficial V-2026-OFFICIAL e período anual
3. Abrir Budget Overview e inspecionar budget, actual, forecast e variações
4. Entrar em OPEX e CAPEX conferindo composição e moeda
5. Retornar e comparar com hipótese V-2026-WHATIF-A
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 600000/400000/590000 USD rotulados por medida e período
- Desvio base vs budget é -10000 USD
- Hipótese A 602000 USD não altera versão oficial
- Null, zero e período incompleto recebem tratamento distinto
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u02, u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
