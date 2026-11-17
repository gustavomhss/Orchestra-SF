---
name: sf-user-journey-qa-cap-cap01-05-cap01-p01
description: "QA manutenção SF: executar story SF-CAP01-P01 (CAP01: Preparar o briefing executivo sem tomar decisões na leitura) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP01-P01 ou o caso específico CAP01: Preparar o briefing executivo sem tomar decisões na leitur"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP01-P01"
---
# SF-CAP01-P01 — CAP01: Preparar o briefing executivo sem tomar decisões na leitura

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** CAP01 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/executive` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero preparar o briefing executivo sem tomar decisões na leitura para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Selecionar competência setembro/2026 e tenant SF-LAB
3. **[UI_ACTION]** Abrir Executive Dashboard e identificar três prioridades com origem explícita
4. **[UI_ACTION]** Entrar no detalhe da prioridade EDI de embarques e retornar mantendo filtros
5. **[UI_ACTION]** Preparar pauta contendo orçamento, risco e decisão de procurement, sem aplicar operações
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Prioridade EDI aparece com fonte e data de atualização
- Forecast mostra USD 590.000 e distingue de budget USD 600.000
- Pauta referencia IDs e revisões originais, sem efeito no orçamento
- Navegação de volta preserva competência e owner
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u02. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
