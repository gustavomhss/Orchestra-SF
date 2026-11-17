---
name: sf-user-journey-qa-cap-cap16-20-cap17-p01
description: "QA manutenção SF: executar story SF-CAP17-P01 (CAP17: Separar versão oficial de hipóteses antes de discutir forec) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP17-P01 ou o caso específico CAP17: Separar versão oficial de hipóteses antes de discutir fore"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP17-P01"
---
# SF-CAP17-P01 — CAP17: Separar versão oficial de hipóteses antes de discutir forecast

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP17 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/overview` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** V-2026-OFFICIAL locked · V-2026-WHATIF-A e B

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero separar versão oficial de hipóteses antes de discutir forecast para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: V-2026-OFFICIAL locked · V-2026-WHATIF-A e B. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Planner Overview com competência anual
3. **[READ_ONLY_WITNESS]** Selecionar versão oficial e anotar valores da linha OPEX-LIC-01
4. **[UI_ACTION]** Alternar para hipóteses A e B
5. **[READ_ONLY_WITNESS]** Comparar total e estado de lock sem executar publish
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Official continua 590000 USD
- What-if A/B exibem 602000/596000 USD
- Legendas impedem confundir cenários com números aprovados
- A seleção de versão acompanha navegação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u06. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
