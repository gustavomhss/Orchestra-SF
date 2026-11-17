---
name: sf-user-journey-qa-ui-ui49-53-ui50-p01
description: "QA manutenção SF: executar story SF-UI50-P01 (UI50: Entregar slides e documento que reproduzem revisão auditada) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI50-P01 ou o caso específico UI50: Entregar slides e documento que reproduzem revisão auditada"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI50-P01"
---
# SF-UI50-P01 — UI50: Entregar slides e documento que reproduzem revisão auditada

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI50 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/reports/:reviewRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV/R1 · report DOCX/PPTX

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero entregar slides e documento que reproduzem revisão auditada para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: REV-EXEC-NOV/R1 · report DOCX/PPTX. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir relatório de R1 e solicitar DOCX e PPTX
3. **[UI_ACTION]** Aguardar status terminal do job sem tratar started como sucesso
4. **[UI_ACTION]** Baixar arquivo gerado e abrir externamente — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
5. **[READ_ONLY_WITNESS]** Conferir 25 projetos, valores e notas com R1
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Arquivos existem, são legíveis e têm revisão R1 identificada
- Dados e ordem coincidem com snapshot, não com fonte atual
- Links respeitam revogação
- Falhas/timeout deixam status e sem download fantasma
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u33. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
