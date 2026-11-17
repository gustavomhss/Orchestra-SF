---
name: sf-user-journey-qa-ui-ui59-63-ui61-p01
description: "QA manutenção SF: executar story SF-UI61-P01 (UI61: Identificar sinal relevante e descartar falso positivo) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI61-P01 ou o caso específico UI61: Identificar sinal relevante e descartar falso positivo"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI61-P01"
---
# SF-UI61-P01 — UI61: Identificar sinal relevante e descartar falso positivo

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI61 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-memory/signals` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SIG-EDI-07 · atraso de 6 dias vs limiar 3

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero identificar sinal relevante e descartar falso positivo para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SIG-EDI-07 · atraso de 6 dias vs limiar 3. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Sinais/materialidade
3. **[UI_ACTION]** Filtrar por risco e período
4. **[READ_ONLY_WITNESS]** Inspecionar SIG-EDI-07 e evidências de origem
5. **[UI_ACTION]** Classificar materialidade e encaminhar para revisão humana
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 6>3 gera sinal material conforme política explícita
- Fonte e limiar são auditáveis
- Sinal não vira decisão automática
- Outros sinais sem fontes não são classificados como certos
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u26. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
