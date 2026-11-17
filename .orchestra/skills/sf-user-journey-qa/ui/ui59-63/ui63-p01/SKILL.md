---
name: sf-user-journey-qa-ui-ui59-63-ui63-p01
description: "QA manutenção SF: executar story SF-UI63-P01 (UI63: Comparar resultado observado com previsão e aprender sem ree) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI63-P01 ou o caso específico UI63: Comparar resultado observado com previsão e aprender sem re"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI63-P01"
---
# SF-UI63-P01 — UI63: Comparar resultado observado com previsão e aprender sem reescrever história

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** FINANCE · **Superfícies:** UI63 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-memory/outcomes/:selectionRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OUTCOME-EDI-01 · previsão 6 dias · observado 9 dias

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero comparar resultado observado com previsão e aprender sem reescrever história para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: OUTCOME-EDI-01 · previsão 6 dias · observado 9 dias. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Previsto versus observado da decisão CASE-EDI-01
3. Selecionar seleção/receipt versionada
4. Registrar ou conferir observado 9 dias vs previsto 6
5. Inspecionar delta e fontes com período consistente
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Desvio de prazo = +3 dias
- Previsão preservada não é recalculada com observado
- Diferença de unidade e fonte incompleta visíveis
- Lições não concedem aprovação automática futura
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u26. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
