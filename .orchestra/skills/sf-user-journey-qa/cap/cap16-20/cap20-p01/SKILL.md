---
name: sf-user-journey-qa-cap-cap16-20-cap20-p01
description: "QA manutenção SF: executar story SF-CAP20-P01 (CAP20: Projetar posições por competência sem confundir lotação e c) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP20-P01 ou o caso específico CAP20: Projetar posições por competência sem confundir lotação e "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP20-P01"
---
# SF-CAP20-P01 — CAP20: Projetar posições por competência sem confundir lotação e custo

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** HR · **Superfícies:** CAP20 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/headcount` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** HC-SEP-26 · 42 planejados / 40 ocupados / 2 vagas

**Resultado de negócio:** Como HR sintética HR-01, quero projetar posições por competência sem confundir lotação e custo para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: HC-SEP-26 · 42 planejados / 40 ocupados / 2 vagas. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Planner Headcount setembro/2026
3. **[READ_ONLY_WITNESS]** Inspecionar posição VAG-02, rate e centro de custo
4. **[UI_ACTION]** Alterar hipótese de contratação de outubro, não actual de setembro
5. **[READ_ONLY_WITNESS]** Comparar roster e custo mensal
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- FTE não é convertido automaticamente em pessoa distinta
- Outubro reflete apenas hipótese
- Setembro fechado permanece inalterado
- Rate/fonte/moeda visíveis conforme grant de HR
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u08. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
