---
name: sf-user-journey-qa-ui-ui54-58-ui57-p01
description: "QA manutenção SF: executar story SF-UI57-P01 (UI57: Comprovar que uma importação aplicou uma só vez) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI57-P01 ou o caso específico UI57: Comprovar que uma importação aplicou uma só vez"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI57-P01"
---
# SF-UI57-P01 — UI57: Comprovar que uma importação aplicou uma só vez

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI57 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/:manifestId/receipt` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero comprovar que uma importação aplicou uma só vez para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir manifest M1 validado e confirmar Apply
3. **[UI_ACTION]** Observar resposta/receipt e reler Planner
4. **[CONTROLLED_FAULT]** Simular perda de resposta e consultar A1 — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
5. **[READ_ONLY_WITNESS]** Abrir histórico do import e conferir contagem exata
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- One Apply = one atomic business effect
- Recibo reporta 10 linhas aplicáveis ou falha total conforme contrato
- Repetir consulta não duplica efeitos
- Audit identifica actor, digest e versão aplicados
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
