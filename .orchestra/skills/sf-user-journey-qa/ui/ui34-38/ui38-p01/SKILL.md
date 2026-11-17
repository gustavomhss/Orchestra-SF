---
name: sf-user-journey-qa-ui-ui34-38-ui38-p01
description: "QA manutenção SF: executar story SF-UI38-P01 (UI38: Registrar escolha humana consciente sem executar aplicação) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI38-P01 ou o caso específico UI38: Registrar escolha humana consciente sem executar aplicação"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI38-P01"
---
# SF-UI38-P01 — UI38: Registrar escolha humana consciente sem executar aplicação

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI38 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/choice` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CHOICE-EDI-01 · ALT-B após validação Finance

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero registrar escolha humana consciente sem executar aplicação para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CHOICE-EDI-01 · ALT-B após validação Finance. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Escolha atual em CASE-EDI-01
3. **[READ_ONLY_WITNESS]** Inspecionar alternativas e ressalva de FX
4. **[UI_ACTION]** Selecionar ALT-B com justificativa explícita
5. **[UI_ACTION]** Confirmar que escolha é registrada separadamente de apply
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Escolha aponta para ALT-B e versão das fontes
- Justificativa/autor são auditáveis
- PR-32000 não muda de estágio automaticamente
- Botão de aplicar só habilita com prepared change autorizado
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u17, u18. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
