---
name: sf-user-journey-qa-ui-ui34-38-ui36-p01
description: "QA manutenção SF: executar story SF-UI36-P01 (UI36: Registrar premissas e divergências sem inventar consenso) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI36-P01 ou o caso específico UI36: Registrar premissas e divergências sem inventar consenso"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI36-P01"
---
# SF-UI36-P01 — UI36: Registrar premissas e divergências sem inventar consenso

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI36 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/assumptions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** ASM-FX-EDI · taxa EURUSD 1.08 de 2026-09-30

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero registrar premissas e divergências sem inventar consenso para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: ASM-FX-EDI · taxa EURUSD 1.08 de 2026-09-30. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir premissas de CASE-EDI-01
3. **[UI_ACTION]** Adicionar ASM-FX-EDI com justificativa e fonte temporal
4. **[UI_ACTION]** Confrontar divergência de Finance vs Buyer
5. **[READ_ONLY_WITNESS]** Registrar correção/revisão separada
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Premissas são versionadas e referenciáveis
- Divergência continua explícita até resolução humana
- Alterar premissa não reescreve recibo passado
- Fonte/competência de FX permanecem associadas
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u17. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
