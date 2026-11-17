---
name: sf-user-journey-qa-cap-cap06-10-cap09-p01
description: "QA manutenção SF: executar story SF-CAP09-P01 (CAP09: Monitorar portfólio com projetos em diferentes estágios) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP09-P01 ou o caso específico CAP09: Monitorar portfólio com projetos em diferentes estágios"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP09-P01"
---
# SF-CAP09-P01 — CAP09: Monitorar portfólio com projetos em diferentes estágios

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** CAP09 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/overview` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PORT-2026 · 25 projetos sintéticos · P-004 crítico · P-009 CAPEX

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero monitorar portfólio com projetos em diferentes estágios para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PORT-2026 · 25 projetos sintéticos · P-004 crítico · P-009 CAPEX. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Portfolio Dashboard com filtro global
3. Inspecionar distribuição por estado e orçamento dos 25 projetos
4. Entrar no risco do P-004 e voltar ao dashboard
5. Criar pauta executiva com projetos críticos
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Cada projeto aparece uma vez na contagem
- Total por estado reconcilia com 25 referências
- Mudanças financeiras em Planner não são inventadas no portfolio
- Filtro e owner persistem no retorno
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u05. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
